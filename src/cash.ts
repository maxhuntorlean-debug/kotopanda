// Счёт "Касса" в плане счетов — категория считается приходной, если этот счёт у неё в Дт
// (деньги приходят в кассу), и расходной, если в Кт (уходят из кассы).
export const CASH_REGISTER_ACCOUNT = "30";

export type CashCategory = {
	id: number;
	name: string;
	direction: "income" | "expense";
	debit_account: string;
	debit_subconto: string | null;
	credit_account: string;
	credit_subconto: string | null;
};

// У каждой кассы (Котопанда/Елітка) свой независимый список категорий — см. миграцию
// 0028_cash_categories_per_register.sql. Код кассы (register code) совпадает с кодом книги
// Бухгалтерии (Ledger в accounting.ts) — операции этой кассы попадают именно в её книгу.
export type RegisterCode = "kotopanda" | "elitka";

export async function listCashCategories(env: Env, registerCode: RegisterCode): Promise<CashCategory[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, name, direction, debit_account, debit_subconto, credit_account, credit_subconto
		 FROM cash_categories
		 WHERE register_id = (SELECT id FROM cash_registers WHERE code = ?)
		 ORDER BY direction, sort_order`,
	)
		.bind(registerCode)
		.all<CashCategory>();
	return results;
}

export type CashCategoryInput = {
	name: string;
	direction: "income" | "expense";
	debitAccount: string;
	debitSubconto: string | null;
	creditAccount: string;
	creditSubconto: string | null;
};

export async function createCashCategory(env: Env, registerCode: RegisterCode, input: CashCategoryInput): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO cash_categories (register_id, name, direction, debit_account, debit_subconto, credit_account, credit_subconto, sort_order)
		 VALUES (
		 	(SELECT id FROM cash_registers WHERE code = ?), ?, ?, ?, ?, ?, ?,
		 	(SELECT COALESCE(MAX(sort_order), 0) + 10 FROM cash_categories WHERE register_id = (SELECT id FROM cash_registers WHERE code = ?))
		 )`,
	)
		.bind(registerCode, input.name, input.direction, input.debitAccount, input.debitSubconto, input.creditAccount, input.creditSubconto, registerCode)
		.run();
}

export async function updateCashCategory(env: Env, id: number, input: CashCategoryInput): Promise<void> {
	await env.DB.prepare(`UPDATE cash_categories SET name = ?, direction = ?, debit_account = ?, debit_subconto = ?, credit_account = ?, credit_subconto = ? WHERE id = ?`)
		.bind(input.name, input.direction, input.debitAccount, input.debitSubconto, input.creditAccount, input.creditSubconto, id)
		.run();
}

export async function deleteCashCategory(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const used = await env.DB.prepare(`SELECT 1 FROM cash_operations WHERE category_id = ? LIMIT 1`).bind(id).first();
	if (used) return { ok: false, reason: "есть операции с этой категорией" };
	await env.DB.prepare(`DELETE FROM cash_categories WHERE id = ?`).bind(id).run();
	return { ok: true };
}

export type CashDocument = {
	id: number;
	register_id: number;
	doc_date: string;
	opening_balance: number;
	closing_balance: number | null;
	closed_at: string | null;
};

// Возвращает документ дня, создавая его при первом обращении. Остаток на начало
// берётся из фактического остатка (closing_balance) предыдущего закрытого дня —
// как и в реальной кассовой книге, сегодняшнее "на начало" = вчерашнее "на конец".
// Пересчитывается при КАЖДОМ обращении (не только при создании) — если вчерашний день
// потом переоткрыли или поправили, "на начало" сегодня само подтянется на актуальное значение.
export async function getOrCreateDocument(env: Env, registerCode: RegisterCode, dateIso: string): Promise<CashDocument> {
	const register = await env.DB.prepare(`SELECT id FROM cash_registers WHERE code = ?`).bind(registerCode).first<{ id: number }>();
	if (!register) throw new Error(`Касса "${registerCode}" не найдена`);

	const previous = await env.DB.prepare(`SELECT closing_balance FROM cash_documents WHERE register_id = ? AND doc_date < ? ORDER BY doc_date DESC LIMIT 1`)
		.bind(register.id, dateIso)
		.first<{ closing_balance: number | null }>();
	const computedOpening = previous?.closing_balance ?? 0;

	const existing = await env.DB.prepare(`SELECT id, register_id, doc_date, opening_balance, closing_balance, closed_at FROM cash_documents WHERE register_id = ? AND doc_date = ?`)
		.bind(register.id, dateIso)
		.first<CashDocument>();

	if (existing) {
		if (existing.opening_balance !== computedOpening) {
			await env.DB.prepare(`UPDATE cash_documents SET opening_balance = ? WHERE id = ?`).bind(computedOpening, existing.id).run();
			existing.opening_balance = computedOpening;
		}
		return existing;
	}

	const created = await env.DB.prepare(
		`INSERT INTO cash_documents (register_id, doc_date, opening_balance) VALUES (?, ?, ?) RETURNING id, register_id, doc_date, opening_balance, closing_balance, closed_at`,
	)
		.bind(register.id, dateIso, computedOpening)
		.first<CashDocument>();
	if (!created) throw new Error("Не удалось создать кассовый документ");

	return created;
}

export async function documentExists(env: Env, registerCode: RegisterCode, dateIso: string): Promise<boolean> {
	const row = await env.DB.prepare(`SELECT 1 FROM cash_documents d JOIN cash_registers r ON r.id = d.register_id WHERE r.code = ? AND d.doc_date = ?`)
		.bind(registerCode, dateIso)
		.first();
	return !!row;
}

export type CashOperation = {
	id: number;
	direction: "in" | "out";
	amount: number;
	comment: string | null;
	subconto: string | null;
	category_id: number;
	category_name: string;
	created_at: string;
};

export async function getOperations(env: Env, documentId: number): Promise<CashOperation[]> {
	const { results } = await env.DB.prepare(
		`SELECT o.id, o.direction, o.amount, o.comment, o.subconto, o.category_id, o.created_at, c.name AS category_name
		 FROM cash_operations o
		 JOIN cash_categories c ON c.id = o.category_id
		 WHERE o.cash_document_id = ?
		 ORDER BY o.created_at ASC, o.id ASC`,
	)
		.bind(documentId)
		.all<CashOperation>();
	return results;
}

// subconto — только для категорий, у которых сторона-контрагент оставлена без субконто
// (например, "Оплата поставщику": сам поставщик каждый раз разный, не фиксирован на категории).
export async function addOperation(env: Env, documentId: number, categoryId: number, amount: number, comment: string | null, subconto: string | null): Promise<void> {
	const category = await env.DB.prepare(`SELECT direction FROM cash_categories WHERE id = ?`).bind(categoryId).first<{ direction: "income" | "expense" }>();
	if (!category) throw new Error("Категория не найдена");

	const direction = category.direction === "income" ? "in" : "out";

	await env.DB.prepare(`INSERT INTO cash_operations (cash_document_id, direction, amount, category_id, comment, subconto) VALUES (?, ?, ?, ?, ?, ?)`)
		.bind(documentId, direction, amount, categoryId, comment, subconto)
		.run();
}

export async function updateOperation(env: Env, id: number, categoryId: number, amount: number, comment: string | null, subconto: string | null): Promise<void> {
	const category = await env.DB.prepare(`SELECT direction FROM cash_categories WHERE id = ?`).bind(categoryId).first<{ direction: "income" | "expense" }>();
	if (!category) throw new Error("Категория не найдена");

	const direction = category.direction === "income" ? "in" : "out";

	await env.DB.prepare(`UPDATE cash_operations SET category_id = ?, direction = ?, amount = ?, comment = ?, subconto = ? WHERE id = ?`)
		.bind(categoryId, direction, amount, comment, subconto, id)
		.run();
}

export async function deleteOperation(env: Env, id: number): Promise<void> {
	await env.DB.prepare(`DELETE FROM cash_operations WHERE id = ?`).bind(id).run();
}

// Закрытый день заблокирован для правок — проверяем перед удалением операции
// (перед добавлением новой достаточно уже загруженного CashDocument.closed_at).
export async function isOperationDocumentClosed(env: Env, operationId: number): Promise<boolean> {
	const row = await env.DB.prepare(
		`SELECT d.closed_at FROM cash_operations o JOIN cash_documents d ON d.id = o.cash_document_id WHERE o.id = ?`,
	)
		.bind(operationId)
		.first<{ closed_at: string | null }>();
	return row ? row.closed_at !== null : false;
}

// Закрытие дня — без ручного ввода "фактического" остатка: он и так виден по кнопке
// "Остатки" (считается из Бухгалтерии), вводить его повторно тут нет смысла.
export async function closeDocument(env: Env, documentId: number): Promise<void> {
	await env.DB.prepare(`UPDATE cash_documents SET closed_at = datetime('now') WHERE id = ?`).bind(documentId).run();
}

export async function reopenDocument(env: Env, documentId: number): Promise<void> {
	await env.DB.prepare(`UPDATE cash_documents SET closing_balance = NULL, closed_at = NULL WHERE id = ?`).bind(documentId).run();
}

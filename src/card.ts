import * as XLSX from "xlsx";

type ParsedRow = {
	operationDate: string; // YYYY-MM-DD
	operationTime: string; // HH:MM:SS
	direction: "in" | "out";
	amount: number;
	bankCategory: string | null;
	description: string | null;
	balanceAfter: number | null;
	cardMask: string | null;
};

function ddmmyyyyToIso(d: string): string {
	const [day, month, year] = d.split(".");
	return `${year}-${month}-${day}`;
}

// Разбирает выписку с картки (формат: Дата | Категорія | Картка | Опис операції |
// Сума в валюті картки | Валюта картки | Сума в валюті транзакції | Валюта транзакції |
// Залишок на кінець періоду | Валюта залишку). Берём сумму и остаток именно "в валюті картки" —
// они уже в гривне, даже если сама операция была в другой валюте.
export function parseCardWorkbook(buffer: ArrayBuffer): ParsedRow[] {
	const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
	const sheet = workbook.Sheets[workbook.SheetNames[0]];
	const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null, raw: true });

	const headerIndex = rows.findIndex((r) => String(r?.[0] ?? "").trim() === "Дата");
	if (headerIndex === -1) {
		throw new Error('Не найдена строка заголовка (столбец "Дата") — формат файла не распознан');
	}

	const parsed: ParsedRow[] = [];

	for (let i = headerIndex + 1; i < rows.length; i++) {
		const row = rows[i];
		const dateTimeRaw = row?.[0];
		if (!dateTimeRaw) continue;

		const dateTime = String(dateTimeRaw).trim();
		const [datePart, timePart] = dateTime.split(" ");
		if (!datePart || !/^\d{2}\.\d{2}\.\d{4}$/.test(datePart)) continue;

		const amountRaw = row[4];
		if (amountRaw === null || amountRaw === undefined || amountRaw === "") continue;
		const amount = Number(amountRaw);
		if (!Number.isFinite(amount) || amount === 0) continue;

		const balanceRaw = row[8];
		const balanceAfter = balanceRaw !== null && balanceRaw !== undefined && balanceRaw !== "" ? Number(balanceRaw) : null;

		parsed.push({
			operationDate: ddmmyyyyToIso(datePart),
			operationTime: timePart ?? "00:00:00",
			direction: amount >= 0 ? "in" : "out",
			amount: Math.abs(amount),
			bankCategory: row[1] ? String(row[1]) : null,
			cardMask: row[2] ? String(row[2]) : null,
			description: row[3] ? String(row[3]) : null,
			balanceAfter: balanceAfter !== null && Number.isFinite(balanceAfter) ? balanceAfter : null,
		});
	}

	return parsed;
}

async function findOrCreateAccount(env: Env, cardMask: string | null): Promise<number> {
	const mask = cardMask ?? "Универсальная карта";

	const existing = await env.DB.prepare(`SELECT id FROM card_accounts WHERE card_mask = ?`).bind(mask).first<{ id: number }>();
	if (existing) return existing.id;

	const created = await env.DB.prepare(`INSERT INTO card_accounts (name, card_mask) VALUES (?, ?) RETURNING id`)
		.bind(mask, mask)
		.first<{ id: number }>();
	if (!created) throw new Error("Не удалось создать карту");
	return created.id;
}

export type ImportResult = { total: number; added: number };

export async function importCardStatement(env: Env, buffer: ArrayBuffer): Promise<ImportResult> {
	const rows = parseCardWorkbook(buffer);
	if (rows.length === 0) return { total: 0, added: 0 };

	const accountId = await findOrCreateAccount(env, rows.find((r) => r.cardMask)?.cardMask ?? null);

	const statements = rows.map((r) =>
		env.DB.prepare(
			`INSERT INTO card_transactions (account_id, operation_date, operation_time, direction, amount, bank_category, description, balance_after)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(account_id, operation_date, operation_time, direction, amount, description) DO NOTHING`,
		).bind(accountId, r.operationDate, r.operationTime, r.direction, r.amount, r.bankCategory, r.description, r.balanceAfter),
	);

	const results = await env.DB.batch(statements);
	const added = results.reduce((sum, res) => sum + (res.meta.changes ?? 0), 0);

	return { total: rows.length, added };
}

export type CardAccount = { id: number; name: string; card_mask: string | null };

export async function getAccount(env: Env): Promise<CardAccount | null> {
	return env.DB.prepare(`SELECT id, name, card_mask FROM card_accounts ORDER BY id LIMIT 1`).first<CardAccount>();
}

// Счёт 31 в плане счетов — тот же, что и у Приватбанка, но карта отличается своим субконто
// (card_accounts.posting_subconto, настраивается в Настройках).
export const CARD_ACCOUNT = "31";

export type PostingCategoryRow = {
	id: number;
	name: string;
	direction: "income" | "expense";
	debit_account: string;
	debit_subconto: string | null;
	credit_account: string;
	credit_subconto: string | null;
};

export async function listPostingCategories(env: Env): Promise<PostingCategoryRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, name, direction, debit_account, debit_subconto, credit_account, credit_subconto FROM posting_categories ORDER BY sort_order`,
	).all<PostingCategoryRow>();
	return results;
}

export async function getPostingCategory(env: Env, id: number): Promise<PostingCategoryRow | null> {
	return env.DB.prepare(`SELECT id, name, direction, debit_account, debit_subconto, credit_account, credit_subconto FROM posting_categories WHERE id = ?`)
		.bind(id)
		.first<PostingCategoryRow>();
}

export type PostingCategoryInput = {
	name: string;
	debitAccount: string;
	debitSubconto: string | null;
	creditAccount: string;
	creditSubconto: string | null;
};

// direction больше не вводится вручную — в отличие от кассы, у карты нет сценария вроде
// "Съём" (перевод между двумя своими кассами по одному счёту): ровно одна сторона категории
// всегда 31 (карта), поэтому Приход/Расход однозначно следует из того, на какой она стороне.
// direction остаётся в БД только для группировки Приход/Расход в выпадашке разноски на вкладке "Операции".
function deriveDirection(input: PostingCategoryInput): "income" | "expense" {
	return input.debitAccount === CARD_ACCOUNT ? "income" : "expense";
}

export async function createPostingCategory(env: Env, input: PostingCategoryInput): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO posting_categories (name, direction, debit_account, debit_subconto, credit_account, credit_subconto, sort_order)
		 VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM posting_categories))`,
	)
		.bind(input.name, deriveDirection(input), input.debitAccount, input.debitSubconto, input.creditAccount, input.creditSubconto)
		.run();
}

export async function updatePostingCategory(env: Env, id: number, input: PostingCategoryInput): Promise<void> {
	await env.DB.prepare(`UPDATE posting_categories SET name = ?, direction = ?, debit_account = ?, debit_subconto = ?, credit_account = ?, credit_subconto = ? WHERE id = ?`)
		.bind(input.name, deriveDirection(input), input.debitAccount, input.debitSubconto, input.creditAccount, input.creditSubconto, id)
		.run();
}

export async function deletePostingCategory(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const used = await env.DB.prepare(`SELECT 1 FROM card_transactions WHERE posting_category_id = ? LIMIT 1`).bind(id).first();
	if (used) return { ok: false, reason: "есть операции с этой категорией" };
	await env.DB.prepare(`DELETE FROM posting_categories WHERE id = ?`).bind(id).run();
	return { ok: true };
}

export type CardTxRow = {
	id: number;
	operation_date: string;
	operation_time: string;
	direction: "in" | "out";
	amount: number;
	bank_category: string | null;
	description: string | null;
	posting_category_id: number | null;
	posting_name: string | null;
	subconto: string | null;
};

export async function listTransactions(env: Env, accountId: number, from: string, to: string): Promise<CardTxRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT t.id, t.operation_date, t.operation_time, t.direction, t.amount, t.bank_category, t.description,
			t.posting_category_id, c.name AS posting_name, t.subconto
		 FROM card_transactions t
		 LEFT JOIN posting_categories c ON c.id = t.posting_category_id
		 WHERE t.account_id = ? AND t.operation_date BETWEEN ? AND ?
		 ORDER BY t.operation_date DESC, t.operation_time DESC, t.id DESC`,
	)
		.bind(accountId, from, to)
		.all<CardTxRow>();
	return results;
}

// Баланс на начало периода = остаток сразу после последней операции ДО периода.
// Баланс на конец периода = остаток после последней операции В периоде (или, если в
// периоде операций нет, всё тот же баланс "на начало" — он не менялся).
export async function balanceBefore(env: Env, accountId: number, dateIso: string): Promise<number> {
	const row = await env.DB.prepare(
		`SELECT balance_after FROM card_transactions WHERE account_id = ? AND operation_date < ? ORDER BY operation_date DESC, operation_time DESC, id DESC LIMIT 1`,
	)
		.bind(accountId, dateIso)
		.first<{ balance_after: number | null }>();
	return row?.balance_after ?? 0;
}

export async function balanceAtEndOf(env: Env, accountId: number, dateIso: string): Promise<number> {
	const row = await env.DB.prepare(
		`SELECT balance_after FROM card_transactions WHERE account_id = ? AND operation_date <= ? ORDER BY operation_date DESC, operation_time DESC, id DESC LIMIT 1`,
	)
		.bind(accountId, dateIso)
		.first<{ balance_after: number | null }>();
	if (row?.balance_after != null) return row.balance_after;
	return balanceBefore(env, accountId, dateIso);
}


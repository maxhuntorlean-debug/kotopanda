import { listChartAccountsTest, type ChartAccountTest } from "./chartOfAccountsTest";
import { listTestRefItems } from "./referencesTest";
import { getTestAccountCard } from "./operationDocumentTest";
import { isoToDisplay } from "./format";

// Тот же счёт "Касса", что и в боевом плане счетов (см. CASH_REGISTER_ACCOUNT в cash.ts) —
// в тестовом плане счетов (test_chart_of_accounts, migrations/0034) код тот же, "30".
export const TEST_CASH_REGISTER_ACCOUNT = "30";

// На счёте 30 в тестовой базе несколько субконто (test_cash_boxes: "Касса Максима"/"Касса Лена"/
// "Касса ОТДЕЛА" — по факту три разных физических кассы под одним счётом), а не одна касса —
// поэтому остаток "по всему счёту 30" (без фильтра по субконто) складывает их все вместе. В бою
// это исключено тем же приёмом: у каждого регистра свой posting_subconto (см. cash_registers,
// getRegisterLedgerBalance в pages/cash.ts) — сейчас у обоих боевых регистров (Котопанда/Елітка)
// он один и тот же, "Касса ОТДЕЛА". Тестовая касса привязана к тому же субконто, чтобы Остатки
// значили то же самое, что и в боевой.
const TEST_CASH_REGISTER_SUBCONTO_NAME = "Касса ОТДЕЛА";

export async function resolveTestCashRegisterSubconto(env: Env): Promise<number | null> {
	const boxes = await listTestRefItems(env, "cashBoxes");
	const found = boxes.find((b) => b.name === TEST_CASH_REGISTER_SUBCONTO_NAME);
	return found ? found.id : null;
}

export async function getTestCashRegisterBalance(env: Env, firmId: number, date: string): Promise<{ openingBalance: number; closingBalance: number }> {
	const subcontoId = await resolveTestCashRegisterSubconto(env);
	const { openingBalance, closingBalance } = await getTestAccountCard(env, firmId, TEST_CASH_REGISTER_ACCOUNT, subcontoId, date, date);
	return { openingBalance, closingBalance };
}

export type TestCashCategory = {
	id: number;
	firmId: number;
	name: string;
	direction: "income" | "expense";
	debitAccount: string;
	debitSubcontoId: number | null;
	creditAccount: string;
	creditSubcontoId: number | null;
};

type CategoryRow = {
	id: number;
	firm_id: number;
	name: string;
	direction: "income" | "expense";
	debit_account: string;
	debit_subconto_id: number | null;
	credit_account: string;
	credit_subconto_id: number | null;
};

function mapCategory(r: CategoryRow): TestCashCategory {
	return {
		id: r.id,
		firmId: r.firm_id,
		name: r.name,
		direction: r.direction,
		debitAccount: r.debit_account,
		debitSubcontoId: r.debit_subconto_id,
		creditAccount: r.credit_account,
		creditSubcontoId: r.credit_subconto_id,
	};
}

export async function listTestCashCategories(env: Env, firmId: number): Promise<TestCashCategory[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, firm_id, name, direction, debit_account, debit_subconto_id, credit_account, credit_subconto_id
		 FROM test_cash_categories WHERE firm_id = ? ORDER BY direction, sort_order`,
	)
		.bind(firmId)
		.all<CategoryRow>();
	return results.map(mapCategory);
}

async function getTestCashCategoryById(env: Env, id: number): Promise<TestCashCategory | null> {
	const row = await env.DB.prepare(
		`SELECT id, firm_id, name, direction, debit_account, debit_subconto_id, credit_account, credit_subconto_id
		 FROM test_cash_categories WHERE id = ?`,
	)
		.bind(id)
		.first<CategoryRow>();
	return row ? mapCategory(row) : null;
}

export type TestCashCategoryInput = {
	name: string;
	direction: "income" | "expense";
	debitAccount: string;
	debitSubcontoId: number | null;
	creditAccount: string;
	creditSubcontoId: number | null;
};

export async function createTestCashCategory(env: Env, firmId: number, input: TestCashCategoryInput): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO test_cash_categories (firm_id, name, direction, debit_account, debit_subconto_id, credit_account, credit_subconto_id, sort_order)
		 VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM test_cash_categories WHERE firm_id = ?))`,
	)
		.bind(firmId, input.name, input.direction, input.debitAccount, input.debitSubcontoId, input.creditAccount, input.creditSubcontoId, firmId)
		.run();
}

export async function updateTestCashCategory(env: Env, id: number, input: TestCashCategoryInput): Promise<void> {
	await env.DB.prepare(
		`UPDATE test_cash_categories SET name = ?, direction = ?, debit_account = ?, debit_subconto_id = ?, credit_account = ?, credit_subconto_id = ? WHERE id = ?`,
	)
		.bind(input.name, input.direction, input.debitAccount, input.debitSubcontoId, input.creditAccount, input.creditSubcontoId, id)
		.run();
}

export async function deleteTestCashCategory(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const used = await env.DB.prepare(`SELECT 1 FROM test_journal WHERE category_id = ? LIMIT 1`).bind(id).first();
	if (used) return { ok: false, reason: "есть операции с этой категорией" };
	await env.DB.prepare(`DELETE FROM test_cash_categories WHERE id = ?`).bind(id).run();
	return { ok: true };
}

// "Свободная" сторона категории — та, что не "30" и у которой на самой категории субконто не
// зафиксирован, но счёт всё же привязан к справочнику: конкретное значение выбирается на каждой
// операции заново (аналог subcontoNeedOf в pages/cash.ts, только возвращает саму сторону, а не
// список вариантов — им уже ведает accountSubcontoOptions в TestSubcontoContext).
function testCashFreeSide(category: TestCashCategory, accounts: ChartAccountTest[]): "debit" | "credit" | null {
	const sides: { side: "debit" | "credit"; account: string; subcontoId: number | null }[] = [
		{ side: "credit", account: category.creditAccount, subcontoId: category.creditSubcontoId },
		{ side: "debit", account: category.debitAccount, subcontoId: category.debitSubcontoId },
	];
	for (const s of sides) {
		if (s.account === TEST_CASH_REGISTER_ACCOUNT || s.subcontoId !== null) continue;
		const acc = accounts.find((a) => a.code === s.account);
		if (acc?.refKind) return s.side;
	}
	return null;
}

export type TestCashDocument = { id: number; docDate: string; closedAt: string | null };

// Документ дня — как getOrCreateDocument в cash.ts: обращение к дню создаёт документ при первом
// заходе (doc_type='cash', см. migrations/0036/0041). Остаток дня считается на лету через
// getTestAccountCard (не хранится в документе, в отличие от боевой cash_documents.opening_balance) —
// а вот закрытие дня (closed_at, см. migrations/0042) хранится, как и в боевой кассе.
export async function getOrCreateTestCashDocument(env: Env, firmId: number, dateIso: string): Promise<TestCashDocument> {
	const existing = await env.DB.prepare(`SELECT id, doc_date, closed_at FROM test_documents WHERE firm_id = ? AND doc_type = 'cash' AND doc_date = ?`)
		.bind(firmId, dateIso)
		.first<{ id: number; doc_date: string; closed_at: string | null }>();
	if (existing) return { id: existing.id, docDate: existing.doc_date, closedAt: existing.closed_at };

	const created = await env.DB.prepare(`INSERT INTO test_documents (doc_type, doc_date, description, firm_id) VALUES ('cash', ?, ?, ?) RETURNING id, doc_date, closed_at`)
		.bind(dateIso, `Касса за ${isoToDisplay(dateIso)}`, firmId)
		.first<{ id: number; doc_date: string; closed_at: string | null }>();
	if (!created) throw new Error("Не удалось создать документ кассы");
	return { id: created.id, docDate: created.doc_date, closedAt: created.closed_at };
}

export async function closeTestCashDocument(env: Env, documentId: number): Promise<void> {
	await env.DB.prepare(`UPDATE test_documents SET closed_at = datetime('now') WHERE id = ?`).bind(documentId).run();
}

export async function reopenTestCashDocument(env: Env, documentId: number): Promise<void> {
	await env.DB.prepare(`UPDATE test_documents SET closed_at = NULL WHERE id = ?`).bind(documentId).run();
}

// Проверка перед правкой/удалением ОТДЕЛЬНОЙ операции (в отличие от документа, id которого на
// строке добавления/кнопках уже есть) — аналог isOperationDocumentClosed в cash.ts.
export async function isTestCashOperationDocumentClosed(env: Env, journalId: number): Promise<boolean> {
	const row = await env.DB.prepare(`SELECT d.closed_at FROM test_journal j JOIN test_documents d ON d.id = j.document_id WHERE j.id = ?`)
		.bind(journalId)
		.first<{ closed_at: string | null }>();
	return row ? row.closed_at !== null : false;
}

export type TestCashOperation = {
	id: number;
	direction: "income" | "expense";
	amount: number;
	comment: string | null;
	categoryId: number;
	categoryName: string;
	// Значение "свободной" стороны категории на этой конкретной операции (см. testCashFreeSide) —
	// null, если у категории обе стороны либо "30", либо с зафиксированным субконто. subcontoAccount —
	// счёт этой стороны, нужен странице, чтобы резолвить id в имя через resolveSubcontoName.
	subcontoId: number | null;
	subcontoAccount: string | null;
};

export async function listTestCashOperations(env: Env, documentId: number): Promise<TestCashOperation[]> {
	const { results } = await env.DB.prepare(
		`SELECT j.id, j.amount, j.comment, j.category_id, c.name AS category_name, c.direction,
		        j.debit_account, j.debit_subconto_id, j.credit_account, j.credit_subconto_id,
		        c.debit_subconto_id AS cat_debit_subconto_id, c.credit_subconto_id AS cat_credit_subconto_id
		 FROM test_journal j
		 JOIN test_cash_categories c ON c.id = j.category_id
		 WHERE j.document_id = ?
		 ORDER BY j.id`,
	)
		.bind(documentId)
		.all<{
			id: number;
			amount: number;
			comment: string | null;
			category_id: number;
			category_name: string;
			direction: "income" | "expense";
			debit_account: string;
			debit_subconto_id: number | null;
			credit_account: string;
			credit_subconto_id: number | null;
			cat_debit_subconto_id: number | null;
			cat_credit_subconto_id: number | null;
		}>();

	return results.map((r) => {
		const debitFree = r.cat_debit_subconto_id === null && r.debit_account !== TEST_CASH_REGISTER_ACCOUNT;
		const creditFree = r.cat_credit_subconto_id === null && r.credit_account !== TEST_CASH_REGISTER_ACCOUNT;
		const subcontoId = debitFree ? r.debit_subconto_id : creditFree ? r.credit_subconto_id : null;
		const subcontoAccount = debitFree ? r.debit_account : creditFree ? r.credit_account : null;
		return {
			id: r.id,
			direction: r.direction,
			amount: r.amount,
			comment: r.comment,
			categoryId: r.category_id,
			categoryName: r.category_name,
			subcontoId,
			subcontoAccount,
		};
	});
}

export async function addTestCashOperation(env: Env, firmId: number, dateIso: string, categoryId: number, subcontoId: number | null, amount: number, comment: string | null): Promise<void> {
	const category = await getTestCashCategoryById(env, categoryId);
	if (!category) throw new Error("Категория не найдена");
	const accounts = await listChartAccountsTest(env);
	const side = testCashFreeSide(category, accounts);
	const doc = await getOrCreateTestCashDocument(env, firmId, dateIso);

	const debitSubcontoId = side === "debit" ? subcontoId : category.debitSubcontoId;
	const creditSubcontoId = side === "credit" ? subcontoId : category.creditSubcontoId;

	await env.DB.prepare(
		`INSERT INTO test_journal (document_id, firm_id, entry_date, debit_account, debit_subconto_id, credit_account, credit_subconto_id, amount, comment, category_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(doc.id, firmId, dateIso, category.debitAccount, debitSubcontoId, category.creditAccount, creditSubcontoId, amount, comment, categoryId)
		.run();
}

export async function updateTestCashOperation(env: Env, journalId: number, categoryId: number, subcontoId: number | null, amount: number, comment: string | null): Promise<void> {
	const category = await getTestCashCategoryById(env, categoryId);
	if (!category) throw new Error("Категория не найдена");
	const accounts = await listChartAccountsTest(env);
	const side = testCashFreeSide(category, accounts);

	const debitSubcontoId = side === "debit" ? subcontoId : category.debitSubcontoId;
	const creditSubcontoId = side === "credit" ? subcontoId : category.creditSubcontoId;

	await env.DB.prepare(
		`UPDATE test_journal SET category_id = ?, debit_account = ?, debit_subconto_id = ?, credit_account = ?, credit_subconto_id = ?, amount = ?, comment = ? WHERE id = ?`,
	)
		.bind(categoryId, category.debitAccount, debitSubcontoId, category.creditAccount, creditSubcontoId, amount, comment, journalId)
		.run();
}

export async function deleteTestCashOperation(env: Env, journalId: number): Promise<void> {
	await env.DB.prepare(`DELETE FROM test_journal WHERE id = ?`).bind(journalId).run();
}

export type CategoriesByDirection = { income: { id: number; name: string }[]; expense: { id: number; name: string }[] };

export function testCashCategoriesByDirection(categories: TestCashCategory[]): CategoriesByDirection {
	return {
		income: categories.filter((c) => c.direction === "income").map((c) => ({ id: c.id, name: c.name })),
		expense: categories.filter((c) => c.direction === "expense").map((c) => ({ id: c.id, name: c.name })),
	};
}

// Для каждой категории, у которой есть "свободная" сторона (см. testCashFreeSide) — список
// вариантов субконто для неё (те же TestSubcontoOption, что и в accountSubcontoOptions контекста
// Операции), чтобы отрисовать select на строке добавления/редактирования операции.
export function testCashCategorySubcontoOptions(
	categories: TestCashCategory[],
	accounts: ChartAccountTest[],
	accountSubcontoOptions: Record<string, { id: number; name: string }[]>,
): Record<number, { id: number; name: string }[]> {
	const result: Record<number, { id: number; name: string }[]> = {};
	for (const c of categories) {
		const side = testCashFreeSide(c, accounts);
		if (!side) continue;
		const account = side === "debit" ? c.debitAccount : c.creditAccount;
		const options = accountSubcontoOptions[account];
		if (options) result[c.id] = options;
	}
	return result;
}

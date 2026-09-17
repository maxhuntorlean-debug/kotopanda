// Данные для "Справочники тест" — песочница поверх test_* таблиц (см. migrations/0033, 0035),
// не связана с боевыми own_accounts/cash_boxes/counterparties/expense_items/employees/
// other_operations. У всех семи тестовых таблиц одинаковая форма (id/name/sort_order),
// поэтому CRUD написан один раз и параметризован именем таблицы, а не продублирован 7 раз.

export type TestRefKind = "ownAccounts" | "cashBoxes" | "suppliers" | "expenseItems" | "employees" | "otherOperations" | "firms";

export type TestRefItem = { id: number; name: string };

const TABLE_BY_KIND: Record<TestRefKind, string> = {
	ownAccounts: "test_own_accounts",
	cashBoxes: "test_cash_boxes",
	suppliers: "test_suppliers",
	expenseItems: "test_expense_items",
	employees: "test_employees",
	otherOperations: "test_other_operations",
	firms: "test_firms",
};

// TABLE_BY_KIND — фиксированный enum, не пользовательский ввод, так что подстановка имени
// таблицы в SQL-текст (D1 не умеет параметризовать идентификаторы) здесь безопасна.
export async function listTestRefItems(env: Env, kind: TestRefKind): Promise<TestRefItem[]> {
	const table = TABLE_BY_KIND[kind];
	const { results } = await env.DB.prepare(`SELECT id, name FROM ${table} ORDER BY sort_order`).all<TestRefItem>();
	return results;
}

export async function createTestRefItem(env: Env, kind: TestRefKind, name: string): Promise<void> {
	const table = TABLE_BY_KIND[kind];
	await env.DB.prepare(`INSERT INTO ${table} (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM ${table}))`).bind(name).run();
}

export async function renameTestRefItem(env: Env, kind: TestRefKind, id: number, name: string): Promise<void> {
	const table = TABLE_BY_KIND[kind];
	await env.DB.prepare(`UPDATE ${table} SET name = ? WHERE id = ?`).bind(name, id).run();
}

export async function deleteTestRefItem(env: Env, kind: TestRefKind, id: number): Promise<void> {
	const table = TABLE_BY_KIND[kind];
	await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}

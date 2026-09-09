// Журнал операций = ручные проводки (journal_entries) + разнесённые операции банка
// (bank_transactions.posting_account) — там уже указан один из сторон, вторая всегда
// counter 31 (банк). Справочники (own_accounts, cash_boxes, expense_items) — просто
// именованные списки, не привязанные к плану счетов; используются как подсказки (субконто)
// при ручном вводе проводки.

import { addDaysIso } from "./format";
import { CASH_REGISTER_ACCOUNT } from "./cash";

export const SOURCE_ACCOUNT_BANK = "31";

// Два разных бизнеса (Котопанда и Элитка) ведут отдельные книги проводок на одном плане
// счетов и одних и тех же справочниках. У Элитки пока нет своих банка/кассы/карты — её
// журнал состоит только из ручных проводок (см. listJournalEntries).
export type Ledger = "kotopanda" | "elitka";

export const LEDGERS: { id: Ledger; label: string }[] = [
	{ id: "kotopanda", label: "Бухгалтерия Котопанда" },
	{ id: "elitka", label: "Бухгалтерия Элитка" },
];

export type Entry = {
	debitAccount: string;
	debitSubconto: string | null;
	creditAccount: string;
	creditSubconto: string | null;
};

export function entryLabel(e: Entry): string {
	const debit = e.debitSubconto ? `${e.debitAccount}/${e.debitSubconto}` : e.debitAccount;
	const credit = e.creditSubconto ? `${e.creditAccount}/${e.creditSubconto}` : e.creditAccount;
	return `Дт${debit} · Кт${credit}`;
}

// Справочник, субконто которого подставляется при вводе проводки для этого счёта.
export type ReferenceKind = "accounts" | "cashBoxes" | "suppliers" | "expenses" | "employees" | "otherOperations";

export type ChartAccount = { code: string; name: string; refKind: ReferenceKind | null };

// Захардкоженный план счетов — просто справочная таблица (код -> название), плюс привязка
// части счетов к нашим справочникам для подсказок субконто. Ничего не считает, не хранится в БД.
export const CHART_OF_ACCOUNTS: ChartAccount[] = [
	{ code: "00", name: "Вспомогательный счет для ввода остатков", refKind: null },
	{ code: "10", name: "ОС", refKind: null },
	{ code: "28", name: "Товар", refKind: null },
	{ code: "30", name: "Касса", refKind: "cashBoxes" },
	{ code: "31", name: "Расчетный счет", refKind: "accounts" },
	{ code: "33", name: "Деньги в пути", refKind: "accounts" },
	{ code: "36", name: "Авансы", refKind: null },
	{ code: "40", name: "Уставной фонд", refKind: null },
	{ code: "44", name: "Прибыль", refKind: null },
	{ code: "46", name: "Расчеты с участниками", refKind: null },
	{ code: "63", name: "Поставщики", refKind: "suppliers" },
	{ code: "66", name: "Зарплата", refKind: "employees" },
	{ code: "68", name: "Прочие операции", refKind: "otherOperations" },
	{ code: "70", name: "Доход от реализации", refKind: null },
	{ code: "71", name: "Прочий доход", refKind: null },
	{ code: "79", name: "Финансовый результат", refKind: null },
	{ code: "90", name: "Себестоимость", refKind: null },
	{ code: "92", name: "Административные расходы", refKind: "expenses" },
];

export const REFERENCE_PAGE_PATH: Record<ReferenceKind, string> = {
	accounts: "/references/accounts",
	cashBoxes: "/references/cash-boxes",
	suppliers: "/references/suppliers",
	expenses: "/references/expenses",
	employees: "/references/employees",
	otherOperations: "/references/other-operations",
};

// Проверка перед удалением справочной записи — если её название встречается как субконто
// хоть в одной проводке, удалять нельзя (эти справочники не связаны FK-ключом с journal_entries,
// субконто там — просто текст, поэтому сверяем по названию).
export async function isNameUsedInEntries(env: Env, name: string): Promise<boolean> {
	const row = await env.DB.prepare(`SELECT 1 FROM journal_entries WHERE debit_subconto = ? OR credit_subconto = ? LIMIT 1`).bind(name, name).first();
	return !!row;
}

export type OwnAccount = { id: number; name: string };

export async function listOwnAccounts(env: Env): Promise<OwnAccount[]> {
	const { results } = await env.DB.prepare(`SELECT id, name FROM own_accounts ORDER BY sort_order`).all<OwnAccount>();
	return results;
}

export async function createOwnAccount(env: Env, name: string): Promise<void> {
	await env.DB.prepare(`INSERT INTO own_accounts (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM own_accounts))`).bind(name).run();
}

export async function renameOwnAccount(env: Env, id: number, name: string): Promise<void> {
	await env.DB.prepare(`UPDATE own_accounts SET name = ? WHERE id = ?`).bind(name, id).run();
}

export async function deleteOwnAccount(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const row = await env.DB.prepare(`SELECT name FROM own_accounts WHERE id = ?`).bind(id).first<{ name: string }>();
	if (!row) return { ok: true };
	if (await isNameUsedInEntries(env, row.name)) return { ok: false, reason: "есть проводки с таким субконто" };
	await env.DB.prepare(`DELETE FROM own_accounts WHERE id = ?`).bind(id).run();
	return { ok: true };
}

export type CashBox = { id: number; name: string };

export async function listCashBoxes(env: Env): Promise<CashBox[]> {
	const { results } = await env.DB.prepare(`SELECT id, name FROM cash_boxes ORDER BY sort_order`).all<CashBox>();
	return results;
}

export async function createCashBox(env: Env, name: string): Promise<void> {
	await env.DB.prepare(`INSERT INTO cash_boxes (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM cash_boxes))`).bind(name).run();
}

export async function renameCashBox(env: Env, id: number, name: string): Promise<void> {
	await env.DB.prepare(`UPDATE cash_boxes SET name = ? WHERE id = ?`).bind(name, id).run();
}

export async function deleteCashBox(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const row = await env.DB.prepare(`SELECT name FROM cash_boxes WHERE id = ?`).bind(id).first<{ name: string }>();
	if (!row) return { ok: true };
	if (await isNameUsedInEntries(env, row.name)) return { ok: false, reason: "есть проводки с таким субконто" };
	await env.DB.prepare(`DELETE FROM cash_boxes WHERE id = ?`).bind(id).run();
	return { ok: true };
}

export type ExpenseItem = { id: number; name: string };

export async function listExpenseItems(env: Env): Promise<ExpenseItem[]> {
	const { results } = await env.DB.prepare(`SELECT id, name FROM expense_items ORDER BY sort_order`).all<ExpenseItem>();
	return results;
}

export async function createExpenseItem(env: Env, name: string): Promise<void> {
	await env.DB.prepare(`INSERT INTO expense_items (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM expense_items))`).bind(name).run();
}

export async function renameExpenseItem(env: Env, id: number, name: string): Promise<void> {
	await env.DB.prepare(`UPDATE expense_items SET name = ? WHERE id = ?`).bind(name, id).run();
}

export async function deleteExpenseItem(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const row = await env.DB.prepare(`SELECT name FROM expense_items WHERE id = ?`).bind(id).first<{ name: string }>();
	if (!row) return { ok: true };
	if (await isNameUsedInEntries(env, row.name)) return { ok: false, reason: "есть проводки с таким субконто" };
	await env.DB.prepare(`DELETE FROM expense_items WHERE id = ?`).bind(id).run();
	return { ok: true };
}

export type Employee = { id: number; name: string };

export async function listEmployees(env: Env): Promise<Employee[]> {
	const { results } = await env.DB.prepare(`SELECT id, name FROM employees ORDER BY sort_order`).all<Employee>();
	return results;
}

export async function createEmployee(env: Env, name: string): Promise<void> {
	await env.DB.prepare(`INSERT INTO employees (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM employees))`).bind(name).run();
}

export async function renameEmployee(env: Env, id: number, name: string): Promise<void> {
	await env.DB.prepare(`UPDATE employees SET name = ? WHERE id = ?`).bind(name, id).run();
}

export async function deleteEmployee(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const row = await env.DB.prepare(`SELECT name FROM employees WHERE id = ?`).bind(id).first<{ name: string }>();
	if (!row) return { ok: true };
	if (await isNameUsedInEntries(env, row.name)) return { ok: false, reason: "есть проводки с таким субконто" };
	await env.DB.prepare(`DELETE FROM employees WHERE id = ?`).bind(id).run();
	return { ok: true };
}

export type OtherOperation = { id: number; name: string };

export async function listOtherOperations(env: Env): Promise<OtherOperation[]> {
	const { results } = await env.DB.prepare(`SELECT id, name FROM other_operations ORDER BY sort_order`).all<OtherOperation>();
	return results;
}

export async function createOtherOperation(env: Env, name: string): Promise<void> {
	await env.DB.prepare(`INSERT INTO other_operations (name, sort_order) VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM other_operations))`).bind(name).run();
}

export async function renameOtherOperation(env: Env, id: number, name: string): Promise<void> {
	await env.DB.prepare(`UPDATE other_operations SET name = ? WHERE id = ?`).bind(name, id).run();
}

export async function deleteOtherOperation(env: Env, id: number): Promise<{ ok: boolean; reason?: string }> {
	const row = await env.DB.prepare(`SELECT name FROM other_operations WHERE id = ?`).bind(id).first<{ name: string }>();
	if (!row) return { ok: true };
	if (await isNameUsedInEntries(env, row.name)) return { ok: false, reason: "есть проводки с таким субконто" };
	await env.DB.prepare(`DELETE FROM other_operations WHERE id = ?`).bind(id).run();
	return { ok: true };
}

export type JournalRow = {
	id: number | null; // null у авто-строк из банка/кассы — их нельзя удалить отсюда, только из источника
	source: "manual" | "bank" | "cash" | "card" | "offset";
	date: string;
	entry: Entry;
	quantity: number | null;
	amount: number;
	description: string;
};

export type ManualEntryInput = {
	entryDate: string;
	debitAccount: string;
	debitSubconto: string | null;
	creditAccount: string;
	creditSubconto: string | null;
	quantity: number | null;
	amount: number;
	description: string | null;
};

export async function createManualEntry(env: Env, ledger: Ledger, input: ManualEntryInput): Promise<number> {
	const result = await env.DB.prepare(
		`INSERT INTO journal_entries (ledger, entry_date, debit_account, debit_subconto, credit_account, credit_subconto, quantity, amount, description)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(ledger, input.entryDate, input.debitAccount, input.debitSubconto, input.creditAccount, input.creditSubconto, input.quantity, input.amount, input.description)
		.run();
	return result.meta.last_row_id;
}

export async function updateManualEntry(env: Env, id: number, input: ManualEntryInput): Promise<void> {
	await env.DB.prepare(
		`UPDATE journal_entries SET entry_date = ?, debit_account = ?, debit_subconto = ?, credit_account = ?, credit_subconto = ?, quantity = ?, amount = ?, description = ? WHERE id = ?`,
	)
		.bind(input.entryDate, input.debitAccount, input.debitSubconto, input.creditAccount, input.creditSubconto, input.quantity, input.amount, input.description, id)
		.run();
}

export async function deleteManualEntry(env: Env, id: number): Promise<void> {
	await env.DB.prepare(`DELETE FROM journal_entries WHERE id = ?`).bind(id).run();
}

// Журнал проводок за период: ручные (journal_entries) + разнесённые операции банка
// (bank_transactions с проставленным счётом — вторая сторона всегда 31). Банк/касса/карта
// принадлежат только книге Котопанды — у Элитки таких интеграций нет, её журнал состоит
// только из ручных проводок этой книги.
export async function listJournalEntries(env: Env, from: string, to: string, ledger: Ledger): Promise<JournalRow[]> {
	const { results: manualResults } = await env.DB.prepare(
		`SELECT je.id, je.entry_date AS date, je.debit_account, je.debit_subconto, je.credit_account, je.credit_subconto, je.quantity, je.amount, je.description,
			EXISTS(SELECT 1 FROM offset_documents od WHERE od.kotopanda_entry_id = je.id OR od.elitka_entry_id = je.id) AS is_offset
		 FROM journal_entries je
		 WHERE je.ledger = ? AND je.entry_date BETWEEN ? AND ?`,
	)
		.bind(ledger, from, to)
		.all<{
			id: number;
			date: string;
			debit_account: string;
			debit_subconto: string | null;
			credit_account: string;
			credit_subconto: string | null;
			quantity: number | null;
			amount: number;
			description: string | null;
			is_offset: number;
		}>();

	// Проводки, созданные документом "Взаимозачёт" (offset_documents), помечаем отдельным
	// источником — физически это обычная строка journal_entries, но править/удалять её
	// отсюда напрямую нельзя (сломает пару с проводкой в другой книге), только со страницы Взаимозачёта.
	const manual: JournalRow[] = manualResults.map((r) => ({
		id: r.id,
		source: r.is_offset ? "offset" : "manual",
		date: r.date,
		entry: { debitAccount: r.debit_account, debitSubconto: r.debit_subconto, creditAccount: r.credit_account, creditSubconto: r.credit_subconto },
		quantity: r.quantity,
		amount: r.amount,
		description: r.description ?? "—",
	}));

	// Банк/карта — интеграции только Котопанды; у Элитки их пока нет совсем. Касса же есть
	// у обеих (код кассы совпадает с кодом книги) — её проводки идут в свою книгу всегда.
	let bank: JournalRow[] = [];
	let card: JournalRow[] = [];

	// Разнесённые операции кассы (cash_operations) — Дт/Кт берутся прямо с категории
	// (она уже полностью описывает проводку, включая сторону "30" — направление менять не нужно).
	// Субконто на каждой стороне подставляется, только если на самой категории оно не задано:
	// для стороны "30" — из настроек кассы (cash_registers.posting_subconto); для стороны-
	// контрагента (например, "Оплата поставщику") — из субконто, введённого прямо на операции,
	// раз конкретный контрагент каждый раз разный и не фиксирован на категории.
	const { results: cashResults } = await env.DB.prepare(
		`SELECT d.doc_date AS date, o.amount, o.comment, o.subconto AS op_subconto, c.name AS category_name,
			c.debit_account, c.debit_subconto, c.credit_account, c.credit_subconto, r.posting_subconto AS register_subconto
		 FROM cash_operations o
		 JOIN cash_documents d ON d.id = o.cash_document_id
		 JOIN cash_categories c ON c.id = o.category_id
		 JOIN cash_registers r ON r.id = d.register_id
		 WHERE r.code = ? AND d.doc_date BETWEEN ? AND ?`,
	)
		.bind(ledger, from, to)
		.all<{
			date: string;
			amount: number;
			comment: string | null;
			op_subconto: string | null;
			category_name: string;
			debit_account: string;
			debit_subconto: string | null;
			credit_account: string;
			credit_subconto: string | null;
			register_subconto: string | null;
		}>();

	const cash: JournalRow[] = cashResults.map((r) => ({
		id: null,
		source: "cash",
		date: r.date,
		entry: {
			debitAccount: r.debit_account,
			debitSubconto: r.debit_account === CASH_REGISTER_ACCOUNT ? (r.debit_subconto ?? r.register_subconto) : (r.debit_subconto ?? r.op_subconto),
			creditAccount: r.credit_account,
			creditSubconto: r.credit_account === CASH_REGISTER_ACCOUNT ? (r.credit_subconto ?? r.register_subconto) : (r.credit_subconto ?? r.op_subconto),
		},
		quantity: null,
		amount: r.amount,
		description: r.comment ?? r.category_name,
	}));

	if (ledger === "kotopanda") {
		// Субконто счёта 31 для банковской стороны проводки — настраивается на странице Банка
		// (own_accounts, обычно "Основний р.с."), не хардкод.
		const bankOwnAccount = await env.DB.prepare(`SELECT posting_subconto FROM bank_accounts LIMIT 1`).first<{ posting_subconto: string | null }>();
		const bankSourceSubconto = bankOwnAccount?.posting_subconto ?? null;

		const { results: bankResults } = await env.DB.prepare(
			`SELECT operation_date AS date, direction, amount, purpose, posting_account, posting_subconto
			 FROM bank_transactions
			 WHERE posting_account IS NOT NULL AND operation_date BETWEEN ? AND ?`,
		)
			.bind(from, to)
			.all<{
				date: string;
				direction: "in" | "out";
				amount: number;
				purpose: string | null;
				posting_account: string;
				posting_subconto: string | null;
			}>();

		bank = bankResults.map((r) => ({
			id: null,
			source: "bank",
			date: r.date,
			entry:
				r.direction === "out"
					? { debitAccount: r.posting_account, debitSubconto: r.posting_subconto, creditAccount: SOURCE_ACCOUNT_BANK, creditSubconto: bankSourceSubconto }
					: { debitAccount: SOURCE_ACCOUNT_BANK, debitSubconto: bankSourceSubconto, creditAccount: r.posting_account, creditSubconto: r.posting_subconto },
			quantity: null,
			amount: r.amount,
			description: r.purpose ?? "—",
		}));

		// Разнесённые операции карточки (card_transactions) — Дт/Кт берутся с категории (posting_categories),
		// как и у кассы. Субконто на стороне "31" (карта) подставляется из card_accounts.posting_subconto,
		// если на самой категории не задано; на стороне-контрагенте — из субконто, введённого прямо
		// на операции (например, поставщик для "Оплата поставщику"), раз конкретное значение каждый
		// раз разное и не фиксировано на категории.
		const { results: cardResults } = await env.DB.prepare(
			`SELECT t.operation_date AS date, t.description, c.debit_account, c.debit_subconto, c.credit_account, c.credit_subconto,
				t.subconto AS op_subconto, ca.posting_subconto AS card_subconto, t.amount
			 FROM card_transactions t
			 JOIN posting_categories c ON c.id = t.posting_category_id
			 JOIN card_accounts ca ON ca.id = t.account_id
			 WHERE t.posting_category_id IS NOT NULL AND t.operation_date BETWEEN ? AND ?`,
		)
			.bind(from, to)
			.all<{
				date: string;
				description: string | null;
				debit_account: string;
				debit_subconto: string | null;
				credit_account: string;
				credit_subconto: string | null;
				op_subconto: string | null;
				card_subconto: string | null;
				amount: number;
			}>();

		card = cardResults.map((r) => ({
			id: null,
			source: "card",
			date: r.date,
			entry: {
				debitAccount: r.debit_account,
				debitSubconto: r.debit_account === SOURCE_ACCOUNT_BANK ? (r.debit_subconto ?? r.card_subconto) : (r.debit_subconto ?? r.op_subconto),
				creditAccount: r.credit_account,
				creditSubconto: r.credit_account === SOURCE_ACCOUNT_BANK ? (r.credit_subconto ?? r.card_subconto) : (r.credit_subconto ?? r.op_subconto),
			},
			quantity: null,
			amount: r.amount,
			description: r.description ?? "—",
		}));
	}

	return [...manual, ...bank, ...cash, ...card].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export type AccountCardRow = {
	date: string;
	source: "manual" | "bank" | "cash" | "card" | "offset";
	id: number | null;
	counterAccount: string;
	counterSubconto: string | null;
	debit: number;
	credit: number;
	description: string;
	balance: number; // нарастающим итогом, знак: плюс — дебетовое сальдо, минус — кредитовое
};

// Карточка счёта (опционально — по конкретному субконто): все проводки, где встречается
// этот счёт (и, если задано, это субконто), с начальным сальдо на начало периода и остатком
// после каждой строки — как в 1С.
export async function getAccountCard(
	env: Env,
	account: string,
	subconto: string | null,
	periodFrom: string,
	periodTo: string,
	ledger: Ledger,
): Promise<{ openingBalance: number; rows: AccountCardRow[]; closingBalance: number }> {
	const openingRows = await listJournalEntries(env, "0001-01-01", addDaysIso(periodFrom, -1), ledger);
	const periodRows = await listJournalEntries(env, periodFrom, periodTo, ledger);

	function matchesSide(r: JournalRow, side: "debit" | "credit"): boolean {
		if (side === "debit") return r.entry.debitAccount === account && (subconto === null || r.entry.debitSubconto === subconto);
		return r.entry.creditAccount === account && (subconto === null || r.entry.creditSubconto === subconto);
	}

	let balance = 0;
	for (const r of openingRows) {
		if (matchesSide(r, "debit")) balance += r.amount;
		if (matchesSide(r, "credit")) balance -= r.amount;
	}
	const openingBalance = balance;

	const rows: AccountCardRow[] = periodRows
		.filter((r) => matchesSide(r, "debit") || matchesSide(r, "credit"))
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
		.map((r) => {
			const debitMatch = matchesSide(r, "debit");
			const creditMatch = matchesSide(r, "credit");
			const debit = debitMatch ? r.amount : 0;
			const credit = creditMatch ? r.amount : 0;
			balance += debit - credit;
			return {
				date: r.date,
				source: r.source,
				id: r.id,
				counterAccount: debitMatch ? r.entry.creditAccount : r.entry.debitAccount,
				counterSubconto: debitMatch ? r.entry.creditSubconto : r.entry.debitSubconto,
				debit,
				credit,
				description: r.description,
				balance,
			};
		});

	return { openingBalance, rows, closingBalance: balance };
}

export type Turnover = {
	key: string;
	openingDebit: number;
	openingCredit: number;
	turnoverDebit: number;
	turnoverCredit: number;
	closingDebit: number;
	closingCredit: number;
};

const NO_SUBCONTO = "Без субконто";

function sumByAccount(rows: JournalRow[]): Map<string, { debit: number; credit: number }> {
	const map = new Map<string, { debit: number; credit: number }>();
	for (const r of rows) {
		const debitAcc = map.get(r.entry.debitAccount) ?? { debit: 0, credit: 0 };
		debitAcc.debit += r.amount;
		map.set(r.entry.debitAccount, debitAcc);

		const creditAcc = map.get(r.entry.creditAccount) ?? { debit: 0, credit: 0 };
		creditAcc.credit += r.amount;
		map.set(r.entry.creditAccount, creditAcc);
	}
	return map;
}

// Разбивка проводок по субконто для ОДНОГО конкретного счёта (обе стороны, где встречается
// этот счёт) — используется для "провалиться" из строки счёта в ОСВ до его аналитики.
function sumBySubconto(rows: JournalRow[], account: string): Map<string, { debit: number; credit: number }> {
	const map = new Map<string, { debit: number; credit: number }>();
	for (const r of rows) {
		if (r.entry.debitAccount === account) {
			const key = r.entry.debitSubconto ?? NO_SUBCONTO;
			const s = map.get(key) ?? { debit: 0, credit: 0 };
			s.debit += r.amount;
			map.set(key, s);
		}
		if (r.entry.creditAccount === account) {
			const key = r.entry.creditSubconto ?? NO_SUBCONTO;
			const s = map.get(key) ?? { debit: 0, credit: 0 };
			s.credit += r.amount;
			map.set(key, s);
		}
	}
	return map;
}

function buildTurnoverRows(opening: Map<string, { debit: number; credit: number }>, turnover: Map<string, { debit: number; credit: number }>): { rows: Turnover[]; totals: Turnover } {
	const keys = new Set<string>([...opening.keys(), ...turnover.keys()]);

	const rows: Turnover[] = [...keys]
		.map((key) => {
			const op = opening.get(key) ?? { debit: 0, credit: 0 };
			const tu = turnover.get(key) ?? { debit: 0, credit: 0 };
			const openNet = op.debit - op.credit;
			const closeNet = openNet + tu.debit - tu.credit;
			return {
				key,
				openingDebit: openNet > 0 ? openNet : 0,
				openingCredit: openNet < 0 ? -openNet : 0,
				turnoverDebit: tu.debit,
				turnoverCredit: tu.credit,
				closingDebit: closeNet > 0 ? closeNet : 0,
				closingCredit: closeNet < 0 ? -closeNet : 0,
			};
		})
		.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

	const totals = rows.reduce(
		(acc, r) => ({
			key: "",
			openingDebit: acc.openingDebit + r.openingDebit,
			openingCredit: acc.openingCredit + r.openingCredit,
			turnoverDebit: acc.turnoverDebit + r.turnoverDebit,
			turnoverCredit: acc.turnoverCredit + r.turnoverCredit,
			closingDebit: acc.closingDebit + r.closingDebit,
			closingCredit: acc.closingCredit + r.closingCredit,
		}),
		{ key: "", openingDebit: 0, openingCredit: 0, turnoverDebit: 0, turnoverCredit: 0, closingDebit: 0, closingCredit: 0 },
	);

	return { rows, totals };
}

// Оборотно-сальдовая ведомость по ручным проводкам. Начальный остаток — всё, что было
// проведено до начала периода; при переходе через ноль остаток "переезжает" в другую
// колонку (Дт/Кт), как в обычной ОСВ. Плюс разбивка по субконто для drill-down в UI.
export async function getTurnoverBalance(
	env: Env,
	periodFrom: string,
	periodTo: string,
	ledger: Ledger,
): Promise<{ rows: Turnover[]; totals: Turnover; subcontoByAccount: Map<string, { rows: Turnover[]; totals: Turnover }> }> {
	const openingRows = await listJournalEntries(env, "0001-01-01", addDaysIso(periodFrom, -1), ledger);
	const periodRows = await listJournalEntries(env, periodFrom, periodTo, ledger);

	const opening = sumByAccount(openingRows);
	const turnover = sumByAccount(periodRows);
	const accounts = new Set<string>([...opening.keys(), ...turnover.keys()]);

	const { rows, totals } = buildTurnoverRows(opening, turnover);

	const subcontoByAccount = new Map<string, { rows: Turnover[]; totals: Turnover }>();
	for (const account of accounts) {
		const openingSub = sumBySubconto(openingRows, account);
		const turnoverSub = sumBySubconto(periodRows, account);
		const keys = new Set<string>([...openingSub.keys(), ...turnoverSub.keys()]);
		// Раскрывать имеет смысл только если есть хоть одно РЕАЛЬНОЕ субконто — счёт, где
		// всё "Без субконто" (напр. 33 — справочника у него нет), разворачивать некуда.
		const hasRealSubconto = [...keys].some((k) => k !== NO_SUBCONTO);
		if (!hasRealSubconto) continue;
		subcontoByAccount.set(account, buildTurnoverRows(openingSub, turnoverSub));
	}

	return { rows, totals, subcontoByAccount };
}

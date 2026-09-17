// План счетов — захардкоженная справочная таблица (код -> название). Раньше часть счетов была
// привязана к своим боевым справочникам (own_accounts, cash_boxes, expense_items, employees,
// other_operations, counterparties) для подсказки субконто — те снесены вместе с Бухгалтерией и
// Поставщиками (см. обсуждение "тестовые станут боевыми"). Но привязка счёта к виду справочника
// как таковая осталась нужна (см. test_chart_of_accounts.ref_kind, Настройки → План счетов) —
// поэтому refKind здесь просто указывает на тот же тестовый справочник (test_own_accounts и т.д.,
// см. referencesTest.ts), что и в тестовом плане счетов, и Банк/Карта подтягивают оттуда подсказки.
import type { TestRefKind } from "./referencesTest";

export const SOURCE_ACCOUNT_BANK = "31";

export type ChartAccount = { code: string; name: string; refKind: TestRefKind | null };

// Захардкоженный план счетов — просто справочная таблица (код -> название -> вид справочника).
// Ничего не считает, не хранится в БД.
export const CHART_OF_ACCOUNTS: ChartAccount[] = [
	{ code: "00", name: "Вспомогательный счет для ввода остатков", refKind: null },
	{ code: "10", name: "ОС", refKind: null },
	{ code: "28", name: "Товар", refKind: null },
	{ code: "30", name: "Касса", refKind: "cashBoxes" },
	{ code: "31", name: "Расчетный счет", refKind: "ownAccounts" },
	{ code: "33", name: "Деньги в пути", refKind: "ownAccounts" },
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
	{ code: "92", name: "Административные расходы", refKind: "expenseItems" },
];

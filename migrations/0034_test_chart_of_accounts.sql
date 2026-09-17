-- Migration number: 0034 	 тестовая таблица "План счетов" для страницы План счетов (тест) —
-- в отличие от боевого CHART_OF_ACCOUNTS (захардкожен в accounting.ts), это настоящая таблица.
-- code — сам код счёта как естественный первичный ключ (не меняется, только name/ref_kind).
-- ref_kind — значения из TestRefKind (src/referencesTest.ts): ownAccounts/cashBoxes/suppliers/
-- expenseItems/employees/otherOperations, либо NULL (без справочника субконто).

CREATE TABLE test_chart_of_accounts (
	code TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	ref_kind TEXT CHECK (ref_kind IN ('ownAccounts', 'cashBoxes', 'suppliers', 'expenseItems', 'employees', 'otherOperations'))
);

INSERT INTO test_chart_of_accounts (code, name, ref_kind) VALUES
	('00', 'Вспомогательный счет для ввода остатков', NULL),
	('10', 'ОС', NULL),
	('28', 'Товар', NULL),
	('30', 'Касса', 'cashBoxes'),
	('31', 'Расчетный счет', 'ownAccounts'),
	('33', 'Деньги в пути', 'ownAccounts'),
	('36', 'Авансы', NULL),
	('40', 'Уставной фонд', NULL),
	('44', 'Прибыль', NULL),
	('46', 'Расчеты с участниками', NULL),
	('63', 'Поставщики', 'suppliers'),
	('66', 'Зарплата', 'employees'),
	('68', 'Прочие операции', 'otherOperations'),
	('70', 'Доход от реализации', NULL),
	('71', 'Прочий доход', NULL),
	('79', 'Финансовый результат', NULL),
	('90', 'Себестоимость', NULL),
	('92', 'Административные расходы', 'expenseItems');

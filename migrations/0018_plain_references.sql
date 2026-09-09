-- Migration number: 0018 	 справочники отвязываем от плана счетов — это просто именованные
-- списки (id, name), без кода бухгалтерского счёта. Заодно добавляем справочник "Витрати".

CREATE TABLE own_accounts_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO own_accounts_new (id, name, sort_order)
	SELECT id, name, sort_order FROM own_accounts;

DROP TABLE own_accounts;
ALTER TABLE own_accounts_new RENAME TO own_accounts;

CREATE TABLE expense_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	sort_order INTEGER NOT NULL DEFAULT 0
);

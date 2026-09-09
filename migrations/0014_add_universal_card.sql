-- Migration number: 0014 	 карточка "Универсальная" — выписка загружается файлом (xlsx), а не по API,
-- остаток на начало/конец берём напрямую из "Залишок на кінець періоду" в файле — якорь не нужен.

CREATE TABLE card_accounts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	card_mask TEXT UNIQUE,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE card_transactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	account_id INTEGER NOT NULL REFERENCES card_accounts(id),
	operation_date TEXT NOT NULL,
	operation_time TEXT NOT NULL,
	direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
	amount REAL NOT NULL,
	bank_category TEXT,
	description TEXT,
	balance_after REAL,
	status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('done', 'review')),
	posting_category_id INTEGER REFERENCES posting_categories(id),
	counterparty_id INTEGER REFERENCES counterparties(id),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (account_id, operation_date, operation_time, direction, amount, description)
);

CREATE INDEX idx_card_transactions_date ON card_transactions(operation_date);

-- Личные операции на этой карте не относятся к бизнесу — отдельные категории, чтобы
-- не путать их с бизнес-категориями банка/кассы, но при этом разносить тем же механизмом.
INSERT INTO posting_categories (name, direction, sort_order) VALUES
	('Личный доход', 'income', 99),
	('Личное', 'expense', 99);

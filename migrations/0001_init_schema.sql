-- Migration number: 0001 	 2026-09-02T19:48:53.362Z

-- Банковские счета (пока только ПриватБанк, но не хардкодим на будущее)
CREATE TABLE bank_accounts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	iban TEXT NOT NULL UNIQUE,
	currency TEXT NOT NULL DEFAULT 'UAH',
	bank_name TEXT NOT NULL DEFAULT 'ПриватБанк',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Категории разноски операций (Закупка товара, Выручка от продаж, Аренда и т.д.)
CREATE TABLE posting_categories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
	sort_order INTEGER NOT NULL DEFAULT 0
);

-- Операции из банковской выписки
CREATE TABLE bank_transactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
	external_id TEXT NOT NULL, -- ID операции из ответа ПриватБанка, для дедупликации при повторной загрузке
	operation_date TEXT NOT NULL, -- ISO-дата (YYYY-MM-DD), распарсенная из DAT_OD
	direction TEXT NOT NULL CHECK (direction IN ('in', 'out')), -- из TRANTYPE: C -> in, D -> out
	amount REAL NOT NULL, -- всегда положительное число
	currency TEXT NOT NULL DEFAULT 'UAH',
	counterparty_name TEXT,
	counterparty_account TEXT,
	purpose TEXT, -- OSND
	status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('done', 'review')),
	posting_category_id INTEGER REFERENCES posting_categories(id),
	raw_json TEXT NOT NULL, -- исходный ответ API по операции, на случай если понадобятся поля, которые пока не используем
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (account_id, external_id)
);

CREATE INDEX idx_bank_transactions_date ON bank_transactions(operation_date);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);

-- Журнал синхронизаций с банком (для кнопки "Получить из банку" и фоновых опросов)
CREATE TABLE bank_sync_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
	period_from TEXT NOT NULL,
	period_to TEXT NOT NULL,
	fetched_count INTEGER NOT NULL,
	added_count INTEGER NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('success', 'error')),
	error_message TEXT,
	synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO posting_categories (name, direction, sort_order) VALUES
	('Выручка от продаж', 'income', 10),
	('Закупка товара', 'expense', 10),
	('Аренда помещения', 'expense', 20),
	('Комиссия банка', 'expense', 30),
	('Прочее', 'expense', 90);

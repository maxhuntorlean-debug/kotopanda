-- Migration number: 0019 	 банк переходит с posting_categories (абстрактная категория) на
-- прямую разноску "счёт + субконто" из плана счетов/довідників — как в ручных проводках.
-- Заодно чистим всю текущую разноску (счёт/субконто пустые, статус снова 'review').

CREATE TABLE bank_transactions_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
	external_id TEXT NOT NULL,
	operation_date TEXT NOT NULL,
	direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
	amount REAL NOT NULL,
	currency TEXT NOT NULL DEFAULT 'UAH',
	counterparty_name TEXT,
	counterparty_account TEXT,
	purpose TEXT,
	status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('done', 'review')),
	posting_account TEXT,
	posting_subconto TEXT,
	raw_json TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (account_id, external_id)
);

INSERT INTO bank_transactions_new (id, account_id, external_id, operation_date, direction, amount, currency, counterparty_name, counterparty_account, purpose, status, raw_json, created_at)
	SELECT id, account_id, external_id, operation_date, direction, amount, currency, counterparty_name, counterparty_account, purpose, 'review', raw_json, created_at FROM bank_transactions;

DROP TABLE bank_transactions;
ALTER TABLE bank_transactions_new RENAME TO bank_transactions;
CREATE INDEX idx_bank_transactions_date ON bank_transactions(operation_date);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);

-- Старые правила были завязаны на категории — в новой модели бессмысленны, начинаем заново.
DROP TABLE posting_rules;
CREATE TABLE posting_rules (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	match_field TEXT NOT NULL CHECK (match_field IN ('counterparty_account', 'counterparty_name')),
	match_value TEXT NOT NULL,
	posting_account TEXT NOT NULL,
	posting_subconto TEXT,
	auto_status TEXT NOT NULL DEFAULT 'done' CHECK (auto_status IN ('done', 'review')),
	priority INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

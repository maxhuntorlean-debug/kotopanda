-- Migration number: 0005 	 add posting_rules for auto-разноска

CREATE TABLE posting_rules (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	match_field TEXT NOT NULL CHECK (match_field IN ('counterparty_account', 'counterparty_name')),
	match_value TEXT NOT NULL,
	posting_category_id INTEGER NOT NULL REFERENCES posting_categories(id),
	auto_status TEXT NOT NULL DEFAULT 'done' CHECK (auto_status IN ('done', 'review')),
	priority INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Эквайринговые зачисления ПриватБанка всегда приходят с одного технического счёта
INSERT INTO posting_rules (match_field, match_value, posting_category_id, auto_status, priority)
SELECT 'counterparty_account', 'UA353052990000029240828509101', id, 'done', 10
FROM posting_categories WHERE name = 'Приход Эквайринг';

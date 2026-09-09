-- Migration number: 0006 	 отдельный справочник контрагентов (поставщиков и т.д.)
-- Разделяем "тип расхода" (posting_categories, напр. "Закупка товара") и "кто именно"
-- (counterparties, напр. "ТОВ Іграшки") — как категория и контрагент в 1С/банк-клиенте.

CREATE TABLE counterparties (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	default_category_id INTEGER REFERENCES posting_categories(id),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE bank_transactions ADD COLUMN counterparty_id INTEGER REFERENCES counterparties(id);
ALTER TABLE posting_rules ADD COLUMN counterparty_id INTEGER REFERENCES counterparties(id);

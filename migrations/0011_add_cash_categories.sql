-- Migration number: 0011 	 отдельный список категорий для кассы (не общий posting_categories)

CREATE TABLE cash_categories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
	sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO cash_categories (name, direction, sort_order) VALUES
	('Выручка от продаж', 'income', 10),
	('Прочий приход', 'income', 90),
	('Закупка товара', 'expense', 10),
	('Зарплата', 'expense', 20),
	('Инкассация в банк', 'expense', 30),
	('Хозрасходы', 'expense', 40),
	('Прочее', 'expense', 90);

-- Переносим cash_operations на новый справочник (был posting_category_id -> posting_categories)
CREATE TABLE cash_operations_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	cash_document_id INTEGER NOT NULL REFERENCES cash_documents(id),
	direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
	amount REAL NOT NULL,
	category_id INTEGER NOT NULL REFERENCES cash_categories(id),
	comment TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO cash_operations_new (id, cash_document_id, direction, amount, category_id, comment, created_at)
	SELECT id, cash_document_id, direction, amount, posting_category_id, comment, created_at FROM cash_operations;

DROP TABLE cash_operations;
ALTER TABLE cash_operations_new RENAME TO cash_operations;

CREATE INDEX idx_cash_operations_document ON cash_operations(cash_document_id);

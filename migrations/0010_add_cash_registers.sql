-- Migration number: 0010 	 кассовая книга (наличка), пилот для магазина Котопанда
-- По мотивам pos-api-db (cash_documents/cash_operations), но проще и с переиспользованием
-- posting_categories вместо отдельного списка типов операций.

CREATE TABLE cash_registers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	code TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL
);

-- Один документ на день на кассу. closing_balance — то, что кассир реально пересчитал
-- в конце дня (не вычисляется автоматически), поэтому может не совпасть с расчётным остатком.
CREATE TABLE cash_documents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	register_id INTEGER NOT NULL REFERENCES cash_registers(id),
	doc_date TEXT NOT NULL,
	opening_balance REAL NOT NULL DEFAULT 0,
	closing_balance REAL,
	closed_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (register_id, doc_date)
);

CREATE TABLE cash_operations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	cash_document_id INTEGER NOT NULL REFERENCES cash_documents(id),
	direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
	amount REAL NOT NULL,
	posting_category_id INTEGER NOT NULL REFERENCES posting_categories(id),
	comment TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cash_operations_document ON cash_operations(cash_document_id);

INSERT INTO cash_registers (code, name) VALUES
	('kotopanda', 'Котопанда'),
	('elitka', 'Елітка');

-- Migration number: 0036 	 тестовый "Журнал операций" — проводки существуют только как
-- порождение документа (см. обсуждение), поэтому две таблицы: сам документ и строки-проводки,
-- которые он создал. document_id — не пара фиксированных FK как у offset_documents, а общая
-- ссылка, поэтому на одном документе может быть сколько угодно строк (1 у "вручную", 2 у
-- будущего теста Взаимозачёта, и так далее).

-- doc_type: пока используется только 'manual', остальные значения — под будущие тестовые
-- документы (касса/банк/карта/взаимозачёт), чтобы не пришлось перестраивать таблицу ради
-- расширения CHECK.
CREATE TABLE test_documents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	doc_type TEXT NOT NULL CHECK (doc_type IN ('manual', 'cash', 'bank', 'card', 'offset')),
	doc_date TEXT NOT NULL,
	description TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- entry_date дублирует test_documents.doc_date — так Оборотка читает только эту таблицу,
-- без джойна на test_documents (см. обсуждение). debit_subconto_id/credit_subconto_id —
-- "мягкая" ссылка (не настоящий FK): какая из семи test_*-таблиц справочника имеется в виду,
-- определяется по ref_kind счёта в test_chart_of_accounts, SQLite так не умеет через FK.
CREATE TABLE test_journal (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document_id INTEGER NOT NULL REFERENCES test_documents(id),
	firm_id INTEGER NOT NULL REFERENCES test_firms(id),
	entry_date TEXT NOT NULL,
	debit_account TEXT NOT NULL REFERENCES test_chart_of_accounts(code),
	debit_subconto_id INTEGER,
	credit_account TEXT NOT NULL REFERENCES test_chart_of_accounts(code),
	credit_subconto_id INTEGER,
	amount REAL NOT NULL
);

CREATE INDEX idx_test_journal_firm_date ON test_journal(firm_id, entry_date);
CREATE INDEX idx_test_journal_document ON test_journal(document_id);

-- Migration number: 0008 	 учёт задолженности перед поставщиками
-- Оплаты берём из bank_transactions (уже привязаны к counterparty_id), а сами поставки/накладные,
-- которые увеличивают долг, банк не видит — их нужно вносить руками. Долг = накладные - оплаты.

ALTER TABLE counterparties ADD COLUMN is_supplier INTEGER NOT NULL DEFAULT 0;

CREATE TABLE supplier_invoices (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	counterparty_id INTEGER NOT NULL REFERENCES counterparties(id),
	invoice_date TEXT NOT NULL,
	number TEXT,
	amount REAL NOT NULL,
	description TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_supplier_invoices_counterparty ON supplier_invoices(counterparty_id);

-- Всё, что уже есть в справочнике, заведено через разноску расходов — считаем поставщиками
UPDATE counterparties SET is_supplier = 1;

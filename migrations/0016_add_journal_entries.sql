-- Migration number: 0016 	 журнал операций — ручные проводки, не привязанные к банку/картке/кассе
-- (начисления, переоценка, корректировки между счетами и т.п.), в духе таблицы проводок 1С:
-- отдельные счёт+субконто на каждую сторону, количество (для товарных проводок) и фирма (магазин).

CREATE TABLE journal_entries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	entry_date TEXT NOT NULL,
	debit_account TEXT NOT NULL,
	debit_subconto TEXT,
	credit_account TEXT NOT NULL,
	credit_subconto TEXT,
	quantity REAL,
	amount REAL NOT NULL,
	register_id INTEGER REFERENCES cash_registers(id), -- "НашаФирма" — переиспользуем справочник магазинов
	description TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);

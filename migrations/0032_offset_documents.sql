-- Migration number: 0032 	 документ "Взаимозачёт" — создаёт по одной ручной проводке в каждой
-- книге (Котопанда и Элитка), связанные между собой через субконто счёта 30 (см.
-- offset_settings). Таблица хранит сам документ + id обеих связанных проводок, чтобы
-- удаление/будущее редактирование документа могло убрать/поправить обе разом.

CREATE TABLE offset_documents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	doc_date TEXT NOT NULL,
	direction TEXT NOT NULL CHECK (direction IN ('kotopanda_to_elitka', 'elitka_to_kotopanda')),
	kotopanda_account TEXT NOT NULL,
	kotopanda_subconto TEXT,
	elitka_account TEXT NOT NULL,
	elitka_subconto TEXT,
	amount REAL NOT NULL,
	description TEXT,
	kotopanda_entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
	elitka_entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

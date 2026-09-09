-- Migration number: 0017 	 справочник собственных счетов (банк/картка под одним счётом 31,
-- через субконто) и справочник касс для субконто по счёту 30 в ручных проводках.
-- Заодно переводим коды счетов на двузначные (312 -> 31/субконто, 377 -> 37, 661 -> 66,
-- 702 -> 70, 703 -> 71, 333 -> 33) — так, как их видит пользователь в 1С.

CREATE TABLE own_accounts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	kind TEXT NOT NULL UNIQUE CHECK (kind IN ('bank', 'card')),
	name TEXT NOT NULL,
	account_code TEXT NOT NULL DEFAULT '31',
	sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO own_accounts (kind, name, account_code, sort_order) VALUES
	('bank', 'Основний р.с.', '31', 10),
	('card', 'Картка універсальна', '31', 20);

CREATE TABLE cash_boxes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO cash_boxes (name, sort_order) VALUES
	('Касса Максима', 10),
	('Касса Лена', 20),
	('Касса ОТДЕЛА', 30);

-- Ручные проводки не привязывались реально ни к чему через register_id (только "Наша фирма"
-- у ещё не выпущенной фичи) — убираем этот столбец, каси теперь выбираются как обычное
-- субконто (текстом, с подсказками из cash_boxes), без отдельной колонки.
CREATE TABLE journal_entries_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	entry_date TEXT NOT NULL,
	debit_account TEXT NOT NULL,
	debit_subconto TEXT,
	credit_account TEXT NOT NULL,
	credit_subconto TEXT,
	quantity REAL,
	amount REAL NOT NULL,
	description TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO journal_entries_new (id, entry_date, debit_account, debit_subconto, credit_account, credit_subconto, quantity, amount, description, created_at)
	SELECT id, entry_date, debit_account, debit_subconto, credit_account, credit_subconto, quantity, amount, description, created_at FROM journal_entries;

DROP TABLE journal_entries;
ALTER TABLE journal_entries_new RENAME TO journal_entries;
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);

UPDATE posting_categories SET contra_account = '70' WHERE contra_account = '702';
UPDATE posting_categories SET contra_account = '71' WHERE contra_account = '703';
UPDATE posting_categories SET contra_account = '37' WHERE contra_account = '377';

UPDATE cash_categories SET contra_account = '70' WHERE contra_account = '702';
UPDATE cash_categories SET contra_account = '71' WHERE contra_account = '703';
UPDATE cash_categories SET contra_account = '66' WHERE contra_account = '661';
UPDATE cash_categories SET contra_account = '33' WHERE contra_account = '333';

-- Уже сохранённые ручные проводки набирались руками (не через категории), так что коды счетов
-- в них тоже могли быть трёхзначными — пересчитываем их по той же схеме, для консистентности.
UPDATE journal_entries SET debit_account = '70' WHERE debit_account = '702';
UPDATE journal_entries SET debit_account = '71' WHERE debit_account = '703';
UPDATE journal_entries SET debit_account = '37' WHERE debit_account = '377';
UPDATE journal_entries SET debit_account = '66' WHERE debit_account = '661';
UPDATE journal_entries SET debit_account = '33' WHERE debit_account = '333';
UPDATE journal_entries SET debit_account = '31' WHERE debit_account = '312';

UPDATE journal_entries SET credit_account = '70' WHERE credit_account = '702';
UPDATE journal_entries SET credit_account = '71' WHERE credit_account = '703';
UPDATE journal_entries SET credit_account = '37' WHERE credit_account = '377';
UPDATE journal_entries SET credit_account = '66' WHERE credit_account = '661';
UPDATE journal_entries SET credit_account = '33' WHERE credit_account = '333';
UPDATE journal_entries SET credit_account = '31' WHERE credit_account = '312';

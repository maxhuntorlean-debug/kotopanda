-- Migration number: 0027 	 два бизнеса (Котопанда и Элитка) ведут отдельные книги проводок
-- на одном плане счетов и одних справочниках — добавляем ledger на journal_entries, чтобы
-- разделить их ручные проводки. Существующие записи принадлежат Котопанде (значение по
-- умолчанию), у Элитки книга начинается с чистого листа. Банк/касса/карта — интеграции
-- только Котопанды, к Элитке не относятся вовсе (см. listJournalEntries в accounting.ts).

ALTER TABLE journal_entries ADD COLUMN ledger TEXT NOT NULL DEFAULT 'kotopanda';

CREATE INDEX idx_journal_entries_ledger ON journal_entries(ledger);

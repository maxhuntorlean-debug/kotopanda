-- Migration number: 0039 	 откат 0038 — зеркалирование кассы Котопанда в тестовый журнал
-- решили не делать (см. обсуждение), убираем и колонку-привязку.
ALTER TABLE cash_operations DROP COLUMN test_journal_id;

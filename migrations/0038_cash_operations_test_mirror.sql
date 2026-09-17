-- Migration number: 0038 	 привязка операции кассы Котопанда к зеркальной проводке в тестовом
-- журнале (test_journal) — см. mirrorCashOperationToTestJournal в cash.ts. NULL, если операция
-- ещё не зеркалирована (касса Элитка сейчас не зеркалируется, только Котопанда).
ALTER TABLE cash_operations ADD COLUMN test_journal_id INTEGER REFERENCES test_journal(id);

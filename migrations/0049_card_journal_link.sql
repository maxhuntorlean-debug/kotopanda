-- Migration number: 0049 	 связка Карты с тестовым журналом (test_journal) — та же история, что
-- и с Банком (см. migrations/0047_bank_journal_link.sql): разноска в Карте до сих пор писала
-- только card_transactions.posting_category_id/subconto и никак не создавала проводку. Карта —
-- тоже всегда фирма Котопанда (см. обсуждение "Проверь чтоб проводки потом делались").
ALTER TABLE card_transactions ADD COLUMN firm_id INTEGER REFERENCES test_firms(id);
ALTER TABLE card_transactions ADD COLUMN journal_document_id INTEGER REFERENCES test_documents(id);

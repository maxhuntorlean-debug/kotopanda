-- Migration number: 0047 	 связка Банка с тестовым журналом (test_journal) — разноска в Банке
-- до сих пор писала только bank_transactions.posting_account/posting_subconto и никак не
-- создавала проводку, поэтому Оборотка её не видела (см. обсуждение "Почему не попало в
-- оборотку"). firm_id — банк общий на обе фирмы, поэтому при разноске каждой операции нужно
-- явно выбрать фирму. journal_document_id — связь 1:1 с test_documents (doc_type='bank'), чтобы
-- при повторном редактировании/снятии разноски можно было найти и обновить/удалить именно её
-- проводку, а не пересоздавать документ каждый раз.
ALTER TABLE bank_transactions ADD COLUMN firm_id INTEGER REFERENCES test_firms(id);
ALTER TABLE bank_transactions ADD COLUMN journal_document_id INTEGER REFERENCES test_documents(id);
ALTER TABLE posting_rules ADD COLUMN firm_id INTEGER REFERENCES test_firms(id);

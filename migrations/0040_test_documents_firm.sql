-- Migration number: 0040 	 фирма — свойство самого документа (test_documents), а не только его
-- строк (test_journal.firm_id) — иначе документ без единой строки (например, только что созданная
-- пустая "Операция" до заполнения) не принадлежал бы ни одной фирме и мог бы "протечь" в список
-- документов другой фирмы (см. обсуждение перед добавлением Оборотки по Элитке). Бэкафилл — из
-- первой строки документа (сейчас все документы — Котопанды, но общий на случай будущих правок).
ALTER TABLE test_documents ADD COLUMN firm_id INTEGER REFERENCES test_firms(id);

UPDATE test_documents
SET firm_id = (SELECT j.firm_id FROM test_journal j WHERE j.document_id = test_documents.id LIMIT 1)
WHERE firm_id IS NULL;

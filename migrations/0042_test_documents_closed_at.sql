-- Migration number: 0042 	 закрытие дня для тестовой Кассы (см. pages/cashTest.ts) — тот же
-- смысл, что и боевой cash_documents.closed_at (migrations боевой кассы): закрытый день
-- блокирует добавление/правку/удаление операций. Общая колонка на test_documents (не только
-- doc_type='cash'), но заполняется только у кассовых документов — остальным типам она не нужна.
ALTER TABLE test_documents ADD COLUMN closed_at TEXT;

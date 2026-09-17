-- Migration number: 0044 	 снос старой боевой Бухгалтерии (ручные проводки journal_entries) и
-- Взаимозачёта — заменена Обороткой/Журналом Операций поверх test_documents/test_journal (см.
-- pages/journalTurnoverTest.ts, pages/journalDocumentsTest.ts, теперь смонтированы на
-- /accounting/kotopanda и /accounting/elitka вместо старых). Взаимозачёт пока оставлен без
-- функционала (страница /offset — заглушка), его данные снесены вместе с Бухгалтерией, т.к. он
-- писал ровно в journal_entries. Код старых модулей (src/pages/accounting.ts, src/offset.ts,
-- src/pages/offset.ts) удалён из проекта тем же коммитом.
-- Порядок — по зависимостям FK: offset_documents ссылается на journal_entries.
DROP TABLE offset_documents;
DROP TABLE journal_entries;
DROP TABLE offset_settings;

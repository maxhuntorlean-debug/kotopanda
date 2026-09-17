-- Migration number: 0043 	 снос старого боевого модуля Кассы (Котопанда/Элитка) — заменён
-- новой Кассой поверх test_documents/test_journal/test_cash_categories (см. cashTest.ts,
-- pages/cashTest.ts, теперь смонтирована на /sales-kotopanda и /sales-elitka вместо старой).
-- Код старого модуля (src/cash.ts, src/pages/cash.ts) удалён из проекта тем же коммитом.
-- Порядок — по зависимостям FK: cash_operations ссылается на cash_documents и cash_categories,
-- те обе — на cash_registers.
DROP TABLE cash_operations;
DROP TABLE cash_documents;
DROP TABLE cash_categories;
DROP TABLE cash_registers;

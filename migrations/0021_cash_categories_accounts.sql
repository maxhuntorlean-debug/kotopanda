-- Migration number: 0021 	 категории кассы переходят с абстрактного contra_account на
-- полную проводку "Дт счёт/субконто, Кт счёт/субконто" — как в ручных проводках и в банке.
-- Приход = Дт 30 (Каса) / Кт <было contra_account>; расход = Дт <было contra_account> / Кт 30.
-- cash_operations.category_id ссылается на cash_categories по имени, и SQLite/D1 переписывает
-- эту ссылку при любом RENAME таблицы-цели — поэтому полный rebuild здесь ломает FK.
-- Вместо этого добавляем новые колонки на месте, contra_account/requires_counterparty остаются
-- неиспользуемым, но безвредным наследием (их приложение больше не читает).

ALTER TABLE cash_categories ADD COLUMN debit_account TEXT;
ALTER TABLE cash_categories ADD COLUMN debit_subconto TEXT;
ALTER TABLE cash_categories ADD COLUMN credit_account TEXT;
ALTER TABLE cash_categories ADD COLUMN credit_subconto TEXT;

UPDATE cash_categories SET
	debit_account = CASE WHEN direction = 'income' THEN '30' ELSE COALESCE(contra_account, '92') END,
	credit_account = CASE WHEN direction = 'income' THEN COALESCE(contra_account, '71') ELSE '30' END;

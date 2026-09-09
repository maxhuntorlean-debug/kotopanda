-- Migration number: 0015 	 контр-счета для автоматической разноски проводок (Дт/Кт)
-- Один источник (31 — банк, 312 — картка, 30/касса — из cash_registers) + контр-счёт из категории.
-- requires_counterparty — субконто по счёту 63 берётся из уже существующего справочника counterparties.

ALTER TABLE posting_categories ADD COLUMN contra_account TEXT;
ALTER TABLE posting_categories ADD COLUMN requires_counterparty INTEGER NOT NULL DEFAULT 0;

UPDATE posting_categories SET contra_account = '702' WHERE name = 'Выручка от продаж';
UPDATE posting_categories SET contra_account = '63', requires_counterparty = 1 WHERE name = 'Оплата поставщику';
UPDATE posting_categories SET contra_account = '92' WHERE name = 'Аренда помещения';
UPDATE posting_categories SET contra_account = '92' WHERE name = 'Комиссия банка';
UPDATE posting_categories SET contra_account = '92' WHERE name = 'Прочее';
UPDATE posting_categories SET contra_account = '703' WHERE name = 'Приход Эквайринг';
UPDATE posting_categories SET contra_account = '377' WHERE name = 'Личный доход';
UPDATE posting_categories SET contra_account = '377' WHERE name = 'Личное';

ALTER TABLE cash_categories ADD COLUMN contra_account TEXT;
ALTER TABLE cash_categories ADD COLUMN requires_counterparty INTEGER NOT NULL DEFAULT 0;

UPDATE cash_categories SET contra_account = '702' WHERE name = 'Выручка от продаж';
UPDATE cash_categories SET contra_account = '703' WHERE name = 'Прочий приход';
UPDATE cash_categories SET contra_account = '63', requires_counterparty = 1 WHERE name = 'Закупка товара';
UPDATE cash_categories SET contra_account = '661' WHERE name = 'Зарплата';
UPDATE cash_categories SET contra_account = '31' WHERE name = 'Съём';
UPDATE cash_categories SET contra_account = '92' WHERE name = 'Хозрасходы';
UPDATE cash_categories SET contra_account = '92' WHERE name = 'Прочее';
UPDATE cash_categories SET contra_account = '333' WHERE name = 'Оплата картой';

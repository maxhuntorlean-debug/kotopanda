-- Migration number: 0025 	 категории карточки ("posting_categories") переходят с абстрактного
-- contra_account на полную проводку "Дт счёт/субконто, Кт счёт/субконто" — как у категорий кассы
-- (см. 0021_cash_categories_accounts.sql). Приход = Дт 31 (карта) / Кт <было contra_account>;
-- расход = Дт <было contra_account> / Кт 31. Суб конто стороны "31" не фиксируется здесь —
-- берётся из card_accounts.posting_subconto (аналог cash_registers.posting_subconto).
-- card_transactions.posting_category_id ссылается на posting_categories — переименование
-- таблицы SQLite/D1 переписало бы эту ссылку, поэтому колонки добавляются на месте;
-- contra_account/requires_counterparty остаются неиспользуемым, но безвредным наследием.

ALTER TABLE posting_categories ADD COLUMN debit_account TEXT;
ALTER TABLE posting_categories ADD COLUMN debit_subconto TEXT;
ALTER TABLE posting_categories ADD COLUMN credit_account TEXT;
ALTER TABLE posting_categories ADD COLUMN credit_subconto TEXT;

UPDATE posting_categories SET
	debit_account = CASE WHEN direction = 'income' THEN '31' ELSE COALESCE(contra_account, '92') END,
	credit_account = CASE WHEN direction = 'income' THEN COALESCE(contra_account, '71') ELSE '31' END;

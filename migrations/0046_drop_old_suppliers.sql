-- Migration number: 0046 	 снос старых Поставщиков (counterparties/supplier_invoices) —
-- дублировали справочник "Поставщики" в Настройках (test_suppliers, см. обсуждение "тестовые
-- станут боевыми"). card_transactions.counterparty_id — неиспользуемая колонка (card.ts всегда
-- писал субконто как свободный текст в subconto, не через эту FK), убираем её первой, иначе
-- DROP TABLE counterparties упрётся в висящую ссылку.
ALTER TABLE card_transactions DROP COLUMN counterparty_id;
DROP TABLE supplier_invoices;
DROP TABLE counterparties;

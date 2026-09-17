-- Migration number: 0045 	 снос старых справочников (own_accounts, cash_boxes, expense_items,
-- employees, other_operations) — подсказывали субконто для ручных проводок Бухгалтерии, которой
-- больше нет (снесена в 0044); Банк/Карта/Настройки, которые ими тоже пользовались (декоративно,
-- их разноска никуда не идёт), переведены на свободный текст. Поставщики (counterparties) не
-- трогаем — отдельная, живая таблица (см. invoices.ts).
DROP TABLE own_accounts;
DROP TABLE cash_boxes;
DROP TABLE expense_items;
DROP TABLE employees;
DROP TABLE other_operations;

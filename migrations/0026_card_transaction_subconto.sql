-- Migration number: 0026 	 у операций карточки появляется общее текстовое субконто
-- (card_transactions.subconto) — как cash_operations.subconto: для категорий, у которых
-- сторона-контрагент оставлена без фиксированного субконто (например, "Оплата поставщику"),
-- конкретное значение вводится каждый раз на самой операции, а не хардкодится на категории.
-- Заменяет прежний узкоспециализированный counterparty_id (FK только на поставщиков, не
-- годится для остальных справочников — своих счетов, касс, статей расходов). Переносим
-- уже проставленных поставщиков в новое поле; counterparty_id остаётся неиспользуемым,
-- но безвредным наследием.

ALTER TABLE card_transactions ADD COLUMN subconto TEXT;

UPDATE card_transactions SET subconto = (SELECT name FROM counterparties WHERE id = card_transactions.counterparty_id) WHERE counterparty_id IS NOT NULL;

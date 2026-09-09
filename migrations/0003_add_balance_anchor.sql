-- Migration number: 0003 	 add balance anchor to bank_accounts
-- ПриватБанк /balance/final отдаёт только баланс на конец последнего закрытого банковского дня
-- (игнорирует startDate/endDate), поэтому храним эту точку как якорь и считаем баланс
-- на любую дату от неё через сумму транзакций из bank_transactions.

ALTER TABLE bank_accounts ADD COLUMN balance_anchor_date TEXT;
ALTER TABLE bank_accounts ADD COLUMN balance_anchor_amount REAL;

-- Migration number: 0020 	 настройка "куда падают деньги" — субконто счёта 31 для
-- разнесённых банком операций (раньше жёстко было "31" без субконто).

ALTER TABLE bank_accounts ADD COLUMN posting_subconto TEXT;

UPDATE bank_accounts SET posting_subconto = (SELECT name FROM own_accounts ORDER BY sort_order LIMIT 1);

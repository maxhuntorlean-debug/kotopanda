-- Migration number: 0022 	 настройка "куда падают деньги" в кассе — субконто счёта 30
-- для разнесённых кассовых операций (аналог posting_subconto у bank_accounts для счёта 31).

ALTER TABLE cash_registers ADD COLUMN posting_subconto TEXT;

UPDATE cash_registers SET posting_subconto = (SELECT name FROM cash_boxes ORDER BY sort_order LIMIT 1);

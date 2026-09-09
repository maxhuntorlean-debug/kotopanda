-- Migration number: 0031 	 настройка "куда падают деньги" для документов Взаимозачёта —
-- субконто счёта 30, аналог posting_subconto у cash_registers/bank_accounts/card_accounts,
-- но Взаимозачёт не привязан к конкретной кассе/счёту, поэтому отдельная табличка на одну строку.

CREATE TABLE offset_settings (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	posting_subconto TEXT
);

INSERT INTO offset_settings (posting_subconto) VALUES (NULL);

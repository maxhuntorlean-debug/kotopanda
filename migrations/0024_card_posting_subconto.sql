-- Migration number: 0024 	 настройка "куда падают деньги" — субконто счёта 31 для
-- карточки "Универсальная" (второй свой счёт на том же счёте 31, что и Приватбанк, но
-- с отдельным субконто) — аналог posting_subconto у bank_accounts/cash_registers.
-- Без дефолта — субконто выбирается вручную в Настройках.

ALTER TABLE card_accounts ADD COLUMN posting_subconto TEXT;

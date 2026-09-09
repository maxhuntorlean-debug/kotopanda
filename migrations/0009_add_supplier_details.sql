-- Migration number: 0009 	 реквизиты поставщика для явного создания из справочника

ALTER TABLE counterparties ADD COLUMN iban TEXT;
ALTER TABLE counterparties ADD COLUMN tax_id TEXT;

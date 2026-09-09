-- Migration number: 0013 	 категория для оплат картой через терминал (вычитаются из налички при сверке кассы)

INSERT INTO cash_categories (name, direction, sort_order) VALUES
	('Оплата картой', 'expense', 5);

-- Migration number: 0004 	 add "Приход Эквайринг" posting category

INSERT INTO posting_categories (name, direction, sort_order) VALUES
	('Приход Эквайринг', 'income', 20);

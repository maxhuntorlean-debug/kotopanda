-- Migration number: 0007 	 rename "Закупка товара" -> "Оплата поставщику"

UPDATE posting_categories SET name = 'Оплата поставщику' WHERE name = 'Закупка товара';

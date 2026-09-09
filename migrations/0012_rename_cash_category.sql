-- Migration number: 0012 	 rename "Инкассация в банк" -> "Съём"

UPDATE cash_categories SET name = 'Съём' WHERE name = 'Инкассация в банк';

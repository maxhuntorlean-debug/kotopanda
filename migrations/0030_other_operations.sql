-- Migration number: 0030 	 новый справочник "Прочие операции" — субконто для счёта 68
-- (Прочие операции), по аналогии с Сотрудники (66) и Расходы (92).

CREATE TABLE other_operations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	sort_order INTEGER NOT NULL DEFAULT 0
);

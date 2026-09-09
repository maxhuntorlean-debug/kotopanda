-- Migration number: 0029 	 новый справочник "Сотрудники" — субконто для счёта 66 (Зарплата),
-- по аналогии с Поставщики (63) и Расходы (92).

CREATE TABLE employees (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	sort_order INTEGER NOT NULL DEFAULT 0
);

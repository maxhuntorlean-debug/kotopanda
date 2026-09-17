-- Migration number: 0035 	 седьмой тестовый справочник — Фирмы, та же форма, что и у
-- остальных пяти простых test_* справочников (id/name/sort_order).

CREATE TABLE test_firms (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO test_firms (name, sort_order) VALUES
	('Котопанда', 10),
	('Элитка', 20);

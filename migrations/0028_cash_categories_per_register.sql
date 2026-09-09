-- Migration number: 0028 	 категории кассы становятся отдельными для каждой кассы (Котопанда/
-- Элітка), а не общим на всё приложение списком — Елітка заводит свои категории сама.
-- Добавляем register_id и меняем уникальность имени с глобальной на "уникально в пределах
-- одной кассы" — SQLite не даёт поменять constraint через ALTER TABLE, поэтому rebuild.
-- Заодно убираем неиспользуемое наследие (contra_account/requires_counterparty — приложение
-- их давно не читает, см. 0021_cash_categories_accounts.sql).
--
-- cash_operations.category_id ссылается на cash_categories по FK. Порядок операций (создать
-- новую таблицу под ВРЕМЕННЫМ именем, скопировать данные, удалить старую cash_categories,
-- переименовать новую в cash_categories) выбран так, чтобы FK у cash_operations ни разу не
-- указывал в никуда — но одного этого мало: реальный D1 (в отличие от локального dev-инстанса
-- на пустых тестовых данных) не даёт выполнить DROP TABLE cash_categories, пока на неё есть
-- живые FK-ссылки из cash_operations (проверено отдельным тестом на проде на изолированных
-- таблицах) — поэтому оборачиваем rebuild в PRAGMA foreign_keys=OFF/ON.

PRAGMA foreign_keys=OFF;

CREATE TABLE cash_categories_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	register_id INTEGER NOT NULL REFERENCES cash_registers(id),
	name TEXT NOT NULL,
	direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
	debit_account TEXT NOT NULL,
	debit_subconto TEXT,
	credit_account TEXT NOT NULL,
	credit_subconto TEXT,
	sort_order INTEGER NOT NULL DEFAULT 0,
	UNIQUE (register_id, name)
);

INSERT INTO cash_categories_new (id, register_id, name, direction, debit_account, debit_subconto, credit_account, credit_subconto, sort_order)
	SELECT id, (SELECT id FROM cash_registers WHERE code = 'kotopanda'), name, direction, debit_account, debit_subconto, credit_account, credit_subconto, sort_order
	FROM cash_categories;

DROP TABLE cash_categories;
ALTER TABLE cash_categories_new RENAME TO cash_categories;

PRAGMA foreign_keys=ON;

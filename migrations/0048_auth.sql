-- Migration number: 0048 	 авторизация — роли, права по разделам, пользователи (см. обсуждение
-- "Сделаем авторизацию?"). is_admin у роли — полный доступ без проверки role_permissions (в т.ч.
-- единственная роль, которой доступен раздел "Администрирование"); у обычных ролей доступ к
-- разделу выдаётся явной строкой в role_permissions (section — ключ вида "sales-elitka", см.
-- sectionForPath в src/auth.ts).
CREATE TABLE roles (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	is_admin INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE role_permissions (
	role_id INTEGER NOT NULL REFERENCES roles(id),
	section TEXT NOT NULL,
	PRIMARY KEY (role_id, section)
);

CREATE TABLE users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role_id INTEGER NOT NULL REFERENCES roles(id),
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO roles (name, is_admin) VALUES ('Администратор', 1);
INSERT INTO roles (name, is_admin) VALUES ('Кассир', 0);
INSERT INTO role_permissions (role_id, section) VALUES ((SELECT id FROM roles WHERE name = 'Кассир'), 'sales-elitka');

-- pbkdf2$<iterations>$<salt-hex>$<hash-hex>, см. src/auth.ts hashPassword/verifyPassword.
INSERT INTO users (username, password_hash, role_id) VALUES (
	'admin',
	'pbkdf2$100000$5c488b5ca0d042ffe413964df0122295$c3ed3230ba45b43b8c7dbbe2a83ae4363a83f7af28528317ae54373f45da39b1',
	(SELECT id FROM roles WHERE name = 'Администратор')
);

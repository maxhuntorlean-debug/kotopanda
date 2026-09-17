-- Migration number: 0041 	 категории для тестовой Кассы (см. pages/cashTest.ts) — тот же смысл,
-- что и боевые cash_categories (Тип +/-, счёт+субконто с каждой стороны), но своя таблица на
-- фирму (firm_id, а не register_id — в тестовом наборе фирма и есть касса, 1:1 с боевыми
-- kotopanda/elitka). Субконто — id из тестовых справочников (test_own_accounts/test_cash_boxes/…),
-- а не свободный текст, как в боевой cash_categories: тестовая схема везде хранит субконто как id
-- (см. test_journal.debit_subconto_id/credit_subconto_id), тут та же логика для единообразия.
CREATE TABLE test_cash_categories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	firm_id INTEGER NOT NULL REFERENCES test_firms(id),
	name TEXT NOT NULL,
	direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
	debit_account TEXT NOT NULL REFERENCES test_chart_of_accounts(code),
	debit_subconto_id INTEGER,
	credit_account TEXT NOT NULL REFERENCES test_chart_of_accounts(code),
	credit_subconto_id INTEGER,
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Проводка кассовой операции (тест) — обычная строка test_journal (документ дня, doc_type='cash',
-- см. cashTest.ts), только дополнительно помеченная категорией, которой она создана — нужно для
-- отображения Тип/Вид при показе и для предзаполнения формы редактирования операции. NULL у строк,
-- заведённых не через Кассу (например, обычная "Операция").
ALTER TABLE test_journal ADD COLUMN category_id INTEGER REFERENCES test_cash_categories(id);

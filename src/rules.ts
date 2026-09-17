import { syncBankPosting } from "./bankPostingTest";

type PostingRule = {
	match_field: "counterparty_account" | "counterparty_name";
	match_value: string;
	posting_account: string;
	posting_subconto: string | null;
	auto_status: "done" | "review";
	firm_id: number | null;
};

export type RuleMatch = {
	posting_account: string;
	posting_subconto: string | null;
	status: "done" | "review";
	firm_id: number | null;
};

async function loadRules(db: D1Database): Promise<PostingRule[]> {
	const { results } = await db
		.prepare(`SELECT match_field, match_value, posting_account, posting_subconto, auto_status, firm_id FROM posting_rules ORDER BY priority DESC, id ASC`)
		.all<PostingRule>();
	return results;
}

function matchAgainst(rules: PostingRule[], counterpartyAccount: string | null, counterpartyName: string | null): RuleMatch | null {
	for (const rule of rules) {
		const value = rule.match_field === "counterparty_account" ? counterpartyAccount : counterpartyName;
		if (value && value === rule.match_value) {
			return { posting_account: rule.posting_account, posting_subconto: rule.posting_subconto, status: rule.auto_status, firm_id: rule.firm_id };
		}
	}
	return null;
}

// Загружает правила один раз и возвращает функцию сопоставления — используется и при
// синхронизации (по одной операции за раз), и при массовом прогоне по уже загруженным.
export async function createRuleMatcher(db: D1Database): Promise<(counterpartyAccount: string | null, counterpartyName: string | null) => RuleMatch | null> {
	const rules = await loadRules(db);
	return (counterpartyAccount, counterpartyName) => matchAgainst(rules, counterpartyAccount, counterpartyName);
}

// Задним числом применяет правила к уже загруженным операциям без разноски.
// Не трогает операции, которые уже размечены (вручную или предыдущим прогоном правил).
// Каждое совпадение сразу же проводится в test_journal через syncBankPosting (та же связка, что
// и ручное сохранение в drawer, см. transactions.ts) — поэтому здесь не единый batch, а
// последовательные запросы по каждой операции.
export async function applyRulesToExisting(env: Env): Promise<number> {
	const matcher = await createRuleMatcher(env.DB);

	const { results: candidates } = await env.DB.prepare(
		`SELECT id, operation_date, direction, amount, counterparty_account, counterparty_name FROM bank_transactions WHERE posting_account IS NULL`,
	).all<{
		id: number;
		operation_date: string;
		direction: "in" | "out";
		amount: number;
		counterparty_account: string | null;
		counterparty_name: string | null;
	}>();

	let applied = 0;
	for (const tx of candidates) {
		const match = matcher(tx.counterparty_account, tx.counterparty_name);
		if (!match) continue;

		await syncBankPosting(
			env,
			tx.id,
			{ operationDate: tx.operation_date, direction: tx.direction, amount: tx.amount, counterpartyName: tx.counterparty_name, journalDocumentId: null },
			match.posting_account,
			match.posting_subconto,
			match.firm_id,
		);
		await env.DB.prepare(`UPDATE bank_transactions SET status = ? WHERE id = ?`).bind(match.status, tx.id).run();
		applied++;
	}

	return applied;
}

export type RuleDisplay = {
	id: number;
	match_field: "counterparty_account" | "counterparty_name";
	match_value: string;
	auto_status: "done" | "review";
	priority: number;
	posting_account: string;
	posting_subconto: string | null;
};

export async function listRulesForDisplay(env: Env): Promise<RuleDisplay[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, match_field, match_value, auto_status, priority, posting_account, posting_subconto FROM posting_rules ORDER BY priority DESC, id ASC`,
	).all<RuleDisplay>();
	return results;
}

export type NewRuleInput = {
	matchField: "counterparty_account" | "counterparty_name";
	matchValue: string;
	postingAccount: string;
	postingSubconto: string | null;
	autoStatus: "done" | "review";
	priority: number;
	firmId: number | null;
};

// Не создаёт дубль, если правило с таким же условием (тип + значение) уже есть —
// это и ручное создание из раздела «Правила», и галочка «Добавить правило» в операции.
export async function createRule(env: Env, input: NewRuleInput): Promise<void> {
	const existing = await env.DB.prepare(`SELECT id FROM posting_rules WHERE match_field = ? AND match_value = ?`)
		.bind(input.matchField, input.matchValue)
		.first<{ id: number }>();
	if (existing) return;

	await env.DB.prepare(
		`INSERT INTO posting_rules (match_field, match_value, posting_account, posting_subconto, auto_status, priority, firm_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(input.matchField, input.matchValue, input.postingAccount, input.postingSubconto, input.autoStatus, input.priority, input.firmId)
		.run();
}

export async function deleteRule(env: Env, id: number): Promise<void> {
	await env.DB.prepare(`DELETE FROM posting_rules WHERE id = ?`).bind(id).run();
}

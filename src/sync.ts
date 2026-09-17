import { fetchPrivatBalanceAnchor, fetchPrivatTransactions, type PrivatTransaction } from "./privat";
import { createRuleMatcher } from "./rules";

// Банк переходит на новую (тестовую) схему разноски — старые данные и правила разноски
// очищены (см. обсуждение "тестовые станут боевыми"), поэтому первая синхронизация после
// очистки не должна утягивать всю историю или "последние 30 дней", а должна начинаться
// ровно с той даты, с которой дальше операции будут вручную разноситься в новые таблицы.
const BANK_SYNC_START_DATE = "2026-09-01";

function displayDateToIso(d: string): string {
	const [day, month, year] = d.split(".");
	return `${year}-${month}-${day}`;
}

export type SyncResult = {
	fetched: number;
	added: number;
};

export async function syncBankAccount(env: Env): Promise<SyncResult> {
	const account = await env.DB.prepare(`SELECT id, iban FROM bank_accounts LIMIT 1`).first<{ id: number; iban: string }>();

	if (!account) {
		throw new Error("Счёт не найден в базе");
	}

	const lastDate = await env.DB.prepare(`SELECT MAX(operation_date) AS max_date FROM bank_transactions WHERE account_id = ?`)
		.bind(account.id)
		.first<{ max_date: string | null }>();

	const today = new Date().toISOString().slice(0, 10);
	// Начинаем с даты последней сохранённой операции (включительно) — новые операции
	// в этот же день не потеряются, а дубликаты отсеются через INSERT OR IGNORE. Если операций
	// в базе ещё нет вовсе (первая синхронизация после очистки) — с BANK_SYNC_START_DATE, а не
	// с "последних 30 дней", как раньше.
	const startDate = lastDate?.max_date ?? BANK_SYNC_START_DATE;

	const transactions = await fetchPrivatTransactions(env, account.iban, startDate, today);

	let added = 0;
	if (transactions.length > 0) {
		const matcher = await createRuleMatcher(env.DB);

		const statements = transactions.map((t: PrivatTransaction) => {
			const match = matcher(t.AUT_CNTR_ACC ?? null, t.AUT_CNTR_NAM ?? null);

			return env.DB.prepare(
				`INSERT INTO bank_transactions
					(account_id, external_id, operation_date, direction, amount, currency, counterparty_name, counterparty_account, purpose, status, posting_account, posting_subconto, raw_json)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(account_id, external_id) DO NOTHING`,
			).bind(
				account.id,
				t.ID,
				displayDateToIso(t.DAT_OD),
				t.TRANTYPE === "C" ? "in" : "out",
				Math.abs(parseFloat(t.SUM)),
				t.CCY,
				t.AUT_CNTR_NAM ?? null,
				t.AUT_CNTR_ACC ?? null,
				t.OSND ?? null,
				match?.status ?? "review",
				match?.posting_account ?? null,
				match?.posting_subconto ?? null,
				JSON.stringify(t),
			);
		});

		const results = await env.DB.batch(statements);
		added = results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
	}

	const anchor = await fetchPrivatBalanceAnchor(env, account.iban);
	if (anchor) {
		await env.DB.prepare(`UPDATE bank_accounts SET balance_anchor_date = ?, balance_anchor_amount = ? WHERE id = ?`)
			.bind(anchor.date, anchor.amount, account.id)
			.run();
	}

	return { fetched: transactions.length, added };
}

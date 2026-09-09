export async function updateTransaction(env: Env, id: number, account: string | null, subconto: string | null): Promise<void> {
	await env.DB.prepare(`UPDATE bank_transactions SET posting_account = ?, posting_subconto = ? WHERE id = ?`).bind(account, subconto, id).run();
}

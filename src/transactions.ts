import { syncBankPosting } from "./bankPostingTest";

export async function updateTransaction(env: Env, id: number, account: string | null, subconto: string | null, firmId: number | null): Promise<void> {
	const tx = await env.DB.prepare(`SELECT operation_date, direction, amount, counterparty_name, journal_document_id FROM bank_transactions WHERE id = ?`)
		.bind(id)
		.first<{ operation_date: string; direction: "in" | "out"; amount: number; counterparty_name: string | null; journal_document_id: number | null }>();
	if (!tx) return;

	await syncBankPosting(
		env,
		id,
		{
			operationDate: tx.operation_date,
			direction: tx.direction,
			amount: tx.amount,
			counterpartyName: tx.counterparty_name,
			journalDocumentId: tx.journal_document_id,
		},
		account,
		subconto,
		firmId,
	);
}

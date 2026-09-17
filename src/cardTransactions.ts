import { getPostingCategory } from "./card";
import { syncCardPosting } from "./cardPostingTest";

export async function updateTransaction(env: Env, id: number, postingCategoryId: number | null, subconto: string | null, firmId: number | null): Promise<void> {
	const tx = await env.DB.prepare(`SELECT operation_date, amount, description, journal_document_id FROM card_transactions WHERE id = ?`)
		.bind(id)
		.first<{ operation_date: string; amount: number; description: string | null; journal_document_id: number | null }>();
	if (!tx) return;

	const category = postingCategoryId ? await getPostingCategory(env, postingCategoryId) : null;

	await syncCardPosting(
		env,
		id,
		{ operationDate: tx.operation_date, amount: tx.amount, description: tx.description, journalDocumentId: tx.journal_document_id },
		category,
		subconto,
		firmId,
	);
}

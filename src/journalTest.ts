// Данные для тестовой Оборотки — читает только test_journal (см. migrations/0036), одним
// запросом на весь диапазон "с начала времён до конца периода", без джойнов на test_documents
// и без обращения к другим таблицам. Именно это и проверяем: одна таблица, один запрос.

export type TestJournalRow = {
	id: number;
	documentId: number;
	firmId: number;
	entryDate: string;
	debitAccount: string;
	debitSubcontoId: number | null;
	creditAccount: string;
	creditSubcontoId: number | null;
	amount: number;
};

export async function listTestJournalUpTo(env: Env, firmId: number, to: string): Promise<TestJournalRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, document_id, firm_id, entry_date, debit_account, debit_subconto_id, credit_account, credit_subconto_id, amount
		 FROM test_journal WHERE firm_id = ? AND entry_date <= ? ORDER BY entry_date`,
	)
		.bind(firmId, to)
		.all<{
			id: number;
			document_id: number;
			firm_id: number;
			entry_date: string;
			debit_account: string;
			debit_subconto_id: number | null;
			credit_account: string;
			credit_subconto_id: number | null;
			amount: number;
		}>();

	return results.map((r) => ({
		id: r.id,
		documentId: r.document_id,
		firmId: r.firm_id,
		entryDate: r.entry_date,
		debitAccount: r.debit_account,
		debitSubcontoId: r.debit_subconto_id,
		creditAccount: r.credit_account,
		creditSubcontoId: r.credit_subconto_id,
		amount: r.amount,
	}));
}

import { listChartAccountsTest } from "./chartOfAccountsTest";
import { listTestRefItems } from "./referencesTest";
import { SOURCE_ACCOUNT_BANK } from "./accounting";

async function resolveBankSubconto(env: Env, account: string, subcontoText: string | null): Promise<{ subcontoId: number | null; comment: string | null }> {
	if (!subcontoText) return { subcontoId: null, comment: null };
	const accounts = await listChartAccountsTest(env);
	const acc = accounts.find((a) => a.code === account);
	if (!acc?.refKind) return { subcontoId: null, comment: subcontoText };
	const items = await listTestRefItems(env, acc.refKind);
	const found = items.find((i) => i.name === subcontoText);
	// Значение не найдено в справочнике (например, руками вписали текст в поле счёта без refKind,
	// а затем сменили счёт на тот, что со справочником) — не роняем сохранение, просто кладём как
	// комментарий к проводке вместо subconto_id.
	return found ? { subcontoId: found.id, comment: null } : { subcontoId: null, comment: subcontoText };
}

export type BankTxForPosting = {
	operationDate: string;
	direction: "in" | "out";
	amount: number;
	counterpartyName: string | null;
	journalDocumentId: number | null;
};

// Пишет/обновляет/удаляет парную проводку в test_journal для банковской операции (второй
// стороной всегда SOURCE_ACCOUNT_BANK, "31" — Расчётный счёт) и синхронно обновляет
// bank_transactions.{posting_account,posting_subconto,firm_id,journal_document_id} — оба шага
// нарочно в одной функции и в таком порядке: снять ссылку bank_transactions.journal_document_id
// с документа НАДО раньше, чем удалять сам документ, иначе FK bank_transactions.journal_document_id
// → test_documents(id) не даст его удалить.
export async function syncBankPosting(
	env: Env,
	txId: number,
	tx: BankTxForPosting,
	account: string | null,
	subcontoText: string | null,
	firmId: number | null,
): Promise<void> {
	if (!account || !firmId) {
		await env.DB.prepare(`UPDATE bank_transactions SET posting_account = NULL, posting_subconto = NULL, firm_id = NULL, journal_document_id = NULL WHERE id = ?`)
			.bind(txId)
			.run();
		if (tx.journalDocumentId) {
			await env.DB.prepare(`DELETE FROM test_journal WHERE document_id = ?`).bind(tx.journalDocumentId).run();
			await env.DB.prepare(`DELETE FROM test_documents WHERE id = ?`).bind(tx.journalDocumentId).run();
		}
		return;
	}

	const { subcontoId, comment } = await resolveBankSubconto(env, account, subcontoText);

	// Сторона проводки по самому счёту 31 тоже должна нести субконто — то, что задано для
	// Приватбанка в Настройки → Учёт (bank_accounts.posting_subconto, например "Основний р.с.").
	// Раньше эта сторона всегда уходила без субконто — забыли её подставить.
	const bankAccount = await env.DB.prepare(`SELECT posting_subconto FROM bank_accounts LIMIT 1`).first<{ posting_subconto: string | null }>();
	const { subcontoId: bankSubcontoId } = await resolveBankSubconto(env, SOURCE_ACCOUNT_BANK, bankAccount?.posting_subconto ?? null);

	const debitAccount = tx.direction === "in" ? SOURCE_ACCOUNT_BANK : account;
	const creditAccount = tx.direction === "in" ? account : SOURCE_ACCOUNT_BANK;
	const debitSubcontoId = tx.direction === "in" ? bankSubcontoId : subcontoId;
	const creditSubcontoId = tx.direction === "in" ? subcontoId : bankSubcontoId;

	let documentId = tx.journalDocumentId;
	if (documentId) {
		await env.DB.prepare(`UPDATE test_documents SET doc_date = ?, firm_id = ?, description = ? WHERE id = ?`)
			.bind(tx.operationDate, firmId, tx.counterpartyName, documentId)
			.run();
		await env.DB.prepare(`DELETE FROM test_journal WHERE document_id = ?`).bind(documentId).run();
	} else {
		const created = await env.DB.prepare(`INSERT INTO test_documents (doc_type, doc_date, description, firm_id) VALUES ('bank', ?, ?, ?) RETURNING id`)
			.bind(tx.operationDate, tx.counterpartyName, firmId)
			.first<{ id: number }>();
		if (!created) throw new Error("Не удалось создать документ банка");
		documentId = created.id;
	}

	await env.DB.prepare(
		`INSERT INTO test_journal (document_id, firm_id, entry_date, debit_account, debit_subconto_id, credit_account, credit_subconto_id, amount, comment)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(documentId, firmId, tx.operationDate, debitAccount, debitSubcontoId, creditAccount, creditSubcontoId, tx.amount, comment)
		.run();

	await env.DB.prepare(`UPDATE bank_transactions SET posting_account = ?, posting_subconto = ?, firm_id = ?, journal_document_id = ? WHERE id = ?`)
		.bind(account, subcontoText, firmId, documentId, txId)
		.run();
}

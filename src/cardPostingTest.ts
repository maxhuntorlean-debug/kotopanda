import { CHART_OF_ACCOUNTS } from "./accounting";
import { listTestRefItems } from "./referencesTest";
import { CARD_ACCOUNT, type PostingCategoryRow } from "./card";

async function resolveSubcontoByAccount(env: Env, account: string, text: string | null): Promise<{ id: number | null; comment: string | null }> {
	if (!text) return { id: null, comment: null };
	const acc = CHART_OF_ACCOUNTS.find((a) => a.code === account);
	if (!acc?.refKind) return { id: null, comment: text };
	const items = await listTestRefItems(env, acc.refKind);
	const found = items.find((i) => i.name === text);
	// Не нашли в справочнике (например, руками вписали текст в поле без refKind, а затем сменили
	// счёт) — не роняем сохранение, кладём как комментарий к проводке вместо subconto_id.
	return found ? { id: found.id, comment: null } : { id: null, comment: text };
}

// Категория всегда одной стороной — счёт 31 (CARD_ACCOUNT, см. deriveDirection в card.ts), у него
// субконто общее на всю карту (card_accounts.posting_subconto, настраивается в Настройках, та же
// идея, что и "Основний р.с." у Банка — см. обсуждение "Приватбанк это основной р.с забыл?").
// Другая сторона — либо с зафиксированным на самой категории субконто (введено при создании
// категории), либо "свободная": берёт значение из поля "Субконто" на конкретной операции.
function cardFreeSide(category: PostingCategoryRow): "debit" | "credit" | null {
	if (category.debit_account !== CARD_ACCOUNT && !category.debit_subconto) return "debit";
	if (category.credit_account !== CARD_ACCOUNT && !category.credit_subconto) return "credit";
	return null;
}

export type CardTxForPosting = {
	operationDate: string;
	amount: number;
	description: string | null;
	journalDocumentId: number | null;
};

// Пишет/обновляет/удаляет парную проводку в test_journal для операции карты и синхронно
// обновляет card_transactions.{posting_category_id,subconto,firm_id,journal_document_id} — та же
// связка "снять ссылку раньше, чем удалять документ", что и в bankPostingTest.ts (иначе FK
// card_transactions.journal_document_id → test_documents(id) не даст его удалить).
export async function syncCardPosting(
	env: Env,
	txId: number,
	tx: CardTxForPosting,
	category: PostingCategoryRow | null,
	freeSubcontoText: string | null,
	firmId: number | null,
): Promise<void> {
	if (!category || !firmId) {
		await env.DB.prepare(`UPDATE card_transactions SET posting_category_id = NULL, subconto = NULL, firm_id = NULL, journal_document_id = NULL WHERE id = ?`)
			.bind(txId)
			.run();
		if (tx.journalDocumentId) {
			await env.DB.prepare(`DELETE FROM test_journal WHERE document_id = ?`).bind(tx.journalDocumentId).run();
			await env.DB.prepare(`DELETE FROM test_documents WHERE id = ?`).bind(tx.journalDocumentId).run();
		}
		return;
	}

	const cardAccountRow = await env.DB.prepare(`SELECT posting_subconto FROM card_accounts LIMIT 1`).first<{ posting_subconto: string | null }>();
	const freeSide = cardFreeSide(category);

	async function sideValue(account: string, side: "debit" | "credit", fixedText: string | null): Promise<{ id: number | null; comment: string | null }> {
		if (account === CARD_ACCOUNT) return resolveSubcontoByAccount(env, account, cardAccountRow?.posting_subconto ?? null);
		if (side === freeSide) return resolveSubcontoByAccount(env, account, freeSubcontoText);
		return resolveSubcontoByAccount(env, account, fixedText);
	}

	const debit = await sideValue(category.debit_account, "debit", category.debit_subconto);
	const credit = await sideValue(category.credit_account, "credit", category.credit_subconto);
	const comment = debit.comment ?? credit.comment ?? null;

	let documentId = tx.journalDocumentId;
	if (documentId) {
		await env.DB.prepare(`UPDATE test_documents SET doc_date = ?, firm_id = ?, description = ? WHERE id = ?`)
			.bind(tx.operationDate, firmId, tx.description, documentId)
			.run();
		await env.DB.prepare(`DELETE FROM test_journal WHERE document_id = ?`).bind(documentId).run();
	} else {
		const created = await env.DB.prepare(`INSERT INTO test_documents (doc_type, doc_date, description, firm_id) VALUES ('card', ?, ?, ?) RETURNING id`)
			.bind(tx.operationDate, tx.description, firmId)
			.first<{ id: number }>();
		if (!created) throw new Error("Не удалось создать документ карты");
		documentId = created.id;
	}

	await env.DB.prepare(
		`INSERT INTO test_journal (document_id, firm_id, entry_date, debit_account, debit_subconto_id, credit_account, credit_subconto_id, amount, comment)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(documentId, firmId, tx.operationDate, category.debit_account, debit.id, category.credit_account, credit.id, tx.amount, comment)
		.run();

	await env.DB.prepare(`UPDATE card_transactions SET posting_category_id = ?, subconto = ?, firm_id = ?, journal_document_id = ? WHERE id = ?`)
		.bind(category.id, freeSubcontoText, firmId, documentId, txId)
		.run();
}

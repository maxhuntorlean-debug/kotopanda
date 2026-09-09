import { createManualEntry, updateManualEntry, deleteManualEntry, type ManualEntryInput } from "./accounting";

export type OffsetDirection = "kotopanda_to_elitka" | "elitka_to_kotopanda";

export type OffsetDocument = {
	id: number;
	docDate: string;
	direction: OffsetDirection;
	kotopandaAccount: string;
	kotopandaSubconto: string | null;
	elitkaAccount: string;
	elitkaSubconto: string | null;
	amount: number;
	description: string | null;
};

export type OffsetDocumentInput = {
	docDate: string;
	direction: OffsetDirection;
	kotopandaAccount: string;
	kotopandaSubconto: string | null;
	elitkaAccount: string;
	elitkaSubconto: string | null;
	amount: number;
	description: string | null;
};

const OFFSET_ACCOUNT = "30";

async function getOffsetPostingSubconto(env: Env): Promise<string | null> {
	const row = await env.DB.prepare(`SELECT posting_subconto FROM offset_settings LIMIT 1`).first<{ posting_subconto: string | null }>();
	return row?.posting_subconto ?? null;
}

// Сторона, которая "даёт", проводит через субконто Взаимозачёта как расход (Кт 30/офсет —
// ценность "ушла" через клиринговую ячейку), сторона, которая "получает" — как приход
// (Дт 30/офсет). См. образец разноски, по которому это сверено.
function buildEntries(offsetSubconto: string | null, input: OffsetDocumentInput): { kotopanda: ManualEntryInput; elitka: ManualEntryInput } {
	const kotopandaGives = input.direction === "kotopanda_to_elitka";
	const base = { entryDate: input.docDate, quantity: null, amount: input.amount, description: input.description };

	const kotopanda: ManualEntryInput = kotopandaGives
		? { ...base, debitAccount: OFFSET_ACCOUNT, debitSubconto: offsetSubconto, creditAccount: input.kotopandaAccount, creditSubconto: input.kotopandaSubconto }
		: { ...base, debitAccount: input.kotopandaAccount, debitSubconto: input.kotopandaSubconto, creditAccount: OFFSET_ACCOUNT, creditSubconto: offsetSubconto };

	const elitka: ManualEntryInput = kotopandaGives
		? { ...base, debitAccount: input.elitkaAccount, debitSubconto: input.elitkaSubconto, creditAccount: OFFSET_ACCOUNT, creditSubconto: offsetSubconto }
		: { ...base, debitAccount: OFFSET_ACCOUNT, debitSubconto: offsetSubconto, creditAccount: input.elitkaAccount, creditSubconto: input.elitkaSubconto };

	return { kotopanda, elitka };
}

// Взаимозачёт — по одной ручной проводке в каждой книге, связанные общим субконто счёта 30
// (Настройки → Взаимозачёт).
export async function createOffsetDocument(env: Env, input: OffsetDocumentInput): Promise<void> {
	const offsetSubconto = await getOffsetPostingSubconto(env);
	const { kotopanda, elitka } = buildEntries(offsetSubconto, input);

	const kotopandaEntryId = await createManualEntry(env, "kotopanda", kotopanda);
	const elitkaEntryId = await createManualEntry(env, "elitka", elitka);

	await env.DB.prepare(
		`INSERT INTO offset_documents (doc_date, direction, kotopanda_account, kotopanda_subconto, elitka_account, elitka_subconto, amount, description, kotopanda_entry_id, elitka_entry_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			input.docDate,
			input.direction,
			input.kotopandaAccount,
			input.kotopandaSubconto,
			input.elitkaAccount,
			input.elitkaSubconto,
			input.amount,
			input.description,
			kotopandaEntryId,
			elitkaEntryId,
		)
		.run();
}

// Редактирование — пересчитывает обе проводки по (возможно изменившимся) направлению/счетам/
// сумме и обновляет их на месте (id проводок не меняются), плюс сам документ.
export async function updateOffsetDocument(env: Env, id: number, input: OffsetDocumentInput): Promise<void> {
	const doc = await env.DB.prepare(`SELECT kotopanda_entry_id, elitka_entry_id FROM offset_documents WHERE id = ?`)
		.bind(id)
		.first<{ kotopanda_entry_id: number; elitka_entry_id: number }>();
	if (!doc) return;

	const offsetSubconto = await getOffsetPostingSubconto(env);
	const { kotopanda, elitka } = buildEntries(offsetSubconto, input);

	await updateManualEntry(env, doc.kotopanda_entry_id, kotopanda);
	await updateManualEntry(env, doc.elitka_entry_id, elitka);

	await env.DB.prepare(
		`UPDATE offset_documents SET doc_date = ?, direction = ?, kotopanda_account = ?, kotopanda_subconto = ?, elitka_account = ?, elitka_subconto = ?, amount = ?, description = ? WHERE id = ?`,
	)
		.bind(input.docDate, input.direction, input.kotopandaAccount, input.kotopandaSubconto, input.elitkaAccount, input.elitkaSubconto, input.amount, input.description, id)
		.run();
}

export async function listOffsetDocuments(env: Env, from: string, to: string): Promise<OffsetDocument[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, doc_date, direction, kotopanda_account, kotopanda_subconto, elitka_account, elitka_subconto, amount, description
		 FROM offset_documents WHERE doc_date BETWEEN ? AND ? ORDER BY doc_date DESC, id DESC`,
	)
		.bind(from, to)
		.all<{
			id: number;
			doc_date: string;
			direction: OffsetDirection;
			kotopanda_account: string;
			kotopanda_subconto: string | null;
			elitka_account: string;
			elitka_subconto: string | null;
			amount: number;
			description: string | null;
		}>();

	return results.map((r) => ({
		id: r.id,
		docDate: r.doc_date,
		direction: r.direction,
		kotopandaAccount: r.kotopanda_account,
		kotopandaSubconto: r.kotopanda_subconto,
		elitkaAccount: r.elitka_account,
		elitkaSubconto: r.elitka_subconto,
		amount: r.amount,
		description: r.description,
	}));
}

export async function deleteOffsetDocument(env: Env, id: number): Promise<void> {
	const doc = await env.DB.prepare(`SELECT kotopanda_entry_id, elitka_entry_id FROM offset_documents WHERE id = ?`)
		.bind(id)
		.first<{ kotopanda_entry_id: number; elitka_entry_id: number }>();
	if (!doc) return;
	// Сначала убираем сам документ (он ссылается на обе проводки через FK), потом сами
	// проводки — иначе D1 на remote ругается на нарушение внешнего ключа.
	await env.DB.prepare(`DELETE FROM offset_documents WHERE id = ?`).bind(id).run();
	await deleteManualEntry(env, doc.kotopanda_entry_id);
	await deleteManualEntry(env, doc.elitka_entry_id);
}

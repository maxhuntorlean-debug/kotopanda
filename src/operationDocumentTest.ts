import { listChartAccountsTest, type ChartAccountTest } from "./chartOfAccountsTest";
import { listTestRefItems, type TestRefKind } from "./referencesTest";
import { addDaysIso } from "./format";

// Код фирмы в URL/форме ("kotopanda"/"elitka") — тот же приём, что Ledger в accounting.ts, только
// свой набор фирм (test_firms), не завязанный на боевые книги.
export type TestFirmCode = "kotopanda" | "elitka";

export const TEST_FIRM_NAME: Record<TestFirmCode, string> = {
	kotopanda: "Котопанда",
	elitka: "Элитка",
};

export async function resolveTestFirmId(env: Env, firm: TestFirmCode): Promise<number> {
	const firms = await listTestRefItems(env, "firms");
	const name = TEST_FIRM_NAME[firm];
	const found = firms.find((f) => f.name === name) ?? firms[0];
	if (!found) throw new Error(`Тестовая фирма «${name}» не найдена`);
	return found.id;
}

export type TestSubcontoOption = { id: number; name: string };

const SUBCONTO_KINDS: TestRefKind[] = ["ownAccounts", "cashBoxes", "suppliers", "expenseItems", "employees", "otherOperations"];

export type TestSubcontoContext = {
	accounts: ChartAccountTest[];
	// Для выпадающих списков в форме документа — какие субконто предложить для конкретного счёта.
	accountSubcontoOptions: Record<string, TestSubcontoOption[]>;
	// Для отображения уже сохранённых проводок — обратный поиск "по виду справочника и id -> имя"
	// (id не глобально уникальны — у каждой из семи test_*-таблиц свой счётчик).
	subcontoNameByKindId: Record<TestRefKind, Map<number, string>>;
};

export async function loadTestSubcontoContext(env: Env): Promise<TestSubcontoContext> {
	const [accounts, ...lists] = await Promise.all([listChartAccountsTest(env), ...SUBCONTO_KINDS.map((kind) => listTestRefItems(env, kind))]);

	const optionsByKind = new Map<TestRefKind, TestSubcontoOption[]>();
	const subcontoNameByKindId = {} as Record<TestRefKind, Map<number, string>>;
	SUBCONTO_KINDS.forEach((kind, i) => {
		optionsByKind.set(kind, lists[i]);
		subcontoNameByKindId[kind] = new Map(lists[i].map((item) => [item.id, item.name]));
	});

	const accountSubcontoOptions: Record<string, TestSubcontoOption[]> = {};
	for (const acc of accounts) {
		if (acc.refKind && optionsByKind.has(acc.refKind)) {
			accountSubcontoOptions[acc.code] = optionsByKind.get(acc.refKind)!;
		}
	}

	return { accounts, accountSubcontoOptions, subcontoNameByKindId };
}

export function resolveSubcontoName(ctx: TestSubcontoContext, accountCode: string, subcontoId: number | null): string | null {
	if (subcontoId === null) return null;
	const acc = ctx.accounts.find((a) => a.code === accountCode);
	if (!acc?.refKind) return null;
	return ctx.subcontoNameByKindId[acc.refKind]?.get(subcontoId) ?? null;
}

export type TestOperationLineInput = {
	debitAccount: string;
	debitSubcontoId: number | null;
	creditAccount: string;
	creditSubcontoId: number | null;
	amount: number;
	comment: string | null;
};

export type TestOperationDocumentInput = {
	docDate: string;
	description: string | null;
	firmId: number;
	lines: TestOperationLineInput[];
};

// Документ "Операция" — doc_type='manual', одна строка test_documents (с её же firm_id, см.
// migrations/0040) и N строк test_journal с одним и тем же document_id. Все строки документа
// проводятся по той фирме, что передана целиком на документ.
export async function createTestOperationDocument(env: Env, input: TestOperationDocumentInput): Promise<void> {
	const doc = await env.DB.prepare(`INSERT INTO test_documents (doc_type, doc_date, description, firm_id) VALUES ('manual', ?, ?, ?)`)
		.bind(input.docDate, input.description, input.firmId)
		.run();
	const documentId = doc.meta.last_row_id;

	for (const line of input.lines) {
		await env.DB.prepare(
			`INSERT INTO test_journal (document_id, firm_id, entry_date, debit_account, debit_subconto_id, credit_account, credit_subconto_id, amount, comment)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(documentId, input.firmId, input.docDate, line.debitAccount, line.debitSubcontoId, line.creditAccount, line.creditSubcontoId, line.amount, line.comment)
			.run();
	}
}

export type TestOperationDocumentWithLines = {
	docDate: string;
	description: string | null;
	firmId: number | null;
	lines: TestOperationLineInput[];
};

// Для формы редактирования — сам документ (шапка) плюс его строки в исходном порядке (id),
// в том же виде TestOperationLineInput, в каком их принимает createTestOperationDocument/
// updateTestOperationDocument.
export async function getTestOperationDocument(env: Env, documentId: number): Promise<TestOperationDocumentWithLines | null> {
	const doc = await env.DB.prepare(`SELECT doc_date, description, firm_id FROM test_documents WHERE id = ?`).bind(documentId).first<{
		doc_date: string;
		description: string | null;
		firm_id: number | null;
	}>();
	if (!doc) return null;

	const { results } = await env.DB.prepare(
		`SELECT debit_account, debit_subconto_id, credit_account, credit_subconto_id, amount, comment
		 FROM test_journal WHERE document_id = ? ORDER BY id`,
	)
		.bind(documentId)
		.all<{
			debit_account: string;
			debit_subconto_id: number | null;
			credit_account: string;
			credit_subconto_id: number | null;
			amount: number;
			comment: string | null;
		}>();

	return {
		docDate: doc.doc_date,
		description: doc.description,
		firmId: doc.firm_id,
		lines: results.map((r) => ({
			debitAccount: r.debit_account,
			debitSubcontoId: r.debit_subconto_id,
			creditAccount: r.credit_account,
			creditSubcontoId: r.credit_subconto_id,
			amount: r.amount,
			comment: r.comment,
		})),
	};
}

// Редактирование заменяет строки документа целиком (удалить все + вставить заново) — проще и
// надёжнее, чем сверять построчно старый/новый набор, а id самих строк journal_entries нигде
// снаружи документа не используются (в отличие от журнала правок, там id проводки важен). Фирма
// у документа не меняется при редактировании — берём её из уже сохранённого test_documents.firm_id,
// а не запрашиваем заново у вызывающей стороны (той негде её надёжно взять для формы редактирования).
export async function updateTestOperationDocument(env: Env, documentId: number, input: Omit<TestOperationDocumentInput, "firmId">): Promise<void> {
	const doc = await env.DB.prepare(`SELECT firm_id FROM test_documents WHERE id = ?`).bind(documentId).first<{ firm_id: number | null }>();
	const firmId = doc?.firm_id ?? null;

	await env.DB.prepare(`UPDATE test_documents SET doc_date = ?, description = ? WHERE id = ?`).bind(input.docDate, input.description, documentId).run();
	await env.DB.prepare(`DELETE FROM test_journal WHERE document_id = ?`).bind(documentId).run();

	for (const line of input.lines) {
		await env.DB.prepare(
			`INSERT INTO test_journal (document_id, firm_id, entry_date, debit_account, debit_subconto_id, credit_account, credit_subconto_id, amount, comment)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(documentId, firmId, input.docDate, line.debitAccount, line.debitSubcontoId, line.creditAccount, line.creditSubcontoId, line.amount, line.comment)
			.run();
	}
}

export async function deleteTestOperationDocument(env: Env, documentId: number): Promise<void> {
	await env.DB.prepare(`DELETE FROM test_journal WHERE document_id = ?`).bind(documentId).run();
	await env.DB.prepare(`DELETE FROM test_documents WHERE id = ?`).bind(documentId).run();
}

export type TestJournalLineWithDoc = {
	id: number;
	documentId: number;
	docType: string;
	entryDate: string;
	debitAccount: string;
	debitSubcontoId: number | null;
	creditAccount: string;
	creditSubcontoId: number | null;
	amount: number;
	comment: string | null;
	description: string | null;
};

// Единственное место в этом наборе тестовых страниц, где журнал джойнится с документами —
// Оборотке это не нужно (см. journalTest.ts), а для списка проводок нужен комментарий документа
// как запасной вариант, если у самой проводки (j.comment) комментария нет. doc_type — чтобы
// Карточка счёта могла подписать документ верно ("Операция"/"Касса", см. renderTestAccountCardBlock
// в pages/journalTurnoverTest.ts), а не всегда одинаково.
export async function listTestJournalWithDocs(env: Env, firmId: number, from: string, to: string): Promise<TestJournalLineWithDoc[]> {
	const { results } = await env.DB.prepare(
		`SELECT j.id, j.document_id, d.doc_type, j.entry_date, j.debit_account, j.debit_subconto_id, j.credit_account, j.credit_subconto_id, j.amount, j.comment, d.description
		 FROM test_journal j JOIN test_documents d ON d.id = j.document_id
		 WHERE j.firm_id = ? AND j.entry_date BETWEEN ? AND ?
		 ORDER BY j.entry_date, j.id`,
	)
		.bind(firmId, from, to)
		.all<{
			id: number;
			document_id: number;
			doc_type: string;
			entry_date: string;
			debit_account: string;
			debit_subconto_id: number | null;
			credit_account: string;
			credit_subconto_id: number | null;
			amount: number;
			comment: string | null;
			description: string | null;
		}>();

	return results.map((r) => ({
		id: r.id,
		documentId: r.document_id,
		docType: r.doc_type,
		entryDate: r.entry_date,
		debitAccount: r.debit_account,
		debitSubcontoId: r.debit_subconto_id,
		creditAccount: r.credit_account,
		creditSubcontoId: r.credit_subconto_id,
		amount: r.amount,
		comment: r.comment,
		description: r.description,
	}));
}

export type TestAccountCardRow = {
	date: string;
	documentId: number;
	docType: string;
	id: number;
	counterAccount: string;
	counterSubcontoId: number | null;
	debit: number;
	credit: number;
	description: string;
	balance: number; // нарастающим итогом, знак: плюс — дебетовое сальдо, минус — кредитовое
};

// subcontoFilter: null — весь счёт целиком (без разбивки), "none" — только строки без субконто
// на этой стороне, число — только строки с этим конкретным id субконто (drill-down из ОСВ,
// см. renderJournalTurnoverTestPage). В отличие от боевой getAccountCard (сравнение по тексту
// субконто), тут сравниваем по id — он есть прямо в схеме test_journal, точнее и без коллизий.
function matchesTestSide(r: TestJournalLineWithDoc, side: "debit" | "credit", account: string, subcontoFilter: number | "none" | null): boolean {
	const rowAccount = side === "debit" ? r.debitAccount : r.creditAccount;
	if (rowAccount !== account) return false;
	if (subcontoFilter === null) return true;
	const subcontoId = side === "debit" ? r.debitSubcontoId : r.creditSubcontoId;
	return subcontoFilter === "none" ? subcontoId === null : subcontoId === subcontoFilter;
}

// Карточка счёта для тестового журнала — та же логика, что и боевая getAccountCard в
// accounting.ts (начальное сальдо + движения периода + сальдо на конец, нарастающим итогом),
// только источник — test_journal через listTestJournalWithDocs (даёт ещё и комментарий/описание
// документа для колонки "Операция").
export async function getTestAccountCard(
	env: Env,
	firmId: number,
	account: string,
	subcontoFilter: number | "none" | null,
	periodFrom: string,
	periodTo: string,
): Promise<{ openingBalance: number; rows: TestAccountCardRow[]; closingBalance: number }> {
	const openingRows = await listTestJournalWithDocs(env, firmId, "0001-01-01", addDaysIso(periodFrom, -1));
	const periodRows = await listTestJournalWithDocs(env, firmId, periodFrom, periodTo);

	let balance = 0;
	for (const r of openingRows) {
		if (matchesTestSide(r, "debit", account, subcontoFilter)) balance += r.amount;
		if (matchesTestSide(r, "credit", account, subcontoFilter)) balance -= r.amount;
	}
	const openingBalance = balance;

	const rows: TestAccountCardRow[] = periodRows
		.filter((r) => matchesTestSide(r, "debit", account, subcontoFilter) || matchesTestSide(r, "credit", account, subcontoFilter))
		.map((r) => {
			const debitMatch = matchesTestSide(r, "debit", account, subcontoFilter);
			const creditMatch = matchesTestSide(r, "credit", account, subcontoFilter);
			const debit = debitMatch ? r.amount : 0;
			const credit = creditMatch ? r.amount : 0;
			balance += debit - credit;
			return {
				date: r.entryDate,
				documentId: r.documentId,
				docType: r.docType,
				id: r.id,
				counterAccount: debitMatch ? r.creditAccount : r.debitAccount,
				counterSubcontoId: debitMatch ? r.creditSubcontoId : r.debitSubcontoId,
				debit,
				credit,
				description: r.comment ?? r.description ?? "—",
				balance,
			};
		});

	return { openingBalance, rows, closingBalance: balance };
}

export type TestDocumentSummary = {
	id: number;
	docType: string;
	docDate: string;
	description: string | null;
	lineCount: number;
	totalAmount: number;
};

// Журнал документов — один ряд на документ (не на проводку, см. listTestJournalWithDocs выше
// для постатейного списка). LEFT JOIN на test_journal, а не JOIN — документ без единой строки
// (например, только что созданная пустая "Операция", ещё не заполненная) тоже должен быть виден
// в списке, чтобы его можно было открыть и заполнить. Фирма теперь — свойство самого документа
// (d.firm_id, см. migrations/0040), а не выводится из его строк, поэтому пустой документ не
// "протекает" в список другой фирмы. Фильтруем по d.doc_date (не j.entry_date) — у документа
// без строк второго просто нет, а первое есть всегда.
// docType — необязательный фильтр по типу документа (например, 'manual' для страницы "Журнал
// Операций", которая должна показывать только сами Операции, а не зеркала кассы/банка/карты).
export async function listTestDocuments(env: Env, firmId: number, from: string, to: string, docType?: string): Promise<TestDocumentSummary[]> {
	const { results } = await env.DB.prepare(
		`SELECT d.id, d.doc_type, d.doc_date, d.description, COUNT(j.id) AS line_count, COALESCE(SUM(j.amount), 0) AS total_amount
		 FROM test_documents d
		 LEFT JOIN test_journal j ON j.document_id = d.id
		 WHERE d.firm_id = ? AND d.doc_date BETWEEN ? AND ? ${docType ? "AND d.doc_type = ?" : ""}
		 GROUP BY d.id
		 ORDER BY d.doc_date DESC, d.id DESC`,
	)
		.bind(...(docType ? [firmId, from, to, docType] : [firmId, from, to]))
		.all<{ id: number; doc_type: string; doc_date: string; description: string | null; line_count: number; total_amount: number }>();

	return results.map((r) => ({
		id: r.id,
		docType: r.doc_type,
		docDate: r.doc_date,
		description: r.description,
		lineCount: r.line_count,
		totalAmount: r.total_amount,
	}));
}






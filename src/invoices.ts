import { isNameUsedInEntries } from "./accounting";

export type SupplierSummary = { id: number; name: string };

export async function listSuppliers(env: Env): Promise<SupplierSummary[]> {
	const { results } = await env.DB.prepare(`SELECT id, name FROM counterparties WHERE is_supplier = 1 ORDER BY name`).all<SupplierSummary>();
	return results;
}

export type SupplierInfo = { id: number; name: string };

export async function getSupplier(env: Env, id: number): Promise<SupplierInfo | null> {
	return env.DB.prepare(`SELECT id, name FROM counterparties WHERE id = ? AND is_supplier = 1`).bind(id).first<SupplierInfo>();
}

export type SupplierFull = {
	id: number;
	name: string;
	iban: string | null;
	tax_id: string | null;
	default_category_id: number | null;
};

export async function getSupplierFull(env: Env, id: number): Promise<SupplierFull | null> {
	return env.DB.prepare(`SELECT id, name, iban, tax_id, default_category_id FROM counterparties WHERE id = ? AND is_supplier = 1`)
		.bind(id)
		.first<SupplierFull>();
}

export async function updateSupplier(env: Env, id: number, input: NewSupplierInput): Promise<void> {
	await env.DB.prepare(`UPDATE counterparties SET name = ?, iban = ?, tax_id = ?, default_category_id = ? WHERE id = ?`)
		.bind(input.name, input.iban, input.taxId, input.defaultCategoryId, id)
		.run();
}

export type DeleteResult = { ok: true } | { ok: false; reason: string };

// Удалить можно только поставщика без истории. Раньше это была FK-связь (counterparty_id),
// теперь и в банке, и в ручных проводках поставщик — просто субконто (текст), сверяем по имени.
export async function deleteSupplier(env: Env, id: number): Promise<DeleteResult> {
	const supplier = await env.DB.prepare(`SELECT name FROM counterparties WHERE id = ?`).bind(id).first<{ name: string }>();
	if (!supplier) return { ok: true };

	const paymentsCount = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bank_transactions WHERE posting_subconto = ?`).bind(supplier.name).first<{ n: number }>();
	if ((paymentsCount?.n ?? 0) > 0) {
		return { ok: false, reason: "У поставщика есть привязанные операции в банке" };
	}

	if (await isNameUsedInEntries(env, supplier.name)) {
		return { ok: false, reason: "есть проводки с таким субконто" };
	}

	const invoicesCount = await env.DB.prepare(`SELECT COUNT(*) AS n FROM supplier_invoices WHERE counterparty_id = ?`).bind(id).first<{ n: number }>();
	if ((invoicesCount?.n ?? 0) > 0) {
		return { ok: false, reason: "У поставщика есть накладные" };
	}

	await env.DB.batch([
		env.DB.prepare(`DELETE FROM posting_rules WHERE posting_subconto = ?`).bind(supplier.name),
		env.DB.prepare(`DELETE FROM counterparties WHERE id = ?`).bind(id),
	]);

	return { ok: true };
}

async function findOrCreateSupplier(env: Env, name: string): Promise<number> {
	const existing = await env.DB.prepare(`SELECT id FROM counterparties WHERE name = ?`).bind(name).first<{ id: number }>();
	if (existing) {
		await env.DB.prepare(`UPDATE counterparties SET is_supplier = 1 WHERE id = ?`).bind(existing.id).run();
		return existing.id;
	}

	const created = await env.DB.prepare(`INSERT INTO counterparties (name, is_supplier) VALUES (?, 1) RETURNING id`).bind(name).first<{ id: number }>();
	if (!created) throw new Error("Не удалось создать поставщика");
	return created.id;
}

export async function createSupplier(env: Env, name: string): Promise<number> {
	return findOrCreateSupplier(env, name.trim());
}

export type NewSupplierInput = {
	name: string;
	iban: string | null;
	taxId: string | null;
	defaultCategoryId: number | null;
};

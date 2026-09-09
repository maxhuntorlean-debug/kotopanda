import { renderBankPage } from "./pages/bank";
import { renderBankRulesPage } from "./pages/bankRules";
import { renderPlaceholderPage } from "./pages/placeholder";
import { renderSettingsPage } from "./pages/settings";
import { renderSuppliersListPage } from "./pages/suppliers";
import { renderOffsetPage } from "./pages/offset";
import { createOffsetDocument, updateOffsetDocument, deleteOffsetDocument, type OffsetDirection } from "./offset";
import { syncBankAccount } from "./sync";
import { updateTransaction } from "./transactions";
import { applyRulesToExisting, createRule, deleteRule } from "./rules";
import { createSupplier, updateSupplier, deleteSupplier, getSupplierFull } from "./invoices";
import { renderKassaPage, renderKassaDayPage, renderKassaBalanceFragment, renderKassaCategoriesPage } from "./pages/cash";
import {
	getOrCreateDocument,
	addOperation,
	updateOperation,
	deleteOperation,
	closeDocument,
	reopenDocument,
	createCashCategory,
	updateCashCategory,
	deleteCashCategory,
	documentExists,
	isOperationDocumentClosed,
	type RegisterCode,
} from "./cash";
import { todayIso } from "./format";
import { renderCardPage, renderCardCategoriesPage } from "./pages/card";
import {
	importCardStatement,
	updateTransaction as updateCardTransaction,
	createPostingCategory,
	updatePostingCategory,
	deletePostingCategory,
} from "./card";
import {
	renderAccountingJournalPage,
	renderAccountingTurnoverPage,
	renderAccountCardPage,
	renderAccountCardFragment,
} from "./pages/accounting";
import {
	renderReferenceAccountsPage,
	renderReferenceCashBoxesPage,
	renderReferenceExpensesPage,
	renderReferenceEmployeesPage,
	renderReferenceOtherOperationsPage,
} from "./pages/references";
import {
	createManualEntry,
	updateManualEntry,
	deleteManualEntry,
	createOwnAccount,
	renameOwnAccount,
	deleteOwnAccount,
	createCashBox,
	renameCashBox,
	deleteCashBox,
	createExpenseItem,
	renameExpenseItem,
	deleteExpenseItem,
	createEmployee,
	renameEmployee,
	deleteEmployee,
	createOtherOperation,
	renameOtherOperation,
	deleteOtherOperation,
	type Ledger,
} from "./accounting";

const PLACEHOLDER_PATHS = ["/dashboard", "/products", "/clients", "/reports"];

// Страницы с выбором периода — период должен быть общим для всей системы: выбрал в одном
// месте, и он подхватывается на остальных, пока не выберут другой (или не истечёт cookie).
const PERIOD_COOKIE_PATHS = new Set([
	"/bank",
	"/card-universal",
	"/sales-kotopanda",
	"/sales-elitka",
	"/accounting/kotopanda",
	"/accounting/kotopanda/turnover",
	"/accounting/kotopanda/journal",
	"/accounting/kotopanda/card",
	"/accounting/kotopanda/card/fragment",
	"/accounting/elitka",
	"/accounting/elitka/turnover",
	"/accounting/elitka/journal",
	"/accounting/elitka/card",
	"/accounting/elitka/card/fragment",
	"/offset",
]);
const PERIOD_COOKIE_NAME = "kp_period";

function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("Cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return decodeURIComponent(rest.join("="));
	}
	return null;
}

// Достаёт книгу (kotopanda|elitka) из пути вида /accounting/:ledger<suffix>, если путь ему
// соответствует ровно — иначе null. Используется вместо runtime-regex на каждый роут ниже.
function accountingLedgerMatch(path: string, suffix: string): Ledger | null {
	const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = path.match(new RegExp(`^/accounting/(kotopanda|elitka)${escapedSuffix}$`));
	return match ? (match[1] as Ledger) : null;
}

// Аналог accountingLedgerMatch для касс: /sales-kotopanda<suffix> / /sales-elitka<suffix>.
function salesRegisterMatch(path: string, suffix: string): RegisterCode | null {
	const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = path.match(new RegExp(`^/sales-(kotopanda|elitka)${escapedSuffix}$`));
	return match ? (match[1] as RegisterCode) : null;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname === "/" ? "/bank" : url.pathname;

		// Старый путь до переноса Поставщиков в Справочники — на случай открытых вкладок/закладок.
		if (path === "/suppliers" && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: `/references/suppliers${url.search}` } });
		}

		// Старые пути настроек Банка/Кассы до переноса в общие Настройки — на случай закладок.
		if ((path === "/bank/settings" || salesRegisterMatch(path, "/settings") || path === "/card-universal/settings") && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: "/settings" } });
		}

		// Старые пути Бухгалтерии до разделения на книги Котопанды/Элитки — вся история была
		// книгой Котопанды, поэтому ведём туда же.
		const legacyAccountingMatch = path.match(/^\/accounting(\/(turnover|journal|chart|card|card\/fragment))?$/);
		if (legacyAccountingMatch && request.method === "GET") {
			const suffix = legacyAccountingMatch[1] ?? "";
			return new Response(null, { status: 301, headers: { Location: `/accounting/kotopanda${suffix}${url.search}` } });
		}

		// План счетов больше не вкладка внутри книги (он общий на обе) — переехал в Настройки.
		if (accountingLedgerMatch(path, "/chart") && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: "/settings" } });
		}

		// "Тест 2" стал основной Обороткой Котопанды (и позже — Элитки), "тест 1" убрали из меню
		// как устаревший — старые ссылки на обе тестовые страницы ведём на настоящую Оборотку.
		if (path === "/accounting-turnover-test-2" && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: `/accounting/kotopanda${url.search}` } });
		}
		if (path === "/accounting-turnover-test-2/card-fragment" && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: `/accounting/kotopanda/card/fragment${url.search}` } });
		}
		if (path === "/accounting-turnover-test" && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: `/accounting/kotopanda${url.search}` } });
		}

		if (path === "/bank/sync" && request.method === "POST") {
			const form = await request.formData();
			const period = String(form.get("period") ?? "this_month");
			const redirectParams = new URLSearchParams({ period });

			try {
				const result = await syncBankAccount(env);
				redirectParams.set("synced", String(result.added));
			} catch (err) {
				redirectParams.set("sync_error", err instanceof Error ? err.message : "неизвестная ошибка");
			}

			// Относительный Location, а не абсолютный URL: в `wrangler dev --remote`
			// request.url — это адрес превью-деплоя (*.workers.dev), а не localhost.
			return new Response(null, { status: 303, headers: { Location: `/bank?${redirectParams.toString()}` } });
		}

		if (path === "/bank/settings" && request.method === "POST") {
			const form = await request.formData();
			const subcontoRaw = form.get("posting_subconto");
			const postingSubconto = subcontoRaw && String(subcontoRaw).trim().length > 0 ? String(subcontoRaw).trim() : null;

			const account = await env.DB.prepare(`SELECT id FROM bank_accounts LIMIT 1`).first<{ id: number }>();
			if (account) {
				await env.DB.prepare(`UPDATE bank_accounts SET posting_subconto = ? WHERE id = ?`).bind(postingSubconto, account.id).run();
			}

			return new Response(null, { status: 303, headers: { Location: "/settings" } });
		}

		if (path === "/bank/rules/apply" && request.method === "POST") {
			const form = await request.formData();
			const period = String(form.get("period") ?? "this_month");
			const applied = await applyRulesToExisting(env);
			return new Response(null, {
				status: 303,
				headers: { Location: `/bank?period=${encodeURIComponent(period)}&rules_applied=${applied}` },
			});
		}

		if (path === "/bank/rules" && request.method === "POST") {
			const form = await request.formData();
			const matchField = form.get("match_field") === "counterparty_name" ? "counterparty_name" : "counterparty_account";
			const matchValue = String(form.get("match_value") ?? "").trim();
			const postingAccount = String(form.get("account") ?? "").trim();
			const postingSubconto = form.get("subconto") ? String(form.get("subconto")).trim() || null : null;
			const autoStatus = form.get("auto_status") === "review" ? "review" : "done";
			const priority = Number(form.get("priority")) || 0;

			if (matchValue && postingAccount) {
				await createRule(env, { matchField, matchValue, postingAccount, postingSubconto, autoStatus, priority });
			}

			return new Response(null, { status: 303, headers: { Location: "/bank/rules" } });
		}

		const ruleDeleteMatch = path.match(/^\/bank\/rules\/(\d+)\/delete$/);
		if (ruleDeleteMatch && request.method === "POST") {
			await deleteRule(env, Number(ruleDeleteMatch[1]));
			return new Response(null, { status: 303, headers: { Location: "/bank/rules" } });
		}

		if (path === "/bank/transactions/update" && request.method === "POST") {
			const form = await request.formData();
			const id = Number(form.get("id"));
			const period = String(form.get("period") ?? "this_month");
			const accountRaw = form.get("account");
			const postingAccount = accountRaw && String(accountRaw).length > 0 ? String(accountRaw) : null;
			const subcontoRaw = form.get("subconto");
			const postingSubconto = subcontoRaw && String(subcontoRaw).trim().length > 0 ? String(subcontoRaw).trim() : null;

			if (Number.isInteger(id)) {
				await updateTransaction(env, id, postingAccount, postingSubconto);

				if (form.get("create_rule") && postingAccount) {
					const matchField = form.get("rule_match_field") === "counterparty_name" ? "counterparty_name" : "counterparty_account";
					const matchValue = String(form.get("rule_match_value") ?? "").trim();
					if (matchValue) {
						await createRule(env, { matchField, matchValue, postingAccount, postingSubconto, autoStatus: "done", priority: 0 });
					}
				}
			}

			return new Response(null, { status: 303, headers: { Location: `/bank?period=${encodeURIComponent(period)}` } });
		}

		if (path === "/references/suppliers" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) {
				await createSupplier(env, name);
			}
			return new Response(null, { status: 303, headers: { Location: "/references/suppliers" } });
		}

		const supplierUpdateMatch = path.match(/^\/references\/suppliers\/(\d+)\/update$/);
		if (supplierUpdateMatch && request.method === "POST") {
			const supplierId = Number(supplierUpdateMatch[1]);
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();

			// Форма сейчас показывает только название — поля счёта/ЄДРПОУ/категории не трогаем,
			// чтобы не затереть то, что было сохранено раньше (если вообще было).
			const existing = await getSupplierFull(env, supplierId);
			const iban = existing?.iban ?? null;
			const taxId = existing?.tax_id ?? null;
			const defaultCategoryId = existing?.default_category_id ?? null;

			if (name) {
				await updateSupplier(env, supplierId, { name, iban, taxId, defaultCategoryId });
			}

			return new Response(null, { status: 303, headers: { Location: "/references/suppliers" } });
		}

		const supplierDeleteMatch = path.match(/^\/references\/suppliers\/(\d+)\/delete$/);
		if (supplierDeleteMatch && request.method === "POST") {
			const supplierId = Number(supplierDeleteMatch[1]);
			const result = await deleteSupplier(env, supplierId);

			if (result.ok) {
				return new Response(null, { status: 303, headers: { Location: "/references/suppliers?deleted=1" } });
			}
			return new Response(null, {
				status: 303,
				headers: { Location: `/references/suppliers?delete_error=${encodeURIComponent(result.reason)}` },
			});
		}

		const salesDayCreateMatch = salesRegisterMatch(path, "/day");
		if (salesDayCreateMatch && request.method === "POST") {
			const registerCode = salesDayCreateMatch;
			const form = await request.formData();
			const dateRaw = String(form.get("date") ?? "");
			const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : todayIso();

			if (await documentExists(env, registerCode, date)) {
				return new Response(null, {
					status: 303,
					headers: { Location: `/sales-${registerCode}?create_error=${encodeURIComponent(`Документ на ${date} уже существует`)}` },
				});
			}

			await getOrCreateDocument(env, registerCode, date);
			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}` } });
		}

		const salesOperationsCreateMatch = salesRegisterMatch(path, "/operations");
		if (salesOperationsCreateMatch && request.method === "POST") {
			const registerCode = salesOperationsCreateMatch;
			const form = await request.formData();
			const date = String(form.get("date") ?? todayIso());
			const categoryRaw = form.get("category_id");
			const categoryId = categoryRaw && String(categoryRaw).length > 0 ? Number(categoryRaw) : null;
			const amount = Number(form.get("amount"));
			const comment = form.get("comment") ? String(form.get("comment")) : null;
			const subconto = form.get("subconto") ? String(form.get("subconto")).trim() || null : null;

			const doc = await getOrCreateDocument(env, registerCode, date);
			if (doc.closed_at !== null) {
				return new Response(null, {
					status: 303,
					headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}&op_error=${encodeURIComponent("День закрыт — сначала откройте его снова")}` },
				});
			}

			if (categoryId && Number.isFinite(amount) && amount > 0) {
				await addOperation(env, doc.id, categoryId, amount, comment, subconto);
			}

			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}` } });
		}

		const opDeleteMatch = path.match(/^\/sales-(kotopanda|elitka)\/operations\/(\d+)\/delete$/);
		if (opDeleteMatch && request.method === "POST") {
			const registerCode = opDeleteMatch[1] as RegisterCode;
			const form = await request.formData();
			const date = String(form.get("date") ?? todayIso());
			const opId = Number(opDeleteMatch[2]);

			if (await isOperationDocumentClosed(env, opId)) {
				return new Response(null, {
					status: 303,
					headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}&op_error=${encodeURIComponent("День закрыт — сначала откройте его снова")}` },
				});
			}

			await deleteOperation(env, opId);
			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}` } });
		}

		const opUpdateMatch = path.match(/^\/sales-(kotopanda|elitka)\/operations\/(\d+)\/update$/);
		if (opUpdateMatch && request.method === "POST") {
			const registerCode = opUpdateMatch[1] as RegisterCode;
			const form = await request.formData();
			const date = String(form.get("date") ?? todayIso());
			const opId = Number(opUpdateMatch[2]);
			const categoryRaw = form.get("category_id");
			const categoryId = categoryRaw && String(categoryRaw).length > 0 ? Number(categoryRaw) : null;
			const amount = Number(form.get("amount"));
			const comment = form.get("comment") ? String(form.get("comment")) : null;
			const subconto = form.get("subconto") ? String(form.get("subconto")).trim() || null : null;

			if (await isOperationDocumentClosed(env, opId)) {
				return new Response(null, {
					status: 303,
					headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}&op_error=${encodeURIComponent("День закрыт — сначала откройте его снова")}` },
				});
			}

			if (categoryId && Number.isFinite(amount) && amount > 0) {
				await updateOperation(env, opId, categoryId, amount, comment, subconto);
			}

			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}` } });
		}

		const salesCloseMatch = salesRegisterMatch(path, "/close");
		if (salesCloseMatch && request.method === "POST") {
			const registerCode = salesCloseMatch;
			const form = await request.formData();
			const date = String(form.get("date") ?? todayIso());
			const doc = await getOrCreateDocument(env, registerCode, date);
			await closeDocument(env, doc.id);
			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}` } });
		}

		const salesReopenMatch = salesRegisterMatch(path, "/reopen");
		if (salesReopenMatch && request.method === "POST") {
			const registerCode = salesReopenMatch;
			const form = await request.formData();
			const date = String(form.get("date") ?? todayIso());
			const doc = await getOrCreateDocument(env, registerCode, date);
			await reopenDocument(env, doc.id);
			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/day?date=${encodeURIComponent(date)}` } });
		}

		const salesCategoriesCreateMatch = salesRegisterMatch(path, "/categories");
		if (salesCategoriesCreateMatch && request.method === "POST") {
			const registerCode = salesCategoriesCreateMatch;
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			const direction = String(form.get("direction") ?? "");
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const debitSubconto = String(form.get("debit_subconto") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const creditSubconto = String(form.get("credit_subconto") ?? "").trim();

			if (name && debitAccount && creditAccount && (direction === "income" || direction === "expense")) {
				await createCashCategory(env, registerCode, {
					name,
					direction,
					debitAccount,
					debitSubconto: debitSubconto || null,
					creditAccount,
					creditSubconto: creditSubconto || null,
				});
			}

			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/categories` } });
		}

		const categoryDeleteMatch = path.match(/^\/sales-(kotopanda|elitka)\/categories\/(\d+)\/delete$/);
		if (categoryDeleteMatch && request.method === "POST") {
			const registerCode = categoryDeleteMatch[1] as RegisterCode;
			const result = await deleteCashCategory(env, Number(categoryDeleteMatch[2]));
			const location = result.ok ? `/sales-${registerCode}/categories` : `/sales-${registerCode}/categories?delete_error=${encodeURIComponent(result.reason ?? "")}`;
			return new Response(null, { status: 303, headers: { Location: location } });
		}

		const categoryUpdateMatch = path.match(/^\/sales-(kotopanda|elitka)\/categories\/(\d+)\/update$/);
		if (categoryUpdateMatch && request.method === "POST") {
			const registerCode = categoryUpdateMatch[1] as RegisterCode;
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			const direction = String(form.get("direction") ?? "");
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const debitSubconto = String(form.get("debit_subconto") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const creditSubconto = String(form.get("credit_subconto") ?? "").trim();

			if (name && debitAccount && creditAccount && (direction === "income" || direction === "expense")) {
				await updateCashCategory(env, Number(categoryUpdateMatch[2]), {
					name,
					direction,
					debitAccount,
					debitSubconto: debitSubconto || null,
					creditAccount,
					creditSubconto: creditSubconto || null,
				});
			}

			return new Response(null, { status: 303, headers: { Location: `/sales-${registerCode}/categories` } });
		}

		const salesSettingsMatch = salesRegisterMatch(path, "/settings");
		if (salesSettingsMatch && request.method === "POST") {
			const registerCode = salesSettingsMatch;
			const form = await request.formData();
			const subcontoRaw = form.get("posting_subconto");
			const postingSubconto = subcontoRaw && String(subcontoRaw).trim().length > 0 ? String(subcontoRaw).trim() : null;

			await env.DB.prepare(`UPDATE cash_registers SET posting_subconto = ? WHERE code = ?`).bind(postingSubconto, registerCode).run();

			return new Response(null, { status: 303, headers: { Location: "/settings" } });
		}

		if (path === "/card-universal/upload" && request.method === "POST") {
			const form = await request.formData();
			const file = form.get("file");

			if (!(file instanceof File)) {
				return new Response(null, { status: 303, headers: { Location: "/card-universal?import_error=" + encodeURIComponent("файл не получен") } });
			}

			try {
				const buffer = await file.arrayBuffer();
				const result = await importCardStatement(env, buffer);
				return new Response(null, { status: 303, headers: { Location: `/card-universal?imported=${result.added}` } });
			} catch (err) {
				const message = err instanceof Error ? err.message : "не удалось разобрать файл";
				return new Response(null, { status: 303, headers: { Location: "/card-universal?import_error=" + encodeURIComponent(message) } });
			}
		}

		if (path === "/card-universal/transactions/update" && request.method === "POST") {
			const form = await request.formData();
			const id = Number(form.get("id"));
			const period = String(form.get("period") ?? "this_month");
			const postingRaw = form.get("posting_category_id");
			const postingCategoryId = postingRaw && String(postingRaw).length > 0 ? Number(postingRaw) : null;
			const subcontoRaw = form.get("subconto");
			const subconto = subcontoRaw && String(subcontoRaw).trim().length > 0 ? String(subcontoRaw).trim() : null;

			if (Number.isInteger(id)) {
				await updateCardTransaction(env, id, postingCategoryId, subconto);
			}

			return new Response(null, { status: 303, headers: { Location: `/card-universal?period=${encodeURIComponent(period)}` } });
		}

		if (path === "/card-universal/settings" && request.method === "POST") {
			const form = await request.formData();
			const subcontoRaw = form.get("posting_subconto");
			const postingSubconto = subcontoRaw && String(subcontoRaw).trim().length > 0 ? String(subcontoRaw).trim() : null;

			const account = await env.DB.prepare(`SELECT id FROM card_accounts LIMIT 1`).first<{ id: number }>();
			if (account) {
				await env.DB.prepare(`UPDATE card_accounts SET posting_subconto = ? WHERE id = ?`).bind(postingSubconto, account.id).run();
			}

			return new Response(null, { status: 303, headers: { Location: "/settings" } });
		}

		if (path === "/offset/settings" && request.method === "POST") {
			const form = await request.formData();
			const subcontoRaw = form.get("posting_subconto");
			const postingSubconto = subcontoRaw && String(subcontoRaw).trim().length > 0 ? String(subcontoRaw).trim() : null;

			const offsetSettings = await env.DB.prepare(`SELECT id FROM offset_settings LIMIT 1`).first<{ id: number }>();
			if (offsetSettings) {
				await env.DB.prepare(`UPDATE offset_settings SET posting_subconto = ? WHERE id = ?`).bind(postingSubconto, offsetSettings.id).run();
			}

			return new Response(null, { status: 303, headers: { Location: "/settings" } });
		}

		if ((path === "/offset" || path.match(/^\/offset\/\d+\/update$/)) && request.method === "POST") {
			const offsetUpdateMatch = path.match(/^\/offset\/(\d+)\/update$/);
			const form = await request.formData();
			const period = String(form.get("period") ?? "this_month");
			const direction: OffsetDirection = form.get("direction") === "elitka_to_kotopanda" ? "elitka_to_kotopanda" : "kotopanda_to_elitka";
			const docDate = String(form.get("entry_date") ?? "");
			const kotopandaAccount = String(form.get("offsetAccount1_account") ?? "").trim();
			const kotopandaSubconto = String(form.get("offsetAccount1_subconto") ?? "").trim();
			const elitkaAccount = String(form.get("offsetAccount2_account") ?? "").trim();
			const elitkaSubconto = String(form.get("offsetAccount2_subconto") ?? "").trim();
			const amount = Number(form.get("amount"));
			const description = form.get("description") ? String(form.get("description")).trim() || null : null;

			if (docDate && kotopandaAccount && elitkaAccount && Number.isFinite(amount) && amount > 0) {
				const input = {
					docDate,
					direction,
					kotopandaAccount,
					kotopandaSubconto: kotopandaSubconto || null,
					elitkaAccount,
					elitkaSubconto: elitkaSubconto || null,
					amount,
					description,
				};
				if (offsetUpdateMatch) {
					await updateOffsetDocument(env, Number(offsetUpdateMatch[1]), input);
				} else {
					await createOffsetDocument(env, input);
				}
			}

			return new Response(null, { status: 303, headers: { Location: `/offset?period=${encodeURIComponent(period)}` } });
		}

		const offsetDeleteMatch = path.match(/^\/offset\/(\d+)\/delete$/);
		if (offsetDeleteMatch && request.method === "POST") {
			const form = await request.formData();
			const period = String(form.get("period") ?? "this_month");
			await deleteOffsetDocument(env, Number(offsetDeleteMatch[1]));
			return new Response(null, { status: 303, headers: { Location: `/offset?period=${encodeURIComponent(period)}` } });
		}

		if (path === "/card-universal/categories" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const debitSubconto = String(form.get("debit_subconto") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const creditSubconto = String(form.get("credit_subconto") ?? "").trim();

			if (name && debitAccount && creditAccount) {
				await createPostingCategory(env, {
					name,
					debitAccount,
					debitSubconto: debitSubconto || null,
					creditAccount,
					creditSubconto: creditSubconto || null,
				});
			}

			return new Response(null, { status: 303, headers: { Location: "/card-universal/categories" } });
		}

		const cardCategoryDeleteMatch = path.match(/^\/card-universal\/categories\/(\d+)\/delete$/);
		if (cardCategoryDeleteMatch && request.method === "POST") {
			const result = await deletePostingCategory(env, Number(cardCategoryDeleteMatch[1]));
			const location = result.ok ? "/card-universal/categories" : `/card-universal/categories?delete_error=${encodeURIComponent(result.reason ?? "")}`;
			return new Response(null, { status: 303, headers: { Location: location } });
		}

		const cardCategoryUpdateMatch = path.match(/^\/card-universal\/categories\/(\d+)\/update$/);
		if (cardCategoryUpdateMatch && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const debitSubconto = String(form.get("debit_subconto") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const creditSubconto = String(form.get("credit_subconto") ?? "").trim();

			if (name && debitAccount && creditAccount) {
				await updatePostingCategory(env, Number(cardCategoryUpdateMatch[1]), {
					name,
					debitAccount,
					debitSubconto: debitSubconto || null,
					creditAccount,
					creditSubconto: creditSubconto || null,
				});
			}

			return new Response(null, { status: 303, headers: { Location: "/card-universal/categories" } });
		}

		const journalCreateMatch = path.match(/^\/accounting\/(kotopanda|elitka)\/journal$/);
		if (journalCreateMatch && request.method === "POST") {
			const ledger = journalCreateMatch[1] as Ledger;
			const form = await request.formData();
			const period = String(form.get("period") ?? "this_month");
			const entryDate = String(form.get("entry_date") ?? "");
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const debitSubconto = String(form.get("debit_subconto") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const creditSubconto = String(form.get("credit_subconto") ?? "").trim();
			const amount = Number(form.get("amount"));
			const quantityRaw = form.get("quantity");
			const quantity = quantityRaw && String(quantityRaw).length > 0 ? Number(quantityRaw) : null;
			const description = form.get("description") ? String(form.get("description")).trim() || null : null;

			if (entryDate && debitAccount && creditAccount && Number.isFinite(amount) && amount > 0) {
				await createManualEntry(env, ledger, {
					entryDate,
					debitAccount,
					debitSubconto: debitSubconto || null,
					creditAccount,
					creditSubconto: creditSubconto || null,
					quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
					amount,
					description,
				});
			}

			// return_to — модалка "+ Проводка" открывается не только со страницы Проводок, но и с
			// Оборотки (см. newEntryModalHtml в pages/accounting.ts); по умолчанию (старые формы без
			// этого поля) ведём на Проводки, как и раньше. Разрешаем редирект только внутри /accounting/,
			// чтобы это скрытое поле формы нельзя было использовать как открытый редирект.
			const returnToRaw = String(form.get("return_to") ?? "");
			const returnTo = returnToRaw.startsWith("/accounting/") ? returnToRaw : `/accounting/${ledger}/journal?period=${encodeURIComponent(period)}`;

			return new Response(null, { status: 303, headers: { Location: returnTo } });
		}

		const journalUpdateMatch = path.match(/^\/accounting\/(kotopanda|elitka)\/journal\/(\d+)\/update$/);
		if (journalUpdateMatch && request.method === "POST") {
			const ledger = journalUpdateMatch[1] as Ledger;
			const form = await request.formData();
			const period = String(form.get("period") ?? "this_month");
			const entryDate = String(form.get("entry_date") ?? "");
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const debitSubconto = String(form.get("debit_subconto") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const creditSubconto = String(form.get("credit_subconto") ?? "").trim();
			const amount = Number(form.get("amount"));
			const quantityRaw = form.get("quantity");
			const quantity = quantityRaw && String(quantityRaw).length > 0 ? Number(quantityRaw) : null;
			const description = form.get("description") ? String(form.get("description")).trim() || null : null;

			if (entryDate && debitAccount && creditAccount && Number.isFinite(amount) && amount > 0) {
				await updateManualEntry(env, Number(journalUpdateMatch[2]), {
					entryDate,
					debitAccount,
					debitSubconto: debitSubconto || null,
					creditAccount,
					creditSubconto: creditSubconto || null,
					quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
					amount,
					description,
				});
			}

			return new Response(null, { status: 303, headers: { Location: `/accounting/${ledger}/journal?period=${encodeURIComponent(period)}` } });
		}

		const journalDeleteMatch = path.match(/^\/accounting\/(kotopanda|elitka)\/journal\/(\d+)\/delete$/);
		if (journalDeleteMatch && request.method === "POST") {
			const ledger = journalDeleteMatch[1] as Ledger;
			const form = await request.formData();
			const period = String(form.get("period") ?? "this_month");
			await deleteManualEntry(env, Number(journalDeleteMatch[2]));
			return new Response(null, { status: 303, headers: { Location: `/accounting/${ledger}/journal?period=${encodeURIComponent(period)}` } });
		}

		if (path === "/references/accounts" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await createOwnAccount(env, name);
			return new Response(null, { status: 303, headers: { Location: "/references/accounts" } });
		}

		const accountUpdateMatch = path.match(/^\/references\/accounts\/(\d+)\/update$/);
		if (accountUpdateMatch && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await renameOwnAccount(env, Number(accountUpdateMatch[1]), name);
			return new Response(null, { status: 303, headers: { Location: "/references/accounts" } });
		}

		const accountDeleteMatch = path.match(/^\/references\/accounts\/(\d+)\/delete$/);
		if (accountDeleteMatch && request.method === "POST") {
			const result = await deleteOwnAccount(env, Number(accountDeleteMatch[1]));
			const location = result.ok ? "/references/accounts" : `/references/accounts?delete_error=${encodeURIComponent(result.reason ?? "")}`;
			return new Response(null, { status: 303, headers: { Location: location } });
		}

		if (path === "/references/cash-boxes" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await createCashBox(env, name);
			return new Response(null, { status: 303, headers: { Location: "/references/cash-boxes" } });
		}

		const cashBoxUpdateMatch = path.match(/^\/references\/cash-boxes\/(\d+)\/update$/);
		if (cashBoxUpdateMatch && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await renameCashBox(env, Number(cashBoxUpdateMatch[1]), name);
			return new Response(null, { status: 303, headers: { Location: "/references/cash-boxes" } });
		}

		const cashBoxDeleteMatch = path.match(/^\/references\/cash-boxes\/(\d+)\/delete$/);
		if (cashBoxDeleteMatch && request.method === "POST") {
			const result = await deleteCashBox(env, Number(cashBoxDeleteMatch[1]));
			const location = result.ok ? "/references/cash-boxes" : `/references/cash-boxes?delete_error=${encodeURIComponent(result.reason ?? "")}`;
			return new Response(null, { status: 303, headers: { Location: location } });
		}

		if (path === "/references/expenses" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await createExpenseItem(env, name);
			return new Response(null, { status: 303, headers: { Location: "/references/expenses" } });
		}

		const expenseUpdateMatch = path.match(/^\/references\/expenses\/(\d+)\/update$/);
		if (expenseUpdateMatch && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await renameExpenseItem(env, Number(expenseUpdateMatch[1]), name);
			return new Response(null, { status: 303, headers: { Location: "/references/expenses" } });
		}

		const expenseDeleteMatch = path.match(/^\/references\/expenses\/(\d+)\/delete$/);
		if (expenseDeleteMatch && request.method === "POST") {
			const result = await deleteExpenseItem(env, Number(expenseDeleteMatch[1]));
			const location = result.ok ? "/references/expenses" : `/references/expenses?delete_error=${encodeURIComponent(result.reason ?? "")}`;
			return new Response(null, { status: 303, headers: { Location: location } });
		}

		if (path === "/references/employees" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await createEmployee(env, name);
			return new Response(null, { status: 303, headers: { Location: "/references/employees" } });
		}

		const employeeUpdateMatch = path.match(/^\/references\/employees\/(\d+)\/update$/);
		if (employeeUpdateMatch && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await renameEmployee(env, Number(employeeUpdateMatch[1]), name);
			return new Response(null, { status: 303, headers: { Location: "/references/employees" } });
		}

		const employeeDeleteMatch = path.match(/^\/references\/employees\/(\d+)\/delete$/);
		if (employeeDeleteMatch && request.method === "POST") {
			const result = await deleteEmployee(env, Number(employeeDeleteMatch[1]));
			const location = result.ok ? "/references/employees" : `/references/employees?delete_error=${encodeURIComponent(result.reason ?? "")}`;
			return new Response(null, { status: 303, headers: { Location: location } });
		}

		if (path === "/references/other-operations" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await createOtherOperation(env, name);
			return new Response(null, { status: 303, headers: { Location: "/references/other-operations" } });
		}

		const otherOperationUpdateMatch = path.match(/^\/references\/other-operations\/(\d+)\/update$/);
		if (otherOperationUpdateMatch && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await renameOtherOperation(env, Number(otherOperationUpdateMatch[1]), name);
			return new Response(null, { status: 303, headers: { Location: "/references/other-operations" } });
		}

		const otherOperationDeleteMatch = path.match(/^\/references\/other-operations\/(\d+)\/delete$/);
		if (otherOperationDeleteMatch && request.method === "POST") {
			const result = await deleteOtherOperation(env, Number(otherOperationDeleteMatch[1]));
			const location = result.ok ? "/references/other-operations" : `/references/other-operations?delete_error=${encodeURIComponent(result.reason ?? "")}`;
			return new Response(null, { status: 303, headers: { Location: location } });
		}

		let periodCookieToSet: string | null = null;
		if (PERIOD_COOKIE_PATHS.has(path) && request.method === "GET") {
			const queryPeriod = url.searchParams.get("period");
			if (queryPeriod) {
				periodCookieToSet = queryPeriod;
			} else {
				const cookiePeriod = readCookie(request, PERIOD_COOKIE_NAME);
				if (cookiePeriod) {
					url.searchParams.set("period", cookiePeriod);
					periodCookieToSet = cookiePeriod;
				}
			}
		}

		let html: string | undefined;
		if (path === "/bank") {
			html = await renderBankPage(env, url);
		} else if (salesRegisterMatch(path, "")) {
			html = await renderKassaPage(env, url, salesRegisterMatch(path, "")!);
		} else if (salesRegisterMatch(path, "/day")) {
			html = await renderKassaDayPage(env, url, salesRegisterMatch(path, "/day")!);
		} else if (salesRegisterMatch(path, "/day/balance")) {
			const registerCode = salesRegisterMatch(path, "/day/balance")!;
			const dateParam = url.searchParams.get("date");
			const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayIso();
			html = await renderKassaBalanceFragment(env, date, registerCode);
		} else if (salesRegisterMatch(path, "/categories")) {
			html = await renderKassaCategoriesPage(env, url, salesRegisterMatch(path, "/categories")!);
		} else if (path === "/settings") {
			html = await renderSettingsPage(env);
		} else if (path === "/card-universal") {
			html = await renderCardPage(env, url);
		} else if (path === "/card-universal/categories") {
			html = await renderCardCategoriesPage(env, url);
		} else if (path === "/bank/rules") {
			html = await renderBankRulesPage(env);
		} else if (path === "/references/suppliers") {
			html = await renderSuppliersListPage(env, url);
		} else if (path === "/offset") {
			html = await renderOffsetPage(env, url);
		} else if (accountingLedgerMatch(path, "")) {
			html = await renderAccountingTurnoverPage(env, url, accountingLedgerMatch(path, "")!);
		} else if (accountingLedgerMatch(path, "/turnover")) {
			html = await renderAccountingTurnoverPage(env, url, accountingLedgerMatch(path, "/turnover")!);
		} else if (accountingLedgerMatch(path, "/journal")) {
			html = await renderAccountingJournalPage(env, url, accountingLedgerMatch(path, "/journal")!);
		} else if (accountingLedgerMatch(path, "/card")) {
			html = await renderAccountCardPage(env, url, accountingLedgerMatch(path, "/card")!);
		} else if (accountingLedgerMatch(path, "/card/fragment")) {
			html = await renderAccountCardFragment(env, url, accountingLedgerMatch(path, "/card/fragment")!);
		} else if (path === "/references/accounts") {
			html = await renderReferenceAccountsPage(env, url);
		} else if (path === "/references/cash-boxes") {
			html = await renderReferenceCashBoxesPage(env, url);
		} else if (path === "/references/expenses") {
			html = await renderReferenceExpensesPage(env, url);
		} else if (path === "/references/employees") {
			html = await renderReferenceEmployeesPage(env, url);
		} else if (path === "/references/other-operations") {
			html = await renderReferenceOtherOperationsPage(env, url);
		} else if (PLACEHOLDER_PATHS.includes(path)) {
			html = renderPlaceholderPage(path);
		}

		if (!html) {
			return new Response("Not found", { status: 404 });
		}

		const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
		if (periodCookieToSet !== null) {
			headers["set-cookie"] = `${PERIOD_COOKIE_NAME}=${encodeURIComponent(periodCookieToSet)}; Path=/; Max-Age=31536000; SameSite=Lax`;
		}

		return new Response(html, { headers });
	},
} satisfies ExportedHandler<Env>;

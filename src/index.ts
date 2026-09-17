import { renderBankPage } from "./pages/bank";
import { renderBankRulesPage } from "./pages/bankRules";
import { renderPlaceholderPage } from "./pages/placeholder";
import { renderSettingsPage } from "./pages/settings";
import { renderTestReferencePage, testRefEntryForSlug } from "./pages/referencesTest";
import { createTestRefItem, renameTestRefItem, deleteTestRefItem } from "./referencesTest";
import { renderChartOfAccountsTestPage } from "./pages/chartOfAccountsTest";
import { renderJournalTurnoverTestPage, renderJournalTurnoverTestAccountCardFragment, renderJournalTurnoverTestOperationModalFragment } from "./pages/journalTurnoverTest";
import { renderJournalListTestPage } from "./pages/journalListTest";
import { renderJournalDocumentsTestPage } from "./pages/journalDocumentsTest";
import { renderCashTestPage, renderCashTestCategoriesPage, renderCashTestBalanceFragment } from "./pages/cashTest";
import {
	addTestCashOperation,
	updateTestCashOperation,
	deleteTestCashOperation,
	createTestCashCategory,
	updateTestCashCategory,
	deleteTestCashCategory,
	getOrCreateTestCashDocument,
	closeTestCashDocument,
	reopenTestCashDocument,
	isTestCashOperationDocumentClosed,
} from "./cashTest";
import { createTestOperationDocument, updateTestOperationDocument, deleteTestOperationDocument, resolveTestFirmId, type TestOperationLineInput, type TestFirmCode } from "./operationDocumentTest";
import { syncBankAccount } from "./sync";
import { updateTransaction } from "./transactions";
import { applyRulesToExisting, createRule, deleteRule } from "./rules";
import { todayIso } from "./format";
import { renderCardPage, renderCardCategoriesPage } from "./pages/card";
import { importCardStatement, createPostingCategory, updatePostingCategory, deletePostingCategory } from "./card";
import { updateTransaction as updateCardTransaction } from "./cardTransactions";
import { resolveCurrentUser, setAuthContext, sectionForPath, firstAllowedPath, createSessionCookie, clearSessionCookie, verifyLogin } from "./auth";
import { renderLoginPage } from "./pages/login";
import { renderAdminPage } from "./pages/admin";
import { createUser, setUserRole, setUserActive, resetUserPassword, deleteUser, createRole, updateRolePermissions, deleteRole } from "./adminUsers";

const PLACEHOLDER_PATHS = ["/dashboard", "/products", "/clients", "/reports", "/offset"];

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
	"/accounting/kotopanda/card/fragment",
	"/accounting/kotopanda/operation-modal",
	"/accounting/elitka",
	"/accounting/elitka/turnover",
	"/accounting/elitka/journal",
	"/accounting/elitka/card/fragment",
	"/accounting/elitka/operation-modal",
	"/journal-list-test",
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

// Аналог testFirmMatch для касс: /sales-kotopanda<suffix> / /sales-elitka<suffix>.
function salesRegisterMatch(path: string, suffix: string): TestFirmCode | null {
	const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = path.match(new RegExp(`^/sales-(kotopanda|elitka)${escapedSuffix}$`));
	return match ? (match[1] as TestFirmCode) : null;
}

// Общий матчер /:prefix/(kotopanda|elitka)<suffix> — используется и для Бухгалтерии
// (/accounting/:firm<suffix>, на месте боевой после сноса), и для остальных тестовых страниц.
function testFirmMatch(path: string, prefix: string, suffix: string): TestFirmCode | null {
	const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = path.match(new RegExp(`^${prefix}/(kotopanda|elitka)${escapedSuffix}$`));
	return match ? (match[1] as TestFirmCode) : null;
}

// Строки документа "Операция" (тест) приходят как line_<N>_<field> — группируем по N, а не
// завязываемся на конкретное число строк. Общее и для создания, и для редактирования документа.
function parseOperationDocumentLines(form: FormData): TestOperationLineInput[] {
	const lineFields = new Map<number, Record<string, string>>();
	for (const [key, value] of form.entries()) {
		const match = key.match(/^line_(\d+)_(.+)$/);
		if (!match) continue;
		const idx = Number(match[1]);
		if (!lineFields.has(idx)) lineFields.set(idx, {});
		lineFields.get(idx)![match[2]] = String(value);
	}

	return [...lineFields.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([, f]) => ({
			debitAccount: (f.debit_account ?? "").trim(),
			debitSubcontoId: f.debit_subconto ? Number(f.debit_subconto) : null,
			creditAccount: (f.credit_account ?? "").trim(),
			creditSubcontoId: f.credit_subconto ? Number(f.credit_subconto) : null,
			amount: Number(f.amount),
			comment: f.comment ? f.comment.trim() || null : null,
		}))
		.filter((l) => l.debitAccount && l.creditAccount && Number.isFinite(l.amount) && l.amount > 0);
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname === "/" ? "/bank" : url.pathname;

		// Авторизация — см. обсуждение "Сделаем авторизацию?". /login отдаём без проверки сессии
		// (иначе некуда логиниться), всё остальное — только залогиненным, и не-админам ещё и по
		// разделу (sectionForPath), см. auth.ts.
		if (path === "/login") {
			const next = url.searchParams.get("next") ?? "/bank";
			if (request.method === "GET") {
				const already = await resolveCurrentUser(env, request);
				if (already) return new Response(null, { status: 303, headers: { Location: firstAllowedPath(already) } });
				return new Response(renderLoginPage(null, next), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
			}
			if (request.method === "POST") {
				const form = await request.formData();
				const username = String(form.get("username") ?? "").trim();
				const password = String(form.get("password") ?? "");
				const formNext = String(form.get("next") ?? "/bank");
				const userId = username && password ? await verifyLogin(env, username, password) : null;
				if (!userId) {
					return new Response(renderLoginPage("Неверный логин или пароль", formNext), {
						status: 401,
						headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
					});
				}
				const cookie = await createSessionCookie(env, userId);
				return new Response(null, { status: 303, headers: { Location: formNext.startsWith("/") ? formNext : "/bank", "set-cookie": cookie } });
			}
		}

		if (path === "/logout" && request.method === "POST") {
			return new Response(null, { status: 303, headers: { Location: "/login", "set-cookie": clearSessionCookie() } });
		}

		const currentUser = await resolveCurrentUser(env, request);
		if (!currentUser) {
			return new Response(null, { status: 303, headers: { Location: `/login?next=${encodeURIComponent(url.pathname + url.search)}` } });
		}
		setAuthContext(env, currentUser);
		if (!currentUser.isAdmin) {
			const section = sectionForPath(path);
			const allowed = section !== null && section !== "admin" && currentUser.allowedSections.has(section);
			if (!allowed) {
				return new Response(null, { status: 303, headers: { Location: firstAllowedPath(currentUser) } });
			}
		}

		// Поставщики (counterparties) снесены — дублировали справочник "Поставщики" в Настройках
		// (test_suppliers, см. обсуждение "тестовые станут боевыми"). Старые ссылки ведём туда же.
		if ((path === "/suppliers" || path === "/references/suppliers") && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: `/settings/references/suppliers${url.search}` } });
		}

		// Администрирование переехало из отдельного пункта меню во вкладку Настроек — на случай
		// закладок у админа.
		if (path === "/admin" && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: "/settings/admin" } });
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
		if (testFirmMatch(path, "/accounting", "/chart") && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: "/settings" } });
		}

		// Отдельной страницы "Карточка счёта" у новой Бухгалтерии нет (она открывается прямо на
		// Обороте AJAX-фрагментом, см. renderJournalTurnoverTestAccountCardFragment) — старый
		// путь /accounting/:ledger/card ведём на саму Оборотку.
		if (testFirmMatch(path, "/accounting", "/card") && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: `/accounting/${testFirmMatch(path, "/accounting", "/card")}${url.search}` } });
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

		// Голый /settings/references — сразу на первый справочник (как /references/accounts у боевых).
		if (path === "/settings/references" && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: "/settings/references/accounts" } });
		}

		// Справочники (тест) и План счетов (тест) переехали внутрь Настроек как вкладки —
		// старые пути ведём туда же (тот же приём, что и для боевой Бухгалтерии/тестового журнала).
		const legacyRefTestMatch = path.match(/^\/references-test(\/([a-z-]+)(\/(\d+)\/(update|delete))?)?$/);
		if (legacyRefTestMatch && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: `/settings/references${legacyRefTestMatch[1] ?? "/accounts"}` } });
		}
		if (path === "/chart-test" && request.method === "GET") {
			return new Response(null, { status: 301, headers: { Location: "/settings/chart" } });
		}

		// Тестовый журнал (Оборотка/Журнал Операций) переехал на место боевой Бухгалтерии — см.
		// обсуждение "тестовые станут боевыми". Старые пути (с разделением на фирмы и без — вся
		// добевая история была Котопандой) ведём на /accounting/:firm[/journal].
		const legacyTestJournalMatch = path.match(/^\/(journal-turnover-test|journal-documents-test)(\/(kotopanda|elitka))?(\/(operation-modal|card\/fragment))?$/);
		if (legacyTestJournalMatch && request.method === "GET") {
			const base = legacyTestJournalMatch[1];
			const firm = legacyTestJournalMatch[3] ?? "kotopanda";
			const extra = legacyTestJournalMatch[5];
			const suffix = base === "journal-turnover-test" ? (extra ? `/${extra}` : "") : "/journal";
			return new Response(null, { status: 301, headers: { Location: `/accounting/${firm}${suffix}${url.search}` } });
		}

		// Касса (тест) переехала на место боевой — /sales-kotopanda и /sales-elitka (см. обсуждение
		// "тестовые станут боевыми"). Старые ссылки на /cash-test/:firm ведём туда же.
		const legacyCashTestMatch = path.match(/^\/cash-test\/(kotopanda|elitka)(\/.*)?$/);
		if (legacyCashTestMatch && request.method === "GET") {
			const firm = legacyCashTestMatch[1];
			const suffix = legacyCashTestMatch[2] ?? "";
			return new Response(null, { status: 301, headers: { Location: `/sales-${firm}${suffix}${url.search}` } });
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
			// Приватбанк — всегда счёт фирмы Котопанда (см. обсуждение), выбора нет и не нужен.
			const firmId = await resolveTestFirmId(env, "kotopanda");

			if (matchValue && postingAccount) {
				await createRule(env, { matchField, matchValue, postingAccount, postingSubconto, autoStatus, priority, firmId });
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
			// Приватбанк — всегда счёт фирмы Котопанда (см. обсуждение), выбора нет и не нужен.
			const firmId = postingAccount ? await resolveTestFirmId(env, "kotopanda") : null;

			if (Number.isInteger(id)) {
				await updateTransaction(env, id, postingAccount, postingSubconto, firmId);

				if (form.get("create_rule") && postingAccount) {
					const matchField = form.get("rule_match_field") === "counterparty_name" ? "counterparty_name" : "counterparty_account";
					const matchValue = String(form.get("rule_match_value") ?? "").trim();
					if (matchValue) {
						await createRule(env, { matchField, matchValue, postingAccount, postingSubconto, autoStatus: "done", priority: 0, firmId });
					}
				}
			}

			return new Response(null, { status: 303, headers: { Location: `/bank?period=${encodeURIComponent(period)}` } });
		}

		// Касса Котопанда/Элитка — раньше боевой модуль (getOrCreateDocument/addOperation/...,
		// см. cash.ts), теперь на его месте новая Касса (см. cashTest.ts/pages/cashTest.ts) —
		// та же /sales-* адресация (только явного POST-создания дня больше нет: открытие даты в
		// renderCashTestPage — обычная GET-форма, документ заводится неявно внутри
		// getOrCreateTestCashDocument/addTestCashOperation при первом обращении).
		const salesOperationsCreateMatch = salesRegisterMatch(path, "/operations");
		if (salesOperationsCreateMatch && request.method === "POST") {
			const firm = salesOperationsCreateMatch;
			const form = await request.formData();
			const date = String(form.get("date") ?? "");
			const period = String(form.get("period") ?? "this_month");
			const categoryId = Number(form.get("category_id"));
			const subcontoRaw = form.get("subconto_id");
			const subcontoId = subcontoRaw ? Number(subcontoRaw) : null;
			const amount = Number(form.get("amount"));
			const comment = form.get("comment") ? String(form.get("comment")).trim() || null : null;
			const basePath = `/sales-${firm}`;

			const firmId = await resolveTestFirmId(env, firm);
			const doc = await getOrCreateTestCashDocument(env, firmId, date);
			if (doc.closedAt !== null) {
				return new Response(null, {
					status: 303,
					headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}&op_error=${encodeURIComponent("День закрыт — сначала откройте его снова")}` },
				});
			}

			if (date && categoryId && Number.isFinite(amount) && amount > 0) {
				await addTestCashOperation(env, firmId, date, categoryId, subcontoId, amount, comment);
			}
			return new Response(null, { status: 303, headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}` } });
		}

		const opUpdateMatch = path.match(/^\/sales-(kotopanda|elitka)\/operations\/(\d+)\/update$/);
		if (opUpdateMatch && request.method === "POST") {
			const firm = opUpdateMatch[1] as TestFirmCode;
			const journalId = Number(opUpdateMatch[2]);
			const form = await request.formData();
			const date = String(form.get("date") ?? "");
			const period = String(form.get("period") ?? "this_month");
			const categoryId = Number(form.get("category_id"));
			const subcontoRaw = form.get("subconto_id");
			const subcontoId = subcontoRaw ? Number(subcontoRaw) : null;
			const amount = Number(form.get("amount"));
			const comment = form.get("comment") ? String(form.get("comment")).trim() || null : null;
			const basePath = `/sales-${firm}`;

			if (await isTestCashOperationDocumentClosed(env, journalId)) {
				return new Response(null, {
					status: 303,
					headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}&op_error=${encodeURIComponent("День закрыт — сначала откройте его снова")}` },
				});
			}

			if (categoryId && Number.isFinite(amount) && amount > 0) {
				await updateTestCashOperation(env, journalId, categoryId, subcontoId, amount, comment);
			}
			return new Response(null, { status: 303, headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}` } });
		}

		const opDeleteMatch = path.match(/^\/sales-(kotopanda|elitka)\/operations\/(\d+)\/delete$/);
		if (opDeleteMatch && request.method === "POST") {
			const firm = opDeleteMatch[1] as TestFirmCode;
			const journalId = Number(opDeleteMatch[2]);
			const form = await request.formData();
			const date = String(form.get("date") ?? "");
			const period = String(form.get("period") ?? "this_month");
			const basePath = `/sales-${firm}`;

			if (await isTestCashOperationDocumentClosed(env, journalId)) {
				return new Response(null, {
					status: 303,
					headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}&op_error=${encodeURIComponent("День закрыт — сначала откройте его снова")}` },
				});
			}

			await deleteTestCashOperation(env, journalId);
			return new Response(null, { status: 303, headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}` } });
		}

		const salesCloseMatch = salesRegisterMatch(path, "/close");
		if (salesCloseMatch && request.method === "POST") {
			const firm = salesCloseMatch;
			const form = await request.formData();
			const date = String(form.get("date") ?? "");
			const period = String(form.get("period") ?? "this_month");
			const basePath = `/sales-${firm}`;
			const firmId = await resolveTestFirmId(env, firm);
			const doc = await getOrCreateTestCashDocument(env, firmId, date);
			await closeTestCashDocument(env, doc.id);
			return new Response(null, { status: 303, headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}` } });
		}

		const salesReopenMatch = salesRegisterMatch(path, "/reopen");
		if (salesReopenMatch && request.method === "POST") {
			const firm = salesReopenMatch;
			const form = await request.formData();
			const date = String(form.get("date") ?? "");
			const period = String(form.get("period") ?? "this_month");
			const basePath = `/sales-${firm}`;
			const firmId = await resolveTestFirmId(env, firm);
			const doc = await getOrCreateTestCashDocument(env, firmId, date);
			await reopenTestCashDocument(env, doc.id);
			return new Response(null, { status: 303, headers: { Location: `${basePath}?period=${encodeURIComponent(period)}&date=${date}` } });
		}

		const salesCategoriesCreateMatch = salesRegisterMatch(path, "/categories");
		if (salesCategoriesCreateMatch && request.method === "POST") {
			const firm = salesCategoriesCreateMatch;
			const form = await request.formData();
			const basePath = `/sales-${firm}/categories`;
			const name = String(form.get("name") ?? "").trim();
			const direction = form.get("direction") === "expense" ? "expense" : "income";
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const debitSubcontoRaw = form.get("debit_subconto_id");
			const creditSubcontoRaw = form.get("credit_subconto_id");
			const debitSubcontoId = debitSubcontoRaw ? Number(debitSubcontoRaw) : null;
			const creditSubcontoId = creditSubcontoRaw ? Number(creditSubcontoRaw) : null;

			if (name && debitAccount && creditAccount) {
				const firmId = await resolveTestFirmId(env, firm);
				await createTestCashCategory(env, firmId, { name, direction, debitAccount, debitSubcontoId, creditAccount, creditSubcontoId });
			}
			return new Response(null, { status: 303, headers: { Location: basePath } });
		}

		const categoryUpdateMatch = path.match(/^\/sales-(kotopanda|elitka)\/categories\/(\d+)\/update$/);
		if (categoryUpdateMatch && request.method === "POST") {
			const firm = categoryUpdateMatch[1] as TestFirmCode;
			const id = Number(categoryUpdateMatch[2]);
			const form = await request.formData();
			const basePath = `/sales-${firm}/categories`;
			const name = String(form.get("name") ?? "").trim();
			const direction = form.get("direction") === "expense" ? "expense" : "income";
			const debitAccount = String(form.get("debit_account") ?? "").trim();
			const creditAccount = String(form.get("credit_account") ?? "").trim();
			const debitSubcontoRaw = form.get("debit_subconto_id");
			const creditSubcontoRaw = form.get("credit_subconto_id");
			const debitSubcontoId = debitSubcontoRaw ? Number(debitSubcontoRaw) : null;
			const creditSubcontoId = creditSubcontoRaw ? Number(creditSubcontoRaw) : null;

			if (name && debitAccount && creditAccount) {
				await updateTestCashCategory(env, id, { name, direction, debitAccount, debitSubcontoId, creditAccount, creditSubcontoId });
			}
			return new Response(null, { status: 303, headers: { Location: basePath } });
		}

		const categoryDeleteMatch = path.match(/^\/sales-(kotopanda|elitka)\/categories\/(\d+)\/delete$/);
		if (categoryDeleteMatch && request.method === "POST") {
			const firm = categoryDeleteMatch[1] as TestFirmCode;
			const id = Number(categoryDeleteMatch[2]);
			const basePath = `/sales-${firm}/categories`;
			const result = await deleteTestCashCategory(env, id);
			return new Response(null, { status: 303, headers: { Location: result.ok ? basePath : `${basePath}?delete_error=${encodeURIComponent(result.reason ?? "")}` } });
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
			// Карта — всегда фирма Котопанда (см. обсуждение "Проверь чтоб проводки потом делались"),
			// та же логика, что и у Банка.
			const firmId = postingCategoryId ? await resolveTestFirmId(env, "kotopanda") : null;

			if (Number.isInteger(id)) {
				await updateCardTransaction(env, id, postingCategoryId, subconto, firmId);
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

		// "Справочники" (вкладка Настроек, тест-песочница поверх test_* таблиц, см.
		// referencesTest.ts). Все 6 видов справочника одинаковой формы, поэтому один
		// параметризованный набор роутов вместо шести копий, как выше для боевых справочников.
		const testRefCreateMatch = path.match(/^\/settings\/references\/([a-z-]+)$/);
		if (testRefCreateMatch && request.method === "POST") {
			const slug = testRefCreateMatch[1];
			const entry = testRefEntryForSlug(slug);
			if (entry) {
				const form = await request.formData();
				const name = String(form.get("name") ?? "").trim();
				if (name) await createTestRefItem(env, entry.kind, name);
			}
			return new Response(null, { status: 303, headers: { Location: `/settings/references/${slug}` } });
		}

		const testRefUpdateMatch = path.match(/^\/settings\/references\/([a-z-]+)\/(\d+)\/update$/);
		if (testRefUpdateMatch && request.method === "POST") {
			const slug = testRefUpdateMatch[1];
			const entry = testRefEntryForSlug(slug);
			if (entry) {
				const form = await request.formData();
				const name = String(form.get("name") ?? "").trim();
				if (name) await renameTestRefItem(env, entry.kind, Number(testRefUpdateMatch[2]), name);
			}
			return new Response(null, { status: 303, headers: { Location: `/settings/references/${slug}` } });
		}

		const testRefDeleteMatch = path.match(/^\/settings\/references\/([a-z-]+)\/(\d+)\/delete$/);
		if (testRefDeleteMatch && request.method === "POST") {
			const slug = testRefDeleteMatch[1];
			const entry = testRefEntryForSlug(slug);
			if (entry) await deleteTestRefItem(env, entry.kind, Number(testRefDeleteMatch[2]));
			return new Response(null, { status: 303, headers: { Location: `/settings/references/${slug}` } });
		}

		// Документ "Операция" (тест) — общий для Оборотки, Проводок и Журнала операций (см.
		// newOperationModalHtml/editOperationModalHtml в pages/operationDocumentTest.ts). firm —
		// скрытое поле формы (см. operationModalHtml): для создания решает, какой фирме принадлежит
		// новый документ, для правки не используется (фирма документа не меняется, см.
		// updateTestOperationDocument), но форма его всё равно отправляет — так что просто игнорируем.
		if (path === "/operation-document-test" && request.method === "POST") {
			const form = await request.formData();
			const returnTo = String(form.get("return_to") ?? "/accounting/kotopanda");
			const docDate = String(form.get("doc_date") ?? "");
			const description = form.get("description") ? String(form.get("description")).trim() || null : null;
			const firm = form.get("firm") === "elitka" ? "elitka" : "kotopanda";
			const lines = parseOperationDocumentLines(form);

			if (docDate && lines.length) {
				const firmId = await resolveTestFirmId(env, firm);
				await createTestOperationDocument(env, { docDate, description, firmId, lines });
			}

			return new Response(null, { status: 303, headers: { Location: returnTo.startsWith("/accounting") ? returnTo : "/accounting/kotopanda" } });
		}

		const opDocUpdateMatch = path.match(/^\/operation-document-test\/(\d+)\/update$/);
		if (opDocUpdateMatch && request.method === "POST") {
			const documentId = Number(opDocUpdateMatch[1]);
			const form = await request.formData();
			const returnTo = String(form.get("return_to") ?? "/accounting/kotopanda/journal");
			const docDate = String(form.get("doc_date") ?? "");
			const description = form.get("description") ? String(form.get("description")).trim() || null : null;
			const lines = parseOperationDocumentLines(form);

			if (docDate && lines.length) {
				await updateTestOperationDocument(env, documentId, { docDate, description, lines });
			}

			return new Response(null, { status: 303, headers: { Location: returnTo.startsWith("/accounting") ? returnTo : "/accounting/kotopanda/journal" } });
		}

		const opDocDeleteMatch = path.match(/^\/operation-document-test\/(\d+)\/delete$/);
		if (opDocDeleteMatch && request.method === "POST") {
			const form = await request.formData();
			const returnTo = String(form.get("return_to") ?? "/accounting/kotopanda/journal");
			await deleteTestOperationDocument(env, Number(opDocDeleteMatch[1]));
			return new Response(null, { status: 303, headers: { Location: returnTo.startsWith("/accounting") ? returnTo : "/accounting/kotopanda/journal" } });
		}

		// Администрирование — вкладка внутри Настроек (/settings/admin), доступна только
		// is_admin-ролям (проверено выше общим guard'ом по sectionForPath, туда этот путь
		// попадает как отдельный раздел "admin", не выдаваемый чекбоксами).
		if (path === "/settings/admin/users" && request.method === "POST") {
			const form = await request.formData();
			const username = String(form.get("username") ?? "").trim();
			const password = String(form.get("password") ?? "");
			const roleId = Number(form.get("role_id"));
			if (username && password.length >= 4 && Number.isInteger(roleId)) {
				await createUser(env, username, password, roleId);
			}
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
		}

		const userRoleMatch = path.match(/^\/settings\/admin\/users\/(\d+)\/role$/);
		if (userRoleMatch && request.method === "POST") {
			const form = await request.formData();
			const roleId = Number(form.get("role_id"));
			if (Number.isInteger(roleId)) await setUserRole(env, Number(userRoleMatch[1]), roleId);
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
		}

		const userToggleActiveMatch = path.match(/^\/settings\/admin\/users\/(\d+)\/toggle-active$/);
		if (userToggleActiveMatch && request.method === "POST") {
			const userId = Number(userToggleActiveMatch[1]);
			const row = await env.DB.prepare(`SELECT is_active FROM users WHERE id = ?`).bind(userId).first<{ is_active: number }>();
			if (row) await setUserActive(env, userId, row.is_active !== 1);
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
		}

		const userResetPasswordMatch = path.match(/^\/settings\/admin\/users\/(\d+)\/reset-password$/);
		if (userResetPasswordMatch && request.method === "POST") {
			const form = await request.formData();
			const password = String(form.get("password") ?? "");
			if (password.length >= 4) await resetUserPassword(env, Number(userResetPasswordMatch[1]), password);
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
		}

		const userDeleteMatch = path.match(/^\/settings\/admin\/users\/(\d+)\/delete$/);
		if (userDeleteMatch && request.method === "POST") {
			if (Number(userDeleteMatch[1]) !== currentUser.id) await deleteUser(env, Number(userDeleteMatch[1]));
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
		}

		if (path === "/settings/admin/roles" && request.method === "POST") {
			const form = await request.formData();
			const name = String(form.get("name") ?? "").trim();
			if (name) await createRole(env, name);
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
		}

		const rolePermissionsMatch = path.match(/^\/settings\/admin\/roles\/(\d+)\/permissions$/);
		if (rolePermissionsMatch && request.method === "POST") {
			const form = await request.formData();
			const sections = form.getAll("section").map((s) => String(s));
			await updateRolePermissions(env, Number(rolePermissionsMatch[1]), sections);
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
		}

		const roleDeleteMatch = path.match(/^\/settings\/admin\/roles\/(\d+)\/delete$/);
		if (roleDeleteMatch && request.method === "POST") {
			await deleteRole(env, Number(roleDeleteMatch[1]));
			return new Response(null, { status: 303, headers: { Location: "/settings/admin" } });
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
		} else if (salesRegisterMatch(path, "/categories")) {
			html = await renderCashTestCategoriesPage(env, url, salesRegisterMatch(path, "/categories")!);
		} else if (salesRegisterMatch(path, "/day/balance")) {
			const firm = salesRegisterMatch(path, "/day/balance")!;
			const firmId = await resolveTestFirmId(env, firm);
			const date = url.searchParams.get("date") ?? todayIso();
			html = await renderCashTestBalanceFragment(env, firmId, date);
		} else if (salesRegisterMatch(path, "")) {
			html = await renderCashTestPage(env, url, salesRegisterMatch(path, "")!);
		} else if (path === "/settings") {
			html = await renderSettingsPage(env);
		} else if (path === "/card-universal") {
			html = await renderCardPage(env, url);
		} else if (path === "/card-universal/categories") {
			html = await renderCardCategoriesPage(env, url);
		} else if (path === "/bank/rules") {
			html = await renderBankRulesPage(env);
		} else if (testFirmMatch(path, "/accounting", "/operation-modal")) {
			html = await renderJournalTurnoverTestOperationModalFragment(env, url, testFirmMatch(path, "/accounting", "/operation-modal")!);
		} else if (testFirmMatch(path, "/accounting", "/card/fragment")) {
			html = await renderJournalTurnoverTestAccountCardFragment(env, url, testFirmMatch(path, "/accounting", "/card/fragment")!);
		} else if (testFirmMatch(path, "/accounting", "/turnover")) {
			html = await renderJournalTurnoverTestPage(env, url, testFirmMatch(path, "/accounting", "/turnover")!);
		} else if (testFirmMatch(path, "/accounting", "/journal")) {
			html = await renderJournalDocumentsTestPage(env, url, testFirmMatch(path, "/accounting", "/journal")!);
		} else if (testFirmMatch(path, "/accounting", "")) {
			html = await renderJournalTurnoverTestPage(env, url, testFirmMatch(path, "/accounting", "")!);
		} else if (path.match(/^\/settings\/references\/([a-z-]+)$/)) {
			const slug = path.match(/^\/settings\/references\/([a-z-]+)$/)![1];
			const entry = testRefEntryForSlug(slug);
			if (entry) html = await renderTestReferencePage(env, entry);
		} else if (path === "/settings/chart") {
			html = await renderChartOfAccountsTestPage(env);
		} else if (path === "/journal-list-test") {
			html = await renderJournalListTestPage(env, url);
		} else if (path === "/settings/admin") {
			html = await renderAdminPage(env, currentUser.username);
		} else if (PLACEHOLDER_PATHS.includes(path)) {
			html = renderPlaceholderPage(path, env);
		}

		if (!html) {
			return new Response("Not found", { status: 404 });
		}

		// no-store — вся эта страница персональная (сессия) и постоянно меняется, кэшировать её
		// нигде (ни браузеру, ни Cloudflare edge) не нужно. Без этого заголовка изредка ловили
		// заведомо устаревший HTML после деплоя (см. обсуждение про "долбоеб это" — уже
		// исправленная на сервере форма всё ещё показывалась из чьего-то кэша).
		const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
		if (periodCookieToSet !== null) {
			headers["set-cookie"] = `${PERIOD_COOKIE_NAME}=${encodeURIComponent(periodCookieToSet)}; Path=/; Max-Age=31536000; SameSite=Lax`;
		}

		return new Response(html, { headers });
	},
} satisfies ExportedHandler<Env>;

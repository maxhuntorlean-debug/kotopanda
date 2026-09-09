import { renderPage } from "../layout";
import { escapeHtml, formatMoney, isoToDisplay, todayIso, addDaysIso, periodRangeFromToken, resolvePeriodToken } from "../format";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, DRAWER_STYLES, SUB_TABS_STYLES, renderSubTabs, type SubTab, MODAL_STYLES, renderConfirmModal, renderSimpleDrawer, editIconSvg, deleteIconSvg } from "../ui";
import { getAccount, listTransactions, balanceBefore, balanceAtEndOf, listPostingCategories, CARD_ACCOUNT, type CardTxRow, type PostingCategoryRow } from "../card";
import { CHART_OF_ACCOUNTS, listOwnAccounts, listCashBoxes, listExpenseItems, listEmployees, listOtherOperations, type ReferenceKind } from "../accounting";

export const CARD_TABS: SubTab[] = [
	{ href: "/card-universal", label: "Операции" },
	{ href: "/card-universal/categories", label: "Правила разноски" },
];

// Категория "нуждается" в субконто на операции, если её сторона-контрагент (не "31") оставлена
// без фиксированного субконто, но её счёт всё же привязан к какому-то справочнику — тогда
// конкретное значение (например, поставщик) вводится каждый раз заново, на самой операции.
function subcontoNeedOf(c: PostingCategoryRow, refLists: Record<ReferenceKind, string[]>): string[] | null {
	const sides = [
		{ account: c.credit_account, subconto: c.credit_subconto },
		{ account: c.debit_account, subconto: c.debit_subconto },
	];
	for (const side of sides) {
		if (side.account === CARD_ACCOUNT || side.subconto !== null) continue;
		const acc = CHART_OF_ACCOUNTS.find((a) => a.code === side.account);
		if (acc?.refKind) return refLists[acc.refKind];
	}
	return null;
}

const STYLES = `
	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
		margin-bottom: 20px;
	}
	.stat-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px 18px 16px;
	}
	.stat-card.highlight {
		background: var(--blue-soft);
		border-color: transparent;
	}
	.stat-label {
		color: var(--text-muted);
		font-size: 13px;
		margin-bottom: 10px;
	}
	.stat-value {
		font-size: 22px;
		font-weight: 700;
	}
	.stat-value.positive { color: var(--green); }
	.stat-value.negative { color: var(--red); }

	.table-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	thead th {
		text-align: left;
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 600;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}
	tbody td {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tbody tr:last-child td { border-bottom: none; }
	.amount-in { color: var(--green); font-weight: 600; white-space: nowrap; }
	.amount-out { color: var(--text); white-space: nowrap; }
	.posting-muted { color: var(--red); font-weight: 600; }
	.empty-state {
		padding: 40px 16px;
		text-align: center;
		color: var(--text-muted);
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 13px;
		margin-bottom: 16px;
	}
	.banner.ok { background: #eafaf3; color: var(--green); }
	.banner.error { background: #fdecec; color: var(--red); }
	.banner.warning { background: #fef6e7; color: #a86400; }

	.topbar {
		justify-content: flex-start;
	}
	.topbar h1 {
		white-space: nowrap;
	}
	.topbar-actions form {
		margin: 0;
	}
	.upload-form {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.upload-form input[type="file"] {
		font-size: 12px;
		max-width: 220px;
	}
	.upload-form .btn-primary {
		font: inherit;
		cursor: pointer;
	}

	tbody tr[data-tx-id] {
		cursor: pointer;
	}
	tbody tr[data-tx-id]:hover {
		background: var(--bg);
	}

	.acc { font-weight: 600; }
	.subconto { color: var(--text-muted); }
	.row-delete { text-align: right; }
	.row-delete .btn-secondary {
		padding: 6px 10px;
		font-size: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.btn-secondary {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 16px;
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		cursor: pointer;
	}
	.btn-secondary:hover {
		background: var(--bg);
	}
	.btn-confirm {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 16px;
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		color: var(--green);
		cursor: pointer;
	}
	.btn-confirm:hover {
		background: var(--bg);
	}
	.journal-form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.modal-card {
		width: 440px;
	}
	.modal-card.drawer-modal-card {
		width: 380px;
		padding: 0;
	}
	.drawer-modal-card .drawer-header {
		padding: 18px 20px;
	}
	.drawer-modal-card .drawer-body {
		padding: 20px;
		max-height: 70vh;
		overflow-y: auto;
	}
	.modal-card input[type="text"],
	.modal-card select {
		width: 100%;
		padding: 9px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
		background: var(--panel);
		color: var(--text);
		box-sizing: border-box;
	}
	.modal-card form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.modal-card .modal-actions {
		margin-top: 4px;
	}
`;

function renderRow(tx: CardTxRow): string {
	const posting = tx.posting_name ?? "Не указано";
	const postingClass = tx.posting_name ? "" : "posting-muted";
	const contragent = tx.subconto ?? tx.description ?? "—";
	const purpose = tx.bank_category ?? "—";
	const amountLabel = `${tx.direction === "in" ? "+" : "-"}${formatMoney(tx.amount)} грн`;

	const dataAttrs = [
		`data-tx-id="${tx.id}"`,
		`data-date="${escapeHtml(isoToDisplay(tx.operation_date))}"`,
		`data-purpose="${escapeHtml((tx.description ?? "") + (tx.bank_category ? " · " + tx.bank_category : ""))}"`,
		`data-amount="${escapeHtml(amountLabel)}"`,
		`data-posting-id="${tx.posting_category_id ?? ""}"`,
		`data-subconto="${escapeHtml(tx.subconto ?? "")}"`,
	].join(" ");

	return `
		<tr ${dataAttrs}>
			<td>${isoToDisplay(tx.operation_date)}</td>
			<td>${escapeHtml(contragent)}</td>
			<td>${escapeHtml(purpose)}</td>
			<td class="amount-in">${tx.direction === "in" ? formatMoney(tx.amount) : "—"}</td>
			<td class="amount-out">${tx.direction === "out" ? formatMoney(tx.amount) : "—"}</td>
			<td class="${postingClass}">${escapeHtml(posting)}</td>
		</tr>`;
}

function renderDrawer(period: string, categories: PostingCategoryRow[], categorySubconto: Record<number, string[]>): string {
	const categoryOptionsHtml = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("\n");
	const categorySubcontoJson = JSON.stringify(categorySubconto);

	return `
	<div class="modal-overlay" id="drawerOverlay">
		<div class="modal-card drawer-modal-card">
			<div class="drawer-header">
				<h2>Операция</h2>
				<button type="button" class="drawer-close" id="drawerClose">✕</button>
			</div>
			<div class="drawer-body">
				<div class="drawer-field">
					<span class="drawer-label">Дата</span>
					<span class="drawer-value" id="drawerDate"></span>
				</div>
				<div class="drawer-field">
					<span class="drawer-label">Назначение</span>
					<span class="drawer-value" id="drawerPurpose"></span>
				</div>
				<div class="drawer-field">
					<span class="drawer-label">Сумма</span>
					<span class="drawer-value" id="drawerAmount"></span>
				</div>
				<div class="drawer-divider"></div>
				<form method="post" action="/card-universal/transactions/update" id="drawerForm">
					<input type="hidden" name="id" id="drawerTxId" value="" />
					<input type="hidden" name="period" value="${period}" />
					<div class="drawer-field">
						<span class="drawer-label">Разноска</span>
						<select name="posting_category_id" id="drawerPosting">
							<option value="">Не указано</option>
							${categoryOptionsHtml}
						</select>
					</div>
					<div class="drawer-field" id="drawerSubcontoField" hidden>
						<span class="drawer-label">Субконто</span>
						<select name="subconto" id="drawerSubconto">
							<option value="">Не выбрано</option>
						</select>
					</div>
					<div class="drawer-actions">
						<button type="submit" class="btn-primary">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
	</div>
	<script>
		(function () {
			var overlay = document.getElementById("drawerOverlay");
			var closeBtn = document.getElementById("drawerClose");
			var postingSelect = document.getElementById("drawerPosting");
			var subcontoField = document.getElementById("drawerSubcontoField");
			var subcontoSelect = document.getElementById("drawerSubconto");
			var categorySubconto = ${categorySubcontoJson};

			function syncSubcontoField(preselect) {
				var names = postingSelect.value ? categorySubconto[postingSelect.value] : null;
				if (names) {
					subcontoSelect.innerHTML = '<option value="">Не выбрано</option>';
					names.forEach(function (name) {
						var opt = document.createElement("option");
						opt.value = name;
						opt.textContent = name;
						subcontoSelect.appendChild(opt);
					});
					if (preselect) subcontoSelect.value = preselect;
					subcontoField.hidden = false;
				} else {
					subcontoField.hidden = true;
					subcontoSelect.value = "";
				}
			}

			function openDrawer(row) {
				document.getElementById("drawerTxId").value = row.dataset.txId;
				document.getElementById("drawerDate").textContent = row.dataset.date;
				document.getElementById("drawerPurpose").textContent = row.dataset.purpose;
				document.getElementById("drawerAmount").textContent = row.dataset.amount;
				document.getElementById("drawerPosting").value = row.dataset.postingId || "";
				syncSubcontoField(row.dataset.subconto || "");
				overlay.classList.add("open");
			}

			function closeDrawer() {
				overlay.classList.remove("open");
			}

			document.querySelectorAll("tbody tr[data-tx-id]").forEach(function (row) {
				row.addEventListener("click", function () {
					openDrawer(row);
				});
			});

			postingSelect.addEventListener("change", function () {
				syncSubcontoField();
			});
			closeBtn.addEventListener("click", closeDrawer);
			overlay.addEventListener("click", function (e) {
				if (e.target === overlay) closeDrawer();
			});

			// Сохранение разноски — обычный POST с редиректом на ту же страницу, после которого
			// браузер прокручивает наверх. Запоминаем позицию перед сабмитом и восстанавливаем
			// после перезагрузки, чтобы не терять место в длинном списке операций.
			var drawerForm = document.getElementById("drawerForm");
			drawerForm.addEventListener("submit", function () {
				try {
					sessionStorage.setItem("cardScrollY", String(window.scrollY));
				} catch (e) {}
			});

			try {
				var savedScrollY = sessionStorage.getItem("cardScrollY");
				if (savedScrollY !== null) {
					sessionStorage.removeItem("cardScrollY");
					window.scrollTo(0, parseInt(savedScrollY, 10));
				}
			} catch (e) {}
		})();
	</script>
	`;
}

export async function renderCardPage(env: Env, url: URL): Promise<string> {
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const account = await getAccount(env);

	if (!account) {
		const content = `
		<div class="topbar"><h1>Карточка Универсальная</h1></div>
		${renderSubTabs(CARD_TABS, "/card-universal")}
		<div class="table-card">
			<div class="empty-state">
				<p>Выписок ещё нет — загрузи первый файл.</p>
				<form method="post" action="/card-universal/upload" enctype="multipart/form-data" class="upload-form" style="justify-content:center; margin-top:12px;">
					<input type="file" name="file" accept=".xlsx" required />
					<button type="submit" class="btn-primary">Загрузить</button>
				</form>
			</div>
		</div>`;
		return renderPage("/card-universal", "Карточка Универсальная", `<style>${STYLES}${SUB_TABS_STYLES}</style>${content}`);
	}

	const { from: periodFrom, to: periodTo } = periodRangeFromToken(period);
	const transactions = await listTransactions(env, account.id, periodFrom, periodTo);
	const categories = await listPostingCategories(env);
	const ownAccounts = await listOwnAccounts(env);
	const cashBoxes = await listCashBoxes(env);
	const expenseItems = await listExpenseItems(env);
	const employeeItems = await listEmployees(env);
	const otherOperationItems = await listOtherOperations(env);
	const { results: suppliers } = await env.DB.prepare(`SELECT name FROM counterparties WHERE is_supplier = 1 ORDER BY name`).all<{ name: string }>();

	const refLists: Record<ReferenceKind, string[]> = {
		accounts: ownAccounts.map((a) => a.name),
		cashBoxes: cashBoxes.map((c) => c.name),
		suppliers: suppliers.map((s) => s.name),
		expenses: expenseItems.map((e) => e.name),
		employees: employeeItems.map((e) => e.name),
		otherOperations: otherOperationItems.map((o) => o.name),
	};
	const categorySubcontoOptions: Record<number, string[]> = {};
	for (const c of categories) {
		const need = subcontoNeedOf(c, refLists);
		if (need) categorySubcontoOptions[c.id] = need;
	}

	const totalIn = transactions.filter((t) => t.direction === "in").reduce((sum, t) => sum + t.amount, 0);
	const totalOut = transactions.filter((t) => t.direction === "out").reduce((sum, t) => sum + t.amount, 0);
	const balanceStart = await balanceBefore(env, account.id, periodFrom);
	const balanceEnd = await balanceAtEndOf(env, account.id, periodTo);

	const rowsHtml = transactions.length ? transactions.map(renderRow).join("\n") : `<tr><td colspan="6" class="empty-state">За этот период операций нет</td></tr>`;

	let banner = "";
	const imported = url.searchParams.get("imported");
	const importError = url.searchParams.get("import_error");
	if (importError) {
		banner = `<div class="banner error">⚠ Не удалось загрузить файл: ${escapeHtml(importError)}</div>`;
	} else if (imported !== null) {
		const added = parseInt(imported, 10);
		banner = added > 0 ? `<div class="banner ok">✓ Добавлено новых операций: ${added}</div>` : `<div class="banner ok">✓ Новых операций нет, всё уже загружено</div>`;
	}

	const unposted = transactions.filter((t) => t.posting_category_id === null).length;
	if (unposted > 0) {
		banner += `<div class="banner warning"><span>⚠ Неразнесённых операций за период: ${unposted}</span></div>`;
	}

	const content = `
	<style>${STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${SUB_TABS_STYLES}${MODAL_STYLES}</style>
	${banner}
	<div class="topbar">
		<h1>Карточка · ${escapeHtml(account.name)}</h1>
		<div class="topbar-actions">
			${renderPeriodPicker("/card-universal", period, periodFrom, periodTo)}
			<form method="post" action="/card-universal/upload" enctype="multipart/form-data" class="upload-form">
				<input type="file" name="file" accept=".xlsx" required />
				<button type="submit" class="btn-primary">⬆ Загрузить выписку</button>
			</form>
		</div>
	</div>
	${renderSubTabs(CARD_TABS, "/card-universal")}

	<div class="stats-row">
		<div class="stat-card">
			<div class="stat-label">Остаток на начало</div>
			<div class="stat-value">${formatMoney(balanceStart)} грн</div>
		</div>
		<div class="stat-card">
			<div class="stat-label">Приход за период</div>
			<div class="stat-value positive">+${formatMoney(totalIn)} грн</div>
		</div>
		<div class="stat-card">
			<div class="stat-label">Расход за период</div>
			<div class="stat-value negative">-${formatMoney(totalOut)} грн</div>
		</div>
		<div class="stat-card highlight">
			<div class="stat-label">Остаток на конец</div>
			<div class="stat-value">${formatMoney(balanceEnd)} грн</div>
		</div>
	</div>

	<div class="table-card">
		<table>
			<thead>
				<tr>
					<th>Дата ▾</th>
					<th>Контрагент</th>
					<th>Назначение</th>
					<th>Приход</th>
					<th>Расход</th>
					<th>Разноска</th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
			</tbody>
		</table>
	</div>

	${renderDrawer(period, categories, categorySubcontoOptions)}
	`;

	return renderPage("/card-universal", "Карточка Универсальная", content);
}

function categoryAccLabel(code: string): string {
	const acc = CHART_OF_ACCOUNTS.find((a) => a.code === code);
	return acc ? `${code} — ${escapeHtml(acc.name)}` : escapeHtml(code);
}

function categoryAccountOptionsHtml(selected?: string): string {
	return CHART_OF_ACCOUNTS.map((a) => `<option value="${a.code}" ${a.code === selected ? "selected" : ""}>${a.code} — ${escapeHtml(a.name)}</option>`).join("\n");
}

type CategoryPrefill = {
	name: string;
	debitAccount: string;
	debitSubconto: string | null;
	creditAccount: string;
	creditSubconto: string | null;
};

function categoryFieldsHtml(idPrefix: string, prefill?: CategoryPrefill): string {
	return `
		<div class="drawer-field">
			<span class="drawer-label">Название</span>
			<input type="text" name="name" value="${prefill ? escapeHtml(prefill.name) : ""}" required />
		</div>
		<div class="journal-form-grid">
			<div class="drawer-field">
				<span class="drawer-label">Счёт Дт</span>
				<select name="debit_account" id="${idPrefix}DebitAccountSelect" required>
					<option value="">Выберите счёт</option>
					${categoryAccountOptionsHtml(prefill?.debitAccount)}
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Субконто Дт</span>
				<select name="debit_subconto" id="${idPrefix}DebitSubcontoSelect" hidden>
					<option value="">Не выбрано</option>
				</select>
				<input type="text" name="debit_subconto" id="${idPrefix}DebitSubcontoText" placeholder="необязательно" value="${prefill?.debitSubconto ? escapeHtml(prefill.debitSubconto) : ""}" />
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Счёт Кт</span>
				<select name="credit_account" id="${idPrefix}CreditAccountSelect" required>
					<option value="">Выберите счёт</option>
					${categoryAccountOptionsHtml(prefill?.creditAccount)}
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Субконто Кт</span>
				<select name="credit_subconto" id="${idPrefix}CreditSubcontoSelect" hidden>
					<option value="">Не выбрано</option>
				</select>
				<input type="text" name="credit_subconto" id="${idPrefix}CreditSubcontoText" placeholder="необязательно" value="${prefill?.creditSubconto ? escapeHtml(prefill.creditSubconto) : ""}" />
			</div>
		</div>
	`;
}

function bindCategoryAccountSubcontoScript(idPrefix: string, accountSubcontoMap: Record<string, string[]>, initialDebitSubconto: string | null, initialCreditSubconto: string | null): string {
	return `
		<script>
			(function () {
				var accountSubconto = ${JSON.stringify(accountSubcontoMap)};

				function bind(accountId, subcontoSelectId, subcontoTextId, initial) {
					var accountSelect = document.getElementById(accountId);
					var subcontoSelect = document.getElementById(subcontoSelectId);
					var subcontoText = document.getElementById(subcontoTextId);

					function sync(preselect) {
						var names = accountSubconto[accountSelect.value];
						if (names) {
							subcontoSelect.innerHTML = '<option value="">Не выбрано</option>';
							names.forEach(function (name) {
								var opt = document.createElement("option");
								opt.value = name;
								opt.textContent = name;
								subcontoSelect.appendChild(opt);
							});
							if (preselect) subcontoSelect.value = preselect;
							subcontoSelect.hidden = false;
							subcontoSelect.disabled = false;
							subcontoText.hidden = true;
							subcontoText.disabled = true;
						} else {
							subcontoSelect.hidden = true;
							subcontoSelect.disabled = true;
							subcontoText.hidden = false;
							subcontoText.disabled = false;
						}
					}

					accountSelect.addEventListener("change", function () {
						sync(null);
					});
					sync(initial);
				}

				bind("${idPrefix}DebitAccountSelect", "${idPrefix}DebitSubcontoSelect", "${idPrefix}DebitSubcontoText", ${JSON.stringify(initialDebitSubconto)});
				bind("${idPrefix}CreditAccountSelect", "${idPrefix}CreditSubcontoSelect", "${idPrefix}CreditSubcontoText", ${JSON.stringify(initialCreditSubconto)});
			})();
		</script>
	`;
}

export async function renderCardCategoriesPage(env: Env, url: URL): Promise<string> {
	const deleteError = url.searchParams.get("delete_error");
	const categories = await listPostingCategories(env);
	const ownAccounts = await listOwnAccounts(env);
	const cashBoxes = await listCashBoxes(env);
	const expenseItems = await listExpenseItems(env);
	const employeeItems = await listEmployees(env);
	const otherOperationItems = await listOtherOperations(env);
	const { results: suppliers } = await env.DB.prepare(`SELECT name FROM counterparties WHERE is_supplier = 1 ORDER BY name`).all<{ name: string }>();

	const refLists: Record<ReferenceKind, string[]> = {
		accounts: ownAccounts.map((a) => a.name),
		cashBoxes: cashBoxes.map((c) => c.name),
		suppliers: suppliers.map((s) => s.name),
		expenses: expenseItems.map((e) => e.name),
		employees: employeeItems.map((e) => e.name),
		otherOperations: otherOperationItems.map((o) => o.name),
	};
	const accountSubcontoMap: Record<string, string[]> = {};
	for (const acc of CHART_OF_ACCOUNTS) {
		if (acc.refKind) accountSubcontoMap[acc.code] = refLists[acc.refKind];
	}

	const rowsHtml = categories.length
		? categories
				.map(
					(c: PostingCategoryRow) => `
			<tr>
				<td>${escapeHtml(c.name)}</td>
				<td class="acc">${categoryAccLabel(c.debit_account)}${c.debit_subconto ? ` <span class="subconto">/ ${escapeHtml(c.debit_subconto)}</span>` : ""}</td>
				<td class="acc">${categoryAccLabel(c.credit_account)}${c.credit_subconto ? ` <span class="subconto">/ ${escapeHtml(c.credit_subconto)}</span>` : ""}</td>
				<td class="row-delete">
					<button type="button" class="btn-secondary" id="editCat${c.id}Trigger" title="Редактировать">${editIconSvg()}</button>
					${renderConfirmModal({
						id: `deleteCat${c.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить разноску?",
						message: "Действие необратимо.",
						confirmLabel: "Удалить",
						formAction: `/card-universal/categories/${c.id}/delete`,
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="4" class="empty-state">Разносок пока нет</td></tr>`;

	const newCategoryFormHtml = `
		<form method="post" action="/card-universal/categories">
			${categoryFieldsHtml("newCat")}
			<div class="drawer-actions">
				<button type="submit" class="btn-primary">Добавить</button>
			</div>
		</form>
		${bindCategoryAccountSubcontoScript("newCat", accountSubcontoMap, null, null)}
	`;

	const editModalsHtml = categories
		.map((c: PostingCategoryRow) => {
			const prefix = `editCat${c.id}`;
			return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Редактировать разноску</h3>
				<form method="post" action="/card-universal/categories/${c.id}/update">
					${categoryFieldsHtml(prefix, {
						name: c.name,
						debitAccount: c.debit_account,
						debitSubconto: c.debit_subconto,
						creditAccount: c.credit_account,
						creditSubconto: c.credit_subconto,
					})}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
		${bindCategoryAccountSubcontoScript(prefix, accountSubcontoMap, c.debit_subconto, c.credit_subconto)}
		<script>
			(function () {
				var overlay = document.getElementById("${prefix}Overlay");
				var cancelBtn = document.getElementById("${prefix}Cancel");
				cancelBtn.addEventListener("click", function () {
					overlay.classList.remove("open");
				});
				overlay.addEventListener("click", function (e) {
					if (e.target === overlay) overlay.classList.remove("open");
				});
			})();
		</script>`;
		})
		.join("\n");

	const banner = deleteError ? `<div class="banner error">⚠ Не удалось удалить: ${escapeHtml(deleteError)}</div>` : "";

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	${banner}
	<div class="topbar">
		<h1>Карточка Универсальная</h1>
		<div class="topbar-actions">
			${renderSimpleDrawer({ id: "newCategory", title: "Новая разноска", triggerLabel: "+ Разноска", bodyHtml: newCategoryFormHtml })}
		</div>
	</div>
	${renderSubTabs(CARD_TABS, "/card-universal/categories")}

	<div class="table-card">
		<table>
			<thead>
				<tr><th>Название</th><th>Дебет</th><th>Кредит</th><th></th></tr>
			</thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>

	${editModalsHtml}

	<script>
		document.querySelectorAll('[id^="editCat"][id$="Trigger"]').forEach(function (btn) {
			var overlayId = btn.id.replace(/Trigger$/, "Overlay");
			btn.addEventListener("click", function () {
				var overlay = document.getElementById(overlayId);
				if (overlay) overlay.classList.add("open");
			});
		});
	</script>
	`;

	return renderPage("/card-universal", "Карточка Универсальная · Правила разноски", content);
}

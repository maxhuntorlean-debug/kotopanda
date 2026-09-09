import { renderPage } from "../layout";
import { escapeHtml, formatMoney, isoToDisplay, todayIso, periodRangeFromToken, resolvePeriodToken } from "../format";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, SUB_TABS_STYLES, renderSubTabs, type SubTab, DRAWER_STYLES, MODAL_STYLES, renderConfirmModal, editIconSvg, deleteIconSvg } from "../ui";
import {
	listJournalEntries,
	listOwnAccounts,
	listCashBoxes,
	listExpenseItems,
	listEmployees,
	listOtherOperations,
	getTurnoverBalance,
	getAccountCard,
	CHART_OF_ACCOUNTS,
	LEDGERS,
	type ReferenceKind,
	type AccountCardRow,
	type Ledger,
	type Turnover,
} from "../accounting";

function accountingTabs(ledger: Ledger): SubTab[] {
	return [
		{ href: `/accounting/${ledger}`, label: "Оборотка" },
		{ href: `/accounting/${ledger}/journal`, label: "Проводки" },
	];
}

function ledgerTitle(ledger: Ledger): string {
	return LEDGERS.find((l) => l.id === ledger)?.label ?? "Бухгалтерия";
}

const STYLES = `
	.table-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 20px;
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
		white-space: nowrap;
	}
	tbody td {
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
		white-space: nowrap;
	}
	tbody tr:last-child td { border-bottom: none; }
	.empty-state {
		padding: 40px 16px;
		text-align: center;
		color: var(--text-muted);
	}
	.source-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		background: var(--bg);
		color: var(--text-muted);
	}
	.muted { color: var(--text-muted); }
	.acc { font-weight: 600; }
	.subconto { color: var(--text-muted); }
	.row-num { color: var(--text-muted); }
	.journal-table-wrap { overflow-x: auto; }
	.row-delete {
		text-align: right;
		position: sticky;
		right: 0;
		background: var(--panel);
		box-shadow: -6px 0 6px -6px rgba(0, 0, 0, 0.15);
	}
	.row-delete .btn-secondary {
		padding: 6px 10px;
		font-size: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.topbar { justify-content: flex-start; }
	.topbar h1 { white-space: nowrap; }
	.back-link { color: var(--text-muted); font-weight: 500; }
	.back-link:hover { color: var(--blue); }
	.topbar-actions .btn-primary { font: inherit; cursor: pointer; }
	.journal-form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
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
	.modal-card {
		width: 440px;
	}
	.modal-card input[type="date"],
	.modal-card input[type="text"],
	.modal-card input[type="number"],
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
	.turnover-table {
		border-collapse: separate;
		border-spacing: 0;
	}
	.turnover-table th, .turnover-table td {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.turnover-table th:nth-child(1), .turnover-table td:nth-child(1) {
		text-align: left;
	}
	.turnover-table th {
		text-align: center;
	}
	.turnover-table thead .grp-head {
		background: var(--blue-soft);
		color: var(--blue);
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding-top: 10px;
		padding-bottom: 10px;
	}
	.turnover-table thead .sub-head {
		background: var(--bg);
		color: var(--text-muted);
		font-size: 11px;
	}
	.turnover-table .grp-start {
		border-left: 1px solid var(--border);
	}
	.turnover-table .acc-cell {
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.turnover-table .drill-icon {
		color: var(--text-muted);
		font-size: 10px;
		transition: transform 0.15s ease;
	}
	.turnover-table tbody tr.open .drill-icon {
		transform: rotate(90deg);
		color: var(--blue);
	}
	.turnover-table tbody tr:nth-child(even):not(.totals-row) {
		background: rgba(31, 41, 55, 0.015);
	}
	.turnover-table tbody tr.clickable {
		cursor: pointer;
	}
	.turnover-table tbody tr.clickable:hover {
		background: var(--blue-soft);
	}
	.turnover-table tbody tr.clickable.open {
		background: var(--blue-soft);
	}
	.turnover-table td.result {
		font-weight: 700;
	}
	.subconto-panel {
		border-left: 3px solid var(--blue);
	}
	.subconto-panel h3 {
		color: var(--text-muted);
		margin: 0;
		padding: 16px 16px 12px;
		font-size: 14px;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.subconto-panel .subconto-icon {
		color: var(--blue);
	}
	.turnover-table .totals-row td {
		font-weight: 700;
		border-top: 2px solid var(--border);
		background: var(--bg);
	}
	.turnover-table td.zero {
		color: var(--border);
		font-weight: 400;
	}
	.card-block {
		padding: 16px;
		position: relative;
	}
	.card-header {
		margin-bottom: 14px;
	}
	.card-header h2 {
		margin: 0;
		font-size: 16px;
	}
	.card-period {
		color: var(--text-muted);
		font-size: 12px;
		margin-top: 2px;
	}
	.card-table-wrap { overflow-x: auto; }
	.card-table { min-width: 900px; }
	.card-table td.cell-left, .card-table th.cell-left { text-align: left; }
	.card-table td.op-cell { white-space: normal; word-break: break-word; max-width: 360px; }
	.bal-d, .bal-k { font-weight: 700; }
	.card-close {
		position: absolute;
		top: 12px;
		right: 12px;
		border: 1px solid var(--border);
		background: var(--panel);
		border-radius: 8px;
		width: 28px;
		height: 28px;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 13px;
	}
	.card-close:hover { color: var(--text); }
`;

function journalAccountOptionsHtml(selected?: string): string {
	return CHART_OF_ACCOUNTS.map((a) => `<option value="${a.code}" ${a.code === selected ? "selected" : ""}>${a.code} — ${escapeHtml(a.name)}</option>`).join("\n");
}

type JournalEntryPrefill = {
	entryDate: string;
	debitAccount: string;
	debitSubconto: string | null;
	creditAccount: string;
	creditSubconto: string | null;
	amount: number;
	description: string | null;
};

function journalFieldsHtml(idPrefix: string, prefill?: JournalEntryPrefill): string {
	return `
		<div class="drawer-field">
			<span class="drawer-label">Дата</span>
			<input type="date" name="entry_date" value="${prefill ? prefill.entryDate : todayIso()}" required />
		</div>
		<div class="journal-form-grid">
			<div class="drawer-field">
				<span class="drawer-label">Счёт Дт</span>
				<select name="debit_account" id="${idPrefix}DebitAccountSelect" required>
					<option value="">Выберите счёт</option>
					${journalAccountOptionsHtml(prefill?.debitAccount)}
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
					${journalAccountOptionsHtml(prefill?.creditAccount)}
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
		<div class="drawer-field">
			<span class="drawer-label">Сумма, грн</span>
			<input type="number" name="amount" step="0.01" min="0.01" value="${prefill ? prefill.amount : ""}" required />
		</div>
		<div class="drawer-field">
			<span class="drawer-label">Комментарий</span>
			<input type="text" name="description" placeholder="Необязательно" value="${prefill?.description ? escapeHtml(prefill.description) : ""}" />
		</div>
	`;
}

function bindJournalAccountSubcontoScript(idPrefix: string, accountSubcontoMap: Record<string, string[]>, initialDebitSubconto: string | null, initialCreditSubconto: string | null): string {
	return `
		<script>
			(function () {
				var accountSubconto = ${JSON.stringify(accountSubcontoMap)};

				function bindAccountSubconto(accountSelectId, subcontoSelectId, subcontoTextId, initial) {
					var accountSelect = document.getElementById(accountSelectId);
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
							subcontoText.value = "";
						} else {
							subcontoSelect.hidden = true;
							subcontoSelect.disabled = true;
							subcontoText.hidden = false;
							subcontoText.disabled = false;
						}
					}

					accountSelect.addEventListener("change", function () { sync(null); });
					sync(initial);
				}

				bindAccountSubconto("${idPrefix}DebitAccountSelect", "${idPrefix}DebitSubcontoSelect", "${idPrefix}DebitSubcontoText", ${JSON.stringify(initialDebitSubconto)});
				bindAccountSubconto("${idPrefix}CreditAccountSelect", "${idPrefix}CreditSubcontoSelect", "${idPrefix}CreditSubcontoText", ${JSON.stringify(initialCreditSubconto)});
			})();
		</script>
	`;
}

// Субконто-подсказки зависят от того, какой счёт введён в Дт/Кт — берём из плана счетов,
// у каких счетов какой справочник захардкожен (31 -> Счета, 30 -> Кассы, 63 -> Поставщики, 92 -> Расходы, 66 -> Сотрудники).
// Общая для всех мест, где открывается модалка новой/редактируемой проводки (Проводки, Оборотка).
export async function buildAccountSubcontoMap(env: Env): Promise<Record<string, string[]>> {
	const [ownAccounts, cashBoxes, expenseItems, employeeItems, otherOperationItems, suppliersResult] = await Promise.all([
		listOwnAccounts(env),
		listCashBoxes(env),
		listExpenseItems(env),
		listEmployees(env),
		listOtherOperations(env),
		env.DB.prepare(`SELECT name FROM counterparties WHERE is_supplier = 1 ORDER BY name`).all<{ name: string }>(),
	]);
	const suppliers = suppliersResult.results;

	const refLists: Record<ReferenceKind, string[]> = {
		accounts: ownAccounts.map((a) => a.name),
		cashBoxes: cashBoxes.map((c) => c.name),
		suppliers: suppliers.map((s) => s.name),
		employees: employeeItems.map((e) => e.name),
		otherOperations: otherOperationItems.map((o) => o.name),
		expenses: expenseItems.map((e) => e.name),
	};
	const accountSubcontoMap: Record<string, string[]> = {};
	for (const acc of CHART_OF_ACCOUNTS) {
		if (acc.refKind) accountSubcontoMap[acc.code] = refLists[acc.refKind];
	}
	return accountSubcontoMap;
}

// Кнопка "+ Проводка" и модалка создания — переиспользуется и на странице Проводок, и на Оборотке.
// returnTo — куда редиректнуть после сохранения (см. POST /accounting/:ledger/journal в index.ts),
// чтобы со страницы Оборотки не улетало на страницу Проводок.
function newEntryModalHtml(ledger: Ledger, period: string, accountSubcontoMap: Record<string, string[]>, returnTo: string): string {
	return `
		<button type="button" class="btn-primary" id="newEntryTrigger">+ Проводка</button>
		<div class="modal-overlay" id="newEntryOverlay">
			<div class="modal-card">
				<h3>Новая проводка</h3>
				<form method="post" action="/accounting/${ledger}/journal">
					<input type="hidden" name="period" value="${period}" />
					<input type="hidden" name="return_to" value="${escapeHtml(returnTo)}" />
					${journalFieldsHtml("newEntry")}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="newEntryCancel">Отмена</button>
						<button type="submit" class="btn-confirm">Добавить</button>
					</div>
				</form>
			</div>
		</div>
		${bindJournalAccountSubcontoScript("newEntry", accountSubcontoMap, null, null)}
		<script>
			(function () {
				var overlay = document.getElementById("newEntryOverlay");
				var trigger = document.getElementById("newEntryTrigger");
				var cancelBtn = document.getElementById("newEntryCancel");
				trigger.addEventListener("click", function () {
					overlay.classList.add("open");
				});
				cancelBtn.addEventListener("click", function () {
					overlay.classList.remove("open");
				});
				overlay.addEventListener("click", function (e) {
					if (e.target === overlay) overlay.classList.remove("open");
				});
			})();
		</script>
	`;
}

export async function renderAccountingJournalPage(env: Env, url: URL, ledger: Ledger): Promise<string> {
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);
	const entries = await listJournalEntries(env, from, to, ledger);
	const accountSubcontoMap = await buildAccountSubcontoMap(env);

	// Редактировать/удалять можно только настоящие ручные проводки — авто-строки из банка/кассы
	// правятся только из своего источника (e.id === null), а проводки Взаимозачёта хоть и имеют
	// id, правятся только со страницы /offset (иначе рассинхронится пара с другой книгой).
	const rowsHtml = entries.length
		? entries
				.map(
					(e, i) => `
			<tr>
				<td class="row-num">${i + 1}</td>
				<td>${isoToDisplay(e.date)}</td>
				<td class="acc">${escapeHtml(e.entry.debitAccount)}</td>
				<td class="subconto">${e.entry.debitSubconto ? escapeHtml(e.entry.debitSubconto) : ""}</td>
				<td class="acc">${escapeHtml(e.entry.creditAccount)}</td>
				<td class="subconto">${e.entry.creditSubconto ? escapeHtml(e.entry.creditSubconto) : ""}</td>
				<td>${e.quantity !== null ? e.quantity : ""}</td>
				<td>${formatMoney(e.amount)} грн</td>
				<td><span class="source-badge">${e.source === "bank" ? "Банк" : e.source === "cash" ? "Касса" : e.source === "card" ? "Карта" : e.source === "offset" ? "Взаимозачёт" : "Вручную"}</span></td>
				<td>${escapeHtml(e.description)}</td>
				<td class="row-delete">
					${
						e.id !== null && e.source !== "offset"
							? `
						<button type="button" class="btn-secondary" id="editEntry${e.id}Trigger" title="Редактировать">${editIconSvg()}</button>
						${renderConfirmModal({
							id: `deleteEntry${e.id}`,
							triggerLabel: deleteIconSvg(),
							triggerClass: "btn-secondary",
							title: "Удалить проводку?",
							message: "Действие необратимо.",
							confirmLabel: "Удалить",
							formAction: `/accounting/${ledger}/journal/${e.id}/delete`,
							hiddenFields: { period },
						})}`
							: ""
					}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="11" class="empty-state">За этот период проводок нет</td></tr>`;

	const editModalsHtml = entries
		.filter((e) => e.id !== null && e.source !== "offset")
		.map((e) => {
			const prefix = `editEntry${e.id}`;
			return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Редактировать проводку</h3>
				<form method="post" action="/accounting/${ledger}/journal/${e.id}/update">
					<input type="hidden" name="period" value="${period}" />
					${journalFieldsHtml(prefix, {
						entryDate: e.date,
						debitAccount: e.entry.debitAccount,
						debitSubconto: e.entry.debitSubconto,
						creditAccount: e.entry.creditAccount,
						creditSubconto: e.entry.creditSubconto,
						amount: e.amount,
						description: e.description === "—" ? null : e.description,
					})}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
		${bindJournalAccountSubcontoScript(prefix, accountSubcontoMap, e.entry.debitSubconto, e.entry.creditSubconto)}
		<script>
			(function () {
				var overlay = document.getElementById("${prefix}Overlay");
				var trigger = document.getElementById("${prefix}Trigger");
				var cancelBtn = document.getElementById("${prefix}Cancel");
				trigger.addEventListener("click", function () {
					overlay.classList.add("open");
				});
				cancelBtn.addEventListener("click", function () {
					overlay.classList.remove("open");
				});
				overlay.addEventListener("click", function (ev) {
					if (ev.target === overlay) overlay.classList.remove("open");
				});
			})();
		</script>`;
		})
		.join("\n");

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	<div class="topbar">
		<h1>${ledgerTitle(ledger)}</h1>
		<div class="topbar-actions">
			${renderPeriodPicker(`/accounting/${ledger}/journal`, period, from, to)}
			${newEntryModalHtml(ledger, period, accountSubcontoMap, `/accounting/${ledger}/journal?period=${encodeURIComponent(period)}`)}
		</div>
	</div>
	${renderSubTabs(accountingTabs(ledger), `/accounting/${ledger}/journal`)}

	<div class="table-card">
		<div class="journal-table-wrap">
		<table>
			<thead>
				<tr>
					<th>№</th><th>Дата</th><th>СчетДт</th><th>СубконтоДт</th><th>СчетКт</th><th>СубконтоКт</th>
					<th>Кол-во</th><th>Сумма</th><th>Источник</th><th>Комментарий</th><th class="row-delete"></th>
				</tr>
			</thead>
			<tbody>${rowsHtml}</tbody>
		</table>
		</div>
	</div>

	${editModalsHtml}
	`;

	return renderPage(`/accounting/${ledger}`, `${ledgerTitle(ledger)} · Проводки`, content);
}

// Порог в полкопейки — сумма многих проводок с плавающей точкой может дать вместо
// чистого нуля крошечный остаток вроде -2.8e-13; formatMoney его всё равно округлит
// до "0,00", так что сравнение с 0 напрямую ошибочно покажет число вместо прочерка.
// Используется везде, где сравнивают денежную сумму с нулём (не только в cell()).
function isZeroAmount(value: number): boolean {
	return Math.abs(value) < 0.005;
}

function cell(value: number): string {
	return isZeroAmount(value) ? `<span class="zero">—</span>` : formatMoney(value);
}

// Обе книги теперь на ОСВ-стиле (см. renderOsvTurnoverPage ниже, бывший "тест 2" для Котопанды).
export async function renderAccountingTurnoverPage(env: Env, url: URL, ledger: Ledger): Promise<string> {
	return renderOsvTurnoverPage(env, url, ledger);
}

// ОСВ-стиль — в духе печатной ОСВ 1С (белый фон, тонкие границы, зелёные заголовки групп,
// субконто сворачиваемые). Обе книги теперь на нём (см. renderOsvTurnoverPage ниже).
const OSV_STYLES = `
	.topbar { justify-content: flex-start; }
	.topbar h1 { white-space: nowrap; }
	.osv-card {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 20px;
	}
	.osv-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.osv-table th, .osv-table td {
		border: 1px solid #dde3da;
		text-align: right;
		font-variant-numeric: tabular-nums;
		padding: 6px 10px;
	}
	.osv-table th:first-child, .osv-table td:first-child {
		text-align: left;
	}
	.osv-table thead .osv-grp {
		background: #eaf3ea;
		color: #2f6b45;
		font-size: 12px;
		font-weight: 700;
		text-align: center;
	}
	.osv-table thead .osv-sub {
		background: #f4f8f3;
		color: #5c7d64;
		font-size: 11px;
		font-weight: 600;
		text-align: center;
	}
	.osv-table thead th:first-child {
		background: #eaf3ea;
		color: #2f6b45;
	}
	.osv-acc {
		font-weight: 700;
	}
	.osv-sub-row td {
		background: #fffdf3;
	}
	.osv-sub-row .osv-acc {
		font-weight: 400;
		padding-left: 24px;
		color: var(--text-muted);
	}
	.osv-total-row td {
		font-weight: 700;
		background: #f5f6f5;
		border-top: 2px solid var(--border);
	}
	.osv-table tbody tr.osv-clickable {
		cursor: pointer;
	}
	.osv-table tbody tr.osv-clickable:hover td {
		background: #eef3ee;
	}
	.osv-table tbody tr.osv-sub-row.osv-clickable:hover td {
		background: #f7f2dc;
	}
`;

// Субконто сворачиваемые: изначально скрыты, тап по строке счёта раскрывает/сворачивает их,
// а тап по строке субконто открывает Карточку счёта.
const OSV2_STYLES = `
	${OSV_STYLES}
	.journal-form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
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
	.modal-card {
		width: 440px;
	}
	.modal-card input[type="date"],
	.modal-card input[type="text"],
	.modal-card input[type="number"],
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
	.osv-drill-icon {
		display: inline-block;
		color: var(--text-muted);
		font-size: 10px;
		margin-left: 6px;
		transition: transform 0.15s ease;
	}
	.osv-account-row.osv-open .osv-drill-icon {
		transform: rotate(90deg);
		color: #2f6b45;
	}
	.osv-sub-row.osv-hidden {
		display: none;
	}
	.osv-card-block {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 16px;
		position: relative;
		margin-top: 20px;
	}
	.osv-card-header {
		margin-bottom: 14px;
	}
	.osv-card-header h2 {
		margin: 0;
		font-size: 16px;
	}
	.osv-card-period {
		color: var(--text-muted);
		font-size: 12px;
		margin-top: 2px;
	}
	.osv-card-table-wrap { overflow-x: auto; }
	.osv-card-table { min-width: 900px; }
	.osv-card-table td.osv-cell-left, .osv-card-table th.osv-cell-left { text-align: left; }
	.osv-card-table td.osv-op-cell { white-space: normal; word-break: break-word; max-width: 360px; }
	.osv-bal-d, .osv-bal-k { font-weight: 700; }
	.osv-bal-d { color: var(--text); }
	.osv-bal-k { color: var(--red); }
	.osv-card-close {
		position: absolute;
		top: 12px;
		right: 12px;
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 8px;
		width: 28px;
		height: 28px;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 13px;
	}
	.osv-card-close:hover { color: var(--text); }
	.osv-table.osv-card-table .osv-totals-row td {
		font-weight: 700;
		background: #f5f6f5;
		border-top: 2px solid var(--border);
	}
`;

async function renderOsvTurnoverPage(env: Env, url: URL, ledger: Ledger): Promise<string> {
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);
	const { rows, totals, subcontoByAccount } = await getTurnoverBalance(env, from, to, ledger);
	const accountSubcontoMap = await buildAccountSubcontoMap(env);

	function cardHref(account: string, subconto?: string): string {
		const params = new URLSearchParams({ account, period });
		if (subconto) params.set("subconto", subconto);
		return `/accounting/${ledger}/card/fragment?${params.toString()}`;
	}

	function osvRow(labelHtml: string, r: Turnover, attrs: string): string {
		return `
			<tr ${attrs}>
				<td class="osv-acc">${labelHtml}</td>
				<td>${cell(r.openingDebit)}</td>
				<td>${cell(r.openingCredit)}</td>
				<td>${cell(r.turnoverDebit)}</td>
				<td>${cell(r.turnoverCredit)}</td>
				<td>${cell(r.closingDebit)}</td>
				<td>${cell(r.closingCredit)}</td>
			</tr>`;
	}

	const rowsHtml = rows.length
		? rows
				.map((r) => {
					const sub = subcontoByAccount.get(r.key);
					const label = sub ? `${escapeHtml(r.key)}<span class="osv-drill-icon">▸</span>` : escapeHtml(r.key);
					const accountAttrs = sub
						? `class="osv-account-row osv-toggle" data-account="${escapeHtml(r.key)}"`
						: `class="osv-account-row osv-clickable" data-href="${cardHref(r.key)}"`;
					const accountRowHtml = osvRow(label, r, accountAttrs);
					const subRowsHtml = sub
						? sub.rows
								.map(
									(sr) =>
										osvRow(
											escapeHtml(sr.key),
											sr,
											`class="osv-sub-row osv-clickable osv-hidden" data-parent="${escapeHtml(r.key)}" data-href="${cardHref(r.key, sr.key)}"`,
										),
								)
								.join("\n")
						: "";
					return accountRowHtml + subRowsHtml;
				})
				.join("\n")
		: `<tr><td colspan="7" class="empty-state">За этот период проводок нет — будем наполнять постепенно</td></tr>`;

	const totalsRowHtml = rows.length
		? `
		<tr class="osv-total-row">
			<td>Итого</td>
			<td>${cell(totals.openingDebit)}</td>
			<td>${cell(totals.openingCredit)}</td>
			<td>${cell(totals.turnoverDebit)}</td>
			<td>${cell(totals.turnoverCredit)}</td>
			<td>${cell(totals.closingDebit)}</td>
			<td>${cell(totals.closingCredit)}</td>
		</tr>`
		: "";

	const content = `
	<style>${OSV2_STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	<div class="topbar">
		<h1>${ledgerTitle(ledger)}</h1>
		<div class="topbar-actions">
			${renderPeriodPicker(`/accounting/${ledger}`, period, from, to)}
			${newEntryModalHtml(ledger, period, accountSubcontoMap, `/accounting/${ledger}?period=${encodeURIComponent(period)}`)}
		</div>
	</div>
	${renderSubTabs(accountingTabs(ledger), `/accounting/${ledger}`)}

	<div class="osv-card">
		<table class="osv-table" id="osvTable">
			<thead>
				<tr>
					<th rowspan="2">Счёт</th>
					<th colspan="2" class="osv-grp">Сальдо на начало периода</th>
					<th colspan="2" class="osv-grp">Обороты за период</th>
					<th colspan="2" class="osv-grp">Сальдо на конец периода</th>
				</tr>
				<tr>
					<th class="osv-sub">Дебет</th><th class="osv-sub">Кредит</th>
					<th class="osv-sub">Дебет</th><th class="osv-sub">Кредит</th>
					<th class="osv-sub">Дебет</th><th class="osv-sub">Кредит</th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
				${totalsRowHtml}
			</tbody>
		</table>
	</div>

	<div id="accountCardContainer"></div>

	<script>
		(function () {
			var container = document.getElementById("accountCardContainer");

			function openCard(href) {
				fetch(href)
					.then(function (r) { return r.text(); })
					.then(function (html) {
						container.innerHTML = html;
						var closeBtn = document.getElementById("accountCardClose");
						if (closeBtn) {
							closeBtn.addEventListener("click", function () {
								container.innerHTML = "";
							});
						}
						container.scrollIntoView({ behavior: "smooth", block: "start" });
					});
			}

			document.querySelectorAll("#osvTable tbody tr.osv-toggle").forEach(function (row) {
				row.addEventListener("click", function () {
					var account = row.dataset.account;
					var wasOpen = row.classList.contains("osv-open");
					document.querySelectorAll('#osvTable tbody tr.osv-sub-row[data-parent="' + account + '"]').forEach(function (subRow) {
						subRow.classList.toggle("osv-hidden", wasOpen);
					});
					row.classList.toggle("osv-open", !wasOpen);
				});
			});

			document.querySelectorAll("#osvTable tbody tr.osv-clickable").forEach(function (row) {
				row.addEventListener("click", function (e) {
					e.stopPropagation();
					openCard(row.dataset.href);
				});
			});
		})();
	</script>
	`;

	return renderPage(`/accounting/${ledger}`, `${ledgerTitle(ledger)} · Оборотка`, content);
}

function osvCardBalanceHtml(balance: number): string {
	if (isZeroAmount(balance)) return `<span class="zero">—</span>`;
	return `<span class="${balance > 0 ? "osv-bal-d" : "osv-bal-k"}">${balance > 0 ? "Д" : "К"} ${formatMoney(Math.abs(balance))}</span>`;
}

// Карточка счёта для теста 2 — та же логика, что и в renderAccountCardBlock, только в вёрстке
// ОСВ-теста (белый фон, тонкие границы, зелёные заголовки) вместо обычного стиля приложения.
function renderOsvAccountCardBlock(
	accountCode: string,
	accountTitle: string,
	subconto: string | null,
	from: string,
	to: string,
	data: { openingBalance: number; rows: AccountCardRow[]; closingBalance: number },
): string {
	const { openingBalance, rows, closingBalance } = data;

	const rowsHtml = rows.length
		? rows
				.map((r) => {
					const debitAcc = !isZeroAmount(r.debit) ? accountCode : r.counterAccount;
					const creditAcc = !isZeroAmount(r.credit) ? accountCode : r.counterAccount;
					const documentLabel = r.source === "bank" ? "Выписка банка" : r.source === "cash" ? "Касса" : r.source === "card" ? "Карта" : r.source === "offset" ? "Взаимозачёт" : `Операция ${r.id}`;
					return `
				<tr>
					<td>${isoToDisplay(r.date)}</td>
					<td class="muted osv-cell-left">${documentLabel}</td>
					<td class="osv-op-cell osv-cell-left">${escapeHtml(r.description)}</td>
					<td class="osv-acc osv-cell-left">${escapeHtml(debitAcc)}</td>
					<td>${!isZeroAmount(r.debit) ? formatMoney(r.debit) : ""}</td>
					<td class="osv-acc osv-cell-left">${escapeHtml(creditAcc)}</td>
					<td>${!isZeroAmount(r.credit) ? formatMoney(r.credit) : ""}</td>
					<td>${osvCardBalanceHtml(r.balance)}</td>
				</tr>`;
				})
				.join("\n")
		: `<tr><td colspan="8" class="empty-state">За этот период движений по счёту нет</td></tr>`;

	return `
		<div class="osv-card-header">
			<h2>Карточка счёта — ${escapeHtml(accountTitle)}${subconto ? ` / ${escapeHtml(subconto)}` : ""}</h2>
			<div class="osv-card-period">за ${isoToDisplay(from)} – ${isoToDisplay(to)}</div>
		</div>
		<div class="osv-card-table-wrap">
		<table class="osv-table osv-card-table">
			<thead>
				<tr>
					<th rowspan="2">Дата</th>
					<th rowspan="2" class="osv-cell-left">Документ</th>
					<th rowspan="2" class="osv-cell-left">Операция</th>
					<th colspan="2" class="osv-grp">Дебет</th>
					<th colspan="2" class="osv-grp">Кредит</th>
					<th rowspan="2">Текущее сальдо</th>
				</tr>
				<tr>
					<th class="osv-sub osv-cell-left">Счёт</th><th class="osv-sub">Сумма</th>
					<th class="osv-sub osv-cell-left">Счёт</th><th class="osv-sub">Сумма</th>
				</tr>
			</thead>
			<tbody>
				<tr class="osv-totals-row">
					<td colspan="3">Сальдо на начало периода</td>
					<td></td>
					<td>${openingBalance > 0 && !isZeroAmount(openingBalance) ? formatMoney(openingBalance) : ""}</td>
					<td></td>
					<td>${openingBalance < 0 && !isZeroAmount(openingBalance) ? formatMoney(-openingBalance) : ""}</td>
					<td></td>
				</tr>
				${rowsHtml}
				<tr class="osv-totals-row">
					<td colspan="3">Сальдо на конец периода</td>
					<td></td>
					<td>${closingBalance > 0 && !isZeroAmount(closingBalance) ? formatMoney(closingBalance) : ""}</td>
					<td></td>
					<td>${closingBalance < 0 && !isZeroAmount(closingBalance) ? formatMoney(-closingBalance) : ""}</td>
					<td></td>
				</tr>
			</tbody>
		</table>
		</div>
	`;
}

async function renderOsvAccountCardFragment(env: Env, url: URL, ledger: Ledger): Promise<string> {
	const { account, accountTitle, subconto, from, to, data } = await loadAccountCard(env, url, ledger);
	return `
		<div class="osv-card-block">
			<button type="button" class="osv-card-close" id="accountCardClose" aria-label="Закрыть">✕</button>
			${renderOsvAccountCardBlock(account, accountTitle, subconto, from, to, data)}
		</div>
	`;
}

async function loadAccountCard(
	env: Env,
	url: URL,
	ledger: Ledger,
): Promise<{ account: string; accountTitle: string; subconto: string | null; period: string; from: string; to: string; data: { openingBalance: number; rows: AccountCardRow[]; closingBalance: number } }> {
	const account = url.searchParams.get("account") ?? "";
	const subconto = url.searchParams.get("subconto");
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);
	const chartAccount = CHART_OF_ACCOUNTS.find((a) => a.code === account);
	const accountTitle = chartAccount ? `${account} — ${chartAccount.name}` : account;
	const data = await getAccountCard(env, account, subconto, from, to, ledger);
	return { account, accountTitle, subconto, period, from, to, data };
}

export async function renderAccountCardPage(env: Env, url: URL, ledger: Ledger): Promise<string> {
	const { account, accountTitle, subconto, period, from, to, data } = await loadAccountCard(env, url, ledger);

	const backHref = `/accounting/${ledger}?period=${encodeURIComponent(period)}`;
	const pickerBasePath = `/accounting/${ledger}/card?${new URLSearchParams(subconto ? { account, subconto } : { account }).toString()}`;

	const content = `
	<style>${OSV2_STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}</style>
	<div class="topbar">
		<h1><a href="${backHref}" class="back-link">← Оборотка</a></h1>
		<div class="topbar-actions">${renderPeriodPicker(pickerBasePath, period, from, to)}</div>
	</div>

	<div class="osv-card-block" style="margin-top:0;">
		${renderOsvAccountCardBlock(account, accountTitle, subconto, from, to, data)}
	</div>
	`;

	return renderPage(`/accounting/${ledger}`, `${ledgerTitle(ledger)} · Карточка счёта ${escapeHtml(accountTitle)}`, content);
}

// Фрагмент карточки для подгрузки в конец страницы Оборотки без перехода — именно туда
// ведут клики по строкам без субконто/по раскрытому субконто (см. renderOsvTurnoverPage). Обе
// книги теперь в ОСВ-стиле.
export async function renderAccountCardFragment(env: Env, url: URL, ledger: Ledger): Promise<string> {
	return renderOsvAccountCardFragment(env, url, ledger);
}


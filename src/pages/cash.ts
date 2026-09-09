import { renderPage } from "../layout";
import { escapeHtml, formatMoney, isoToDisplay, todayIso, addDaysIso, periodRangeFromToken, resolvePeriodToken } from "../format";
import { DRAWER_STYLES, MODAL_STYLES, renderConfirmModal, SUB_TABS_STYLES, renderSubTabs, type SubTab, PERIOD_PICKER_STYLES, renderPeriodPicker, editIconSvg, deleteIconSvg } from "../ui";
import { getOrCreateDocument, getOperations, listCashCategories, CASH_REGISTER_ACCOUNT, type CashCategory, type RegisterCode } from "../cash";
import { CHART_OF_ACCOUNTS, listOwnAccounts, listCashBoxes, listExpenseItems, listEmployees, listOtherOperations, getAccountCard, type ReferenceKind } from "../accounting";

const REGISTER_TITLES: Record<RegisterCode, string> = {
	kotopanda: "Касса Котопанда",
	elitka: "Касса Элитка",
};

// Остаток кассы больше не считается локально (день за днём) — по кнопке "Остатки" он
// пересчитывается прямо из Бухгалтерии: сальдо счёта 30 по субконто именно этой кассы
// (настраивается в Настройках), чтобы не путаться с другими кассами на том же счёте.
// getAccountCard(from=to=date) удобно даёт сразу обе точки: openingBalance — на начало
// дня (сальдо на date-1), closingBalance — на конец дня (сальдо на date).
async function getRegisterLedgerBalance(env: Env, date: string, registerCode: RegisterCode): Promise<{ opening: number; closing: number }> {
	const register = await env.DB.prepare(`SELECT posting_subconto FROM cash_registers WHERE code = ?`).bind(registerCode).first<{ posting_subconto: string | null }>();
	const { openingBalance, closingBalance } = await getAccountCard(env, CASH_REGISTER_ACCOUNT, register?.posting_subconto ?? null, date, date, registerCode);
	return { opening: openingBalance, closing: closingBalance };
}

function kassaTabs(registerCode: RegisterCode): SubTab[] {
	return [
		{ href: `/sales-${registerCode}`, label: "День" },
		{ href: `/sales-${registerCode}/categories`, label: "Категории" },
	];
}

const STYLES = `
	.topbar {
		justify-content: flex-start;
	}
	.topbar h1 {
		white-space: nowrap;
	}
	.topbar-actions form {
		margin: 0;
	}
	.topbar-actions .btn-primary {
		font: inherit;
		cursor: pointer;
	}

	.date-nav {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.date-nav a {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--panel);
		color: var(--text);
	}
	.date-nav a.disabled {
		color: var(--border);
		pointer-events: none;
	}
	.date-nav a:hover {
		background: var(--bg);
	}
	.date-nav .date-label {
		font-weight: 600;
		font-size: 14px;
		min-width: 110px;
		text-align: center;
	}

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

	.close-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px;
		margin-bottom: 20px;
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.close-card form {
		margin: 0;
		display: flex;
		align-items: end;
		gap: 10px;
	}
	.close-card .form-field label {
		display: block;
		color: var(--text-muted);
		font-size: 12px;
		margin-bottom: 4px;
	}
	.close-card .form-field input {
		padding: 9px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
		width: 160px;
		box-sizing: border-box;
	}
	.close-card .btn-primary,
	.close-card .btn-secondary {
		font: inherit;
		cursor: pointer;
	}
	.closed-summary {
		display: flex;
		align-items: center;
		gap: 24px;
		flex-wrap: wrap;
	}
	.closed-summary .item .label {
		color: var(--text-muted);
		font-size: 12px;
		margin-bottom: 2px;
	}
	.closed-summary .item .value {
		font-size: 16px;
		font-weight: 700;
	}
	.discrepancy-ok { color: var(--green); }
	.discrepancy-bad { color: var(--red); }

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
	.empty-state {
		padding: 40px 16px;
		text-align: center;
		color: var(--text-muted);
	}
	.muted {
		color: var(--text-muted);
	}
	.row-delete {
		text-align: right;
	}
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
	.btn-confirm:hover {
		background: var(--bg);
	}
	.acc { font-weight: 600; }
	.subconto { color: var(--text-muted); }
	.journal-form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.cat-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
	}
	.cat-badge.in { background: rgba(31, 169, 113, 0.12); color: var(--green); }
	.cat-badge.out { background: rgba(229, 72, 77, 0.1); color: var(--red); }
	.banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 13px;
		margin-bottom: 16px;
	}
	.banner.error {
		background: #fdecec;
		color: var(--red);
	}
	.doc-table td { text-align: left; }
	.doc-table td.balance { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
	.doc-table tbody tr {
		cursor: pointer;
	}
	.doc-table tbody tr:hover {
		background: var(--bg);
	}
	.back-link { color: var(--text-muted); font-weight: 500; }
	.back-link:hover { color: var(--blue); }
	.back-btn {
		display: block;
		text-align: center;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 16px;
	}
	.back-btn:hover { background: var(--bg); }
	.kassa-title {
		color: var(--green);
		margin: 0 0 16px;
		font-size: 22px;
	}

	.doc-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 20px;
	}
	.doc-topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 18px;
		border-bottom: 1px solid var(--border);
	}
	.doc-date {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}
	.doc-date .date-arrow {
		color: var(--text-muted);
		font-size: 13px;
		padding: 2px 7px;
		border-radius: 6px;
	}
	.doc-date .date-arrow:hover { background: var(--bg); }
	.doc-date .date-arrow.disabled { color: var(--border); pointer-events: none; }
	.doc-number { color: var(--text-muted); font-size: 13px; }
	.balance-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		background: var(--bg);
		font-size: 13px;
		color: var(--text-muted);
	}
	.balance-row .balance-value { font-weight: 700; font-size: 15px; color: var(--text); }
	.balance-row .balance-value.positive { color: var(--green); }
	.balance-row .balance-value.negative { color: var(--red); }
	.balance-row.total {
		background: var(--panel);
		border-top: 1px solid var(--border);
	}
	.balance-row.total .balance-value { font-size: 18px; }
	.op-table { width: 100%; border-collapse: collapse; }
	.op-table thead tr { background: var(--green); }
	.op-table th {
		text-align: left;
		font-size: 12px;
		color: #fff;
		font-weight: 600;
		padding: 10px 18px;
		white-space: nowrap;
	}
	.op-table th:last-child, .op-table td:last-child { text-align: right; }
	.op-table td {
		padding: 12px 18px;
		border-bottom: 1px solid var(--border);
	}
	.op-row { cursor: pointer; }
	.op-row:hover { background: var(--bg); }
	.op-row:last-child td { border-bottom: none; }
	.amt.in { color: var(--green); font-weight: 600; }
	.amt.out { color: var(--red); font-weight: 600; }
	.op-table td.num { color: var(--text-muted); width: 1%; }
	.op-table td.sign { font-weight: 700; width: 1%; }
	.op-table td.sign.in { color: var(--green); }
	.op-table td.sign.out { color: var(--red); }
	.op-table select, .op-table input[type="number"], .op-table input[type="text"] {
		width: 100%;
		min-width: 90px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font: inherit;
		font-size: 13px;
		box-sizing: border-box;
	}
	.op-add-row td { padding: 8px 10px; }
	.btn-add-row {
		background: var(--blue);
		color: #fff;
		border: none;
		border-radius: 6px;
		width: 30px;
		height: 30px;
		cursor: pointer;
		font-size: 14px;
	}
	.row-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		white-space: nowrap;
	}
	.op-icon-btn {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		width: 30px;
		height: 30px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		cursor: pointer;
		color: var(--text-muted);
	}
	.op-icon-btn:hover {
		background: var(--bg);
		color: var(--text);
		border-color: var(--text-muted);
	}
	.op-icon-btn-danger:hover {
		background: rgba(229, 72, 77, 0.1);
		color: var(--red);
		border-color: var(--red);
	}
`;

// Категория "нуждается" в субконто на операции, если её сторона-контрагент (не "30") оставлена
// без фиксированного субконто, но её счёт всё же привязан к какому-то справочнику — тогда
// конкретное значение (например, поставщик) вводится каждый раз заново, на самой операции.
function subcontoNeedOf(c: CashCategory, refLists: Record<ReferenceKind, string[]>): string[] | null {
	const sides = [
		{ account: c.credit_account, subconto: c.credit_subconto },
		{ account: c.debit_account, subconto: c.debit_subconto },
	];
	for (const side of sides) {
		if (side.account === CASH_REGISTER_ACCOUNT || side.subconto !== null) continue;
		const acc = CHART_OF_ACCOUNTS.find((a) => a.code === side.account);
		if (acc?.refKind) return refLists[acc.refKind];
	}
	return null;
}

type CategoriesByDirection = { income: { id: number; name: string }[]; expense: { id: number; name: string }[] };

// Каскад Тип → Вид → Субконто, общий и для строки добавления, и для модалок редактирования
// операции — id полей строятся как idPrefix+"Direction"/"Category"/"Subconto".
function opCascadeScript(
	idPrefix: string,
	categoriesByDirection: CategoriesByDirection,
	categorySubconto: Record<number, string[]>,
	initial: { direction: "income" | "expense"; categoryId: number; subconto: string | null } | null,
	focusOnInit: boolean,
	autoAdvance: boolean,
): string {
	return `
		<script>
			(function () {
				var directionSelect = document.getElementById("${idPrefix}Direction");
				var categorySelect = document.getElementById("${idPrefix}Category");
				var subcontoSelect = document.getElementById("${idPrefix}Subconto");
				var amountInput = document.getElementById("${idPrefix}Amount");
				var commentInput = document.getElementById("${idPrefix}Comment");
				var categoriesByDirection = ${JSON.stringify(categoriesByDirection)};
				var categorySubconto = ${JSON.stringify(categorySubconto)};
				var initial = ${JSON.stringify(initial)};
				var autoAdvance = ${autoAdvance};

				function syncSubconto(preselect) {
					var options = categorySubconto[categorySelect.value];
					if (options) {
						subcontoSelect.innerHTML = '<option value="">Выберите</option>';
						options.forEach(function (name) {
							var opt = document.createElement("option");
							opt.value = name;
							opt.textContent = name;
							subcontoSelect.appendChild(opt);
						});
						if (preselect) subcontoSelect.value = preselect;
						subcontoSelect.hidden = false;
						subcontoSelect.disabled = false;
					} else {
						subcontoSelect.hidden = true;
						subcontoSelect.disabled = true;
						subcontoSelect.value = "";
					}
				}

				function rebuildCategories(preselectCategory, preselectSubconto) {
					var list = categoriesByDirection[directionSelect.value] || [];
					categorySelect.innerHTML = "";
					list.forEach(function (c) {
						var opt = document.createElement("option");
						opt.value = c.id;
						opt.textContent = c.name;
						categorySelect.appendChild(opt);
					});
					if (preselectCategory) categorySelect.value = String(preselectCategory);
					syncSubconto(preselectSubconto);
				}

				function afterDirectionChosen() {
					rebuildCategories();
					if (autoAdvance) categorySelect.focus();
				}
				function afterCategoryChosen() {
					syncSubconto();
					if (autoAdvance) {
						if (!subcontoSelect.hidden) subcontoSelect.focus();
						else if (amountInput) amountInput.focus();
					}
				}
				function afterSubcontoChosen() {
					if (autoAdvance && amountInput) amountInput.focus();
				}

				directionSelect.addEventListener("change", afterDirectionChosen);
				categorySelect.addEventListener("change", afterCategoryChosen);
				if (autoAdvance) {
					subcontoSelect.addEventListener("change", afterSubcontoChosen);
					// change у select не сработает, если выбранное значение и так уже стоит
					// (например, "Реализация" — первая в списке и выбрана по умолчанию) —
					// поэтому Enter на самом select тоже должен продвигать вперёд.
					[
						[directionSelect, afterDirectionChosen],
						[categorySelect, afterCategoryChosen],
						[subcontoSelect, afterSubcontoChosen],
					].forEach(function (pair) {
						pair[0].addEventListener("keydown", function (e) {
							if (e.key !== "Enter") return;
							e.preventDefault();
							pair[1]();
						});
					});
					if (amountInput) {
						amountInput.addEventListener("keydown", function (e) {
							if (e.key !== "Enter") return;
							e.preventDefault();
							if (commentInput) commentInput.focus();
							else if (amountInput.form) amountInput.form.requestSubmit ? amountInput.form.requestSubmit() : amountInput.form.submit();
						});
					}
					if (commentInput) {
						commentInput.addEventListener("keydown", function (e) {
							if (e.key !== "Enter") return;
							e.preventDefault();
							var form = commentInput.form;
							if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
						});
					}
				}

				if (initial) {
					directionSelect.value = initial.direction;
					rebuildCategories(initial.categoryId, initial.subconto);
				} else {
					rebuildCategories();
				}
				if (${focusOnInit}) directionSelect.focus();
			})();
		</script>
	`;
}

export async function renderKassaDayPage(env: Env, url: URL, registerCode: RegisterCode): Promise<string> {
	const dateParam = url.searchParams.get("date");
	const today = todayIso();
	const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

	const opError = url.searchParams.get("op_error");
	const doc = await getOrCreateDocument(env, registerCode, date);
	const operations = await getOperations(env, doc.id);
	const categories = await listCashCategories(env, registerCode);
	const isClosed = doc.closed_at !== null;

	const prevDate = addDaysIso(date, -1);
	const nextDate = addDaysIso(date, 1);
	const isToday = date === today;

	const income = categories.filter((c) => c.direction === "income");
	const expense = categories.filter((c) => c.direction === "expense");

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
	const categoriesByDirection: CategoriesByDirection = {
		income: income.map((c) => ({ id: c.id, name: c.name })),
		expense: expense.map((c) => ({ id: c.id, name: c.name })),
	};

	const closeSectionHtml = !isClosed
		? `
		<div class="close-card">
			<button type="button" class="btn-secondary" id="balanceBtn">Остатки</button>
			<form method="post" action="/sales-${registerCode}/close">
				<input type="hidden" name="date" value="${date}" />
				<button type="submit" class="btn-primary">Закрыть день</button>
			</form>
		</div>`
		: `
		<div class="close-card">
			<button type="button" class="btn-secondary" id="balanceBtn">Остатки</button>
			<span>День закрыт — добавление и удаление операций заблокировано</span>
			<form method="post" action="/sales-${registerCode}/reopen">
				<input type="hidden" name="date" value="${date}" />
				<button type="submit" class="btn-secondary">Открыть заново</button>
			</form>
		</div>`;

	const rowsHtml = operations
		.map((op, i) => {
			const sign = op.direction === "in" ? "+" : "−";
			const cls = op.direction === "in" ? "in" : "out";
			const actionsHtml = isClosed
				? ""
				: `
					<button type="button" class="op-icon-btn" id="editOp${op.id}Trigger" title="Редактировать">${editIconSvg()}</button>
					${renderConfirmModal({
						id: `deleteOp${op.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "op-icon-btn op-icon-btn-danger",
						title: "Удалить операцию?",
						message: "Действие необратимо.",
						confirmLabel: "Удалить",
						formAction: `/sales-${registerCode}/operations/${op.id}/delete`,
						hiddenFields: { date },
					})}`;
			return `
				<tr>
					<td class="num">${i + 1}</td>
					<td class="sign ${cls}">${sign}</td>
					<td>${escapeHtml(op.category_name)}</td>
					<td class="subconto">${op.subconto ? escapeHtml(op.subconto) : ""}</td>
					<td class="amt ${cls}">${formatMoney(op.amount)}</td>
					<td class="muted">${op.comment ? escapeHtml(op.comment) : ""}</td>
					<td class="row-actions">${actionsHtml}</td>
				</tr>`;
		})
		.join("\n");

	const addRowHtml = isClosed
		? ""
		: `
			<tr class="op-add-row">
				<td class="num">${operations.length + 1}</td>
				<td>
					<select id="opDirection">
						<option value="income">+</option>
						<option value="expense">−</option>
					</select>
				</td>
				<td><select id="opCategory" form="addOpForm" name="category_id" required></select></td>
				<td><select id="opSubconto" form="addOpForm" name="subconto" hidden></select></td>
				<td><input type="number" id="opAmount" form="addOpForm" name="amount" step="0.01" min="0.01" placeholder="Сумма" required /></td>
				<td><input type="text" id="opComment" form="addOpForm" name="comment" placeholder="Примечание" /></td>
				<td><button type="submit" form="addOpForm" class="btn-add-row">✓</button></td>
			</tr>`;

	const emptyRowHtml = operations.length === 0 && isClosed ? `<tr><td colspan="7" class="empty-state">За этот день операций нет</td></tr>` : "";

	const editModalsHtml = isClosed
		? ""
		: operations
				.map((op) => {
					const prefix = `editOp${op.id}`;
					return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Редактировать операцию</h3>
				<form method="post" action="/sales-${registerCode}/operations/${op.id}/update">
					<input type="hidden" name="date" value="${date}" />
					<div class="drawer-field">
						<span class="drawer-label">Тип</span>
						<select id="${prefix}Direction">
							<option value="income">+</option>
							<option value="expense">−</option>
						</select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Вид</span>
						<select id="${prefix}Category" name="category_id" required></select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Субконто</span>
						<select id="${prefix}Subconto" name="subconto" hidden></select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Сумма, грн</span>
						<input type="number" name="amount" step="0.01" min="0.01" value="${op.amount}" required />
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Примечание</span>
						<input type="text" id="${prefix}Comment" name="comment" value="${op.comment ? escapeHtml(op.comment) : ""}" />
					</div>
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
		${opCascadeScript(prefix, categoriesByDirection, categorySubcontoOptions, { direction: op.direction === "in" ? "income" : "expense", categoryId: op.category_id, subconto: op.subconto }, false, false)}
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
				overlay.addEventListener("click", function (e) {
					if (e.target === overlay) overlay.classList.remove("open");
				});
			})();
		</script>`;
				})
				.join("\n");

	const banner = opError ? `<div class="banner error">⚠ ${escapeHtml(opError)}</div>` : "";

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	${banner}
	<a href="/sales-${registerCode}" class="back-btn">← Назад</a>
	<h1 class="kassa-title">${REGISTER_TITLES[registerCode]}</h1>

	<div class="doc-card">
		<div class="doc-topline">
			<div class="doc-date">
				<a class="date-arrow" href="/sales-${registerCode}/day?date=${prevDate}">‹</a>
				${isoToDisplay(date)}
				<a class="date-arrow ${isToday ? "disabled" : ""}" href="${isToday ? "#" : `/sales-${registerCode}/day?date=${nextDate}`}">›</a>
			</div>
			<div class="doc-number">Документ №${doc.id}</div>
		</div>

		<div id="balanceOpening"></div>

		<table class="op-table">
			<thead><tr><th>№</th><th>П/Р</th><th>Вид</th><th>Субконто</th><th>Сумма</th><th>Примечание</th><th></th></tr></thead>
			<tbody>
				${rowsHtml}
				${addRowHtml}
				${emptyRowHtml}
			</tbody>
		</table>

		<div id="balanceClosing"></div>
	</div>

	${closeSectionHtml}

	${editModalsHtml}

	<form id="addOpForm" method="post" action="/sales-${registerCode}/operations">
		<input type="hidden" name="date" value="${date}" />
	</form>

	<script>
		document.getElementById("balanceBtn").addEventListener("click", function () {
			fetch("/sales-${registerCode}/day/balance?date=${encodeURIComponent(date)}")
				.then(function (r) { return r.text(); })
				.then(function (html) {
					var temp = document.createElement("div");
					temp.innerHTML = html;
					var opening = temp.querySelector("#balanceOpeningRow");
					var closing = temp.querySelector("#balanceClosingRow");
					document.getElementById("balanceOpening").innerHTML = opening ? opening.outerHTML : "";
					document.getElementById("balanceClosing").innerHTML = closing ? closing.outerHTML : "";
				});
		});
		// F2 — то же самое, что клик по кнопке "Остатки", без мыши.
		document.addEventListener("keydown", function (e) {
			if (e.key !== "F2") return;
			e.preventDefault();
			document.getElementById("balanceBtn").click();
		});
	</script>
	${isClosed ? "" : opCascadeScript("op", categoriesByDirection, categorySubcontoOptions, null, true, true)}
	`;

	return renderPage(`/sales-${registerCode}`, REGISTER_TITLES[registerCode], content);
}

export async function renderKassaBalanceFragment(env: Env, date: string, registerCode: RegisterCode): Promise<string> {
	const { opening, closing } = await getRegisterLedgerBalance(env, date, registerCode);
	return `
		<div class="balance-row" id="balanceOpeningRow">
			<span>Остаток на начало (${isoToDisplay(date)})</span>
			<span class="balance-value ${opening >= 0 ? "positive" : "negative"}">${formatMoney(opening)}</span>
		</div>
		<div class="balance-row total" id="balanceClosingRow">
			<span>Остаток на конец</span>
			<span class="balance-value ${closing >= 0 ? "positive" : "negative"}">${formatMoney(closing)}</span>
		</div>
	`;
}

export async function renderKassaPage(env: Env, url: URL, registerCode: RegisterCode): Promise<string> {
	const createError = url.searchParams.get("create_error");
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);

	const { results: documents } = await env.DB.prepare(
		`SELECT d.id, d.doc_date
		 FROM cash_documents d
		 JOIN cash_registers r ON r.id = d.register_id
		 WHERE r.code = ? AND d.doc_date BETWEEN ? AND ?
		 ORDER BY d.doc_date DESC`,
	)
		.bind(registerCode, from, to)
		.all<{ id: number; doc_date: string }>();

	const rowsHtml = documents.length
		? documents
				.map(
					(d) => `
			<tr data-href="/sales-${registerCode}/day?date=${d.doc_date}">
				<td>${isoToDisplay(d.doc_date)}</td>
				<td>№${d.id}</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="2" class="empty-state">За этот период документов нет</td></tr>`;

	const newDocModalHtml = `
		<button type="button" class="btn-primary" id="newDocTrigger">+ Новый документ</button>
		<div class="modal-overlay" id="newDocOverlay">
			<div class="modal-card">
				<h3>Новый документ</h3>
				<form method="post" action="/sales-${registerCode}/day">
					<div class="drawer-field">
						<span class="drawer-label">Дата</span>
						<input type="date" name="date" value="${todayIso()}" required />
					</div>
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="newDocCancel">Отмена</button>
						<button type="submit" class="btn-confirm">Создать</button>
					</div>
				</form>
			</div>
		</div>
		<script>
			(function () {
				var overlay = document.getElementById("newDocOverlay");
				var trigger = document.getElementById("newDocTrigger");
				var cancelBtn = document.getElementById("newDocCancel");
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

	const banner = createError ? `<div class="banner error">⚠ ${escapeHtml(createError)}</div>` : "";

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}${MODAL_STYLES}${DRAWER_STYLES}</style>
	${banner}
	<div class="topbar">
		<h1>${REGISTER_TITLES[registerCode]}</h1>
		<div class="topbar-actions">
			${renderPeriodPicker(`/sales-${registerCode}`, period, from, to)}
			${newDocModalHtml}
		</div>
	</div>
	${renderSubTabs(kassaTabs(registerCode), `/sales-${registerCode}`)}

	<div class="table-card">
		<table class="doc-table">
			<thead>
				<tr><th>Дата</th><th>Документ</th></tr>
			</thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>

	<script>
		document.querySelectorAll("tbody tr[data-href]").forEach(function (row) {
			row.addEventListener("click", function () {
				window.location.href = row.dataset.href;
			});
		});
	</script>
	`;

	return renderPage(`/sales-${registerCode}`, REGISTER_TITLES[registerCode], content);
}

function accLabel(code: string): string {
	const acc = CHART_OF_ACCOUNTS.find((a) => a.code === code);
	return acc ? `${code} — ${escapeHtml(acc.name)}` : escapeHtml(code);
}

function fullAccountOptionsHtml(selected?: string): string {
	return CHART_OF_ACCOUNTS.map((a) => `<option value="${a.code}" ${a.code === selected ? "selected" : ""}>${a.code} — ${escapeHtml(a.name)}</option>`).join("\n");
}

type CategoryPrefill = {
	name: string;
	direction: "income" | "expense";
	debitAccount: string;
	debitSubconto: string | null;
	creditAccount: string;
	creditSubconto: string | null;
};

function categoryFieldsHtml(idPrefix: string, prefill?: CategoryPrefill): string {
	return `
		<div class="drawer-field">
			<span class="drawer-label">Название категории</span>
			<input type="text" name="name" value="${prefill ? escapeHtml(prefill.name) : ""}" required />
		</div>
		<div class="drawer-field">
			<span class="drawer-label">Тип</span>
			<select name="direction">
				<option value="income" ${!prefill || prefill.direction === "income" ? "selected" : ""}>+ (Приход)</option>
				<option value="expense" ${prefill?.direction === "expense" ? "selected" : ""}>− (Расход)</option>
			</select>
		</div>
		<div class="journal-form-grid">
			<div class="drawer-field">
				<span class="drawer-label">Счёт Дт</span>
				<select name="debit_account" id="${idPrefix}DebitAccountSelect" required>
					<option value="">Выберите счёт</option>
					${fullAccountOptionsHtml(prefill?.debitAccount)}
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
					${fullAccountOptionsHtml(prefill?.creditAccount)}
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

export async function renderKassaCategoriesPage(env: Env, url: URL, registerCode: RegisterCode): Promise<string> {
	const deleteError = url.searchParams.get("delete_error");
	const categories = await listCashCategories(env, registerCode);
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
					(c) => `
			<tr>
				<td>${escapeHtml(c.name)}</td>
				<td>
					<span class="cat-badge ${c.direction === "income" ? "in" : "out"}">${c.direction === "income" ? "+" : "−"}</span>
				</td>
				<td class="acc">${accLabel(c.debit_account)}${c.debit_subconto ? ` <span class="subconto">/ ${escapeHtml(c.debit_subconto)}</span>` : ""}</td>
				<td class="acc">${accLabel(c.credit_account)}${c.credit_subconto ? ` <span class="subconto">/ ${escapeHtml(c.credit_subconto)}</span>` : ""}</td>
				<td class="row-delete">
					<button type="button" class="btn-secondary" id="editCat${c.id}Trigger" title="Редактировать">${editIconSvg()}</button>
					${renderConfirmModal({
						id: `deleteCat${c.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить категорию?",
						message: "Действие необратимо.",
						confirmLabel: "Удалить",
						formAction: `/sales-${registerCode}/categories/${c.id}/delete`,
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="5" class="empty-state">Категорий пока нет</td></tr>`;

	const newCategoryModalHtml = `
		<button type="button" class="btn-primary" id="newCategoryTrigger">+ Категория</button>
		<div class="modal-overlay" id="newCategoryOverlay">
			<div class="modal-card">
				<h3>Новая категория</h3>
				<form method="post" action="/sales-${registerCode}/categories">
					${categoryFieldsHtml("newCat")}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="newCategoryCancel">Отмена</button>
						<button type="submit" class="btn-confirm">Добавить</button>
					</div>
				</form>
			</div>
		</div>
		${bindCategoryAccountSubcontoScript("newCat", accountSubcontoMap, null, null)}
		<script>
			(function () {
				var overlay = document.getElementById("newCategoryOverlay");
				var trigger = document.getElementById("newCategoryTrigger");
				var cancelBtn = document.getElementById("newCategoryCancel");
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

	const editModalsHtml = categories
		.map((c) => {
			const prefix = `editCat${c.id}`;
			return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Редактировать категорию</h3>
				<form method="post" action="/sales-${registerCode}/categories/${c.id}/update">
					${categoryFieldsHtml(prefix, {
						name: c.name,
						direction: c.direction,
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
		<h1>${REGISTER_TITLES[registerCode]}</h1>
		<div class="topbar-actions">
			${newCategoryModalHtml}
		</div>
	</div>
	${renderSubTabs(kassaTabs(registerCode), `/sales-${registerCode}/categories`)}

	<div class="table-card">
		<table>
			<thead>
				<tr><th>Название</th><th>Тип</th><th>Дебет</th><th>Кредит</th><th></th></tr>
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

	return renderPage(`/sales-${registerCode}`, `${REGISTER_TITLES[registerCode]} · Категории`, content);
}


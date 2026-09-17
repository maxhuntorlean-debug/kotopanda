import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { SUB_TABS_STYLES, renderSubTabs, DRAWER_STYLES, renderSimpleDrawer, MODAL_STYLES, renderConfirmModal, deleteIconSvg } from "../ui";
import { listRulesForDisplay } from "../rules";
import { CHART_OF_ACCOUNTS } from "../accounting";
import { listTestRefItems, type TestRefKind } from "../referencesTest";
import { BANK_TABS } from "./bank";

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
	.empty-state {
		padding: 40px 16px;
		text-align: center;
		color: var(--text-muted);
	}
	.muted { color: var(--text-muted); }
	.status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
	}
	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.status-dot.done { background: var(--green); }
	.status-dot.review { background: var(--amber); }
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

	.drawer select,
	.drawer input[type="text"],
	.drawer input[type="number"] {
		width: 100%;
		box-sizing: border-box;
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
`;

function matchFieldLabel(field: string): string {
	return field === "counterparty_account" ? "Расчётный счёт" : "Имя контрагента";
}

function accountLabel(code: string): string {
	const acc = CHART_OF_ACCOUNTS.find((a) => a.code === code);
	return acc ? `${acc.code} · ${acc.name}` : code;
}

export async function renderBankRulesPage(env: Env): Promise<string> {
	const rules = await listRulesForDisplay(env);

	const neededKinds = Array.from(new Set(CHART_OF_ACCOUNTS.map((a) => a.refKind).filter((k): k is TestRefKind => k !== null)));
	const refListEntries = await Promise.all(neededKinds.map(async (kind) => [kind, (await listTestRefItems(env, kind)).map((i) => i.name)] as const));
	const refLists = Object.fromEntries(refListEntries) as Record<TestRefKind, string[]>;
	const accountSubcontoMap: Record<string, string[]> = {};
	for (const acc of CHART_OF_ACCOUNTS) {
		if (acc.refKind) accountSubcontoMap[acc.code] = refLists[acc.refKind] ?? [];
	}

	const accountOptionsHtml = CHART_OF_ACCOUNTS.map((a) => `<option value="${a.code}">${a.code} — ${escapeHtml(a.name)}</option>`).join("\n");

	const rowsHtml = rules.length
		? rules
				.map(
					(r) => `
			<tr>
				<td>${matchFieldLabel(r.match_field)}</td>
				<td>${escapeHtml(r.match_value)}</td>
				<td>${escapeHtml(accountLabel(r.posting_account))}</td>
				<td>${r.posting_subconto ? escapeHtml(r.posting_subconto) : '<span class="muted">—</span>'}</td>
				<td><span class="status"><span class="status-dot ${r.auto_status}"></span>${r.auto_status === "done" ? "Готово" : "Требует проверки"}</span></td>
				<td>${r.priority}</td>
				<td class="row-delete">
					${renderConfirmModal({
						id: `deleteRule${r.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить правило?",
						message: "Уже разнесённые операции это не изменит — только будущие перестанут автоматически размечаться по нему.",
						confirmLabel: "Удалить",
						formAction: `/bank/rules/${r.id}/delete`,
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="7" class="empty-state">Правил пока нет — добавь первое кнопкой сверху</td></tr>`;

	const newRuleFormHtml = `
		<form method="post" action="/bank/rules">
			<div class="drawer-field">
				<span class="drawer-label">Тип совпадения</span>
				<select name="match_field" id="ruleMatchField">
					<option value="counterparty_account">По расчётному счёту</option>
					<option value="counterparty_name">По имени контрагента</option>
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Значение</span>
				<input type="text" name="match_value" id="ruleMatchValue" placeholder="UA..." required />
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Счёт</span>
				<select name="account" id="ruleAccount" required>
					<option value="">Выберите счёт</option>
					${accountOptionsHtml}
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Субконто</span>
				<select name="subconto" id="ruleSubcontoSelect" hidden>
					<option value="">Не выбрано</option>
				</select>
				<input type="text" name="subconto" id="ruleSubcontoText" placeholder="необязательно" />
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Статус после применения</span>
				<select name="auto_status">
					<option value="done">Готово</option>
					<option value="review">Требует проверки</option>
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Приоритет</span>
				<input type="number" name="priority" value="0" step="1" />
				<div class="drawer-hint">Чем больше число — тем раньше проверяется правило, если совпадений несколько.</div>
			</div>
			<div class="drawer-actions">
				<button type="submit" class="btn-primary">Добавить правило</button>
			</div>
		</form>
		<script>
			(function () {
				var field = document.getElementById("ruleMatchField");
				var value = document.getElementById("ruleMatchValue");
				function syncPlaceholder() {
					value.placeholder = field.value === "counterparty_account" ? "UA..." : "Название контрагента как в банке";
				}
				field.addEventListener("change", syncPlaceholder);
				syncPlaceholder();

				var accountSelect = document.getElementById("ruleAccount");
				var subcontoSelect = document.getElementById("ruleSubcontoSelect");
				var subcontoText = document.getElementById("ruleSubcontoText");
				var accountSubconto = ${JSON.stringify(accountSubcontoMap)};

				function syncSubconto() {
					var names = accountSubconto[accountSelect.value];
					if (names) {
						subcontoSelect.innerHTML = '<option value="">Не выбрано</option>';
						names.forEach(function (name) {
							var opt = document.createElement("option");
							opt.value = name;
							opt.textContent = name;
							subcontoSelect.appendChild(opt);
						});
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

				accountSelect.addEventListener("change", syncSubconto);
				syncSubconto();
			})();
		</script>
	`;

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	<div class="topbar">
		<h1>Банк</h1>
		<div class="topbar-actions">
			${renderSimpleDrawer({ id: "newRule", title: "Новое правило", triggerLabel: "+ Новое правило", bodyHtml: newRuleFormHtml })}
		</div>
	</div>
	${renderSubTabs(BANK_TABS, "/bank/rules")}

	<div class="table-card">
		<table>
			<thead>
				<tr>
					<th>Тип</th>
					<th>Значение</th>
					<th>Счёт</th>
					<th>Субконто</th>
					<th>Статус</th>
					<th>Приоритет</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
			</tbody>
		</table>
	</div>
	`;

	return renderPage("/bank", "Правила разноски", content, env);
}

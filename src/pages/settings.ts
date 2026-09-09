import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { listOwnAccounts, listCashBoxes, CHART_OF_ACCOUNTS, REFERENCE_PAGE_PATH, type ReferenceKind } from "../accounting";

const REFERENCE_LABELS: Record<ReferenceKind, string> = {
	accounts: "Счета",
	cashBoxes: "Кассы",
	suppliers: "Поставщики",
	expenses: "Расходы",
	employees: "Сотрудники",
	otherOperations: "Прочие операции",
};

const STYLES = `
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
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tbody tr:last-child td { border-bottom: none; }
	.acc { font-weight: 600; }
	.inline-form {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.inline-form select {
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
	}
	.inline-form button {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px 10px;
		cursor: pointer;
	}
	.muted { color: var(--text-muted); }
	.section-title {
		font-size: 15px;
		margin: 24px 0 12px;
	}
`;

export async function renderSettingsPage(env: Env): Promise<string> {
	const bankAccount = await env.DB.prepare(`SELECT posting_subconto FROM bank_accounts LIMIT 1`).first<{ posting_subconto: string | null }>();
	const cashRegisterKotopanda = await env.DB.prepare(`SELECT posting_subconto FROM cash_registers WHERE code = 'kotopanda'`).first<{ posting_subconto: string | null }>();
	const cashRegisterElitka = await env.DB.prepare(`SELECT posting_subconto FROM cash_registers WHERE code = 'elitka'`).first<{ posting_subconto: string | null }>();
	const cardAccount = await env.DB.prepare(`SELECT posting_subconto FROM card_accounts LIMIT 1`).first<{ posting_subconto: string | null }>();
	const offsetSettings = await env.DB.prepare(`SELECT posting_subconto FROM offset_settings LIMIT 1`).first<{ posting_subconto: string | null }>();
	const ownAccounts = await listOwnAccounts(env);
	const cashBoxes = await listCashBoxes(env);

	const rowsHtml = `
		<tr>
			<td>Приватбанк</td>
			<td class="acc">31</td>
			<td>
				<form method="post" action="/bank/settings" class="inline-form">
					<select name="posting_subconto">
						<option value="">Без субконто</option>
						${ownAccounts.map((a) => `<option value="${escapeHtml(a.name)}" ${a.name === bankAccount?.posting_subconto ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("\n")}
					</select>
					<button type="submit" title="Сохранить">💾</button>
				</form>
			</td>
		</tr>
		<tr>
			<td>Касса Котопанда</td>
			<td class="acc">30</td>
			<td>
				<form method="post" action="/sales-kotopanda/settings" class="inline-form">
					<select name="posting_subconto">
						<option value="">Без субконто</option>
						${cashBoxes.map((c) => `<option value="${escapeHtml(c.name)}" ${c.name === cashRegisterKotopanda?.posting_subconto ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("\n")}
					</select>
					<button type="submit" title="Сохранить">💾</button>
				</form>
			</td>
		</tr>
		<tr>
			<td>Касса Элитка</td>
			<td class="acc">30</td>
			<td>
				<form method="post" action="/sales-elitka/settings" class="inline-form">
					<select name="posting_subconto">
						<option value="">Без субконто</option>
						${cashBoxes.map((c) => `<option value="${escapeHtml(c.name)}" ${c.name === cashRegisterElitka?.posting_subconto ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("\n")}
					</select>
					<button type="submit" title="Сохранить">💾</button>
				</form>
			</td>
		</tr>
		<tr>
			<td>Карточка Универсальная</td>
			<td class="acc">31</td>
			<td>
				<form method="post" action="/card-universal/settings" class="inline-form">
					<select name="posting_subconto">
						<option value="">Без субконто</option>
						${ownAccounts.map((a) => `<option value="${escapeHtml(a.name)}" ${a.name === cardAccount?.posting_subconto ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("\n")}
					</select>
					<button type="submit" title="Сохранить">💾</button>
				</form>
			</td>
		</tr>
		<tr>
			<td>Взаимозачёт</td>
			<td class="acc">30</td>
			<td>
				<form method="post" action="/offset/settings" class="inline-form">
					<select name="posting_subconto">
						<option value="">Без субконто</option>
						${cashBoxes.map((c) => `<option value="${escapeHtml(c.name)}" ${c.name === offsetSettings?.posting_subconto ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("\n")}
					</select>
					<button type="submit" title="Сохранить">💾</button>
				</form>
			</td>
		</tr>
	`;

	const chartRowsHtml = CHART_OF_ACCOUNTS.map(
		(a) => `
		<tr>
			<td class="acc">${a.code}</td>
			<td>${escapeHtml(a.name)}</td>
			<td>${a.refKind ? `<a href="${REFERENCE_PAGE_PATH[a.refKind]}">${REFERENCE_LABELS[a.refKind]}</a>` : `<span class="muted">—</span>`}</td>
		</tr>`,
	).join("\n");

	const content = `
	<style>${STYLES}</style>
	<div class="topbar">
		<h1>Настройки</h1>
	</div>

	<div class="table-card">
		<table>
			<thead><tr><th>Учёт</th><th>Счёт</th><th>Субконто</th></tr></thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>

	<h2 class="section-title">План счетов</h2>
	<div class="table-card">
		<table>
			<thead><tr><th>Код</th><th>Название</th><th>Справочник</th></tr></thead>
			<tbody>${chartRowsHtml}</tbody>
		</table>
	</div>
	`;

	return renderPage("/settings", "Настройки", content);
}

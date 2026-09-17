import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { listChartAccountsTest } from "../chartOfAccountsTest";
import { TEST_REF_ENTRIES } from "./referencesTest";
import type { TestRefKind } from "../referencesTest";
import { SUB_TABS_STYLES, renderSubTabs } from "../ui";
import { settingsTabs } from "./settings";

const REF_KIND_LABEL: Record<TestRefKind, string> = Object.fromEntries(TEST_REF_ENTRIES.map((e) => [e.kind, e.label])) as Record<TestRefKind, string>;

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
	.empty-state {
		padding: 40px 16px;
		text-align: center;
		color: var(--text-muted);
	}
	.acc { font-weight: 600; }
	.muted { color: var(--text-muted); }
`;

// План счетов полностью неизменяем — только чтение, без создания/редактирования/удаления.
export async function renderChartOfAccountsTestPage(env: Env): Promise<string> {
	const accounts = await listChartAccountsTest(env);

	const rowsHtml = accounts.length
		? accounts
				.map(
					(acc) => `
			<tr>
				<td class="acc">${escapeHtml(acc.code)}</td>
				<td>${escapeHtml(acc.name)}</td>
				<td>${acc.refKind ? escapeHtml(REF_KIND_LABEL[acc.refKind]) : `<span class="muted">—</span>`}</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="3" class="empty-state">Счетов нет</td></tr>`;

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}</style>
	<div class="topbar">
		<h1>Настройки</h1>
	</div>
	${renderSubTabs(settingsTabs(env), "/settings/chart")}

	<div class="table-card">
		<table>
			<thead><tr><th>Код</th><th>Название</th><th>Справочник</th></tr></thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>
	`;

	return renderPage("/settings", "Настройки · План счетов", content, env);
}

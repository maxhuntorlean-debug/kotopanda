import { renderPage } from "../layout";
import { escapeHtml, formatMoney, isoToDisplay, periodRangeFromToken, resolvePeriodToken } from "../format";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, SUB_TABS_STYLES, renderSubTabs, MODAL_STYLES, DRAWER_STYLES } from "../ui";
import { listTestRefItems } from "../referencesTest";
import { loadTestSubcontoContext, listTestJournalWithDocs, resolveSubcontoName } from "../operationDocumentTest";
import { operationTestTabs, newOperationModalHtml, OPERATION_MODAL_STYLES } from "./operationDocumentTest";

const STYLES = `
	.topbar { justify-content: flex-start; }
	.topbar h1 { white-space: nowrap; }
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
		white-space: nowrap;
	}
	tbody td {
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
		white-space: nowrap;
	}
	tbody tr:last-child td { border-bottom: none; }
	.empty-state { padding: 40px 16px; text-align: center; color: var(--text-muted); }
	.acc { font-weight: 600; }
	.subconto { color: var(--text-muted); }
	.topbar-actions .btn-primary { font: inherit; cursor: pointer; }
`;

// Список проводок — единственное место в тестовом наборе, где журнал джойнится с документами
// (см. listTestJournalWithDocs), только Котопанда, как и Оборотка (тест журнал).
export async function renderJournalListTestPage(env: Env, url: URL): Promise<string> {
	const firms = await listTestRefItems(env, "firms");
	const kotopanda = firms.find((f) => f.name === "Котопанда") ?? firms[0];
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);

	const ctx = await loadTestSubcontoContext(env);
	const lines = kotopanda ? await listTestJournalWithDocs(env, kotopanda.id, from, to) : [];

	const accountLabel = (code: string) => {
		const a = ctx.accounts.find((x) => x.code === code);
		return a ? `${code} — ${a.name}` : code;
	};

	const rowsHtml = lines.length
		? lines
				.map(
					(l, i) => `
			<tr>
				<td>${i + 1}</td>
				<td>${isoToDisplay(l.entryDate)}</td>
				<td class="acc">${escapeHtml(accountLabel(l.debitAccount))}</td>
				<td class="subconto">${escapeHtml(resolveSubcontoName(ctx, l.debitAccount, l.debitSubcontoId) ?? "")}</td>
				<td class="acc">${escapeHtml(accountLabel(l.creditAccount))}</td>
				<td class="subconto">${escapeHtml(resolveSubcontoName(ctx, l.creditAccount, l.creditSubcontoId) ?? "")}</td>
				<td>${formatMoney(l.amount)}</td>
				<td>${(l.comment ?? l.description) ? escapeHtml((l.comment ?? l.description) as string) : ""}</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="8" class="empty-state">За этот период проводок нет</td></tr>`;

	const returnTo = `/journal-list-test?period=${encodeURIComponent(period)}`;

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${MODAL_STYLES}${OPERATION_MODAL_STYLES}</style>
	<div class="topbar">
		<h1>Проводки Котопанда (тест журнал)</h1>
		<div class="topbar-actions">
			${renderPeriodPicker("/journal-list-test", period, from, to)}
			${newOperationModalHtml(returnTo, ctx, "kotopanda")}
		</div>
	</div>
	${renderSubTabs(operationTestTabs("kotopanda"), "/journal-list-test")}

	<div class="table-card">
		<table>
			<thead>
				<tr>
					<th>№</th><th>Дата</th><th>СчётДт</th><th>СубконтоДт</th><th>СчётКт</th><th>СубконтоКт</th><th>Сумма</th><th>Комментарий</th>
				</tr>
			</thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>
	`;

	// activeHref указывает на основной пункт меню (Оборотку) — подсветка в сайдбаре не должна
	// гаснуть при переключении на вкладку Проводок, как и у боевой Бухгалтерии.
	return renderPage("/journal-turnover-test", "Проводки Котопанда (тест журнал)", content, env);
}

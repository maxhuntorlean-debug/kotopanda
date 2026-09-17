import { renderPage } from "../layout";
import { escapeHtml, isoToDisplay, periodRangeFromToken, resolvePeriodToken } from "../format";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, SUB_TABS_STYLES, renderSubTabs, MODAL_STYLES, DRAWER_STYLES, renderConfirmModal, editIconSvg, deleteIconSvg } from "../ui";
import { loadTestSubcontoContext, listTestDocuments, getTestOperationDocument, resolveTestFirmId, type TestFirmCode } from "../operationDocumentTest";
import { operationTestTabs, newOperationModalHtml, editOperationModalHtml, OPERATION_MODAL_STYLES } from "./operationDocumentTest";

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
	.comment-cell { white-space: normal; }
	.row-actions { text-align: right; white-space: nowrap; }
	.row-actions .btn-secondary {
		padding: 6px 10px;
		font-size: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: 6px;
	}
	.topbar-actions .btn-primary { font: inherit; cursor: pointer; }
`;

// Журнал документов — один ряд на документ (а не на проводку, см. journalListTest.ts для
// постатейного списка). Три поля: Дата / Номер / Комментарий — по просьбе пользователя.
// Документ "Операция" сейчас всегда одна строка test_documents, но схема уже поддерживает
// несколько (см. listTestDocuments).
export async function renderJournalDocumentsTestPage(env: Env, url: URL, firm: TestFirmCode): Promise<string> {
	const firmId = await resolveTestFirmId(env, firm);
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);

	const ctx = await loadTestSubcontoContext(env);
	// Только сами Операции (doc_type='manual') — Операция тоже документ, а схема test_documents
	// поддерживает и другие типы (cash/bank/card/offset, см. CHECK в migrations/0036), но этот
	// журнал — именно про те, что создаём здесь вручную кнопкой "+ Новая операция".
	const documents = await listTestDocuments(env, firmId, from, to, "manual");

	// ?open=<id документа> — переход сюда кликом по строке в Карточке счёта (см. openCard() в
	// journalTurnoverTest.ts): сразу открывает модалку редактирования нужного документа, а не
	// просто приземляет на список. Период в ссылке уже тот же, что был на карточке, так что
	// документ (его doc_date) заведомо попадает в текущий диапазон и его кнопка есть в разметке.
	const openDocumentId = Number(url.searchParams.get("open"));

	const basePath = `/accounting/${firm}/journal`;
	const returnTo = `${basePath}?period=${encodeURIComponent(period)}`;
	const title = `Бухгалтерия ${firm === "kotopanda" ? "Котопанда" : "Элитка"} · Журнал Операций`;

	// Строки документа нужны только для формы редактирования (список документов их не
	// показывает) — подгружаем отдельно на каждый документ периода, их обычно немного.
	const fullDocuments = await Promise.all(documents.map((d) => getTestOperationDocument(env, d.id)));

	const rowsHtml = documents.length
		? documents
				.map(
					(d) => `
			<tr>
				<td>${isoToDisplay(d.docDate)}</td>
				<td>№${d.id}</td>
				<td class="comment-cell">${d.description ? escapeHtml(d.description) : "—"}</td>
				<td class="row-actions">
					<button type="button" class="btn-secondary" id="editOp${d.id}Trigger" title="Редактировать">${editIconSvg()}</button>
					${renderConfirmModal({
						id: `deleteOp${d.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить операцию?",
						message: "Удалятся все проводки этого документа.",
						confirmLabel: "Удалить",
						formAction: `/operation-document-test/${d.id}/delete`,
						hiddenFields: { return_to: returnTo },
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="4" class="empty-state">За этот период документов нет</td></tr>`;

	const editModalsHtml = documents
		.map((d, i) => {
			const full = fullDocuments[i];
			if (!full) return "";
			return editOperationModalHtml({ id: d.id, docDate: full.docDate, description: full.description, lines: full.lines }, returnTo, ctx, firm);
		})
		.join("\n");

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${MODAL_STYLES}${OPERATION_MODAL_STYLES}</style>
	<div class="topbar">
		<h1>${title}</h1>
		<div class="topbar-actions">
			${renderPeriodPicker(basePath, period, from, to)}
			${newOperationModalHtml(returnTo, ctx, firm)}
		</div>
	</div>
	${renderSubTabs(operationTestTabs(firm), basePath)}

	<div class="table-card">
		<table>
			<thead>
				<tr>
					<th>Дата</th><th>Номер</th><th>Комментарий</th><th></th>
				</tr>
			</thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>

	${editModalsHtml}

	${
		Number.isInteger(openDocumentId) && documents.some((d) => d.id === openDocumentId)
			? `<script>
				(function () {
					var trigger = document.getElementById("editOp${openDocumentId}Trigger");
					if (trigger) trigger.click();
				})();
			</script>`
			: ""
	}
	`;

	// activeHref указывает на Оборотку (той же фирмы) — подсветка в сайдбаре не должна гаснуть
	// при переключении вкладок, как и у остальных страниц этого набора.
	return renderPage(`/accounting/${firm}`, title, content, env);
}

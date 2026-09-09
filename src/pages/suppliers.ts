import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { SUB_TABS_STYLES, renderSubTabs, MODAL_STYLES, renderConfirmModal, deleteIconSvg } from "../ui";
import { listSuppliers } from "../invoices";
import { REFERENCE_TABS } from "./references";

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
	.inline-form {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.inline-form input[type="text"] {
		width: 260px;
		padding: 7px 8px;
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
	.row-delete { text-align: right; }
	.row-delete .btn-secondary {
		padding: 6px 10px;
		font-size: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.add-form {
		padding: 12px 16px;
	}
	.add-form .btn-primary {
		font: inherit;
		cursor: pointer;
	}

	.topbar {
		justify-content: flex-start;
	}
	.topbar h1 {
		white-space: nowrap;
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
	.banner.ok {
		background: #eafaf3;
		color: var(--green);
	}
	.banner.error {
		background: #fdecec;
		color: var(--red);
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

export async function renderSuppliersListPage(env: Env, url: URL): Promise<string> {
	const suppliers = await listSuppliers(env);

	const rowsHtml = suppliers.length
		? suppliers
				.map(
					(s) => `
			<tr>
				<td>
					<form method="post" action="/references/suppliers/${s.id}/update" class="inline-form">
						<input type="text" name="name" value="${escapeHtml(s.name)}" required />
						<button type="submit" title="Сохранить">💾</button>
					</form>
				</td>
				<td class="row-delete">
					${renderConfirmModal({
						id: `deleteSupplier${s.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить поставщика?",
						message: "Удалить можно только поставщика без операций и накладных.",
						confirmLabel: "Удалить",
						formAction: `/references/suppliers/${s.id}/delete`,
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="2" class="empty-state">Поставщиков пока нет</td></tr>`;

	let banner = "";
	if (url.searchParams.get("deleted") !== null) {
		banner = `<div class="banner ok">✓ Поставщик удалён</div>`;
	} else if (url.searchParams.get("delete_error")) {
		banner = `<div class="banner error">⚠ Не удалось удалить: ${escapeHtml(String(url.searchParams.get("delete_error")))}</div>`;
	}

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${MODAL_STYLES}</style>
	${banner}
	<div class="topbar">
		<h1>Справочники</h1>
	</div>
	${renderSubTabs(REFERENCE_TABS, "/references/suppliers")}

	<div class="table-card">
		<table>
			<thead>
				<tr>
					<th>Название</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
			</tbody>
		</table>
		<form method="post" action="/references/suppliers" class="inline-form add-form">
			<input type="text" name="name" placeholder="напр. ООО «Поставщик»" required />
			<button type="submit" class="btn-primary">+ Добавить</button>
		</form>
	</div>
	`;

	return renderPage("/references/accounts", "Поставщики", content);
}

import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { SUB_TABS_STYLES, renderSubTabs, type SubTab, MODAL_STYLES, renderConfirmModal, deleteIconSvg } from "../ui";
import { listOwnAccounts, listCashBoxes, listExpenseItems, listEmployees, listOtherOperations } from "../accounting";

export const REFERENCE_TABS: SubTab[] = [
	{ href: "/references/suppliers", label: "Поставщики" },
	{ href: "/references/accounts", label: "Счета" },
	{ href: "/references/cash-boxes", label: "Кассы" },
	{ href: "/references/expenses", label: "Расходы" },
	{ href: "/references/employees", label: "Сотрудники" },
	{ href: "/references/other-operations", label: "Прочие операции" },
];

// Пункт меню слева всегда указывает сюда — подсветка активного пункта навигации
// не должна "гаснуть" при переключении между вкладками внутри Справочников.
const NAV_HREF = "/references/accounts";

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
`;

type RefItem = { id: number; name: string };

function renderRefPage(
	tabHref: string,
	title: string,
	items: RefItem[],
	createAction: string,
	updateActionFor: (id: number) => string,
	deleteActionFor: (id: number) => string,
	addPlaceholder: string,
	deleteError: string | null,
): string {
	const rowsHtml = items.length
		? items
				.map(
					(item) => `
			<tr>
				<td>
					<form method="post" action="${updateActionFor(item.id)}" class="inline-form">
						<input type="text" name="name" value="${escapeHtml(item.name)}" required />
						<button type="submit" title="Сохранить">💾</button>
					</form>
				</td>
				<td class="row-delete">
					${renderConfirmModal({
						id: `deleteRef${item.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить запись?",
						message: "Удалить можно только если запись не используется в проводках.",
						confirmLabel: "Удалить",
						formAction: deleteActionFor(item.id),
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="2" class="empty-state">Записей нет</td></tr>`;

	const banner = deleteError ? `<div class="banner error">⚠ Не удалось удалить: ${escapeHtml(deleteError)}</div>` : "";

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${MODAL_STYLES}</style>
	${banner}
	<div class="topbar">
		<h1>Справочники</h1>
	</div>
	${renderSubTabs(REFERENCE_TABS, tabHref)}

	<div class="table-card">
		<table>
			<thead><tr><th>Название</th><th></th></tr></thead>
			<tbody>${rowsHtml}</tbody>
		</table>
		<form method="post" action="${createAction}" class="inline-form add-form">
			<input type="text" name="name" placeholder="${addPlaceholder}" required />
			<button type="submit" class="btn-primary">+ Добавить</button>
		</form>
	</div>
	`;

	return renderPage(NAV_HREF, title, content);
}

export async function renderReferenceAccountsPage(env: Env, url: URL): Promise<string> {
	const items = await listOwnAccounts(env);
	return renderRefPage(
		"/references/accounts",
		"Справочники · Счета",
		items,
		"/references/accounts",
		(id) => `/references/accounts/${id}/update`,
		(id) => `/references/accounts/${id}/delete`,
		"напр. Основной р/с",
		url.searchParams.get("delete_error"),
	);
}

export async function renderReferenceCashBoxesPage(env: Env, url: URL): Promise<string> {
	const items = await listCashBoxes(env);
	return renderRefPage(
		"/references/cash-boxes",
		"Справочники · Кассы",
		items,
		"/references/cash-boxes",
		(id) => `/references/cash-boxes/${id}/update`,
		(id) => `/references/cash-boxes/${id}/delete`,
		"напр. Касса Максима",
		url.searchParams.get("delete_error"),
	);
}

export async function renderReferenceExpensesPage(env: Env, url: URL): Promise<string> {
	const items = await listExpenseItems(env);
	return renderRefPage(
		"/references/expenses",
		"Справочники · Расходы",
		items,
		"/references/expenses",
		(id) => `/references/expenses/${id}/update`,
		(id) => `/references/expenses/${id}/delete`,
		"напр. Аренда помещения",
		url.searchParams.get("delete_error"),
	);
}

export async function renderReferenceEmployeesPage(env: Env, url: URL): Promise<string> {
	const items = await listEmployees(env);
	return renderRefPage(
		"/references/employees",
		"Справочники · Сотрудники",
		items,
		"/references/employees",
		(id) => `/references/employees/${id}/update`,
		(id) => `/references/employees/${id}/delete`,
		"напр. Иванова Мария",
		url.searchParams.get("delete_error"),
	);
}

export async function renderReferenceOtherOperationsPage(env: Env, url: URL): Promise<string> {
	const items = await listOtherOperations(env);
	return renderRefPage(
		"/references/other-operations",
		"Справочники · Прочие операции",
		items,
		"/references/other-operations",
		(id) => `/references/other-operations/${id}/update`,
		(id) => `/references/other-operations/${id}/delete`,
		"напр. Списание недостачи",
		url.searchParams.get("delete_error"),
	);
}

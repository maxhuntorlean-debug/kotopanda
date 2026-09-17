import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { DRAWER_STYLES, MODAL_STYLES, SUB_TABS_STYLES, renderSubTabs, renderConfirmModal, editIconSvg, deleteIconSvg } from "../ui";
import { listTestRefItems, type TestRefItem, type TestRefKind } from "../referencesTest";
import { settingsTabs } from "./settings";

export type TestRefEntry = { kind: TestRefKind; slug: string; label: string; placeholder: string };

// Порядок и подписи — как у боевых справочников, только источник данных — test_* таблицы.
// Экспортируется — те же подписи переиспользует "План счетов (тест)" для выбора справочника.
export const TEST_REF_ENTRIES: TestRefEntry[] = [
	{ kind: "ownAccounts", slug: "accounts", label: "Счета", placeholder: "напр. Основной р/с" },
	{ kind: "cashBoxes", slug: "cash-boxes", label: "Кассы", placeholder: "напр. Касса Максима" },
	{ kind: "suppliers", slug: "suppliers", label: "Поставщики", placeholder: "напр. ООО «Поставщик»" },
	{ kind: "expenseItems", slug: "expenses", label: "Расходы", placeholder: "напр. Аренда помещения" },
	{ kind: "employees", slug: "employees", label: "Сотрудники", placeholder: "напр. Иванова Мария" },
	{ kind: "otherOperations", slug: "other-operations", label: "Прочие операции", placeholder: "напр. Списание недостачи" },
	{ kind: "firms", slug: "firms", label: "Фирмы", placeholder: "напр. Котопанда" },
];

export function testRefEntryForSlug(slug: string): TestRefEntry | null {
	return TEST_REF_ENTRIES.find((e) => e.slug === slug) ?? null;
}

const STYLES = `
	.ref-test-layout {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}
	.ref-test-nav {
		width: 220px;
		flex-shrink: 0;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ref-test-nav a {
		display: block;
		padding: 9px 12px;
		border-radius: 8px;
		color: var(--text-muted);
		font-weight: 500;
		font-size: 13px;
	}
	.ref-test-nav a:hover { background: var(--bg); }
	.ref-test-nav a.active {
		background: var(--blue-soft);
		color: var(--blue);
	}
	.ref-test-content {
		flex: 1;
		min-width: 0;
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
	.row-actions { text-align: right; white-space: nowrap; }
	.row-actions .btn-secondary {
		padding: 6px 10px;
		font-size: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: 6px;
	}
	.table-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}
	.table-card-header h2 {
		margin: 0;
		font-size: 14px;
	}
	.btn-primary { font: inherit; cursor: pointer; }
	.modal-card {
		width: 380px;
	}
	.modal-card input[type="text"] {
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
`;

function modalOpenCloseScript(prefix: string): string {
	return `
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
			})();
		</script>
	`;
}

function newItemModalHtml(entry: TestRefEntry): string {
	return `
		<button type="button" class="btn-primary" id="newTestRefTrigger">+ Новый элемент</button>
		<div class="modal-overlay" id="newTestRefOverlay">
			<div class="modal-card">
				<h3>Новый элемент — ${entry.label}</h3>
				<form method="post" action="/settings/references/${entry.slug}">
					<div class="drawer-field">
						<span class="drawer-label">Название</span>
						<input type="text" name="name" placeholder="${entry.placeholder}" required />
					</div>
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="newTestRefCancel">Отмена</button>
						<button type="submit" class="btn-confirm">Добавить</button>
					</div>
				</form>
			</div>
		</div>
		${modalOpenCloseScript("newTestRef")}
	`;
}

// Модалка редактирования — триггер (карандаш) лежит в строке таблицы, а сама модалка со
// скриптом рендерится отдельно, после таблицы (см. renderTestReferencePage) — иначе
// document.getElementById её кнопки-триггера ещё не найдёт в DOM (те же грабли, что уже
// однажды словили на странице Проводок).
function editItemModalHtml(entry: TestRefEntry, item: TestRefItem): string {
	const prefix = `editTestRef${item.id}`;
	return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Редактировать — ${entry.label}</h3>
				<form method="post" action="/settings/references/${entry.slug}/${item.id}/update">
					<div class="drawer-field">
						<span class="drawer-label">Название</span>
						<input type="text" name="name" value="${escapeHtml(item.name)}" required />
					</div>
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
		${modalOpenCloseScript(prefix)}
	`;
}

export async function renderTestReferencePage(env: Env, entry: TestRefEntry): Promise<string> {
	const items = await listTestRefItems(env, entry.kind);

	const navHtml = TEST_REF_ENTRIES.map(
		(e) => `<a class="${e.slug === entry.slug ? "active" : ""}" href="/settings/references/${e.slug}">${e.label}</a>`,
	).join("\n");

	const rowsHtml = items.length
		? items
				.map(
					(item) => `
			<tr>
				<td>${escapeHtml(item.name)}</td>
				<td class="row-actions">
					<button type="button" class="btn-secondary" id="editTestRef${item.id}Trigger" title="Редактировать">${editIconSvg()}</button>
					${renderConfirmModal({
						id: `deleteTestRef${item.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить запись?",
						message: "Тестовая запись, действие необратимо.",
						confirmLabel: "Удалить",
						formAction: `/settings/references/${entry.slug}/${item.id}/delete`,
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="2" class="empty-state">Записей нет</td></tr>`;

	const editModalsHtml = items.map((item) => editItemModalHtml(entry, item)).join("\n");

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	<div class="topbar">
		<h1>Настройки</h1>
	</div>
	${renderSubTabs(settingsTabs(env), "/settings/references")}

	<div class="ref-test-layout">
		<nav class="ref-test-nav">${navHtml}</nav>
		<div class="ref-test-content">
			<div class="table-card">
				<div class="table-card-header">
					<h2>${entry.label}</h2>
					${newItemModalHtml(entry)}
				</div>
				<table>
					<thead><tr><th>Название</th><th></th></tr></thead>
					<tbody>${rowsHtml}</tbody>
				</table>
			</div>
		</div>
	</div>

	${editModalsHtml}
	`;

	// activeHref указывает на "Настройки" — подсветка в сайдбаре не должна гаснуть ни при
	// переключении вкладок Настроек, ни справочников внутри вкладки "Справочники".
	return renderPage("/settings", `Настройки · ${entry.label}`, content, env);
}

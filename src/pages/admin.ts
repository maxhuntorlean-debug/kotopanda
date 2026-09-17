import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { DRAWER_STYLES, renderSimpleDrawer, MODAL_STYLES, renderConfirmModal, deleteIconSvg, SUB_TABS_STYLES, renderSubTabs } from "../ui";
import { listUsers, listRoles } from "../adminUsers";
import { SECTIONS } from "../auth";
import { settingsTabs } from "./settings";

const STYLES = `
	.table-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 24px;
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
		height: 52px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
		box-sizing: border-box;
	}
	tbody tr:last-child td { border-bottom: none; }
	.muted { color: var(--text-muted); }
	.section-title {
		font-size: 15px;
		font-weight: 700;
		margin: 0 0 12px;
	}
	.inline-form {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.inline-form select,
	.inline-form input[type="text"],
	.inline-form input[type="password"] {
		padding: 6px 9px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
	}
	.inline-form button:not(.btn-primary) {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px 9px;
		cursor: pointer;
	}
	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		padding: 3px 9px;
		border-radius: 999px;
	}
	.status-pill.active { background: #eafaf3; color: var(--green); }
	.status-pill.inactive { background: #fdecec; color: var(--red); }
	.row-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.row-actions form { margin: 0; }
	/* Высота фиксированная — иначе кнопка с текстом ("Отключить") и кнопка-иконка (корзина, чей
	   размер задаёт вложенный svg) получаются чуть разной высоты, из-за чего строки с удалением
	   и без него в таблице пользователей выходят разной высоты, а разделитель между ними —
	   как будто "съезжает". */
	.row-actions .btn-secondary {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		height: 30px;
		padding: 0 10px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.role-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px;
		margin-bottom: 16px;
	}
	.role-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}
	.role-card-header h3 {
		margin: 0;
		font-size: 14px;
	}
	.perm-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 8px 16px;
		margin-bottom: 14px;
	}
	.perm-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}
	.perm-item input { accent-color: var(--blue); }
	.new-row-form {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 16px 18px;
		margin-bottom: 24px;
	}
	.new-row-form .inline-form { flex-wrap: wrap; }
`;

export async function renderAdminPage(env: Env, currentUsername: string): Promise<string> {
	const [users, roles] = await Promise.all([listUsers(env), listRoles(env)]);

	const roleOptionsHtml = roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("\n");

	const usersRowsHtml = users.length
		? users
				.map((u) => {
					const isSelf = u.username === currentUsername;
					return `
			<tr>
				<td>${escapeHtml(u.username)}${isSelf ? ' <span class="muted">(вы)</span>' : ""}</td>
				<td>
					<form method="post" action="/settings/admin/users/${u.id}/role" class="inline-form">
						<select name="role_id">
							${roles.map((r) => `<option value="${r.id}" ${r.id === u.roleId ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("\n")}
						</select>
						<button type="submit" title="Сохранить роль">💾</button>
					</form>
				</td>
				<td><span class="status-pill ${u.isActive ? "active" : "inactive"}">${u.isActive ? "Активен" : "Отключён"}</span></td>
				<td>
					<form method="post" action="/settings/admin/users/${u.id}/reset-password" class="inline-form">
						<input type="password" name="password" placeholder="новый пароль" required minlength="4" />
						<button type="submit" title="Сбросить пароль">🔑</button>
					</form>
				</td>
				<td class="row-actions">
					<form method="post" action="/settings/admin/users/${u.id}/toggle-active">
						<button type="submit" class="btn-secondary">${u.isActive ? "Отключить" : "Включить"}</button>
					</form>
					${
						isSelf
							? ""
							: renderConfirmModal({
									id: `deleteUser${u.id}`,
									triggerLabel: deleteIconSvg(),
									triggerClass: "btn-secondary",
									title: "Удалить пользователя?",
									message: `Пользователь «${escapeHtml(u.username)}» больше не сможет войти.`,
									confirmLabel: "Удалить",
									formAction: `/settings/admin/users/${u.id}/delete`,
								})
					}
				</td>
			</tr>`;
				})
				.join("\n")
		: `<tr><td colspan="5" class="muted">Пользователей пока нет</td></tr>`;

	const newUserFormHtml = `
		<form method="post" action="/settings/admin/users">
			<div class="drawer-field">
				<span class="drawer-label">Логин</span>
				<input type="text" name="username" required />
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Пароль</span>
				<input type="password" name="password" required minlength="4" />
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Роль</span>
				<select name="role_id">${roleOptionsHtml}</select>
			</div>
			<div class="drawer-actions">
				<button type="submit" class="btn-primary">Добавить пользователя</button>
			</div>
		</form>
	`;

	const rolesHtml = roles
		.map((r) => {
			if (r.isAdmin) {
				return `
			<div class="role-card">
				<div class="role-card-header">
					<h3>${escapeHtml(r.name)}</h3>
					<span class="status-pill active">Полный доступ</span>
				</div>
				<div class="muted">Видит и может всё, включая это Администрирование. Пользователей с этой ролью: ${r.userCount}.</div>
			</div>`;
			}

			const permsHtml = SECTIONS.map(
				(s) => `
				<label class="perm-item">
					<input type="checkbox" name="section" value="${s.key}" ${r.sections.includes(s.key) ? "checked" : ""} />
					${escapeHtml(s.label)}
				</label>`,
			).join("\n");

			return `
			<div class="role-card">
				<div class="role-card-header">
					<h3>${escapeHtml(r.name)}</h3>
					<span class="muted">Пользователей: ${r.userCount}</span>
				</div>
				<form method="post" action="/settings/admin/roles/${r.id}/permissions">
					<div class="perm-grid">${permsHtml}</div>
					<div class="row-actions">
						<button type="submit" class="btn-secondary">Сохранить права</button>
						${
							r.userCount === 0
								? renderConfirmModal({
										id: `deleteRole${r.id}`,
										triggerLabel: "Удалить роль",
										triggerClass: "btn-secondary",
										title: "Удалить роль?",
										message: `Роль «${escapeHtml(r.name)}» будет удалена.`,
										confirmLabel: "Удалить",
										formAction: `/settings/admin/roles/${r.id}/delete`,
									})
								: ""
						}
					</div>
				</form>
			</div>`;
		})
		.join("\n");

	const newRoleFormHtml = `
		<form method="post" action="/settings/admin/roles" class="inline-form">
			<input type="text" name="name" placeholder="Название роли" required />
			<button type="submit" class="btn-primary">Создать роль</button>
		</form>
	`;

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	<div class="topbar">
		<h1>Настройки</h1>
		<div class="topbar-actions">
			${renderSimpleDrawer({ id: "newUser", title: "Новый пользователь", triggerLabel: "+ Пользователь", bodyHtml: newUserFormHtml })}
		</div>
	</div>
	${renderSubTabs(settingsTabs(env), "/settings/admin")}

	<h2 class="section-title">Пользователи</h2>
	<div class="table-card">
		<table>
			<thead><tr><th>Логин</th><th>Роль</th><th>Статус</th><th>Сброс пароля</th><th></th></tr></thead>
			<tbody>${usersRowsHtml}</tbody>
		</table>
	</div>

	<h2 class="section-title">Роли и права</h2>
	<div class="new-row-form">${newRoleFormHtml}</div>
	${rolesHtml}
	`;

	return renderPage("/settings", "Администрирование", content, env);
}

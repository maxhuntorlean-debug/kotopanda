import { hashPassword } from "./auth";

export type AdminUserRow = {
	id: number;
	username: string;
	roleId: number;
	roleName: string;
	isActive: boolean;
};

export async function listUsers(env: Env): Promise<AdminUserRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT u.id, u.username, u.role_id, r.name AS role_name, u.is_active
		 FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`,
	).all<{ id: number; username: string; role_id: number; role_name: string; is_active: number }>();
	return results.map((r) => ({ id: r.id, username: r.username, roleId: r.role_id, roleName: r.role_name, isActive: r.is_active === 1 }));
}

export type AdminRoleRow = {
	id: number;
	name: string;
	isAdmin: boolean;
	userCount: number;
	sections: string[];
};

export async function listRoles(env: Env): Promise<AdminRoleRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT r.id, r.name, r.is_admin, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
		 FROM roles r ORDER BY r.is_admin DESC, r.id`,
	).all<{ id: number; name: string; is_admin: number; user_count: number }>();

	const { results: permRows } = await env.DB.prepare(`SELECT role_id, section FROM role_permissions`).all<{ role_id: number; section: string }>();
	const sectionsByRole = new Map<number, string[]>();
	for (const p of permRows) {
		const list = sectionsByRole.get(p.role_id) ?? [];
		list.push(p.section);
		sectionsByRole.set(p.role_id, list);
	}

	return results.map((r) => ({ id: r.id, name: r.name, isAdmin: r.is_admin === 1, userCount: r.user_count, sections: sectionsByRole.get(r.id) ?? [] }));
}

export async function createUser(env: Env, username: string, password: string, roleId: number): Promise<{ ok: boolean; reason?: string }> {
	const existing = await env.DB.prepare(`SELECT id FROM users WHERE username = ?`).bind(username).first<{ id: number }>();
	if (existing) return { ok: false, reason: "Такой логин уже занят" };
	const hash = await hashPassword(password);
	await env.DB.prepare(`INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)`).bind(username, hash, roleId).run();
	return { ok: true };
}

export async function setUserRole(env: Env, userId: number, roleId: number): Promise<void> {
	await env.DB.prepare(`UPDATE users SET role_id = ? WHERE id = ?`).bind(roleId, userId).run();
}

export async function setUserActive(env: Env, userId: number, active: boolean): Promise<void> {
	await env.DB.prepare(`UPDATE users SET is_active = ? WHERE id = ?`).bind(active ? 1 : 0, userId).run();
}

export async function resetUserPassword(env: Env, userId: number, password: string): Promise<void> {
	const hash = await hashPassword(password);
	await env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(hash, userId).run();
}

export async function deleteUser(env: Env, userId: number): Promise<void> {
	await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
}

export async function createRole(env: Env, name: string): Promise<{ ok: boolean; reason?: string }> {
	const existing = await env.DB.prepare(`SELECT id FROM roles WHERE name = ?`).bind(name).first<{ id: number }>();
	if (existing) return { ok: false, reason: "Такая роль уже есть" };
	await env.DB.prepare(`INSERT INTO roles (name, is_admin) VALUES (?, 0)`).bind(name).run();
	return { ok: true };
}

export async function updateRolePermissions(env: Env, roleId: number, sections: string[]): Promise<void> {
	await env.DB.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).bind(roleId).run();
	for (const section of sections) {
		await env.DB.prepare(`INSERT INTO role_permissions (role_id, section) VALUES (?, ?)`).bind(roleId, section).run();
	}
}

export async function deleteRole(env: Env, roleId: number): Promise<{ ok: boolean; reason?: string }> {
	const role = await env.DB.prepare(`SELECT is_admin FROM roles WHERE id = ?`).bind(roleId).first<{ is_admin: number }>();
	if (!role) return { ok: false, reason: "Роль не найдена" };
	if (role.is_admin === 1) return { ok: false, reason: "Нельзя удалить роль администратора" };
	const usersWithRole = await env.DB.prepare(`SELECT 1 FROM users WHERE role_id = ? LIMIT 1`).bind(roleId).first();
	if (usersWithRole) return { ok: false, reason: "Есть пользователи с этой ролью" };
	await env.DB.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).bind(roleId).run();
	await env.DB.prepare(`DELETE FROM roles WHERE id = ?`).bind(roleId).run();
	return { ok: true };
}

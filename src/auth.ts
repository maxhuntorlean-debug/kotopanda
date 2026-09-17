// Авторизация — роли с правами по разделам (см. обсуждение "Сделаем авторизацию?"). Сессия —
// подписанная cookie (userId + срок действия + HMAC-подпись на AUTH_SECRET), без отдельной таблицы
// сессий: раз в запрос всё равно идём в БД за пользователем/ролью/правами, поэтому деактивация
// пользователя или смена его роли уже действует со следующего запроса без нужды в ручном отзыве
// токена (решили не делать мгновенный отзыв — 30-дневная cookie достаточно).

const PBKDF2_ITERATIONS = 100000;
const SESSION_COOKIE_NAME = "kp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней

function toHex(bytes: Uint8Array): string {
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualStr(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
	return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
	return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split("$");
	if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
	const iterations = Number(parts[1]);
	const salt = fromHex(parts[2]);
	const expected = toHex(await pbkdf2(password, salt, iterations));
	return timingSafeEqualStr(expected, parts[3]);
}

async function hmacSign(payload: string, secret: string): Promise<string> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
	return toBase64Url(new Uint8Array(sig));
}

function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("Cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return decodeURIComponent(rest.join("="));
	}
	return null;
}

export async function createSessionCookie(env: Env, userId: number): Promise<string> {
	const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
	const payload = `${userId}.${exp}`;
	const sig = await hmacSign(payload, env.AUTH_SECRET);
	const value = `${payload}.${sig}`;
	return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
	return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Разделы приложения — по одному на пункт меню (плюс "admin", доступный только is_admin-ролям).
// sectionForPath определяет раздел по URL для проверки прав на каждый запрос.
export const SECTIONS: { key: string; label: string }[] = [
	{ key: "dashboard", label: "Дашборд" },
	{ key: "products", label: "Товары" },
	{ key: "sales-kotopanda", label: "Касса Котопанда" },
	{ key: "sales-kotopanda-categories", label: "Касса Котопанда · Категории" },
	{ key: "sales-elitka", label: "Касса Элитка" },
	{ key: "sales-elitka-categories", label: "Касса Элитка · Категории" },
	{ key: "clients", label: "Клиенты" },
	{ key: "reports", label: "Отчёты" },
	{ key: "bank", label: "Банк Приватбанк" },
	{ key: "card", label: "Карточка Универсальная" },
	{ key: "accounting-kotopanda", label: "Бухгалтерия Котопанда" },
	{ key: "accounting-elitka", label: "Бухгалтерия Элитка" },
	{ key: "offset", label: "Взаимозачёт" },
	{ key: "settings", label: "Настройки" },
];

export function sectionForPath(path: string): string | null {
	if (path === "/" || path === "/dashboard") return "dashboard";
	if (path === "/products" || path.startsWith("/products/")) return "products";
	// Категории — отдельное, более узкое право (см. обсуждение "Доступу кассиру к категориям не
	// нужны"): проверка на конкретный /categories обязана идти раньше общего префикса кассы,
	// иначе он же перехватит путь первым.
	if (path.startsWith("/sales-kotopanda/categories")) return "sales-kotopanda-categories";
	if (path.startsWith("/sales-elitka/categories")) return "sales-elitka-categories";
	if (path.startsWith("/sales-kotopanda")) return "sales-kotopanda";
	if (path.startsWith("/sales-elitka")) return "sales-elitka";
	if (path === "/clients" || path.startsWith("/clients/")) return "clients";
	if (path === "/reports" || path.startsWith("/reports/")) return "reports";
	if (path.startsWith("/bank")) return "bank";
	if (path.startsWith("/card-universal")) return "card";
	if (path.startsWith("/accounting/kotopanda")) return "accounting-kotopanda";
	if (path.startsWith("/accounting/elitka")) return "accounting-elitka";
	if (path === "/offset") return "offset";
	// Администрирование — вкладка внутри Настроек (/settings/admin, см. обсуждение "перенесём во
	// Настройки"), но право отдельное и не выдаётся чекбоксом (см. "admin" — фильтр ниже, только
	// auth.isAdmin): проверка обязана идти раньше общего префикса /settings, иначе тот же
	// "settings"-доступ ошибочно открывал бы и администрирование.
	if (path.startsWith("/settings/admin")) return "admin";
	if (path.startsWith("/settings")) return "settings";
	// Общий для обеих книг маршрут (например /accounting/:firm/operation-modal обрабатывается
	// через testFirmMatch, но /operation-document-test/:id/* — без фирмы в пути) — оба ведут
	// на существующую проводку, чей firm_id уже определяет книгу; для целей прав считаем их
	// частью "settings" не стоит — доступны только админам как unmatched (см. ниже).
	return null;
}

export type CurrentUser = {
	id: number;
	username: string;
	roleId: number;
	roleName: string;
	isAdmin: boolean;
	allowedSections: Set<string>;
};

export async function resolveCurrentUser(env: Env, request: Request): Promise<CurrentUser | null> {
	const raw = readCookie(request, SESSION_COOKIE_NAME);
	if (!raw) return null;
	const parts = raw.split(".");
	if (parts.length !== 3) return null;
	const [userIdStr, expStr, sig] = parts;
	const expected = await hmacSign(`${userIdStr}.${expStr}`, env.AUTH_SECRET);
	if (!timingSafeEqualStr(expected, sig)) return null;
	const exp = Number(expStr);
	if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

	const userId = Number(userIdStr);
	const row = await env.DB.prepare(
		`SELECT u.id, u.username, u.is_active, r.id AS role_id, r.name AS role_name, r.is_admin
		 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
	)
		.bind(userId)
		.first<{ id: number; username: string; is_active: number; role_id: number; role_name: string; is_admin: number }>();
	if (!row || row.is_active !== 1) return null;

	const isAdmin = row.is_admin === 1;
	let allowedSections = new Set<string>();
	if (!isAdmin) {
		const { results } = await env.DB.prepare(`SELECT section FROM role_permissions WHERE role_id = ?`).bind(row.role_id).all<{ section: string }>();
		allowedSections = new Set(results.map((r) => r.section));
	}

	return { id: row.id, username: row.username, roleId: row.role_id, roleName: row.role_name, isAdmin, allowedSections };
}

export async function verifyLogin(env: Env, username: string, password: string): Promise<number | null> {
	const row = await env.DB.prepare(`SELECT id, password_hash, is_active FROM users WHERE username = ?`)
		.bind(username)
		.first<{ id: number; password_hash: string; is_active: number }>();
	if (!row || row.is_active !== 1) return null;
	return (await verifyPassword(password, row.password_hash)) ? row.id : null;
}

// Первый доступный пользователю раздел — куда редиректить после логина или при попытке открыть
// запрещённую страницу (вместо голого 403).
export function firstAllowedPath(user: CurrentUser): string {
	if (user.isAdmin) return "/bank";
	for (const s of SECTIONS) {
		if (user.allowedSections.has(s.key)) return sectionHomePath(s.key);
	}
	return "/login";
}

function sectionHomePath(section: string): string {
	switch (section) {
		case "dashboard":
			return "/dashboard";
		case "products":
			return "/products";
		case "sales-kotopanda":
			return "/sales-kotopanda";
		case "sales-elitka":
			return "/sales-elitka";
		case "clients":
			return "/clients";
		case "reports":
			return "/reports";
		case "bank":
			return "/bank";
		case "card":
			return "/card-universal";
		case "accounting-kotopanda":
			return "/accounting/kotopanda";
		case "accounting-elitka":
			return "/accounting/elitka";
		case "offset":
			return "/offset";
		case "settings":
			return "/settings";
		default:
			return "/login";
	}
}

// Контекст текущего пользователя, привязанный к конкретному объекту env этого запроса (env —
// свежий объект на каждый вызов fetch(), так что WeakMap-привязка к нему безопасна при
// конкурентных запросах в одном изоляте — в отличие от module-level let). Используется в
// layout.ts, чтобы отфильтровать пункты меню без протаскивания currentUser через все renderPage.
const authContextByEnv = new WeakMap<object, CurrentUser>();

export function setAuthContext(env: Env, user: CurrentUser): void {
	authContextByEnv.set(env as unknown as object, user);
}

export function getAuthContext(env: Env): CurrentUser | null {
	return authContextByEnv.get(env as unknown as object) ?? null;
}

import { getAuthContext } from "./auth";
import { escapeHtml } from "./format";

export type NavItem = {
	href: string;
	label: string;
	icon: string;
	section: string;
};

// section — ключ из auth.ts SECTIONS, по нему фильтруется меню под текущего пользователя
// (см. renderPage). "Администрирование" сюда не входит — это теперь вкладка внутри "Настройки"
// (см. settings.ts), а не отдельный пункт меню.
export const NAV_ITEMS: NavItem[] = [
	{ href: "/dashboard", label: "Дашборд", icon: "📊", section: "dashboard" },
	{ href: "/products", label: "Товары", icon: "📦", section: "products" },
	{ href: "/sales-kotopanda", label: "Касса Котопанда", icon: "💰", section: "sales-kotopanda" },
	{ href: "/sales-elitka", label: "Касса Элитка", icon: "💰", section: "sales-elitka" },
	{ href: "/clients", label: "Клиенты", icon: "👥", section: "clients" },
	{ href: "/reports", label: "Отчёты", icon: "📈", section: "reports" },
	{ href: "/bank", label: "Банк Приватбанк", icon: "🏦", section: "bank" },
	{ href: "/card-universal", label: "Карточка Универсальная", icon: "💳", section: "card" },
	{ href: "/accounting/kotopanda", label: "Бухгалтерия Котопанда", icon: "🧮", section: "accounting-kotopanda" },
	{ href: "/accounting/elitka", label: "Бухгалтерия Элитка", icon: "🧮", section: "accounting-elitka" },
	{ href: "/offset", label: "Взаимозачёт", icon: "🔁", section: "offset" },
	{ href: "/settings", label: "Настройки", icon: "⚙️", section: "settings" },
];

const STYLES = `
	:root {
		--bg: #f5f6f8;
		--panel: #ffffff;
		--border: #e5e7eb;
		--text: #1f2430;
		--text-muted: #8a8f99;
		--blue: #3b6ef6;
		--blue-soft: #eaf0fe;
		--green: #1fa971;
		--red: #e5484d;
		--amber: #f5a623;
		--radius: 14px;
		--sidebar-w: 220px;
	}
	* { box-sizing: border-box; }
	html, body {
		margin: 0;
		padding: 0;
		background: var(--bg);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		font-size: 14px;
	}
	a { color: inherit; text-decoration: none; }
	.app {
		display: flex;
		min-height: 100vh;
	}
	.sidebar {
		width: var(--sidebar-w);
		flex-shrink: 0;
		background: var(--panel);
		border-right: 1px solid var(--border);
		padding: 20px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sidebar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 16px;
		padding: 8px 10px 20px;
	}
	.brand-emoji { font-size: 20px; }
	.nav-toggle {
		display: none;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		background: none;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 16px;
		color: var(--text);
		cursor: pointer;
	}
	.sidebar-nav {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 4px;
	}
	.nav-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 10px;
		border-radius: 10px;
		color: var(--text-muted);
		font-weight: 500;
	}
	.nav-item:hover { background: var(--bg); }
	.nav-item.active {
		background: var(--blue-soft);
		color: var(--blue);
	}
	.nav-icon { font-size: 16px; width: 18px; text-align: center; }
	.sidebar-user {
		margin-top: auto;
		padding: 12px 10px 4px;
		border-top: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.sidebar-username {
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sidebar-user form { margin: 0; }
	.sidebar-logout {
		background: none;
		border: none;
		color: var(--text-muted);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
		padding: 4px 6px;
		border-radius: 6px;
	}
	.sidebar-logout:hover { background: var(--bg); color: var(--text); }
	.main {
		flex: 1;
		padding: 24px 32px;
		min-width: 0;
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
		gap: 16px;
		flex-wrap: wrap;
	}
	.topbar h1 {
		font-size: 19px;
		font-weight: 700;
		margin: 0;
	}
	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.dropdown, .icon-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 8px 12px;
		font-size: 13px;
		color: var(--text);
		cursor: default;
	}
	.icon-btn {
		padding: 8px 10px;
	}
	.btn-primary {
		background: var(--blue);
		color: #fff;
		border: none;
		border-radius: 10px;
		padding: 10px 16px;
		font-size: 13px;
		font-weight: 600;
		cursor: default;
	}
	.placeholder {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 48px 24px;
		text-align: center;
		color: var(--text-muted);
	}
	.placeholder h2 {
		color: var(--text);
		margin: 0 0 8px;
	}
	@media (max-width: 760px) {
		/* Базовый шрифт у тела — 14px, рассчитан на десктопную плотность; на телефоне
		   поднимаем до 16px, чтобы весь текст, который не переопределён отдельно
		   (заголовки, подписи, обычные абзацы), не приходилось разглядывать. */
		html, body { font-size: 16px; }
		.app { flex-direction: column; }
		.sidebar {
			width: 100%;
			border-right: none;
			border-bottom: 1px solid var(--border);
			padding: 8px 14px;
		}
		.brand { padding: 6px 0; font-size: 17px; }
		.nav-toggle {
			display: flex;
			width: 40px;
			height: 40px;
			font-size: 18px;
		}
		.sidebar-nav {
			display: none;
			flex: none;
			padding-top: 8px;
			gap: 2px;
		}
		.sidebar.open .sidebar-nav { display: flex; }
		.nav-item { padding: 13px 12px; font-size: 15px; }
		.nav-icon { font-size: 18px; }
		.sidebar-user { margin-top: 8px; padding: 14px 10px 6px; }
		.sidebar-username { font-size: 13px; }
		.sidebar-logout { font-size: 13px; padding: 7px 10px; }
		.main { padding: 14px; }
		.topbar { gap: 10px; }
		.topbar h1 { font-size: 19px; }
		.btn-primary {
			font-size: 16px;
			padding: 13px 18px;
		}
		.dropdown, .icon-btn {
			font-size: 14px;
			padding: 10px 12px;
		}
	}
`;

export function renderPage(activeHref: string, title: string, content: string, env: Env): string {
	const auth = getAuthContext(env);
	// auth отсутствует только если renderPage вызвали вне цепочки запроса, прошедшей проверку
	// в index.ts (не должно происходить) — тогда безопаснее показать меню как есть, чем уронить
	// страницу: сама проверка прав уже отработала на уровне маршрута.
	const visibleItems = !auth ? NAV_ITEMS : NAV_ITEMS.filter((item) => auth.isAdmin || auth.allowedSections.has(item.section));

	const navHtml = visibleItems
		.map((item) => {
			const cls = item.href === activeHref ? "nav-item active" : "nav-item";
			return `<a class="${cls}" href="${item.href}"><span class="nav-icon">${item.icon}</span>${item.label}</a>`;
		})
		.join("\n");

	return `<!doctype html>
<html lang="ru">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${title} · Котопанда</title>
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="icon" href="/icons/icon-32.png" />
	<link rel="apple-touch-icon" href="/icons/icon-180.png" />
	<meta name="theme-color" content="#3b6ef6" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Kotopanda" />
	<style>${STYLES}</style>
</head>
<body>
	<div class="app">
		<aside class="sidebar" id="sidebar">
			<div class="sidebar-top">
				<div class="brand"><span class="brand-emoji">🐾</span>Котопанда</div>
				<button type="button" class="nav-toggle" id="navToggle" aria-label="Меню">☰</button>
			</div>
			<div class="sidebar-nav" id="sidebarNav">
			${navHtml}
			${
				auth
					? `<div class="sidebar-user">
				<span class="sidebar-username">${escapeHtml(auth.username)}</span>
				<form method="post" action="/logout"><button type="submit" class="sidebar-logout">Выйти</button></form>
			</div>`
					: ""
			}
			</div>
		</aside>
		<main class="main">
			${content}
		</main>
	</div>
	<script>
		if ("serviceWorker" in navigator) {
			window.addEventListener("load", function () {
				navigator.serviceWorker.register("/sw.js");
			});
		}
		// Бургер-меню — на узких экранах сайдбар схлопнут в верхнюю панель, список пунктов
		// открывается/закрывается по клику на ☰ (см. .nav-toggle/.sidebar-nav в STYLES).
		(function () {
			var toggle = document.getElementById("navToggle");
			var sidebar = document.getElementById("sidebar");
			if (!toggle || !sidebar) return;
			toggle.addEventListener("click", function () {
				sidebar.classList.toggle("open");
			});
		})();
		// Защита от повторной отправки формы двойным кликом/Enter — любая форма на сайте
		// шлёт запрос и уходит на новую страницу, повторная отправка того же элемента
		// до перезагрузки — всегда случайность (например, "Терминал" задваивался в кассе).
		document.addEventListener(
			"submit",
			function (e) {
				var form = e.target;
				if (!(form instanceof HTMLFormElement)) return;
				if (form.dataset.submitted === "1") {
					e.preventDefault();
					return;
				}
				form.dataset.submitted = "1";
			},
			true,
		);
	</script>
</body>
</html>`;
}

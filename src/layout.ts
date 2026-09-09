export type NavItem = {
	href: string;
	label: string;
	icon: string;
};

export const NAV_ITEMS: NavItem[] = [
	{ href: "/dashboard", label: "Дашборд", icon: "📊" },
	{ href: "/products", label: "Товары", icon: "📦" },
	{ href: "/sales-kotopanda", label: "Касса Котопанда", icon: "💰" },
	{ href: "/sales-elitka", label: "Касса Элитка", icon: "💰" },
	{ href: "/clients", label: "Клиенты", icon: "👥" },
	{ href: "/reports", label: "Отчёты", icon: "📈" },
	{ href: "/bank", label: "Банк Приватбанк", icon: "🏦" },
	{ href: "/card-universal", label: "Карточка Универсальная", icon: "💳" },
	{ href: "/accounting/kotopanda", label: "Бухгалтерия Котопанда", icon: "🧮" },
	{ href: "/accounting/elitka", label: "Бухгалтерия Элитка", icon: "🧮" },
	{ href: "/offset", label: "Взаимозачёт", icon: "🔁" },
	{ href: "/references/accounts", label: "Справочники", icon: "📚" },
	{ href: "/settings", label: "Настройки", icon: "⚙️" },
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
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 16px;
		padding: 8px 10px 20px;
	}
	.brand-emoji { font-size: 20px; }
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
	@keyframes moneyCopyFlash {
		0% { background: #fde68a; }
		100% { background: transparent; }
	}
	.money-copy-flash {
		animation: moneyCopyFlash 0.6s ease;
		border-radius: 4px;
	}
	.copy-chip {
		position: fixed;
		right: 20px;
		bottom: 20px;
		display: flex;
		align-items: center;
		gap: 8px;
		background: #fde68a;
		border: 1px solid #e8c34a;
		border-radius: 12px;
		padding: 10px 14px;
		box-shadow: 0 8px 24px rgba(20, 24, 33, 0.18);
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		color: #6b5410;
		/* Ниже любого дропдауна/модалки (period-overlay:15, dropdown-menu:20, drawer:40/41,
		   modal-overlay:50), чтобы плашка не перекрывала их и не воровала клики, если
		   визуально оказалась в том же углу экрана. */
		z-index: 5;
		user-select: none;
	}
	.copy-chip:hover { background: #fcd34d; }
	.copy-chip-close {
		margin-left: 4px;
		color: #8a6d1a;
		font-weight: 700;
		padding: 0 2px;
	}
	.copy-chip-close:hover { color: #4a3a0d; }
`;

export function renderPage(activeHref: string, title: string, content: string): string {
	const navHtml = NAV_ITEMS.map((item) => {
		const cls = item.href === activeHref ? "nav-item active" : "nav-item";
		return `<a class="${cls}" href="${item.href}"><span class="nav-icon">${item.icon}</span>${item.label}</a>`;
	}).join("\n");

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
		<aside class="sidebar">
			<div class="brand"><span class="brand-emoji">🐾</span>Котопанда</div>
			${navHtml}
		</aside>
		<main class="main">
			${content}
		</main>
	</div>
	<div class="copy-chip" id="copyChip" hidden>
		<span>📋</span>
		<span id="copyChipValue"></span>
		<span class="copy-chip-close" id="copyChipClose" title="Убрать">✕</span>
	</div>
	<script>
		if ("serviceWorker" in navigator) {
			window.addEventListener("load", function () {
				navigator.serviceWorker.register("/sw.js");
			});
		}
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

		// Клик по любой сумме на странице копирует её в буфер обмена — без привязки к
		// конкретным классам/страницам, по формату текста ("1 234,56", "Д 1 234,56",
		// "1 234,56 грн" и т.п.), чтобы работало сразу везде, где показываются деньги.
		// Жёлтая плашка внизу справа хранит последнее скопированное и по клику подставляет
		// его в последнее сфокусированное поле — так можно скопировать сумму на одной
		// странице (например, в Обороте) и вставить на другой (например, в кассе).
		(function () {
			var STORAGE_KEY = "kotopanda:lastCopiedAmount";
			var MONEY_RE = /^(?:[ДК]\s)?([+-]?[\d\s ]+,\d{2})(?:\s?грн\.?)?$/;
			var lastFocusedInput = null;
			var chip = document.getElementById("copyChip");
			var chipValue = document.getElementById("copyChipValue");
			var chipClose = document.getElementById("copyChipClose");

			function normalize(raw) {
				var s = raw.trim();
				if (s.charAt(0) === "+" || s.charAt(0) === "-") s = s.slice(1);
				return s.replace(/[\s ]/g, "").replace(",", ".");
			}

			function display(normalized) {
				var parts = normalized.split(".");
				return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + parts[1];
			}

			function showChip(normalized) {
				if (!chip) return;
				chipValue.textContent = display(normalized);
				chip.hidden = false;
			}

			function hideChip() {
				if (!chip) return;
				chip.hidden = true;
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (e) {}
			}

			try {
				var stored = localStorage.getItem(STORAGE_KEY);
				if (stored) showChip(stored);
			} catch (e) {}

			document.addEventListener("focusin", function (e) {
				var el = e.target;
				if (el instanceof HTMLInputElement && (el.type === "number" || el.type === "text")) {
					lastFocusedInput = el;
				}
			});

			document.addEventListener(
				"click",
				function (e) {
					var el = e.target;
					if (!(el instanceof Element) || el.children.length > 0) return;
					var text = (el.textContent || "").trim();
					var match = text.match(MONEY_RE);
					if (!match) return;
					var normalized = normalize(match[1]);
					try {
						if (navigator.clipboard && navigator.clipboard.writeText) {
							navigator.clipboard.writeText(normalized);
						}
					} catch (err) {}
					try {
						localStorage.setItem(STORAGE_KEY, normalized);
					} catch (err) {}
					showChip(normalized);
					el.classList.remove("money-copy-flash");
					void el.offsetWidth;
					el.classList.add("money-copy-flash");
				},
				true,
			);

			if (chip) {
				chip.addEventListener("click", function (e) {
					if (e.target === chipClose) return;
					var normalized = null;
					try {
						normalized = localStorage.getItem(STORAGE_KEY);
					} catch (err) {}
					if (!normalized || !lastFocusedInput || !document.contains(lastFocusedInput)) return;
					lastFocusedInput.value = normalized;
					lastFocusedInput.dispatchEvent(new Event("input", { bubbles: true }));
					lastFocusedInput.dispatchEvent(new Event("change", { bubbles: true }));
					lastFocusedInput.focus();
				});
			}
			if (chipClose) {
				chipClose.addEventListener("click", function (e) {
					e.stopPropagation();
					hideChip();
				});
			}
		})();
	</script>
</body>
</html>`;
}

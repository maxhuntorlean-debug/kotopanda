import {
	PERIOD_OPTIONS,
	type PeriodKey,
	escapeHtml,
	todayIso,
	monthRange,
	quarterRange,
	yearRange,
	monthLabel,
	quarterLabel,
	encodeRangeToken,
	periodTokenLabel,
	shiftPeriodToken,
} from "./format";

// Единые иконки редактирования/удаления вместо emoji (✏/🗑) — рендер эмодзи-глифов
// непредсказуемо зависит от шрифта ОС/браузера и местами выглядит криво; inline SVG
// рисуется одинаково везде. Цвет задаём прямо на самом svg (а не через currentColor
// кнопки-обёртки) — карандаш всегда синий, корзина всегда красная, независимо от того,
// в какой кнопке они оказались.
export function editIconSvg(): string {
	return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
}

export function deleteIconSvg(): string {
	return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
}

export type SubTab = { href: string; label: string };

export const SUB_TABS_STYLES = `
	.sub-tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		border-bottom: 1px solid var(--border);
	}
	.sub-tab {
		padding: 10px 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}
	.sub-tab:hover {
		color: var(--text);
	}
	.sub-tab.active {
		color: var(--blue);
		border-bottom-color: var(--blue);
	}
	@media (max-width: 760px) {
		.sub-tab { padding: 12px 16px; font-size: 15px; }
	}
`;

// Горизонтальные вкладки внутри раздела (Справочник / Документы / Оборотка и т.п.)
export function renderSubTabs(tabs: SubTab[], activeHref: string): string {
	return `<div class="sub-tabs">${tabs
		.map((t) => `<a class="sub-tab${t.href === activeHref ? " active" : ""}" href="${t.href}">${t.label}</a>`)
		.join("\n")}</div>`;
}

// Общий каркас выезжающей справа панели (overlay + aside), используется и для
// редактирования (drawer открывается по клику на строку, см. bank.ts), и для
// создания новой записи через renderSimpleDrawer ниже.
export const DRAWER_STYLES = `
	.drawer-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 18, 25, 0.35);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
		z-index: 40;
	}
	.drawer-overlay.open {
		opacity: 1;
		pointer-events: auto;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 380px;
		max-width: 90vw;
		background: var(--panel);
		box-shadow: -10px 0 30px rgba(20, 24, 33, 0.15);
		transform: translateX(100%);
		transition: transform 0.25s ease;
		z-index: 41;
		display: flex;
		flex-direction: column;
	}
	.drawer.open {
		transform: translateX(0);
	}
	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 20px;
		border-bottom: 1px solid var(--border);
	}
	.drawer-header h2 {
		margin: 0;
		font-size: 16px;
	}
	.drawer-close {
		border: none;
		background: none;
		font-size: 16px;
		cursor: pointer;
		color: var(--text-muted);
		padding: 4px;
		line-height: 1;
	}
	.drawer-body {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		overflow-y: auto;
	}
	.drawer-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.drawer-field[hidden] {
		display: none;
	}
	.drawer-label {
		color: var(--text-muted);
		font-size: 12px;
	}
	.drawer-value {
		font-size: 14px;
	}
	.drawer select,
	.drawer input[type="text"],
	.drawer input[type="date"],
	.drawer input[type="number"] {
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
	.drawer-divider {
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}
	.drawer-actions {
		margin-top: 4px;
	}
	.drawer-actions .btn-primary {
		width: 100%;
		text-align: center;
		font: inherit;
		cursor: pointer;
	}
	.drawer-hint {
		color: var(--text-muted);
		font-size: 11px;
	}
	.drawer-checkbox {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	.drawer-checkbox input[type="checkbox"] {
		width: auto;
		margin-top: 2px;
		accent-color: var(--blue);
	}
	.drawer-checkbox input[type="checkbox"]:disabled {
		cursor: not-allowed;
	}
	@media (max-width: 760px) {
		/* Инпут мельче 16px заставляет iOS Safari зумить страницу при фокусе — на десктопе
		   не трогаем (там это просто плотность), только на мобильном. */
		.drawer select,
		.drawer input[type="text"],
		.drawer input[type="date"],
		.drawer input[type="number"] {
			font-size: 16px;
			padding: 11px 12px;
		}
		.drawer-label { font-size: 13px; }
		.drawer-hint { font-size: 12px; }
		.drawer-checkbox { font-size: 14px; }
	}
`;

export type SimpleDrawerOptions = {
	id: string;
	title: string;
	triggerLabel: string;
	bodyHtml: string;
};

// Кнопка-триггер + панель, которая открывается по клику на неё (не на строку таблицы,
// как в bank.ts) — подходит для форм создания новой записи (например, нового поставщика).
export function renderSimpleDrawer(opts: SimpleDrawerOptions): string {
	const overlayId = `${opts.id}Overlay`;
	const panelId = `${opts.id}Panel`;
	const triggerId = `${opts.id}Trigger`;
	const closeId = `${opts.id}Close`;

	return `
	<button type="button" class="btn-primary" id="${triggerId}">${opts.triggerLabel}</button>
	<div class="drawer-overlay" id="${overlayId}"></div>
	<aside class="drawer" id="${panelId}">
		<div class="drawer-header">
			<h2>${opts.title}</h2>
			<button type="button" class="drawer-close" id="${closeId}">✕</button>
		</div>
		<div class="drawer-body">
			${opts.bodyHtml}
		</div>
	</aside>
	<script>
		(function () {
			var overlay = document.getElementById("${overlayId}");
			var panel = document.getElementById("${panelId}");
			var trigger = document.getElementById("${triggerId}");
			var closeBtn = document.getElementById("${closeId}");
			function openDrawer() {
				overlay.classList.add("open");
				panel.classList.add("open");
			}
			function closeDrawer() {
				overlay.classList.remove("open");
				panel.classList.remove("open");
			}
			trigger.addEventListener("click", openDrawer);
			closeBtn.addEventListener("click", closeDrawer);
			overlay.addEventListener("click", closeDrawer);
		})();
	</script>
	`;
}

export const MODAL_STYLES = `
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 18, 25, 0.4);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.modal-overlay.open {
		opacity: 1;
		pointer-events: auto;
	}
	.modal-card {
		background: var(--panel);
		border-radius: 14px;
		box-shadow: 0 20px 60px rgba(20, 24, 33, 0.25);
		width: 340px;
		max-width: 90vw;
		padding: 22px;
		transform: scale(0.96);
		transition: transform 0.15s ease;
	}
	.modal-overlay.open .modal-card {
		transform: scale(1);
	}
	.modal-card h3 {
		margin: 0 0 8px;
		font-size: 15px;
	}
	.modal-card p {
		margin: 0 0 20px;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 1.5;
	}
	.modal-card form {
		margin: 0;
	}
	.modal-actions {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}
	.btn-danger {
		background: var(--red);
		color: #fff;
		border: none;
		border-radius: 10px;
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		padding: 10px 16px;
	}
	@media (max-width: 760px) {
		/* MODAL_STYLES подключается последним на каждой странице — эта медиа-правка
		   перекрывает локальные ".modal-card input{font-size:13px}" того же селектора у
		   каждой страницы с модалками (cashTest.ts, bank.ts и т.д.), а не дублируется в них. */
		.modal-card input[type="text"],
		.modal-card input[type="number"],
		.modal-card input[type="date"],
		.modal-card select {
			font-size: 16px;
			padding: 11px 12px;
		}
		.modal-card { width: 92vw; padding: 20px; }
		.modal-card h3 { font-size: 17px; }
		.modal-card p { font-size: 14px; }
		.btn-danger { font-size: 15px; padding: 12px 18px; }
	}
`;

export type ConfirmModalOptions = {
	id: string;
	triggerLabel: string;
	triggerClass?: string;
	title: string;
	message: string;
	confirmLabel: string;
	formAction: string;
	hiddenFields?: Record<string, string>;
};

// Кнопка-триггер + стилизованное модальное окно подтверждения (вместо нативного confirm()),
// с формой внутри — реальная отправка происходит только по клику на кнопку подтверждения.
export function renderConfirmModal(opts: ConfirmModalOptions): string {
	const overlayId = `${opts.id}Overlay`;
	const triggerId = `${opts.id}Trigger`;
	const cancelId = `${opts.id}Cancel`;
	const hiddenHtml = Object.entries(opts.hiddenFields ?? {})
		.map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
		.join("\n");

	return `
	<button type="button" class="${opts.triggerClass ?? "btn-secondary"}" id="${triggerId}">${opts.triggerLabel}</button>
	<div class="modal-overlay" id="${overlayId}">
		<div class="modal-card">
			<h3>${opts.title}</h3>
			<p>${opts.message}</p>
			<form method="post" action="${opts.formAction}">
				${hiddenHtml}
				<div class="modal-actions">
					<button type="button" class="btn-secondary" id="${cancelId}">Отмена</button>
					<button type="submit" class="btn-danger">${opts.confirmLabel}</button>
				</div>
			</form>
		</div>
	</div>
	<script>
		(function () {
			var overlay = document.getElementById("${overlayId}");
			var trigger = document.getElementById("${triggerId}");
			var cancelBtn = document.getElementById("${cancelId}");
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

export const PERIOD_PICKER_STYLES = `
	.period-nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.period-step {
		cursor: pointer;
		user-select: none;
		font-size: 11px;
		line-height: 1;
		padding: 8px 8px;
	}
	.period-step:hover {
		background: var(--bg);
	}
	.date-dropdown {
		position: relative;
	}
	.dropdown {
		font: inherit;
		cursor: pointer;
	}
	.dropdown .chevron {
		font-size: 10px;
		color: var(--text-muted);
		margin-left: 2px;
		transition: transform 0.15s ease;
	}
	.date-dropdown.open .dropdown {
		border-color: var(--blue);
		box-shadow: 0 0 0 3px var(--blue-soft);
	}
	.date-dropdown.open .chevron {
		transform: rotate(180deg);
	}
	.dropdown-menu {
		display: none;
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 230px;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 10px 30px rgba(20, 24, 33, 0.12);
		padding: 6px;
		z-index: 20;
	}
	.date-dropdown.open .dropdown-menu {
		display: block;
	}
	.menu-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 9px 10px;
		border-radius: 8px;
		font-size: 13px;
		color: var(--text);
		cursor: default;
	}
	a.menu-item {
		cursor: pointer;
	}
	.menu-item:hover {
		background: var(--bg);
	}
	.menu-item.selected {
		color: var(--blue);
		font-weight: 600;
	}
	.menu-check {
		display: inline-block;
		width: 16px;
		color: var(--blue);
	}
	.menu-item .menu-label {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.menu-item .arrow {
		color: var(--text-muted);
		font-size: 13px;
	}
	.menu-divider {
		height: 1px;
		background: var(--border);
		margin: 6px 4px;
	}
	.dropdown-submenu {
		max-height: 280px;
		overflow-y: auto;
	}
	.menu-back {
		color: var(--text-muted);
		font-weight: 600;
		border-bottom: 1px solid var(--border);
		border-radius: 0;
		margin-bottom: 4px;
		cursor: pointer;
		justify-content: flex-start;
	}
	.menu-back .arrow-back {
		margin-right: 4px;
	}
	.custom-period-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 6px 4px;
	}
	.custom-period-form label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.custom-period-form input[type="date"] {
		padding: 7px 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
	}
	.custom-period-form .btn-primary {
		font: inherit;
		cursor: pointer;
		margin-top: 2px;
	}
	.period-overlay {
		display: none;
		position: fixed;
		inset: 0;
		z-index: 15;
	}
	@media (max-width: 760px) {
		.period-step { font-size: 13px; padding: 10px 10px; }
		.menu-item { font-size: 15px; padding: 11px 12px; }
		.menu-check { width: 18px; }
		.menu-item .arrow { font-size: 15px; }
		.dropdown-menu { min-width: 250px; padding: 8px; }
		.custom-period-form label { font-size: 13px; }
		.custom-period-form input[type="date"] { font-size: 16px; padding: 10px; }
	}
`;

// Выезжающий выбор периода (Текущий месяц / Прошлый месяц / Месяц / Квартал / Год / Период),
// переиспользуется на всех страницах с отчётами по периоду (Банк, Касса, Карта, Бухгалтерия,
// Взаимозачёт). basePath — куда ведут ссылки пунктов меню.
// period/from/to — уже разрешённый период (см. resolvePeriodToken/periodRangeFromToken в format.ts).
// visibleKeys — если задан, показывает только эти пункты быстрого выбора из PERIOD_OPTIONS.
// Месяц/Квартал/Год/Период — рабочие подменю: клик переключает панель внутри того же дропдауна,
// без перезагрузки; выбор конкретного месяца/квартала/года/диапазона кодируется в period как "range:from:to".
export function renderPeriodPicker(basePath: string, period: string, from: string, to: string, visibleKeys?: PeriodKey[]): string {
	const periodLabel = periodTokenLabel(period);
	const visibleOptions = visibleKeys ? PERIOD_OPTIONS.filter((opt) => visibleKeys.includes(opt.key)) : PERIOD_OPTIONS;
	// basePath может уже нести свои query-параметры (например, карточка счёта — ?account=...&subconto=...) —
	// тогда period нужно приклеивать через "&", а не "?".
	const sep = basePath.includes("?") ? "&" : "?";

	const presetItemsHtml = visibleOptions
		.map((opt) => {
			const isSelected = opt.key === period;
			const check = isSelected ? `<span class="menu-check">✓</span>` : "";
			return `<a class="menu-item${isSelected ? " selected" : ""}" href="${basePath}${sep}period=${opt.key}"><span class="menu-label">${check}${opt.label}</span></a>`;
		})
		.join("\n");

	const today = todayIso();
	const [ty, tm] = today.split("-").map(Number);
	const currentQuarter = Math.ceil(tm / 3);

	const rangeItem = (token: string, label: string) => {
		const isSelected = period === token;
		const check = isSelected ? `<span class="menu-check">✓</span>` : "";
		return `<a class="menu-item${isSelected ? " selected" : ""}" href="${basePath}${sep}period=${encodeURIComponent(token)}"><span class="menu-label">${check}${escapeHtml(label)}</span></a>`;
	};

	const monthItemsHtml = Array.from({ length: 12 }, (_, i) => {
		let y = ty;
		let m = tm - i;
		while (m <= 0) {
			m += 12;
			y -= 1;
		}
		const r = monthRange(y, m);
		return rangeItem(encodeRangeToken(r.from, r.to), monthLabel(y, m));
	}).join("\n");

	const quarterItemsHtml = Array.from({ length: 8 }, (_, i) => {
		let y = ty;
		let q = currentQuarter - i;
		while (q <= 0) {
			q += 4;
			y -= 1;
		}
		const r = quarterRange(y, q);
		return rangeItem(encodeRangeToken(r.from, r.to), quarterLabel(y, q));
	}).join("\n");

	const yearItemsHtml = Array.from({ length: 5 }, (_, i) => {
		const y = ty - i;
		const r = yearRange(y);
		return rangeItem(encodeRangeToken(r.from, r.to), String(y));
	}).join("\n");

	// ▼/▲ рядом с окошком периода — шаг на соседний период (см. shiftPeriodToken в format.ts):
	// целый месяц/квартал/год, если текущий диапазон выровнен по его границе, иначе на длину
	// самого диапазона. Обычные ссылки с ?period=..., без JS — как и пункты меню выше.
	const prevHref = `${basePath}${sep}period=${encodeURIComponent(shiftPeriodToken(period, -1))}`;
	const nextHref = `${basePath}${sep}period=${encodeURIComponent(shiftPeriodToken(period, 1))}`;

	return `
	<div class="period-nav">
	<a class="icon-btn period-step" href="${prevHref}" title="Предыдущий период">▼</a>
	<div class="date-dropdown" id="dateDropdown">
		<button type="button" class="dropdown" id="dateDropdownTrigger">📅 ${escapeHtml(periodLabel)} <span class="chevron">▾</span></button>
		<div class="dropdown-menu" id="periodPanelMain">
			${presetItemsHtml}
			<div class="menu-item" data-open-panel="periodPanelMonth"><span class="menu-label">Месяц</span><span class="arrow">›</span></div>
			<div class="menu-item" data-open-panel="periodPanelQuarter"><span class="menu-label">Квартал</span><span class="arrow">›</span></div>
			<div class="menu-item" data-open-panel="periodPanelYear"><span class="menu-label">Год</span><span class="arrow">›</span></div>
			<div class="menu-divider"></div>
			<div class="menu-item" data-open-panel="periodPanelCustom"><span class="menu-label">📅 Период</span><span class="arrow">›</span></div>
		</div>
		<div class="dropdown-menu dropdown-submenu" id="periodPanelMonth" style="display:none;">
			<div class="menu-item menu-back" data-back="1"><span class="arrow-back">‹</span> Назад</div>
			${monthItemsHtml}
		</div>
		<div class="dropdown-menu dropdown-submenu" id="periodPanelQuarter" style="display:none;">
			<div class="menu-item menu-back" data-back="1"><span class="arrow-back">‹</span> Назад</div>
			${quarterItemsHtml}
		</div>
		<div class="dropdown-menu dropdown-submenu" id="periodPanelYear" style="display:none;">
			<div class="menu-item menu-back" data-back="1"><span class="arrow-back">‹</span> Назад</div>
			${yearItemsHtml}
		</div>
		<div class="dropdown-menu" id="periodPanelCustom" style="display:none;">
			<div class="menu-item menu-back" data-back="1"><span class="arrow-back">‹</span> Назад</div>
			<form id="customPeriodForm" class="custom-period-form">
				<label>С <input type="date" id="customPeriodFrom" value="${from}" required /></label>
				<label>По <input type="date" id="customPeriodTo" value="${to}" required /></label>
				<button type="submit" class="btn-primary">Показать</button>
			</form>
		</div>
	</div>
	<div class="period-overlay" id="periodOverlay"></div>
	<a class="icon-btn period-step" href="${nextHref}" title="Следующий период">▲</a>
	</div>
	<script>
		(function () {
			var wrap = document.getElementById("dateDropdown");
			var trigger = document.getElementById("dateDropdownTrigger");
			var overlay = document.getElementById("periodOverlay");
			var panels = wrap.querySelectorAll(".dropdown-menu");

			function showPanel(id) {
				panels.forEach(function (p) {
					p.style.display = p.id === id ? "block" : "none";
				});
			}

			function closeDropdown() {
				wrap.classList.remove("open");
				overlay.style.display = "none";
				// showPanel() ставит инлайн display:block на активную панель — одного снятия
				// класса "open" недостаточно, инлайн-стиль иначе так и останется "block".
				panels.forEach(function (p) {
					p.style.display = "none";
				});
			}

			wrap.addEventListener("click", function (e) {
				e.stopPropagation();
			});

			trigger.addEventListener("click", function () {
				var willOpen = !wrap.classList.contains("open");
				if (willOpen) {
					wrap.classList.add("open");
					overlay.style.display = "block";
					showPanel("periodPanelMain");
				} else {
					closeDropdown();
				}
			});

			wrap.querySelectorAll("[data-open-panel]").forEach(function (item) {
				item.addEventListener("click", function () {
					showPanel(item.getAttribute("data-open-panel"));
				});
			});

			wrap.querySelectorAll(".menu-back").forEach(function (item) {
				item.addEventListener("click", function () {
					showPanel("periodPanelMain");
				});
			});

			// Тап по overlay, а не document-click: на iOS Safari клик по обычным элементам
			// без cursor:pointer/onclick не всегда всплывает до document, из-за чего
			// закрытие тапом "мимо" не срабатывало на мобильных.
			overlay.addEventListener("click", closeDropdown);

			var customForm = document.getElementById("customPeriodForm");
			customForm.addEventListener("submit", function (e) {
				e.preventDefault();
				var f = document.getElementById("customPeriodFrom").value;
				var t = document.getElementById("customPeriodTo").value;
				if (f && t) {
					window.location.href = "${basePath}${sep}period=" + encodeURIComponent("range:" + f + ":" + t);
				}
			});
		})();
	</script>
	`;
}

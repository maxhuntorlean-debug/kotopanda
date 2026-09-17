import { renderPage } from "../layout";
import { getAuthContext } from "../auth";
import { escapeHtml, formatMoney, isoToDisplay, todayIso, addDaysIso, periodRangeFromToken, resolvePeriodToken } from "../format";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, SUB_TABS_STYLES, renderSubTabs, type SubTab, MODAL_STYLES, DRAWER_STYLES, renderConfirmModal, editIconSvg, deleteIconSvg } from "../ui";
import { loadTestSubcontoContext, listTestDocuments, resolveTestFirmId, resolveSubcontoName, type TestFirmCode, type TestSubcontoContext } from "../operationDocumentTest";
import {
	listTestCashCategories,
	createTestCashCategory,
	updateTestCashCategory,
	deleteTestCashCategory,
	getOrCreateTestCashDocument,
	listTestCashOperations,
	testCashCategoriesByDirection,
	testCashCategorySubcontoOptions,
	getTestCashRegisterBalance,
	type TestCashCategory,
	type CategoriesByDirection,
} from "../cashTest";
import type { ChartAccountTest } from "../chartOfAccountsTest";

const REGISTER_TITLES: Record<TestFirmCode, string> = {
	kotopanda: "Касса Котопанда",
	elitka: "Касса Элитка",
};

// Те же вкладки, что и у боевой кассы (kassaTabs в pages/cash.ts) — в отличие от той, "День"
// (сама эта страница) теперь не переход на отдельный урл документа, а панель справа (см. ниже).
// "Категории" — отдельное право (sales-:firm-categories, см. auth.ts), кассиру обычно не нужно:
// вкладку просто не показываем, если прав нет (сам маршрут всё равно блокирует guard в index.ts,
// это только про то, чтобы не предлагать ссылку, по которой всё равно редиректнёт).
function cashTestTabs(firm: TestFirmCode, env: Env): SubTab[] {
	const auth = getAuthContext(env);
	const canSeeCategories = !auth || auth.isAdmin || auth.allowedSections.has(`sales-${firm}-categories`);
	const tabs: SubTab[] = [{ href: `/sales-${firm}`, label: "Касса" }];
	if (canSeeCategories) tabs.push({ href: `/sales-${firm}/categories`, label: "Категории" });
	return tabs;
}

const STYLES = `
	.topbar { justify-content: flex-start; }
	.topbar h1 { white-space: nowrap; }
	.topbar-actions form { margin: 0; display: flex; align-items: center; gap: 8px; }
	.topbar-actions .btn-primary, .topbar-actions .btn-secondary { font: inherit; cursor: pointer; }
	.topbar-actions input[type="date"] {
		padding: 9px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
	}

	.cash-test-layout {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}
	.cash-test-list {
		width: 320px;
		flex-shrink: 0;
	}
	.cash-test-detail {
		flex: 1;
		min-width: 0;
	}
	.table-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	table { width: 100%; border-collapse: collapse; }
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
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
		white-space: nowrap;
	}
	tbody tr:last-child td { border-bottom: none; }
	tbody tr[data-href] { cursor: pointer; }
	tbody tr[data-href]:hover { background: var(--bg); }
	tbody tr.active { background: var(--blue-soft); }
	.empty-state { padding: 40px 16px; text-align: center; color: var(--text-muted); }
	.placeholder { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 48px 24px; text-align: center; color: var(--text-muted); }

	.close-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px;
		margin-bottom: 20px;
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.close-card form { margin: 0; display: flex; align-items: end; gap: 10px; }
	.doc-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
	.doc-topline { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); }
	.doc-date { display: flex; align-items: center; gap: 8px; font-weight: 600; }
	.doc-date .date-arrow { color: var(--text-muted); font-size: 13px; padding: 2px 7px; border-radius: 6px; }
	.doc-date .date-arrow:hover { background: var(--bg); }
	.doc-number { color: var(--text-muted); font-size: 13px; }
	.balance-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: var(--bg); font-size: 13px; color: var(--text-muted); }
	.balance-row .balance-value { font-weight: 700; font-size: 15px; color: var(--text); }
	.balance-row .balance-value.positive { color: var(--green); }
	.balance-row .balance-value.negative { color: var(--red); }
	.balance-row.total { background: var(--panel); border-top: 1px solid var(--border); }
	.balance-row.total .balance-value { font-size: 18px; }
	.op-table { width: 100%; border-collapse: collapse; }
	.op-table thead tr { background: var(--green); }
	.op-table th { text-align: left; font-size: 12px; color: #fff; font-weight: 600; padding: 10px 18px; white-space: nowrap; }
	.op-table th:last-child, .op-table td:last-child { text-align: right; }
	.op-table td { padding: 12px 18px; border-bottom: 1px solid var(--border); }
	.op-table tr:last-child td { border-bottom: none; }
	.amt.in { color: var(--green); font-weight: 600; }
	.amt.out { color: var(--red); font-weight: 600; }
	.op-table td.num { color: var(--text-muted); width: 1%; }
	.op-table td.sign { font-weight: 700; width: 1%; }
	.op-table td.sign.in { color: var(--green); }
	.op-table td.sign.out { color: var(--red); }
	.op-table select, .op-table input[type="number"], .op-table input[type="text"] {
		width: 100%;
		min-width: 90px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font: inherit;
		font-size: 13px;
		box-sizing: border-box;
	}
	.op-add-row td { padding: 8px 10px; }
	.btn-add-row { background: var(--blue); color: #fff; border: none; border-radius: 6px; width: 30px; height: 30px; cursor: pointer; font-size: 14px; }
	.row-actions { display: flex; gap: 6px; justify-content: flex-end; white-space: nowrap; }
	.op-icon-btn {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		width: 30px;
		height: 30px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		cursor: pointer;
		color: var(--text-muted);
	}
	.op-icon-btn:hover { background: var(--bg); color: var(--text); border-color: var(--text-muted); }
	.op-icon-btn-danger:hover { background: rgba(229, 72, 77, 0.1); color: var(--red); border-color: var(--red); }
	.muted { color: var(--text-muted); }

	.modal-card input[type="date"],
	.modal-card input[type="text"],
	.modal-card input[type="number"],
	.modal-card select {
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
	.modal-card form { display: flex; flex-direction: column; gap: 14px; }
	.modal-card .modal-actions { margin-top: 4px; }
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
	.btn-confirm:hover { background: var(--bg); }
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
	.btn-secondary:hover { background: var(--bg); }
	.acc { font-weight: 600; }
	.subconto { color: var(--text-muted); }
	.journal-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.cat-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
	.cat-badge.in { background: rgba(31, 169, 113, 0.12); color: var(--green); }
	.cat-badge.out { background: rgba(229, 72, 77, 0.1); color: var(--red); }
	.row-delete { text-align: right; }
	.row-delete .btn-secondary { padding: 6px 10px; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; }
	.banner { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
	.banner.error { background: #fdecec; color: var(--red); }

	.mobile-back { display: none; }
	.mobile-detail-title { display: none; }
	.mobile-add-actions { display: none; }
	.fab-new-doc { display: none; }

	@media (max-width: 760px) {
		/* Список дат — главный экран Кассы на телефоне: период вверху (topbar), список ниже.
		   День — второй экран, открывается тем же ?date=, что и на десктопе, просто здесь
		   список и день не бок о бок, а по одному за раз (has-date переключает, какой виден). */
		.cash-page.has-date .topbar,
		.cash-page.has-date .sub-tabs { display: none; }
		.cash-page.has-date .cash-test-list { display: none; }
		.cash-page:not(.has-date) .cash-test-detail { display: none; }
		.mobile-back {
			display: block;
			text-align: center;
			padding: 12px;
			margin-bottom: 12px;
			border: 1px solid var(--border);
			border-radius: 10px;
			background: var(--panel);
			font-weight: 600;
			color: var(--text);
		}
		.mobile-detail-title {
			display: block;
			margin: 4px 4px 12px;
			font-size: 19px;
		}

		/* align-items: stretch — база (.cash-test-layout выше) ставит flex-start для бок-о-бок
		   раскладки на десктопе, а в колонке (мобильный) это сжимало все карточки внутри
		   (.doc-card/.close-card/.mobile-add-actions и т.д.) по содержимому вместо растяжения
		   на всю ширину — отсюда пустое место справа на всех мобильных скриншотах. */
		.cash-test-layout { flex-direction: column; align-items: stretch; }
		.cash-test-list { width: 100%; }
		.topbar-actions { flex-wrap: wrap; }
		/* Именно ".topbar-actions .desktop-open-form" (2 класса), а не просто ".desktop-open-form"
		   (1 класс) — иначе проигрывает по специфичности базовому ".topbar-actions form"
		   (класс + тег) выше, и форма с датой не пряталась, хотя остальное мобильное уже
		   работало (несмотря на видимость сначала списывали на кэш — на деле баг в CSS). */
		.topbar-actions .desktop-open-form { display: none; }
		.fab-new-doc {
			display: flex;
			align-items: center;
			justify-content: center;
			position: fixed;
			right: 20px;
			bottom: 20px;
			width: 56px;
			height: 56px;
			border-radius: 50%;
			border: none;
			background: #1f2430;
			color: #fff;
			font-size: 28px;
			line-height: 1;
			cursor: pointer;
			box-shadow: 0 8px 24px rgba(20, 24, 33, 0.25);
			/* Ниже дропдауна/модалки (15/20/50, см. z-index-карту в layout.ts), но выше строк
			   таблицы под собой. */
			z-index: 10;
		}
		.doc-list-table thead th { background: var(--green); color: #fff; }
		.doc-list-table tbody td { font-size: 15px; padding: 13px 14px; }

		/* Таблица операций дня — на телефоне это компактный список без подписей полей
		   (Вид + Сумма в одну строку, как в "нормальной" мобильной кассе, см. обсуждение
		   "Как сделать нормально моб версию касса элитка"), а не таблица-простыня. Субконто/
		   примечание — вторая мелкая строка, только если реально заполнены. */
		.op-table thead { display: none; }
		.op-table, .op-table tbody { display: block; width: 100%; }
		.op-table tbody tr {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			border-bottom: 1px solid var(--border);
			padding: 12px 16px;
			gap: 2px 10px;
		}
		.op-table tbody tr:last-child { border-bottom: none; }
		.op-table td { border-bottom: none; padding: 0; white-space: normal; }
		.op-table td.num, .op-table td.sign { display: none; }
		.op-table td:not(.num):not(.sign):not(.amt):not(.subconto):not(.muted):not(.row-actions) {
			flex: 1 1 auto;
			font-size: 16px;
			font-weight: 600;
			order: 1;
		}
		.op-table td.amt {
			order: 2;
			text-align: right;
			font-size: 17px;
		}
		.op-table td.subconto,
		.op-table td.muted:not(.row-actions) {
			flex-basis: 100%;
			order: 3;
			font-size: 13px;
			color: var(--text-muted);
		}
		.op-table td.subconto:empty,
		.op-table td.muted:not(.row-actions):empty { display: none; }
		.op-table td.row-actions {
			flex-basis: 100%;
			order: 4;
			justify-content: flex-end;
			padding-top: 6px;
			gap: 10px;
		}
		.op-icon-btn { width: 40px; height: 40px; }
		.op-icon-btn svg { width: 17px; height: 17px; }

		/* Вписанная в таблицу строка добавления — на телефоне заменена кнопками +/- снизу
		   (см. mobile-add-actions/mobileAddModalHtml), сама она тут не нужна и не влезла бы.
		   ".op-table tbody tr.op-add-row" (2 класса + 2 тега), а не просто ".op-add-row" —
		   та же история специфичности, что и с .desktop-open-form: простого класса не хватает,
		   чтобы перебить ".op-table tbody tr { display: flex }" чуть выше. */
		.op-table tbody tr.op-add-row { display: none; }

		.mobile-add-actions {
			display: flex;
			gap: 12px;
			margin-top: 16px;
		}
		.mobile-add-btn {
			flex: 1;
			height: 64px;
			border-radius: 14px;
			border: 1px solid var(--border);
			background: var(--panel);
			font-size: 32px;
			font-weight: 700;
			line-height: 1;
			cursor: pointer;
		}
		.mobile-add-btn.income { color: var(--green); border-color: rgba(31, 169, 113, 0.35); }
		.mobile-add-btn.expense { color: var(--red); border-color: rgba(229, 72, 77, 0.35); }

		.topbar-actions input[type="date"] { font-size: 16px; padding: 10px 12px; }
		/* "Остатки"/"Закрыть день" (или "Открыть заново") — растягиваем на всю ширину карточки
		   поровну вместо кучки мелких кнопок слева (см. обсуждение "кнопки чуть крупнее и
		   растяни красиво"); текст про закрытый день — отдельной строкой на всю ширину сверху. */
		.close-card { padding: 14px; gap: 10px; }
		.close-card > .btn-secondary,
		.close-card > form { flex: 1 1 0; }
		.close-card form button { width: 100%; }
		.close-card span { flex-basis: 100%; font-size: 14px; }
		.btn-secondary, .btn-confirm { font-size: 16px; padding: 13px 16px; }
		.doc-topline { padding: 14px 16px; }
		.doc-date { font-size: 16px; }
		/* Перемотка на предыдущий/следующий день — на телефоне убрана (см. обсуждение "убери
		   перемотку где дата"): у мобильной кассы и так есть "← Назад" на список плюс новая
		   кнопка "+" на нём же для любой другой даты, второй способ поменять день не нужен. */
		.doc-date .date-arrow { display: none; }
		.doc-number { font-size: 14px; }
		.balance-row { font-size: 14px; padding: 12px 16px; }
		.balance-row .balance-value { font-size: 16px; }
		.balance-row.total .balance-value { font-size: 19px; }
		.cat-badge { font-size: 12px; padding: 3px 10px; }
	}
`;

function accLabel(accounts: ChartAccountTest[], code: string): string {
	const a = accounts.find((x) => x.code === code);
	return a ? `${code} — ${escapeHtml(a.name)}` : escapeHtml(code);
}

// Каскад Тип → Вид → Субконто — тот же приём, что opCascadeScript в pages/cash.ts, только
// субконто тут id (число), а не текст: вариант отрисовывается как <option value="id">имя</option>.
function testOpCascadeScript(
	idPrefix: string,
	categoriesByDirection: CategoriesByDirection,
	categorySubconto: Record<number, { id: number; name: string }[]>,
	initial: { direction: "income" | "expense"; categoryId: number; subcontoId: number | null } | null,
	focusOnInit: boolean,
	autoAdvance: boolean,
): string {
	return `
		<script>
			(function () {
				var directionSelect = document.getElementById("${idPrefix}Direction");
				var categorySelect = document.getElementById("${idPrefix}Category");
				var subcontoSelect = document.getElementById("${idPrefix}Subconto");
				var amountInput = document.getElementById("${idPrefix}Amount");
				var commentInput = document.getElementById("${idPrefix}Comment");
				var categoriesByDirection = ${JSON.stringify(categoriesByDirection)};
				var categorySubconto = ${JSON.stringify(categorySubconto)};
				var initial = ${JSON.stringify(initial)};
				var autoAdvance = ${autoAdvance};

				function syncSubconto(preselect) {
					var options = categorySubconto[categorySelect.value];
					if (options && options.length) {
						subcontoSelect.innerHTML = '<option value="">Выберите</option>';
						options.forEach(function (o) {
							var opt = document.createElement("option");
							opt.value = String(o.id);
							opt.textContent = o.name;
							subcontoSelect.appendChild(opt);
						});
						if (preselect != null) subcontoSelect.value = String(preselect);
						subcontoSelect.hidden = false;
						subcontoSelect.disabled = false;
					} else {
						subcontoSelect.hidden = true;
						subcontoSelect.disabled = true;
						subcontoSelect.value = "";
					}
				}

				function rebuildCategories(preselectCategory, preselectSubconto) {
					var list = categoriesByDirection[directionSelect.value] || [];
					categorySelect.innerHTML = "";
					list.forEach(function (c) {
						var opt = document.createElement("option");
						opt.value = c.id;
						opt.textContent = c.name;
						categorySelect.appendChild(opt);
					});
					if (preselectCategory) categorySelect.value = String(preselectCategory);
					syncSubconto(preselectSubconto);
				}

				function afterDirectionChosen() {
					rebuildCategories();
					if (autoAdvance) categorySelect.focus();
				}
				function afterCategoryChosen() {
					syncSubconto();
					if (autoAdvance) {
						if (!subcontoSelect.hidden) subcontoSelect.focus();
						else if (amountInput) amountInput.focus();
					}
				}
				function afterSubcontoChosen() {
					if (autoAdvance && amountInput) amountInput.focus();
				}

				directionSelect.addEventListener("change", afterDirectionChosen);
				categorySelect.addEventListener("change", afterCategoryChosen);
				if (autoAdvance) {
					subcontoSelect.addEventListener("change", afterSubcontoChosen);
					[
						[directionSelect, afterDirectionChosen],
						[categorySelect, afterCategoryChosen],
						[subcontoSelect, afterSubcontoChosen],
					].forEach(function (pair) {
						pair[0].addEventListener("keydown", function (e) {
							if (e.key !== "Enter") return;
							e.preventDefault();
							pair[1]();
						});
					});
					if (amountInput) {
						amountInput.addEventListener("keydown", function (e) {
							if (e.key !== "Enter") return;
							e.preventDefault();
							if (commentInput) commentInput.focus();
							else if (amountInput.form) amountInput.form.requestSubmit ? amountInput.form.requestSubmit() : amountInput.form.submit();
						});
					}
					if (commentInput) {
						commentInput.addEventListener("keydown", function (e) {
							if (e.key !== "Enter") return;
							e.preventDefault();
							var form = commentInput.form;
							if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
						});
					}
				}

				if (initial) {
					directionSelect.value = initial.direction;
					rebuildCategories(initial.categoryId, initial.subcontoId);
				} else {
					rebuildCategories();
				}
				if (${focusOnInit}) directionSelect.focus();
			})();
		</script>
	`;
}

// Мобильная модалка добавления операции (см. mobileAddHtml в renderCashTestDetail) — по сути тот
// же modal-card, что и у редактирования (editModalsHtml), только без выбора Тип: направление
// зафиксировано кнопкой, которой модалка открыта (income/expense), скрытый select с единственным
// option'ом нужен лишь затем, чтобы testOpCascadeScript (которому нужен реальный <select id="...Direction">)
// заработал без переделки.
function mobileAddModalHtml(
	basePath: string,
	date: string,
	period: string,
	direction: "income" | "expense",
	categoriesByDirection: CategoriesByDirection,
	categorySubcontoOptions: Record<number, { id: number; name: string }[]>,
): string {
	const prefix = direction === "income" ? "addIncome" : "addExpense";
	const title = direction === "income" ? "Приход" : "Расход";
	return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>${title}</h3>
				<form method="post" action="${basePath}/operations">
					<input type="hidden" name="date" value="${date}" />
					<input type="hidden" name="period" value="${escapeHtml(period)}" />
					<select id="${prefix}Direction" hidden><option value="${direction}" selected>${direction}</option></select>
					<div class="drawer-field">
						<span class="drawer-label">Вид</span>
						<select id="${prefix}Category" name="category_id" required></select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Субконто</span>
						<select id="${prefix}Subconto" name="subconto_id" hidden></select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Сумма, грн</span>
						<input type="number" inputmode="decimal" name="amount" step="0.01" min="0.01" required />
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Примечание</span>
						<input type="text" name="comment" placeholder="необязательно" />
					</div>
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Добавить</button>
					</div>
				</form>
			</div>
		</div>
		${testOpCascadeScript(prefix, categoriesByDirection, categorySubcontoOptions, { direction, categoryId: 0, subcontoId: null }, false, false)}
		<script>
			(function () {
				var overlay = document.getElementById("${prefix}Overlay");
				var trigger = document.getElementById("${prefix === "addIncome" ? "addIncomeTrigger" : "addExpenseTrigger"}");
				var cancelBtn = document.getElementById("${prefix}Cancel");
				if (!trigger) return;
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

// Касса (на месте старого боевого модуля, см. src/cash.ts до сноса) — список документов дня
// (узкая таблица) слева, сам день открывается не модалкой, а панелью справа (по клику по строке —
// обычный переход по ссылке с ?date=, без AJAX и без оверлея). У дня — тот же вид (Тип/Вид/
// Субконто, зелёная шапка таблицы), что и у старой боевой кассы, но пишет он в document-центричные
// test_documents/test_journal (doc_type='cash'), поэтому категории и справочники субконто — тоже
// из test_*-таблиц (test_cash_categories, см. cashTest.ts).
// На телефоне (см. обсуждение "Как сделать нормально моб версию касса элитка") это два разных
// экрана — список дат и сам день, между ними переключаемся по ?date= как и раньше, просто на
// мобильном CSS показывает только одну из панелей за раз (.cash-page.has-date, см. STYLES)
// вместо развёрстки бок о бок, как на десктопе.
export async function renderCashTestPage(env: Env, url: URL, firm: TestFirmCode): Promise<string> {
	const firmId = await resolveTestFirmId(env, firm);
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);

	const documents = await listTestDocuments(env, firmId, from, to, "cash");

	const basePath = `/sales-${firm}`;
	const title = REGISTER_TITLES[firm];

	const dateParam = url.searchParams.get("date");
	const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

	const opError = url.searchParams.get("op_error");
	const banner = opError ? `<div class="banner error">⚠ ${escapeHtml(opError)}</div>` : "";

	const today = todayIso();

	const rowsHtml = documents.length
		? documents
				.map(
					(d) => `
			<tr data-href="${basePath}?period=${encodeURIComponent(period)}&date=${d.docDate}" class="${d.docDate === selectedDate ? "active" : ""}">
				<td>${isoToDisplay(d.docDate)}</td>
				<td>№${d.id}</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="2" class="empty-state">За этот период документов нет</td></tr>`;

	const newDocHtml = `
		<form method="get" action="${basePath}" class="desktop-open-form">
			<input type="hidden" name="period" value="${escapeHtml(period)}" />
			<input type="date" name="date" value="${selectedDate ?? today}" />
			<button type="submit" class="btn-primary">Открыть</button>
		</form>
	`;

	// Мобильная замена той же формы — плавающая кнопка "+" в углу списка (видна только там, не на
	// экране дня, см. .fab-new-doc внутри .cash-test-list) и модалка с датой (по умолчанию
	// сегодня), см. обсуждение после "ты можешь это просто убрать в моб версии?". GET тот же, что
	// и у desktop-формы — день создаётся лениво при первом заходе на ?date=, ничего своего в
	// обработке не нужно.
	const mobileNewDocHtml = `
		<button type="button" class="fab-new-doc" id="newDocTrigger" aria-label="Новый документ">+</button>
		<div class="modal-overlay" id="newDocOverlay">
			<div class="modal-card">
				<h3>Новый документ</h3>
				<form method="get" action="${basePath}">
					<input type="hidden" name="period" value="${escapeHtml(period)}" />
					<div class="drawer-field">
						<span class="drawer-label">Дата</span>
						<input type="date" name="date" value="${today}" required />
					</div>
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="newDocCancel">Отмена</button>
						<button type="submit" class="btn-confirm">Создать</button>
					</div>
				</form>
			</div>
		</div>
		<script>
			(function () {
				var overlay = document.getElementById("newDocOverlay");
				var trigger = document.getElementById("newDocTrigger");
				var cancelBtn = document.getElementById("newDocCancel");
				trigger.addEventListener("click", function () {
					overlay.classList.add("open");
				});
				cancelBtn.addEventListener("click", function () {
					overlay.classList.remove("open");
				});
			})();
		</script>
	`;

	const detailHtml = selectedDate ? await renderCashTestDetail(env, firmId, firm, selectedDate, period) : `<div class="placeholder"><h2>Документ не выбран</h2><p>Выберите дату слева или откройте/создайте новый документ.</p></div>`;

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	${banner}
	<div class="cash-page${selectedDate ? " has-date" : ""}">
		<div class="topbar">
			<h1>${title}</h1>
			<div class="topbar-actions">
				${renderPeriodPicker(basePath, period, from, to)}
				${newDocHtml}
			</div>
		</div>
		${renderSubTabs(cashTestTabs(firm, env), basePath)}

		<div class="cash-test-layout">
			<div class="cash-test-list">
				<div class="table-card">
					<table class="doc-list-table">
						<thead><tr><th>Дата</th><th>Документ</th></tr></thead>
						<tbody>${rowsHtml}</tbody>
					</table>
				</div>
				${mobileNewDocHtml}
			</div>
			<div class="cash-test-detail">${detailHtml}</div>
		</div>
	</div>

	<script>
		document.querySelectorAll("tbody tr[data-href]").forEach(function (row) {
			row.addEventListener("click", function () {
				window.location.href = row.dataset.href;
			});
		});
	</script>
	`;

	return renderPage(basePath, title, content, env);
}

async function renderCashTestDetail(env: Env, firmId: number, firm: TestFirmCode, date: string, period: string): Promise<string> {
	const basePath = `/sales-${firm}`;
	const doc = await getOrCreateTestCashDocument(env, firmId, date);
	const isClosed = doc.closedAt !== null;
	const operations = await listTestCashOperations(env, doc.id);
	const categories = await listTestCashCategories(env, firmId);
	const ctx = await loadTestSubcontoContext(env);

	const categoriesByDirection = testCashCategoriesByDirection(categories);
	const categorySubcontoOptions = testCashCategorySubcontoOptions(categories, ctx.accounts, ctx.accountSubcontoOptions);

	const prevDate = addDaysIso(date, -1);
	const nextDate = addDaysIso(date, 1);
	const dateLink = (d: string) => `${basePath}?period=${encodeURIComponent(period)}&date=${d}`;

	const rowsHtml = operations
		.map((op, i) => {
			const sign = op.direction === "income" ? "+" : "−";
			const cls = op.direction === "income" ? "in" : "out";
			const subcontoName = op.subcontoId !== null && op.subcontoAccount ? resolveSubcontoName(ctx, op.subcontoAccount, op.subcontoId) : null;
			const actionsHtml = isClosed
				? ""
				: `
					<button type="button" class="op-icon-btn" id="editOp${op.id}Trigger" title="Редактировать">${editIconSvg()}</button>
					${renderConfirmModal({
						id: `deleteOp${op.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "op-icon-btn op-icon-btn-danger",
						title: "Удалить операцию?",
						message: "Действие необратимо.",
						confirmLabel: "Удалить",
						formAction: `${basePath}/operations/${op.id}/delete`,
						hiddenFields: { date, period },
					})}`;
			return `
				<tr>
					<td class="num">${i + 1}</td>
					<td class="sign ${cls}" data-label="Тип">${sign}</td>
					<td data-label="Вид">${escapeHtml(op.categoryName)}</td>
					<td class="subconto" data-label="Субконто">${subcontoName ? escapeHtml(subcontoName) : ""}</td>
					<td class="amt ${cls}" data-label="Сумма">${formatMoney(op.amount)}</td>
					<td class="muted" data-label="Примечание">${op.comment ? escapeHtml(op.comment) : ""}</td>
					<td class="row-actions">${actionsHtml}</td>
				</tr>`;
		})
		.join("\n");

	const addRowHtml =
		categories.length && !isClosed
			? `
			<tr class="op-add-row">
				<td class="num">${operations.length + 1}</td>
				<td data-label="Тип">
					<select id="opDirection">
						<option value="income">+</option>
						<option value="expense">−</option>
					</select>
				</td>
				<td data-label="Вид"><select id="opCategory" form="addOpForm" name="category_id" required></select></td>
				<td data-label="Субконто"><select id="opSubconto" form="addOpForm" name="subconto_id" hidden></select></td>
				<td data-label="Сумма"><input type="number" inputmode="decimal" id="opAmount" form="addOpForm" name="amount" step="0.01" min="0.01" placeholder="Сумма" required /></td>
				<td data-label="Примечание"><input type="text" id="opComment" form="addOpForm" name="comment" placeholder="Примечание" /></td>
				<td><button type="submit" form="addOpForm" class="btn-add-row">✓</button></td>
			</tr>`
			: "";

	const emptyRowHtml = operations.length === 0 && !categories.length ? `<tr><td colspan="7" class="empty-state">Сначала добавьте категории — вкладка «Категории»</td></tr>` : operations.length === 0 && isClosed ? `<tr><td colspan="7" class="empty-state">За этот день операций нет</td></tr>` : "";

	const editModalsHtml = isClosed
		? ""
		: operations
				.map((op) => {
					const prefix = `editOp${op.id}`;
					return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Редактировать операцию</h3>
				<form method="post" action="${basePath}/operations/${op.id}/update">
					<input type="hidden" name="date" value="${date}" />
					<input type="hidden" name="period" value="${escapeHtml(period)}" />
					<div class="drawer-field">
						<span class="drawer-label">Тип</span>
						<select id="${prefix}Direction">
							<option value="income">+</option>
							<option value="expense">−</option>
						</select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Вид</span>
						<select id="${prefix}Category" name="category_id" required></select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Субконто</span>
						<select id="${prefix}Subconto" name="subconto_id" hidden></select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Сумма, грн</span>
						<input type="number" inputmode="decimal" name="amount" step="0.01" min="0.01" value="${op.amount}" required />
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Примечание</span>
						<input type="text" id="${prefix}Comment" name="comment" value="${op.comment ? escapeHtml(op.comment) : ""}" />
					</div>
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
		${testOpCascadeScript(prefix, categoriesByDirection, categorySubcontoOptions, { direction: op.direction, categoryId: op.categoryId, subcontoId: op.subcontoId }, false, false)}
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
		</script>`;
		})
		.join("\n");

	const closeSectionHtml = !isClosed
		? `
		<div class="close-card">
			<button type="button" class="btn-secondary" id="balanceBtn">Остатки</button>
			<form method="post" action="${basePath}/close">
				<input type="hidden" name="date" value="${date}" />
				<input type="hidden" name="period" value="${escapeHtml(period)}" />
				<button type="submit" class="btn-primary">Закрыть день</button>
			</form>
		</div>`
		: `
		<div class="close-card">
			<button type="button" class="btn-secondary" id="balanceBtn">Остатки</button>
			<span>День закрыт — добавление и удаление операций заблокировано</span>
			<form method="post" action="${basePath}/reopen">
				<input type="hidden" name="date" value="${date}" />
				<input type="hidden" name="period" value="${escapeHtml(period)}" />
				<button type="submit" class="btn-secondary">Открыть заново</button>
			</form>
		</div>`;

	// "← Назад" + заголовок видны только на мобильном (см. .mobile-back/.mobile-detail-title в
	// STYLES) — на десктопе список и день уже бок о бок под общим топбаром, тут не нужны.
	const mobileBackHtml = `<a class="mobile-back" href="${basePath}?period=${encodeURIComponent(period)}">← Назад</a><h1 class="mobile-detail-title">${REGISTER_TITLES[firm]}</h1>`;

	// Кнопки + / − — мобильная замена вписанной в таблицу строке добавления (op-add-row):
	// на телефоне тесные select'ы в ряд неюзабельны, поэтому вместо неё крупные кнопки, каждая
	// открывает свою модалку с готовым направлением (см. mobileAddModalHtml — категории уже
	// отфильтрованы по direction, отдельного переключателя Тип внутри не нужно).
	const mobileAddHtml =
		categories.length && !isClosed
			? `
			<div class="mobile-add-actions">
				<button type="button" class="mobile-add-btn income" id="addIncomeTrigger">+</button>
				<button type="button" class="mobile-add-btn expense" id="addExpenseTrigger">−</button>
			</div>
			${mobileAddModalHtml(basePath, date, period, "income", categoriesByDirection, categorySubcontoOptions)}
			${mobileAddModalHtml(basePath, date, period, "expense", categoriesByDirection, categorySubcontoOptions)}`
			: "";

	return `
	${mobileBackHtml}
	<div class="doc-card">
		<div class="doc-topline">
			<div class="doc-date">
				<a class="date-arrow" href="${dateLink(prevDate)}">‹</a>
				${isoToDisplay(date)}
				<a class="date-arrow" href="${dateLink(nextDate)}">›</a>
			</div>
			<div class="doc-number">Документ №${doc.id}</div>
		</div>

		<div id="balanceOpening"></div>

		<table class="op-table">
			<thead><tr><th>№</th><th>П/Р</th><th>Вид</th><th>Субконто</th><th>Сумма</th><th>Примечание</th><th></th></tr></thead>
			<tbody>
				${rowsHtml}
				${addRowHtml}
				${emptyRowHtml}
			</tbody>
		</table>

		<div id="balanceClosing"></div>
	</div>

	${closeSectionHtml}

	${mobileAddHtml}

	${editModalsHtml}

	<form id="addOpForm" method="post" action="${basePath}/operations">
		<input type="hidden" name="date" value="${date}" />
		<input type="hidden" name="period" value="${escapeHtml(period)}" />
	</form>

	<script>
		document.getElementById("balanceBtn").addEventListener("click", function () {
			fetch("${basePath}/day/balance?date=${encodeURIComponent(date)}")
				.then(function (r) { return r.text(); })
				.then(function (html) {
					var temp = document.createElement("div");
					temp.innerHTML = html;
					var opening = temp.querySelector("#balanceOpeningRow");
					var closing = temp.querySelector("#balanceClosingRow");
					document.getElementById("balanceOpening").innerHTML = opening ? opening.outerHTML : "";
					document.getElementById("balanceClosing").innerHTML = closing ? closing.outerHTML : "";
				});
		});
	</script>
	${categories.length && !isClosed ? testOpCascadeScript("op", categoriesByDirection, categorySubcontoOptions, null, true, true) : ""}
	`;
}

// Фрагмент остатков — подгружается AJAX'ом по клику на кнопку "Остатки" (см. скрипт в
// renderCashTestDetail), тот же приём, что renderKassaBalanceFragment в pages/cash.ts. Остаток —
// по конкретному субконто регистра (см. getTestCashRegisterBalance), а не по всему счёту 30 —
// иначе в сумму попадают и другие тестовые кассы (см. комментарий у TEST_CASH_REGISTER_SUBCONTO_NAME
// в cashTest.ts).
export async function renderCashTestBalanceFragment(env: Env, firmId: number, date: string): Promise<string> {
	const { openingBalance, closingBalance } = await getTestCashRegisterBalance(env, firmId, date);
	return `
		<div class="balance-row" id="balanceOpeningRow">
			<span>Остаток на начало (${isoToDisplay(date)})</span>
			<span class="balance-value ${openingBalance >= 0 ? "positive" : "negative"}">${formatMoney(openingBalance)}</span>
		</div>
		<div class="balance-row total" id="balanceClosingRow">
			<span>Остаток на конец</span>
			<span class="balance-value ${closingBalance >= 0 ? "positive" : "negative"}">${formatMoney(closingBalance)}</span>
		</div>
	`;
}

// Категории — тот же смысл, что и у прежней боевой кассы (src/cash.ts до сноса): Тип +/-,
// счёт+субконто с каждой стороны, только счета/субконто теперь из test_*-таблиц (ctx.accounts,
// ctx.accountSubcontoOptions из loadTestSubcontoContext), а субконто — id, а не текст.
export async function renderCashTestCategoriesPage(env: Env, url: URL, firm: TestFirmCode): Promise<string> {
	const firmId = await resolveTestFirmId(env, firm);
	const deleteError = url.searchParams.get("delete_error");
	const categories = await listTestCashCategories(env, firmId);
	const ctx = await loadTestSubcontoContext(env);

	const basePath = `/sales-${firm}`;
	const title = `${REGISTER_TITLES[firm]} · Категории`;

	const rowsHtml = categories.length
		? categories
				.map(
					(c) => `
			<tr>
				<td>${escapeHtml(c.name)}</td>
				<td><span class="cat-badge ${c.direction === "income" ? "in" : "out"}">${c.direction === "income" ? "+" : "−"}</span></td>
				<td class="acc">${accLabel(ctx.accounts, c.debitAccount)}${c.debitSubcontoId !== null ? ` <span class="subconto">/ ${escapeHtml(resolveSubcontoName(ctx, c.debitAccount, c.debitSubcontoId) ?? "")}</span>` : ""}</td>
				<td class="acc">${accLabel(ctx.accounts, c.creditAccount)}${c.creditSubcontoId !== null ? ` <span class="subconto">/ ${escapeHtml(resolveSubcontoName(ctx, c.creditAccount, c.creditSubcontoId) ?? "")}</span>` : ""}</td>
				<td class="row-delete">
					<button type="button" class="btn-secondary" id="editCat${c.id}Trigger" title="Редактировать">${editIconSvg()}</button>
					${renderConfirmModal({
						id: `deleteCat${c.id}`,
						triggerLabel: deleteIconSvg(),
						triggerClass: "btn-secondary",
						title: "Удалить категорию?",
						message: "Действие необратимо.",
						confirmLabel: "Удалить",
						formAction: `${basePath}/categories/${c.id}/delete`,
					})}
				</td>
			</tr>`,
				)
				.join("\n")
		: `<tr><td colspan="5" class="empty-state">Категорий пока нет</td></tr>`;

	const newCategoryModalHtml = `
		<button type="button" class="btn-primary" id="newCategoryTrigger">+ Категория</button>
		<div class="modal-overlay" id="newCategoryOverlay">
			<div class="modal-card">
				<h3>Новая категория</h3>
				<form method="post" action="${basePath}/categories">
					${categoryFieldsHtml("newCat", ctx)}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="newCategoryCancel">Отмена</button>
						<button type="submit" class="btn-confirm">Добавить</button>
					</div>
				</form>
			</div>
		</div>
		${bindCategoryAccountSubcontoScript("newCat", ctx, null, null)}
		<script>
			(function () {
				var overlay = document.getElementById("newCategoryOverlay");
				var trigger = document.getElementById("newCategoryTrigger");
				var cancelBtn = document.getElementById("newCategoryCancel");
				trigger.addEventListener("click", function () {
					overlay.classList.add("open");
				});
				cancelBtn.addEventListener("click", function () {
					overlay.classList.remove("open");
				});
			})();
		</script>
	`;

	const editModalsHtml = categories
		.map((c) => {
			const prefix = `editCat${c.id}`;
			return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Редактировать категорию</h3>
				<form method="post" action="${basePath}/categories/${c.id}/update">
					${categoryFieldsHtml(prefix, ctx, c)}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
		${bindCategoryAccountSubcontoScript(prefix, ctx, c.debitSubcontoId, c.creditSubcontoId)}
		<script>
			(function () {
				var overlay = document.getElementById("${prefix}Overlay");
				var cancelBtn = document.getElementById("${prefix}Cancel");
				cancelBtn.addEventListener("click", function () {
					overlay.classList.remove("open");
				});
			})();
		</script>`;
		})
		.join("\n");

	const banner = deleteError ? `<div class="banner error">⚠ Не удалось удалить: ${escapeHtml(deleteError)}</div>` : "";

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	${banner}
	<div class="topbar">
		<h1>${REGISTER_TITLES[firm]}</h1>
		<div class="topbar-actions">${newCategoryModalHtml}</div>
	</div>
	${renderSubTabs(cashTestTabs(firm, env), `${basePath}/categories`)}

	<div class="table-card">
		<table>
			<thead><tr><th>Название</th><th>Тип</th><th>Дебет</th><th>Кредит</th><th></th></tr></thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>

	${editModalsHtml}

	<script>
		document.querySelectorAll('[id^="editCat"][id$="Trigger"]').forEach(function (btn) {
			var overlayId = btn.id.replace(/Trigger$/, "Overlay");
			btn.addEventListener("click", function () {
				var overlay = document.getElementById(overlayId);
				if (overlay) overlay.classList.add("open");
			});
		});
	</script>
	`;

	return renderPage(basePath, title, content, env);
}

function categoryFieldsHtml(idPrefix: string, ctx: TestSubcontoContext, prefill?: TestCashCategory): string {
	const accountOptions = (selected?: string) => ctx.accounts.map((a) => `<option value="${a.code}" ${a.code === selected ? "selected" : ""}>${a.code} — ${escapeHtml(a.name)}</option>`).join("\n");
	return `
		<div class="drawer-field">
			<span class="drawer-label">Название категории</span>
			<input type="text" name="name" value="${prefill ? escapeHtml(prefill.name) : ""}" required />
		</div>
		<div class="drawer-field">
			<span class="drawer-label">Тип</span>
			<select name="direction">
				<option value="income" ${!prefill || prefill.direction === "income" ? "selected" : ""}>+ (Приход)</option>
				<option value="expense" ${prefill?.direction === "expense" ? "selected" : ""}>− (Расход)</option>
			</select>
		</div>
		<div class="journal-form-grid">
			<div class="drawer-field">
				<span class="drawer-label">Счёт Дт</span>
				<select name="debit_account" id="${idPrefix}DebitAccountSelect" required>
					<option value="">Выберите счёт</option>
					${accountOptions(prefill?.debitAccount)}
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Субконто Дт</span>
				<select name="debit_subconto_id" id="${idPrefix}DebitSubcontoSelect" hidden>
					<option value="">Не выбрано</option>
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Счёт Кт</span>
				<select name="credit_account" id="${idPrefix}CreditAccountSelect" required>
					<option value="">Выберите счёт</option>
					${accountOptions(prefill?.creditAccount)}
				</select>
			</div>
			<div class="drawer-field">
				<span class="drawer-label">Субконто Кт</span>
				<select name="credit_subconto_id" id="${idPrefix}CreditSubcontoSelect" hidden>
					<option value="">Не выбрано</option>
				</select>
			</div>
		</div>
	`;
}

function bindCategoryAccountSubcontoScript(idPrefix: string, ctx: TestSubcontoContext, initialDebitSubcontoId: number | null, initialCreditSubcontoId: number | null): string {
	return `
		<script>
			(function () {
				var accountSubconto = ${JSON.stringify(ctx.accountSubcontoOptions)};

				function bind(accountId, subcontoSelectId, initial) {
					var accountSelect = document.getElementById(accountId);
					var subcontoSelect = document.getElementById(subcontoSelectId);

					function sync(preselect) {
						var options = accountSubconto[accountSelect.value];
						if (options && options.length) {
							subcontoSelect.innerHTML = '<option value="">Не выбрано</option>';
							options.forEach(function (o) {
								var opt = document.createElement("option");
								opt.value = String(o.id);
								opt.textContent = o.name;
								subcontoSelect.appendChild(opt);
							});
							if (preselect != null) subcontoSelect.value = String(preselect);
							subcontoSelect.hidden = false;
							subcontoSelect.disabled = false;
						} else {
							subcontoSelect.hidden = true;
							subcontoSelect.disabled = true;
							subcontoSelect.value = "";
						}
					}

					accountSelect.addEventListener("change", function () {
						sync(null);
					});
					sync(initial);
				}

				bind("${idPrefix}DebitAccountSelect", "${idPrefix}DebitSubcontoSelect", ${JSON.stringify(initialDebitSubcontoId)});
				bind("${idPrefix}CreditAccountSelect", "${idPrefix}CreditSubcontoSelect", ${JSON.stringify(initialCreditSubcontoId)});
			})();
		</script>
	`;
}

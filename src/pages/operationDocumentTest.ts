import { escapeHtml, todayIso } from "../format";
import { DRAWER_STYLES, MODAL_STYLES, type SubTab } from "../ui";
import { TEST_FIRM_NAME, type TestSubcontoContext, type TestOperationLineInput, type TestFirmCode } from "../operationDocumentTest";

// Общие вкладки для тестовых страниц Журнала Операций — Оборотка / Журнал Операций, каждая
// со своей фирмой в пути (тот же приём, что accountingTabs(ledger) в pages/accounting.ts).
export function operationTestTabs(firm: TestFirmCode): SubTab[] {
	return [
		{ href: `/accounting/${firm}`, label: "Оборотка" },
		{ href: `/accounting/${firm}/journal`, label: "Журнал Операций" },
	];
}

// Внешний вид модалки "Операция" построен по образцу 1С (шапка с датой/организацией/суммой +
// табличная часть проводок Дебет/Кредит/Сумма) — см. обсуждение со скриншотом 1С.
export const OPERATION_MODAL_STYLES = `
	.modal-card.op-modal-card {
		width: 960px;
		max-width: 96vw;
		padding: 0;
		overflow: hidden;
	}
	.op-modal-card h3 {
		margin: 0;
		padding: 16px 22px;
		font-size: 15px;
		background: #eaf3ea;
		color: #2f6b45;
		border-bottom: 1px solid var(--border);
	}
	.op-modal-card form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 22px 22px;
	}
	.op-header-panel {
		border: 1px solid #cfe3d2;
		background: #f4f9f4;
		border-radius: 10px;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.op-header-row {
		display: flex;
		gap: 12px;
	}
	.op-header-field {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.op-header-field .drawer-label {
		font-size: 11px;
	}
	.op-header-panel input[type="date"],
	.op-header-panel input[type="text"] {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
		background: var(--panel);
		color: var(--text);
		box-sizing: border-box;
	}
	.op-header-panel input:disabled {
		background: var(--bg);
		color: var(--text-muted);
	}
	.op-add-line {
		align-self: flex-start;
		background: #eaf3ea;
		border: 1px solid #bcdcc0;
		border-radius: 8px;
		padding: 7px 14px;
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		color: #2f6b45;
		cursor: pointer;
	}
	.op-add-line:hover { background: #dcefdd; }
	.op-lines-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}
	.op-lines-table th {
		background: #f4f8f3;
		color: #5c7d64;
		font-weight: 600;
		font-size: 11px;
		text-align: left;
		padding: 8px 8px;
		border-bottom: 1px solid var(--border);
	}
	.op-lines-table td {
		padding: 6px 8px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	.op-lines-table tbody tr:last-child td { border-bottom: none; }
	.op-line-num {
		color: var(--text-muted);
		text-align: center;
	}
	.op-lines-table select,
	.op-lines-table input[type="number"],
	.op-lines-table input[type="text"] {
		width: 100%;
		padding: 7px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font: inherit;
		font-size: 12px;
		background: var(--panel);
		color: var(--text);
		box-sizing: border-box;
		outline: none;
	}
	.op-lines-table select:focus,
	.op-lines-table input[type="number"]:focus,
	.op-lines-table input[type="text"]:focus {
		border-color: var(--blue);
		box-shadow: 0 0 0 3px var(--blue-soft);
	}
	.op-lines-table select:disabled {
		background: transparent;
		border-color: transparent;
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		color: transparent;
	}
	.op-line-remove {
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 13px;
		padding: 6px;
	}
	.op-line-remove:hover { color: var(--red); }
	.op-lines-table input.op-comment {
		border-radius: 999px;
		padding-left: 14px;
		padding-right: 14px;
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
	.btn-secondary:hover { background: var(--bg); }
	.btn-confirm {
		background: var(--green);
		border: 1px solid var(--green);
		border-radius: 10px;
		padding: 10px 16px;
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		color: #fff;
		cursor: pointer;
	}
	.btn-confirm:hover { opacity: 0.9; }
`;

export { DRAWER_STYLES, MODAL_STYLES };

function accountOptionsHtml(ctx: TestSubcontoContext): string {
	return ctx.accounts.map((a) => `<option value="${a.code}" title="${escapeHtml(a.name)}">${a.code}</option>`).join("");
}

type OperationModalOptions = {
	idPrefix: string;
	formAction: string;
	title: string;
	submitLabel: string;
	// null — триггер (кнопка-иконка) уже отрисован отдельно, снаружи (см. editOperationModalHtml);
	// иначе — html самой кнопки открытия, рендерится прямо здесь (см. newOperationModalHtml).
	trigger: string | null;
	returnTo: string;
	docDate: string;
	description: string;
	initialLines: TestOperationLineInput[];
	ctx: TestSubcontoContext;
	firm: TestFirmCode;
	// Для editOperationModalStandaloneHtml — модалка сама себя открывает сразу после того, как её
	// скрипт выполнится (без клика по триггеру, которого тут просто нет), а по закрытию не прячется
	// (как постоянные модалки на странице), а удаляет себя из DOM целиком — она была вставлена туда
	// одноразово через fetch+innerHTML (см. openOperationModal в journalTurnoverTest.ts).
	autoOpen?: boolean;
};

// Общее ядро модалки "Операция" — и для создания, и для редактирования (см. newOperationModalHtml/
// editOperationModalHtml ниже). idPrefix делает все id внутри модалки уникальными, чтобы на одной
// странице могло быть несколько экземпляров разом (кнопка создания + модалка редактирования на
// каждой строке таблицы, как в offset.ts). Документ может содержать несколько проводок — строки
// таблицы добавляются динамически в браузере (шаблон строки — только в JS, чтобы не дублировать
// разметку между сервером и клиентом). Каждая строка сама подтягивает субконто по выбранному
// счёту — тот же приём, что и в остальных формах, только тут субконто — id из справочника, а не
// текст (см. debit_subconto_id/credit_subconto_id в схеме test_journal).
function operationModalHtml(opts: OperationModalOptions): string {
	const { idPrefix, formAction, title, submitLabel, trigger, returnTo, docDate, description, initialLines, ctx, firm, autoOpen } = opts;
	const accountOptions = accountOptionsHtml(ctx);
	const overlayId = `${idPrefix}Overlay`;
	const triggerId = `${idPrefix}Trigger`;
	const cancelId = `${idPrefix}Cancel`;
	const addLineId = `${idPrefix}AddLine`;
	const linesId = `${idPrefix}Lines`;

	return `
		${trigger ?? ""}
		<div class="modal-overlay" id="${overlayId}">
			<div class="modal-card op-modal-card">
				<h3>${escapeHtml(title)}</h3>
				<form method="post" action="${formAction}">
					<input type="hidden" name="return_to" value="${escapeHtml(returnTo)}" />
					<input type="hidden" name="firm" value="${firm}" />
					<div class="op-header-panel">
						<div class="op-header-row">
							<div class="op-header-field">
								<span class="drawer-label">от</span>
								<input type="date" name="doc_date" value="${docDate}" required />
							</div>
							<div class="op-header-field">
								<span class="drawer-label">Организация</span>
								<input type="text" value="${escapeHtml(TEST_FIRM_NAME[firm])}" disabled />
							</div>
						</div>
						<div class="op-header-row">
							<div class="op-header-field">
								<span class="drawer-label">Содержание</span>
								<input type="text" name="description" placeholder="Необязательно" value="${escapeHtml(description)}" />
							</div>
						</div>
					</div>

					<button type="button" class="op-add-line" id="${addLineId}">+ Добавить проводку</button>

					<table class="op-lines-table">
						<colgroup>
							<col style="width: 30px;" />
							<col style="width: 90px;" />
							<col />
							<col style="width: 90px;" />
							<col />
							<col style="width: 110px;" />
							<col style="width: 220px;" />
							<col style="width: 28px;" />
						</colgroup>
						<thead>
							<tr>
								<th>№</th>
								<th>Счёт Дт</th>
								<th>Субконто Дт</th>
								<th>Счёт Кт</th>
								<th>Субконто Кт</th>
								<th>Сумма</th>
								<th>Комментарий</th>
								<th></th>
							</tr>
						</thead>
						<tbody id="${linesId}"></tbody>
					</table>

					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${cancelId}">Отмена</button>
						<button type="submit" class="btn-confirm">${escapeHtml(submitLabel)}</button>
					</div>
				</form>
			</div>
		</div>
		<script>
			(function () {
				var accountSubconto = ${JSON.stringify(ctx.accountSubcontoOptions)};
				var accountOptionsHtml = ${JSON.stringify(accountOptions)};
				var initialLines = ${JSON.stringify(initialLines)};
				var FIELD_ORDER = ["op-debit-account", "op-debit-subconto", "op-credit-account", "op-credit-subconto", "op-amount", "op-comment"];
				var tbody = document.getElementById("${linesId}");
				var form = document.querySelector("#${overlayId} form");
				var lineCount = 0;

				// Обычный .focus() на <select> не раскрывает список сам по себе — просто ставит
				// туда фокус. showPicker() (там, где браузер его поддерживает) сразу открывает
				// выпадающее меню, как и требуется при переходе между полями строки.
				function focusField(el) {
					el.focus();
					if (el.tagName === "SELECT" && typeof el.showPicker === "function") {
						try {
							el.showPicker();
						} catch (e) {}
					}
				}

				function renumber() {
					tbody.querySelectorAll(".op-line").forEach(function (row, i) {
						row.querySelector(".op-line-num").textContent = String(i + 1);
					});
				}

				// Общая заливка списка субконто для одной стороны строки — используется и по смене
				// счёта (bindSubconto), и при первичной отрисовке существующей строки документа
				// (addLine(prefill) ниже), где нужно сразу выбрать сохранённое значение.
				function populateSubconto(accountSelect, subcontoSelect, selectedId) {
					var options = accountSubconto[accountSelect.value];
					subcontoSelect.innerHTML = "";
					if (options && options.length) {
						var placeholder = document.createElement("option");
						placeholder.value = "";
						placeholder.textContent = "";
						subcontoSelect.appendChild(placeholder);
						options.forEach(function (o) {
							var opt = document.createElement("option");
							opt.value = String(o.id);
							opt.textContent = o.name;
							if (selectedId != null && o.id === selectedId) opt.selected = true;
							subcontoSelect.appendChild(opt);
						});
						subcontoSelect.disabled = false;
					} else {
						subcontoSelect.disabled = true;
					}
				}

				function bindSubconto(accountSelect, subcontoSelect) {
					accountSelect.addEventListener("change", function () {
						populateSubconto(accountSelect, subcontoSelect, null);
					});
				}

				function updateRemoveVisibility() {
					var lines = tbody.querySelectorAll(".op-line");
					lines.forEach(function (line) {
						line.querySelector(".op-line-remove").style.visibility = lines.length > 1 ? "visible" : "hidden";
					});
				}

				// Позиции строки в порядке заполнения — используется для перехода Enter'ом/сменой
				// значения селекта на следующее поле, как в 1С. Отключённые поля (нет справочника
				// у выбранного счёта) пропускаются.
				function fieldsOfRow(tr) {
					return FIELD_ORDER.map(function (cls) {
						return tr.querySelector("." + cls);
					}).filter(function (el) {
						return el && !el.disabled;
					});
				}

				function advance(el) {
					var tr = el.closest("tr.op-line");
					var fields = fieldsOfRow(tr);
					var i = fields.indexOf(el);
					if (i !== -1 && i < fields.length - 1) {
						focusField(fields[i + 1]);
						return;
					}
					var next = tr.nextElementSibling;
					if (next && next.classList.contains("op-line")) {
						var nextFields = fieldsOfRow(next);
						if (nextFields.length) focusField(nextFields[0]);
					} else {
						addLine(null);
					}
				}

				// prefill — существующая строка документа (при редактировании) или null для новой
				// пустой строки. Пустая строка сразу получает фокус на "Счёт Дт" (см. focusField),
				// предзаполненная — нет, чтобы открытие модалки редактирования не воровало фокус.
				function addLine(prefill) {
					var idx = lineCount++;
					var tr = document.createElement("tr");
					tr.className = "op-line";
					tr.innerHTML =
						'<td class="op-line-num">1</td>' +
						'<td><select name="line_' + idx + '_debit_account" class="op-debit-account" required><option value="">—</option>' + accountOptionsHtml + "</select></td>" +
						'<td><select name="line_' + idx + '_debit_subconto" class="op-debit-subconto" disabled></select></td>' +
						'<td><select name="line_' + idx + '_credit_account" class="op-credit-account" required><option value="">—</option>' + accountOptionsHtml + "</select></td>" +
						'<td><select name="line_' + idx + '_credit_subconto" class="op-credit-subconto" disabled></select></td>' +
						'<td><input type="number" name="line_' + idx + '_amount" class="op-amount" step="0.01" min="0.01" placeholder="0,00" required /></td>' +
						'<td><input type="text" name="line_' + idx + '_comment" class="op-comment" placeholder="Необязательно" /></td>' +
						'<td><button type="button" class="op-line-remove" title="Убрать строку">✕</button></td>';
					tbody.appendChild(tr);

					var debitAcc = tr.querySelector(".op-debit-account");
					var debitSub = tr.querySelector(".op-debit-subconto");
					var creditAcc = tr.querySelector(".op-credit-account");
					var creditSub = tr.querySelector(".op-credit-subconto");
					var amount = tr.querySelector(".op-amount");
					var comment = tr.querySelector(".op-comment");

					bindSubconto(debitAcc, debitSub);
					bindSubconto(creditAcc, creditSub);

					if (prefill) {
						debitAcc.value = prefill.debitAccount;
						populateSubconto(debitAcc, debitSub, prefill.debitSubcontoId);
						creditAcc.value = prefill.creditAccount;
						populateSubconto(creditAcc, creditSub, prefill.creditSubcontoId);
						amount.value = prefill.amount;
						comment.value = prefill.comment || "";
					}

					[debitAcc, debitSub, creditAcc, creditSub].forEach(function (el) {
						el.addEventListener("change", function () {
							advance(el);
						});
						el.addEventListener("keydown", function (e) {
							if (e.key === "Enter") {
								e.preventDefault();
								advance(el);
							}
						});
					});
					[amount, comment].forEach(function (el) {
						el.addEventListener("keydown", function (e) {
							if (e.key === "Enter") {
								e.preventDefault();
								advance(el);
							}
						});
					});

					tr.querySelector(".op-line-remove").addEventListener("click", function () {
						tr.remove();
						updateRemoveVisibility();
						renumber();
					});
					updateRemoveVisibility();
					renumber();
					if (!prefill) focusField(debitAcc);
					return tr;
				}

				document.getElementById("${addLineId}").addEventListener("click", function () {
					addLine(null);
				});

				// Возвращает модалку к исходному состоянию: пустой список строк у "Новой операции",
				// исходные строки документа у редактирования — чтобы отменённое/закрытое
				// редактирование не потеряло prefill при повторном открытии.
				function resetModal() {
					tbody.innerHTML = "";
					lineCount = 0;
					form.reset();
					initialLines.forEach(function (l) {
						addLine(l);
					});
				}

				var overlay = document.getElementById("${overlayId}");
				var trigger = document.getElementById("${triggerId}");
				var cancelBtn = document.getElementById("${cancelId}");

				// autoOpen (см. editOperationModalStandaloneHtml) — модалку вставили в DOM одноразовым
				// fetch+innerHTML специально ради открытия, триггера у неё нет; закрытие тогда не прячет
				// её обратно (она всё равно больше никому не нужна), а удаляет из DOM целиком.
				function closeModal() {
					if (${JSON.stringify(!!autoOpen)}) {
						overlay.remove();
					} else {
						overlay.classList.remove("open");
						resetModal();
					}
				}

				if (trigger) {
					trigger.addEventListener("click", function () {
						overlay.classList.add("open");
					});
				}
				cancelBtn.addEventListener("click", closeModal);

				initialLines.forEach(function (l) {
					addLine(l);
				});

				if (${JSON.stringify(!!autoOpen)}) {
					overlay.classList.add("open");
				}
			})();
		</script>
	`;
}

// Модалка "Новая операция" — общая для Оборотки, Проводок и Журнала операций (см. вызовы в
// journalTurnoverTest.ts / journalListTest.ts / journalDocumentsTest.ts).
export function newOperationModalHtml(returnTo: string, ctx: TestSubcontoContext, firm: TestFirmCode): string {
	return operationModalHtml({
		idPrefix: "newOp",
		formAction: "/operation-document-test",
		title: "Операция (создание)",
		submitLabel: "Добавить",
		trigger: `<button type="button" class="btn-primary" id="newOpTrigger">+ Новая операция</button>`,
		returnTo,
		docDate: todayIso(),
		description: "",
		initialLines: [],
		ctx,
		firm,
	});
}

export type EditableOperationDocument = {
	id: number;
	docDate: string;
	description: string | null;
	lines: TestOperationLineInput[];
};

// Модалка редактирования существующей операции — триггер (кнопка-карандаш) рендерится отдельно
// прямо в строке таблицы (см. journalDocumentsTest.ts), сама модалка — здесь же, после таблицы,
// с уникальным idPrefix на документ (тот же приём, что editDocumentModalHtml в pages/offset.ts).
// firm — той страницы, на которой сейчас редактируем (у документа фирма не меняется, см.
// updateTestOperationDocument — форма её даже не отправляет, это чисто для подписи "Организация").
export function editOperationModalHtml(doc: EditableOperationDocument, returnTo: string, ctx: TestSubcontoContext, firm: TestFirmCode): string {
	return operationModalHtml({
		idPrefix: `editOp${doc.id}`,
		formAction: `/operation-document-test/${doc.id}/update`,
		title: `Операция №${doc.id}`,
		submitLabel: "Сохранить",
		trigger: null,
		returnTo,
		docDate: doc.docDate,
		description: doc.description ?? "",
		initialLines: doc.lines,
		ctx,
		firm,
	});
}

// Та же модалка редактирования, но для одноразовой вставки на ЛЮБУЮ страницу через fetch —
// открывается сама сразу после вставки (autoOpen), без клика по триггеру и без постоянного места
// в разметке страницы (см. openOperationModal в journalTurnoverTest.ts — переход с Карточки счёта
// "по проводке" на её документ без ухода со страницы). idPrefix отдельный от editOperationModalHtml,
// чтобы не столкнуться id-ами, если когда-нибудь окажутся на одной странице одновременно.
export function editOperationModalStandaloneHtml(doc: EditableOperationDocument, returnTo: string, ctx: TestSubcontoContext, firm: TestFirmCode): string {
	return operationModalHtml({
		idPrefix: `stdOp${doc.id}`,
		formAction: `/operation-document-test/${doc.id}/update`,
		title: `Операция №${doc.id}`,
		submitLabel: "Сохранить",
		trigger: null,
		returnTo,
		docDate: doc.docDate,
		description: doc.description ?? "",
		initialLines: doc.lines,
		ctx,
		firm,
		autoOpen: true,
	});
}

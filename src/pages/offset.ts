import { renderPage } from "../layout";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, DRAWER_STYLES, MODAL_STYLES, renderConfirmModal, editIconSvg, deleteIconSvg } from "../ui";
import { escapeHtml, formatMoney, isoToDisplay, periodRangeFromToken, resolvePeriodToken, todayIso } from "../format";
import { CHART_OF_ACCOUNTS } from "../accounting";
import { buildAccountSubcontoMap } from "./accounting";
import { listOffsetDocuments, type OffsetDocument } from "../offset";

const STYLES = `
	.topbar { justify-content: flex-start; }
	.topbar h1 { white-space: nowrap; }
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
	.muted { color: var(--text-muted); font-size: 12px; }
	.doc-title { font-weight: 600; }
	.row-actions { text-align: right; white-space: nowrap; }
	.row-actions .btn-secondary {
		padding: 6px 10px;
		font-size: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: 6px;
	}
	.topbar-actions .btn-primary { font: inherit; cursor: pointer; }
	.modal-card {
		width: 460px;
	}
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
	.modal-card form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.modal-card .modal-actions {
		margin-top: 4px;
	}
	.offset-direction {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.offset-direction label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	.offset-direction input[type="radio"] {
		accent-color: var(--blue);
	}
	.offset-pair-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
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

function accountLabel(code: string): string {
	const acc = CHART_OF_ACCOUNTS.find((a) => a.code === code);
	return acc ? `${code} — ${acc.name}` : code;
}

function accountOptionsHtml(selected?: string): string {
	return CHART_OF_ACCOUNTS.map((a) => `<option value="${a.code}" ${a.code === selected ? "selected" : ""}>${a.code} — ${escapeHtml(a.name)}</option>`).join("\n");
}

// Пара Счёт+Субконто — используется дважды в документе (сторона Котопанды и сторона Элитки).
// Субконто-подсказки подтягиваются тем же способом, что и в обычной проводке (см. journalFieldsHtml
// в pages/accounting.ts) — по выбранному счёту, из общего плана счетов; prefillAccount/prefillSubconto
// заполняются при редактировании существующего документа.
function accountPairFieldsHtml(idPrefix: string, label: string, prefillAccount?: string, prefillSubconto?: string | null): string {
	return `
		<div class="drawer-field">
			<span class="drawer-label">${label}: счёт</span>
			<select name="${idPrefix}_account" id="${idPrefix}AccountSelect" required>
				<option value="">Выберите счёт</option>
				${accountOptionsHtml(prefillAccount)}
			</select>
		</div>
		<div class="drawer-field">
			<span class="drawer-label">${label}: субконто</span>
			<select name="${idPrefix}_subconto" id="${idPrefix}SubcontoSelect" hidden>
				<option value="">Не выбрано</option>
			</select>
			<input type="text" name="${idPrefix}_subconto" id="${idPrefix}SubcontoText" placeholder="необязательно" value="${prefillSubconto ? escapeHtml(prefillSubconto) : ""}" />
		</div>
	`;
}

// initial1/initial2 — текущее субконто каждой пары при редактировании (null для создания нового
// документа) — сразу после привязки подбирает, показывать ли селект (и что в нём выбрано) или
// текстовое поле, в зависимости от того, есть ли у выбранного счёта справочник.
function bindAccountSubcontoScript(idPrefix1: string, idPrefix2: string, accountSubcontoMap: Record<string, string[]>, initial1: string | null, initial2: string | null): string {
	return `
		<script>
			(function () {
				var accountSubconto = ${JSON.stringify(accountSubcontoMap)};

				function bindAccountSubconto(accountSelectId, subcontoSelectId, subcontoTextId, initial) {
					var accountSelect = document.getElementById(accountSelectId);
					var subcontoSelect = document.getElementById(subcontoSelectId);
					var subcontoText = document.getElementById(subcontoTextId);

					function sync(preselect) {
						var names = accountSubconto[accountSelect.value];
						if (names) {
							subcontoSelect.innerHTML = '<option value="">Не выбрано</option>';
							names.forEach(function (name) {
								var opt = document.createElement("option");
								opt.value = name;
								opt.textContent = name;
								subcontoSelect.appendChild(opt);
							});
							if (preselect) subcontoSelect.value = preselect;
							subcontoSelect.hidden = false;
							subcontoSelect.disabled = false;
							subcontoText.hidden = true;
							subcontoText.disabled = true;
							subcontoText.value = "";
						} else {
							subcontoSelect.hidden = true;
							subcontoSelect.disabled = true;
							subcontoText.hidden = false;
							subcontoText.disabled = false;
						}
					}

					accountSelect.addEventListener("change", function () { sync(null); });
					sync(initial);
				}

				bindAccountSubconto("${idPrefix1}AccountSelect", "${idPrefix1}SubcontoSelect", "${idPrefix1}SubcontoText", ${JSON.stringify(initial1)});
				bindAccountSubconto("${idPrefix2}AccountSelect", "${idPrefix2}SubcontoSelect", "${idPrefix2}SubcontoText", ${JSON.stringify(initial2)});
			})();
		</script>
	`;
}

type OffsetFormPrefill = {
	direction: OffsetDocument["direction"];
	docDate: string;
	kotopandaAccount: string;
	kotopandaSubconto: string | null;
	elitkaAccount: string;
	elitkaSubconto: string | null;
	amount: number;
	description: string | null;
};

// Общая форма документа — используется и для создания, и для редактирования (см. вызовы ниже).
// Направление определяет, чья сторона "даёт" (проводится через субконто Взаимозачёта как
// Кт 30/офсет), а чья "получает" (Дт 30/офсет) — см. createOffsetDocument в src/offset.ts.
function offsetFormFieldsHtml(idPrefix: string, prefill?: OffsetFormPrefill): string {
	return `
		<div class="drawer-field">
			<span class="drawer-label">Направление</span>
			<div class="offset-direction">
				<label><input type="radio" name="direction" value="kotopanda_to_elitka" ${!prefill || prefill.direction === "kotopanda_to_elitka" ? "checked" : ""} /> Котопанда даёт Элитке</label>
				<label><input type="radio" name="direction" value="elitka_to_kotopanda" ${prefill?.direction === "elitka_to_kotopanda" ? "checked" : ""} /> Элитка даёт Котопанде</label>
			</div>
		</div>
		<div class="drawer-field">
			<span class="drawer-label">Дата</span>
			<input type="date" name="entry_date" value="${prefill ? prefill.docDate : todayIso()}" required />
		</div>
		<div class="offset-pair-grid">
			${accountPairFieldsHtml(`${idPrefix}Account1`, "Котопанда", prefill?.kotopandaAccount, prefill?.kotopandaSubconto)}
			${accountPairFieldsHtml(`${idPrefix}Account2`, "Элитка", prefill?.elitkaAccount, prefill?.elitkaSubconto)}
		</div>
		<div class="drawer-field">
			<span class="drawer-label">Сумма, грн</span>
			<input type="number" name="amount" step="0.01" min="0.01" value="${prefill ? prefill.amount : ""}" required />
		</div>
		<div class="drawer-field">
			<span class="drawer-label">Комментарий</span>
			<input type="text" name="description" placeholder="Необязательно" value="${prefill?.description ? escapeHtml(prefill.description) : ""}" />
		</div>
	`;
}

function newDocumentModalHtml(period: string, accountSubcontoMap: Record<string, string[]>): string {
	return `
		<button type="button" class="btn-primary" id="newOffsetTrigger">+ Новый документ</button>
		<div class="modal-overlay" id="newOffsetOverlay">
			<div class="modal-card">
				<h3>Новый документ взаимозачёта</h3>
				<form method="post" action="/offset">
					<input type="hidden" name="period" value="${period}" />
					${offsetFormFieldsHtml("offset")}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="newOffsetCancel">Отмена</button>
						<button type="submit" class="btn-confirm">Добавить</button>
					</div>
				</form>
			</div>
		</div>
		${bindAccountSubcontoScript("offsetAccount1", "offsetAccount2", accountSubcontoMap, null, null)}
		<script>
			(function () {
				var overlay = document.getElementById("newOffsetOverlay");
				var trigger = document.getElementById("newOffsetTrigger");
				var cancelBtn = document.getElementById("newOffsetCancel");
				trigger.addEventListener("click", function () {
					overlay.classList.add("open");
				});
				cancelBtn.addEventListener("click", function () {
					overlay.classList.remove("open");
				});
				overlay.addEventListener("click", function (e) {
					if (e.target === overlay) overlay.classList.remove("open");
				});
			})();
		</script>
	`;
}

// Модалка редактирования — триггер (кнопка-карандаш) лежит в строке таблицы, а сама модалка
// со скриптом привязки рендерится отдельно, после таблицы (см. renderOffsetPage) — иначе
// document.getElementById её кнопки-триггера ещё не найдёт в DOM (уже наступали на эти грабли
// на странице Проводок).
function editDocumentModalHtml(doc: OffsetDocument, period: string, accountSubcontoMap: Record<string, string[]>): string {
	const prefix = `editOffset${doc.id}`;
	return `
		<div class="modal-overlay" id="${prefix}Overlay">
			<div class="modal-card">
				<h3>Взаимозачёт №${doc.id}</h3>
				<form method="post" action="/offset/${doc.id}/update">
					<input type="hidden" name="period" value="${period}" />
					${offsetFormFieldsHtml(prefix, {
						direction: doc.direction,
						docDate: doc.docDate,
						kotopandaAccount: doc.kotopandaAccount,
						kotopandaSubconto: doc.kotopandaSubconto,
						elitkaAccount: doc.elitkaAccount,
						elitkaSubconto: doc.elitkaSubconto,
						amount: doc.amount,
						description: doc.description,
					})}
					<div class="modal-actions">
						<button type="button" class="btn-secondary" id="${prefix}Cancel">Отмена</button>
						<button type="submit" class="btn-confirm">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
		${bindAccountSubcontoScript(`${prefix}Account1`, `${prefix}Account2`, accountSubcontoMap, doc.kotopandaSubconto, doc.elitkaSubconto)}
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
				overlay.addEventListener("click", function (e) {
					if (e.target === overlay) overlay.classList.remove("open");
				});
			})();
		</script>
	`;
}

function documentRowHtml(doc: OffsetDocument, period: string): string {
	const directionLabel = doc.direction === "kotopanda_to_elitka" ? "Котопанда → Элитка" : "Элитка → Котопанда";
	return `
		<tr>
			<td>${isoToDisplay(doc.docDate)}</td>
			<td>
				<div class="doc-title">Взаимозачёт №${doc.id} · ${directionLabel}</div>
				<div class="muted">${escapeHtml(accountLabel(doc.kotopandaAccount))}${doc.kotopandaSubconto ? ` / ${escapeHtml(doc.kotopandaSubconto)}` : ""} ⇄ ${escapeHtml(accountLabel(doc.elitkaAccount))}${doc.elitkaSubconto ? ` / ${escapeHtml(doc.elitkaSubconto)}` : ""}</div>
				<div>${formatMoney(doc.amount)} грн${doc.description ? ` · ${escapeHtml(doc.description)}` : ""}</div>
			</td>
			<td class="row-actions">
				<button type="button" class="btn-secondary" id="editOffset${doc.id}Trigger" title="Редактировать">${editIconSvg()}</button>
				${renderConfirmModal({
					id: `deleteOffset${doc.id}`,
					triggerLabel: deleteIconSvg(),
					triggerClass: "btn-secondary",
					title: "Удалить документ?",
					message: "Удалятся обе проводки — и в книге Котопанда, и в книге Элитка.",
					confirmLabel: "Удалить",
					formAction: `/offset/${doc.id}/delete`,
					hiddenFields: { period },
				})}
			</td>
		</tr>`;
}

export async function renderOffsetPage(env: Env, url: URL): Promise<string> {
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);
	const [accountSubcontoMap, documents] = await Promise.all([buildAccountSubcontoMap(env), listOffsetDocuments(env, from, to)]);

	const rowsHtml = documents.length
		? documents.map((doc) => documentRowHtml(doc, period)).join("\n")
		: `<tr><td colspan="3" class="empty-state">За этот период документов нет</td></tr>`;

	const editModalsHtml = documents.map((doc) => editDocumentModalHtml(doc, period, accountSubcontoMap)).join("\n");

	const content = `
	<style>${STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${MODAL_STYLES}</style>
	<div class="topbar">
		<h1>Взаимозачёт</h1>
		<div class="topbar-actions">
			${renderPeriodPicker("/offset", period, from, to)}
			${newDocumentModalHtml(period, accountSubcontoMap)}
		</div>
	</div>

	<div class="table-card">
		<table>
			<thead>
				<tr>
					<th>Дата</th>
					<th>Документ</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
			</tbody>
		</table>
	</div>

	${editModalsHtml}
	`;

	return renderPage("/offset", "Взаимозачёт", content);
}

import { renderPage } from "../layout";
import { escapeHtml, formatMoney, isoToDisplay, periodRangeFromToken, resolvePeriodToken } from "../format";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, SUB_TABS_STYLES, renderSubTabs, MODAL_STYLES, DRAWER_STYLES } from "../ui";
import {
	loadTestSubcontoContext,
	resolveSubcontoName,
	getTestAccountCard,
	getTestOperationDocument,
	resolveTestFirmId,
	type TestSubcontoContext,
	type TestAccountCardRow,
	type TestFirmCode,
} from "../operationDocumentTest";
import { listTestJournalUpTo, type TestJournalRow } from "../journalTest";
import { operationTestTabs, newOperationModalHtml, editOperationModalStandaloneHtml, OPERATION_MODAL_STYLES } from "./operationDocumentTest";

// Вёрстка — в духе печатной ОСВ 1С, как и промотированная боевая Оборотка (см. OSV_STYLES/
// OSV2_STYLES в pages/accounting.ts): белый фон, тонкие границы, зелёные заголовки групп,
// сворачиваемые субконто-строки под счётом.
const STYLES = `
	.topbar { justify-content: flex-start; }
	.topbar h1 { white-space: nowrap; }
	.topbar-actions .btn-primary { font: inherit; cursor: pointer; }
	.osv-card {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 20px;
	}
	.osv-table {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		font-size: 13px;
	}
	.osv-table th, .osv-table td {
		border: 1px solid #dde3da;
		text-align: right;
		font-variant-numeric: tabular-nums;
		padding: 6px 10px;
	}
	.osv-table th:first-child, .osv-table td:first-child {
		text-align: left;
	}
	.osv-table thead .osv-grp {
		background: #eaf3ea;
		color: #2f6b45;
		font-size: 12px;
		font-weight: 700;
		text-align: center;
	}
	.osv-table thead .osv-sub {
		background: #f4f8f3;
		color: #5c7d64;
		font-size: 11px;
		font-weight: 600;
		text-align: center;
	}
	.osv-table thead .osv-acc-head {
		background: #eaf3ea;
		color: #2f6b45;
	}
	.osv-acc { font-weight: 700; }
	.osv-sub-row td { background: #fffdf3; }
	.osv-sub-row .osv-acc {
		font-weight: 400;
		padding-left: 24px;
		color: var(--text-muted);
	}
	.osv-sub-row.osv-hidden { display: none; }
	.osv-drill-icon {
		display: inline-block;
		color: var(--text-muted);
		font-size: 10px;
		margin-left: 6px;
		transition: transform 0.15s ease;
	}
	.osv-account-row.osv-open .osv-drill-icon {
		transform: rotate(90deg);
		color: #2f6b45;
	}
	.osv-account-row.osv-toggle { cursor: pointer; user-select: none; }
	.osv-account-row.osv-toggle:hover td { background: #eef3ee; }
	.osv-total-row td {
		font-weight: 700;
		background: #f5f6f5;
		border-top: 2px solid var(--border);
	}
	.osv-table td.zero { color: var(--border); font-weight: 400; }
	.empty-state { padding: 40px 16px; text-align: center; color: var(--text-muted); }
	.osv-table tbody tr.osv-clickable { cursor: pointer; }
	.osv-table tbody tr.osv-clickable:hover td { background: #eef3ee; }
	.osv-table tbody tr.osv-sub-row.osv-clickable:hover td { background: #f7f2dc; }
	.muted { color: var(--text-muted); }
	.osv-card-block {
		background: #fff;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 16px;
		position: relative;
		margin-top: 20px;
	}
	.osv-card-header { margin-bottom: 14px; }
	.osv-card-header h2 { margin: 0; font-size: 16px; }
	.osv-card-period { color: var(--text-muted); font-size: 12px; margin-top: 2px; }
	.osv-card-table-wrap { overflow-x: auto; }
	.osv-card-table { min-width: 900px; }
	.osv-card-table td.osv-cell-left, .osv-card-table th.osv-cell-left { text-align: left; }
	.osv-card-table td.osv-op-cell { white-space: normal; word-break: break-word; max-width: 360px; }
	.osv-bal-d, .osv-bal-k { font-weight: 700; }
	.osv-bal-d { color: var(--text); }
	.osv-bal-k { color: var(--red); }
	.osv-card-close {
		position: absolute;
		top: 12px;
		right: 12px;
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 8px;
		width: 28px;
		height: 28px;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 13px;
	}
	.osv-card-close:hover { color: var(--text); }
	.osv-table.osv-card-table .osv-totals-row td {
		font-weight: 700;
		background: #f5f6f5;
		border-top: 2px solid var(--border);
	}
	.osv-card-row-clickable { cursor: pointer; }
	.osv-card-row-clickable:hover td { background: #eef3ee; }
`;

function isZeroAmount(value: number): boolean {
	return Math.abs(value) < 0.005;
}

function cell(value: number): string {
	return isZeroAmount(value) ? `<span class="zero">—</span>` : formatMoney(value);
}

type Totals = { debit: number; credit: number };
type TurnoverRow = { key: string; label: string; openingDebit: number; openingCredit: number; turnoverDebit: number; turnoverCredit: number; closingDebit: number; closingCredit: number };

function buildRows(opening: Map<string, { label: string; totals: Totals }>, turnover: Map<string, { label: string; totals: Totals }>): TurnoverRow[] {
	const keys = new Set<string>([...opening.keys(), ...turnover.keys()]);
	return [...keys]
		.map((key) => {
			const op = opening.get(key)?.totals ?? { debit: 0, credit: 0 };
			const tu = turnover.get(key)?.totals ?? { debit: 0, credit: 0 };
			const label = opening.get(key)?.label ?? turnover.get(key)?.label ?? key;
			const openNet = op.debit - op.credit;
			const closeNet = openNet + tu.debit - tu.credit;
			return {
				key,
				label,
				openingDebit: openNet > 0 ? openNet : 0,
				openingCredit: openNet < 0 ? -openNet : 0,
				turnoverDebit: tu.debit,
				turnoverCredit: tu.credit,
				closingDebit: closeNet > 0 ? closeNet : 0,
				closingCredit: closeNet < 0 ? -closeNet : 0,
			};
		})
		.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

function sumByAccount(rows: TestJournalRow[]): Map<string, { label: string; totals: Totals }> {
	const map = new Map<string, { label: string; totals: Totals }>();
	for (const r of rows) {
		const d = map.get(r.debitAccount) ?? { label: r.debitAccount, totals: { debit: 0, credit: 0 } };
		d.totals.debit += r.amount;
		map.set(r.debitAccount, d);

		const c = map.get(r.creditAccount) ?? { label: r.creditAccount, totals: { debit: 0, credit: 0 } };
		c.totals.credit += r.amount;
		map.set(r.creditAccount, c);
	}
	return map;
}

const NO_SUBCONTO = "__none__";

// Разбивка по субконто для ОДНОГО счёта (обе стороны, где он встречается) — id-шные
// debit_subconto_id/credit_subconto_id переводим в читаемое имя через resolveSubcontoName.
function sumBySubconto(rows: TestJournalRow[], account: string, ctx: TestSubcontoContext): Map<string, { label: string; totals: Totals }> {
	const map = new Map<string, { label: string; totals: Totals }>();
	for (const r of rows) {
		if (r.debitAccount === account) {
			const key = r.debitSubcontoId !== null ? `id:${r.debitSubcontoId}` : NO_SUBCONTO;
			const label = r.debitSubcontoId !== null ? (resolveSubcontoName(ctx, account, r.debitSubcontoId) ?? String(r.debitSubcontoId)) : "Без субконто";
			const entry = map.get(key) ?? { label, totals: { debit: 0, credit: 0 } };
			entry.totals.debit += r.amount;
			map.set(key, entry);
		}
		if (r.creditAccount === account) {
			const key = r.creditSubcontoId !== null ? `id:${r.creditSubcontoId}` : NO_SUBCONTO;
			const label = r.creditSubcontoId !== null ? (resolveSubcontoName(ctx, account, r.creditSubcontoId) ?? String(r.creditSubcontoId)) : "Без субконто";
			const entry = map.get(key) ?? { label, totals: { debit: 0, credit: 0 } };
			entry.totals.credit += r.amount;
			map.set(key, entry);
		}
	}
	return map;
}

function osvRow(labelHtml: string, r: TurnoverRow, attrs: string): string {
	return `
		<tr ${attrs}>
			<td class="osv-acc">${labelHtml}</td>
			<td>${cell(r.openingDebit)}</td>
			<td>${cell(r.openingCredit)}</td>
			<td>${cell(r.turnoverDebit)}</td>
			<td>${cell(r.turnoverCredit)}</td>
			<td>${cell(r.closingDebit)}</td>
			<td>${cell(r.closingCredit)}</td>
		</tr>`;
}

// Тестовая Оборотка — читает ТОЛЬКО test_journal одним SQL-запросом на весь диапазон "с начала
// времён до конца периода" (см. listTestJournalUpTo), делит на "остаток на начало"/"обороты
// периода" уже в JS по entry_date — ни джойнов, ни обращения к test_documents. Субконто
// сворачиваемые, как в боевой Обороте (см. OSV2 в accounting.ts). firm — какую из книг (Котопанда/
// Элитка) показываем, тот же приём, что Ledger у боевой Бухгалтерии (см. accountingLedgerMatch
// в index.ts) — своя фирма в пути у каждого из связанных роутов (страница, карточка счёта, модалка
// документа), чтобы они не перепутались между книгами.
export async function renderJournalTurnoverTestPage(env: Env, url: URL, firm: TestFirmCode): Promise<string> {
	const firmId = await resolveTestFirmId(env, firm);
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);

	const ctx = await loadTestSubcontoContext(env);

	const rowsUpTo = await listTestJournalUpTo(env, firmId, to);
	const openingRows = rowsUpTo.filter((r) => r.entryDate < from);
	const periodRows = rowsUpTo.filter((r) => r.entryDate >= from && r.entryDate <= to);

	const opening = sumByAccount(openingRows);
	const turnover = sumByAccount(periodRows);
	// Служебные счета вроде "00" (ввод остатков через вспомогательный счёт, см. CHART_OF_ACCOUNTS)
	// по построению всегда сводятся в ноль — дебет и кредит гасят друг друга и на начало,
	// и на конец периода. Показывать такую пустую строку в ОСВ незачем (как и в 1С).
	const rows = buildRows(opening, turnover).filter(
		(r) => !isZeroAmount(r.openingDebit) || !isZeroAmount(r.openingCredit) || !isZeroAmount(r.turnoverDebit) || !isZeroAmount(r.turnoverCredit) || !isZeroAmount(r.closingDebit) || !isZeroAmount(r.closingCredit),
	);

	const totals = rows.reduce(
		(acc, r) => ({
			openingDebit: acc.openingDebit + r.openingDebit,
			openingCredit: acc.openingCredit + r.openingCredit,
			turnoverDebit: acc.turnoverDebit + r.turnoverDebit,
			turnoverCredit: acc.turnoverCredit + r.turnoverCredit,
			closingDebit: acc.closingDebit + r.closingDebit,
			closingCredit: acc.closingCredit + r.closingCredit,
		}),
		{ openingDebit: 0, openingCredit: 0, turnoverDebit: 0, turnoverCredit: 0, closingDebit: 0, closingCredit: 0 },
	);

	function cardHref(account: string, subcontoParam?: string): string {
		const params = new URLSearchParams({ account, period });
		if (subcontoParam !== undefined) params.set("subconto_id", subcontoParam);
		return `/accounting/${firm}/card/fragment?${params.toString()}`;
	}

	const rowsHtml = rows.length
		? rows
				.map((r) => {
					const accountOpening = openingRows.filter((row) => row.debitAccount === r.key || row.creditAccount === r.key);
					const accountPeriod = periodRows.filter((row) => row.debitAccount === r.key || row.creditAccount === r.key);
					const subOpening = sumBySubconto(accountOpening, r.key, ctx);
					const subPeriod = sumBySubconto(accountPeriod, r.key, ctx);
					// Тот же фильтр пустых строк, что и на уровне счёта (см. фильтр rows выше) — субконто,
					// у которого дебет и кредит за всё время до конца периода сошлись в ноль (например,
					// разнесли и тут же сняли разноску, или движение туда-обратно погасило само себя),
					// незачем показывать отдельной строкой в разбивке.
					const subRows = buildRows(subOpening, subPeriod).filter(
						(sr) =>
							!isZeroAmount(sr.openingDebit) ||
							!isZeroAmount(sr.openingCredit) ||
							!isZeroAmount(sr.turnoverDebit) ||
							!isZeroAmount(sr.turnoverCredit) ||
							!isZeroAmount(sr.closingDebit) ||
							!isZeroAmount(sr.closingCredit),
					);
					const hasRealSubconto = subRows.some((sr) => sr.key !== NO_SUBCONTO);

					// Счёт без субконто-разбивки — клик сразу открывает Карточку счёта; со
					// счётом с субконто клик по строке счёта только сворачивает/разворачивает
					// (как раньше), а открывает карточку клик по конкретной строке субконто —
					// так же, как в боевой Обороте (см. renderOsvTurnoverPage в accounting.ts).
					const label = hasRealSubconto ? `${escapeHtml(r.key)}<span class="osv-drill-icon">▸</span>` : escapeHtml(r.key);
					const accountAttrs = hasRealSubconto
						? `class="osv-account-row osv-toggle" data-account="${escapeHtml(r.key)}"`
						: `class="osv-account-row osv-clickable" data-href="${cardHref(r.key)}"`;
					const accountRowHtml = osvRow(label, r, accountAttrs);

					const subRowsHtml = hasRealSubconto
						? subRows
								.map((sr) => {
									const subcontoParam = sr.key === NO_SUBCONTO ? "none" : sr.key.slice(3);
									return osvRow(
										escapeHtml(sr.label),
										sr,
										`class="osv-sub-row osv-clickable osv-hidden" data-parent="${escapeHtml(r.key)}" data-href="${cardHref(r.key, subcontoParam)}"`,
									);
								})
								.join("\n")
						: "";

					return accountRowHtml + subRowsHtml;
				})
				.join("\n")
		: `<tr><td colspan="7" class="empty-state">За этот период проводок нет</td></tr>`;

	const totalsRowHtml = rows.length
		? `
		<tr class="osv-total-row">
			<td>Итого</td>
			<td>${cell(totals.openingDebit)}</td>
			<td>${cell(totals.openingCredit)}</td>
			<td>${cell(totals.turnoverDebit)}</td>
			<td>${cell(totals.turnoverCredit)}</td>
			<td>${cell(totals.closingDebit)}</td>
			<td>${cell(totals.closingCredit)}</td>
		</tr>`
		: "";

	const basePath = `/accounting/${firm}`;
	const returnTo = `${basePath}?period=${encodeURIComponent(period)}`;
	const title = `Бухгалтерия ${firm === "kotopanda" ? "Котопанда" : "Элитка"}`;

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${MODAL_STYLES}${OPERATION_MODAL_STYLES}</style>
	<div class="topbar">
		<h1>${title}</h1>
		<div class="topbar-actions">
			${renderPeriodPicker(basePath, period, from, to)}
			${newOperationModalHtml(returnTo, ctx, firm)}
		</div>
	</div>
	${renderSubTabs(operationTestTabs(firm), basePath)}

	<div class="osv-card">
		<table class="osv-table" id="osvTable">
			<colgroup>
				<col style="width: 320px;" />
				<col /><col /><col /><col /><col /><col />
			</colgroup>
			<thead>
				<tr>
					<th rowspan="2" class="osv-acc-head">Счёт</th>
					<th colspan="2" class="osv-grp">Сальдо на начало периода</th>
					<th colspan="2" class="osv-grp">Обороты за период</th>
					<th colspan="2" class="osv-grp">Сальдо на конец периода</th>
				</tr>
				<tr>
					<th class="osv-sub">Дебет</th><th class="osv-sub">Кредит</th>
					<th class="osv-sub">Дебет</th><th class="osv-sub">Кредит</th>
					<th class="osv-sub">Дебет</th><th class="osv-sub">Кредит</th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
				${totalsRowHtml}
			</tbody>
		</table>
	</div>

	<div id="accountCardContainer"></div>

	<script>
		(function () {
			var container = document.getElementById("accountCardContainer");

			// Открывает модалку документа поверх текущей страницы, без перехода куда-либо —
			// фрагмент (см. editOperationModalStandaloneHtml/renderJournalTurnoverTestOperationModalFragment)
			// сам открывается и сам убирает себя из DOM при закрытии. innerHTML не выполняет <script>,
			// поэтому переносим узлы фрагмента в body вручную, а для script — пересоздаём элемент,
			// чтобы браузер его выполнил, и сразу убираем — дальше он уже не нужен.
			function openOperationModal(href) {
				fetch(href)
					.then(function (r) { return r.text(); })
					.then(function (html) {
						var temp = document.createElement("div");
						temp.innerHTML = html;
						Array.prototype.slice.call(temp.childNodes).forEach(function (node) {
							if (node.tagName === "SCRIPT") {
								var s = document.createElement("script");
								s.text = node.textContent;
								document.body.appendChild(s);
								s.remove();
							} else {
								document.body.appendChild(node);
							}
						});
					});
			}

			function openCard(href) {
				fetch(href)
					.then(function (r) { return r.text(); })
					.then(function (html) {
						container.innerHTML = html;
						var closeBtn = document.getElementById("accountCardClose");
						if (closeBtn) {
							closeBtn.addEventListener("click", function () {
								container.innerHTML = "";
							});
						}
						// Клик по строке карточки — открывает документ, которым эта проводка создана,
						// модалкой поверх страницы (см. openOperationModal выше), без ухода с Оборотки.
						// Исключение — документ "Касса" (data-nav): у него нет модалки-аналога (он
						// редактируется каскадом Тип/Вид/Субконто на своей странице, см. pages/cashTest.ts),
						// поэтому это обычный переход на день этой кассы.
						container.querySelectorAll(".osv-card-row-clickable").forEach(function (row) {
							row.addEventListener("click", function () {
								if (row.dataset.nav) {
									window.location.href = row.dataset.href;
								} else {
									openOperationModal(row.dataset.href);
								}
							});
						});
						container.scrollIntoView({ behavior: "smooth", block: "start" });
					});
			}

			document.querySelectorAll("#osvTable tbody tr.osv-toggle").forEach(function (row) {
				row.addEventListener("click", function () {
					var account = row.dataset.account;
					var wasOpen = row.classList.contains("osv-open");
					document.querySelectorAll('#osvTable tbody tr.osv-sub-row[data-parent="' + account + '"]').forEach(function (subRow) {
						subRow.classList.toggle("osv-hidden", wasOpen);
					});
					row.classList.toggle("osv-open", !wasOpen);
				});
			});

			document.querySelectorAll("#osvTable tbody tr.osv-clickable").forEach(function (row) {
				row.addEventListener("click", function (e) {
					e.stopPropagation();
					openCard(row.dataset.href);
				});
			});
		})();
	</script>
	`;

	return renderPage(basePath, title, content, env);
}

function testAccountLabel(ctx: TestSubcontoContext, code: string): string {
	const acc = ctx.accounts.find((a) => a.code === code);
	return acc ? `${code} — ${acc.name}` : code;
}

function osvCardBalanceHtml(balance: number): string {
	if (isZeroAmount(balance)) return `<span class="zero">—</span>`;
	return `<span class="${balance > 0 ? "osv-bal-d" : "osv-bal-k"}">${balance > 0 ? "Д" : "К"} ${formatMoney(Math.abs(balance))}</span>`;
}

// Блок карточки счёта — вёрстка 1:1 с боевой renderOsvAccountCardBlock (accounting.ts), только
// источник данных — getTestAccountCard (test_journal). "Документ" всегда "Операция №N" — пока
// у тестового журнала есть только один тип документа (doc_type='manual', см. migrations/0036).
// Каждая строка кликабельна — открывает документ, которым эта проводка создана, прямо здесь же,
// модалкой поверх Оборотки, без ухода со страницы (см. openOperationModal в скрипте
// renderJournalTurnoverTestPage и renderJournalTurnoverTestOperationModalFragment ниже). Сейчас
// это всегда Операция — когда появятся другие типы документов, тут нужно будет завести ссылку
// под каждый тип.
function renderTestAccountCardBlock(
	ctx: TestSubcontoContext,
	accountCode: string,
	subcontoLabel: string | null,
	from: string,
	to: string,
	period: string,
	firm: TestFirmCode,
	data: { openingBalance: number; rows: TestAccountCardRow[]; closingBalance: number },
): string {
	const { openingBalance, rows, closingBalance } = data;

	const rowsHtml = rows.length
		? rows
				.map((r) => {
					const debitAcc = !isZeroAmount(r.debit) ? accountCode : r.counterAccount;
					const creditAcc = !isZeroAmount(r.credit) ? accountCode : r.counterAccount;
					// Документ "Касса" редактируется не универсальной сеткой Дт/Кт (та — только для
					// doc_type='manual', см. editOperationModalStandaloneHtml), а Кассой (тест) со своим
					// каскадом Тип/Вид/Субконто (см. pages/cashTest.ts) — так что вместо модалки поверх
					// Оборотки просто переходим на день этой кассы, где та же проводка редактируется как
					// положено. См. data-nav в скрипте ниже. Документ "Банк" — аналогично: правится только
					// через drawer на /bank (см. bankPostingTest.ts, syncBankPosting), иначе правка через
					// универсальную сетку рассинхронит bank_transactions.posting_account с журналом.
					const isCash = r.docType === "cash";
					const isBank = r.docType === "bank";
					const documentHref = isCash
						? `/cash-test/${firm}?period=${encodeURIComponent(period)}&date=${r.date}`
						: isBank
							? `/bank?period=${encodeURIComponent(period)}`
							: `/accounting/${firm}/operation-modal?period=${encodeURIComponent(period)}&id=${r.documentId}`;
					const documentLabel = isCash ? `Касса №${r.documentId}` : isBank ? `Банк №${r.documentId}` : `Операция №${r.documentId}`;
					return `
				<tr class="osv-card-row-clickable" data-href="${documentHref}" ${isCash || isBank ? 'data-nav="1"' : ""}>
					<td>${isoToDisplay(r.date)}</td>
					<td class="muted osv-cell-left">${documentLabel}</td>
					<td class="osv-op-cell osv-cell-left">${escapeHtml(r.description)}</td>
					<td class="osv-acc osv-cell-left">${escapeHtml(debitAcc)}</td>
					<td>${!isZeroAmount(r.debit) ? formatMoney(r.debit) : ""}</td>
					<td class="osv-acc osv-cell-left">${escapeHtml(creditAcc)}</td>
					<td>${!isZeroAmount(r.credit) ? formatMoney(r.credit) : ""}</td>
					<td>${osvCardBalanceHtml(r.balance)}</td>
				</tr>`;
				})
				.join("\n")
		: `<tr><td colspan="8" class="empty-state">За этот период движений по счёту нет</td></tr>`;

	const turnoverDebit = rows.reduce((sum, r) => sum + r.debit, 0);
	const turnoverCredit = rows.reduce((sum, r) => sum + r.credit, 0);

	return `
		<div class="osv-card-header">
			<h2>Карточка счёта — ${escapeHtml(testAccountLabel(ctx, accountCode))}${subcontoLabel ? ` / ${escapeHtml(subcontoLabel)}` : ""}</h2>
			<div class="osv-card-period">за ${isoToDisplay(from)} – ${isoToDisplay(to)}</div>
		</div>
		<div class="osv-card-table-wrap">
		<table class="osv-table osv-card-table">
			<thead>
				<tr>
					<th rowspan="2">Дата</th>
					<th rowspan="2" class="osv-cell-left">Документ</th>
					<th rowspan="2" class="osv-cell-left">Комментарий</th>
					<th colspan="2" class="osv-grp">Дебет</th>
					<th colspan="2" class="osv-grp">Кредит</th>
					<th rowspan="2">Текущее сальдо</th>
				</tr>
				<tr>
					<th class="osv-sub osv-cell-left">Счёт</th><th class="osv-sub">Сумма</th>
					<th class="osv-sub osv-cell-left">Счёт</th><th class="osv-sub">Сумма</th>
				</tr>
			</thead>
			<tbody>
				<tr class="osv-totals-row">
					<td colspan="3">Сальдо на начало периода</td>
					<td></td>
					<td>${openingBalance > 0 && !isZeroAmount(openingBalance) ? formatMoney(openingBalance) : ""}</td>
					<td></td>
					<td>${openingBalance < 0 && !isZeroAmount(openingBalance) ? formatMoney(-openingBalance) : ""}</td>
					<td></td>
				</tr>
				${rowsHtml}
				<tr class="osv-totals-row">
					<td colspan="3">Обороты за период</td>
					<td></td>
					<td>${!isZeroAmount(turnoverDebit) ? formatMoney(turnoverDebit) : ""}</td>
					<td></td>
					<td>${!isZeroAmount(turnoverCredit) ? formatMoney(turnoverCredit) : ""}</td>
					<td></td>
				</tr>
				<tr class="osv-totals-row">
					<td colspan="3">Сальдо на конец периода</td>
					<td></td>
					<td>${closingBalance > 0 && !isZeroAmount(closingBalance) ? formatMoney(closingBalance) : ""}</td>
					<td></td>
					<td>${closingBalance < 0 && !isZeroAmount(closingBalance) ? formatMoney(-closingBalance) : ""}</td>
					<td></td>
				</tr>
			</tbody>
		</table>
		</div>
	`;
}

// Фрагмент, подгружаемый по клику AJAX'ом в конец страницы Оборотки (тест журнал) — см.
// openCard() в скрипте renderJournalTurnoverTestPage. subconto_id в query: число — id
// конкретного субконто, "none" — только строки без субконто, отсутствует — весь счёт целиком.
export async function renderJournalTurnoverTestAccountCardFragment(env: Env, url: URL, firm: TestFirmCode): Promise<string> {
	const firmId = await resolveTestFirmId(env, firm);
	const ctx = await loadTestSubcontoContext(env);

	const account = url.searchParams.get("account") ?? "";
	const subcontoIdParam = url.searchParams.get("subconto_id");
	const subcontoFilter: number | "none" | null = subcontoIdParam === null ? null : subcontoIdParam === "none" ? "none" : Number(subcontoIdParam);
	const subcontoLabel = subcontoFilter === null ? null : subcontoFilter === "none" ? "Без субконто" : (resolveSubcontoName(ctx, account, subcontoFilter) ?? String(subcontoFilter));

	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");
	const { from, to } = periodRangeFromToken(period);

	const data = await getTestAccountCard(env, firmId, account, subcontoFilter, from, to);

	return `
		<div class="osv-card-block">
			<button type="button" class="osv-card-close" id="accountCardClose" aria-label="Закрыть">✕</button>
			${renderTestAccountCardBlock(ctx, account, subcontoLabel, from, to, period, firm, data)}
		</div>
	`;
}

// Фрагмент модалки документа — подгружается AJAX'ом кликом по строке Карточки счёта (см.
// openOperationModal в скрипте renderJournalTurnoverTestPage) и открывается сама, без клика по
// триггеру (см. autoOpen/editOperationModalStandaloneHtml). returnTo ведёт обратно на Оборотку
// с тем же периодом — после сохранения формы (POST /operation-document-test/:id/update) редирект
// вернёт именно сюда, а не на Журнал Операций.
export async function renderJournalTurnoverTestOperationModalFragment(env: Env, url: URL, firm: TestFirmCode): Promise<string> {
	const id = Number(url.searchParams.get("id"));
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");

	const doc = await getTestOperationDocument(env, id);
	if (!doc) return "";

	const ctx = await loadTestSubcontoContext(env);
	const returnTo = `/accounting/${firm}?period=${encodeURIComponent(period)}`;

	return editOperationModalStandaloneHtml({ id, docDate: doc.docDate, description: doc.description, lines: doc.lines }, returnTo, ctx, firm);
}

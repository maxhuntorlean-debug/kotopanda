import { renderPage } from "../layout";
import { escapeHtml, formatMoney, isoToDisplay, addDaysIso, periodRangeFromToken, resolvePeriodToken } from "../format";
import { PERIOD_PICKER_STYLES, renderPeriodPicker, DRAWER_STYLES, SUB_TABS_STYLES, renderSubTabs, type SubTab, MODAL_STYLES } from "../ui";
import { CHART_OF_ACCOUNTS } from "../accounting";
import { listTestRefItems, type TestRefKind } from "../referencesTest";

export const BANK_TABS: SubTab[] = [
	{ href: "/bank", label: "Выписка" },
	{ href: "/bank/rules", label: "Правила разноски" },
];

type TxRow = {
	id: number;
	operation_date: string;
	direction: "in" | "out";
	amount: number;
	counterparty_name: string | null;
	counterparty_account: string | null;
	purpose: string | null;
	posting_account: string | null;
	posting_subconto: string | null;
};

type AccountRow = {
	id: number;
	name: string;
	iban: string;
	bank_name: string;
	balance_anchor_date: string | null;
	balance_anchor_amount: number | null;
	posting_subconto: string | null;
};

const STYLES = `
	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin-bottom: 12px;
	}
	.stat-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 8px 12px;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		min-width: 0;
	}
	.stat-card.highlight {
		background: var(--blue-soft);
		border-color: transparent;
	}
	.stat-label {
		color: var(--text-muted);
		font-size: 12px;
		margin: 0;
		white-space: nowrap;
	}
	.stat-value {
		font-size: 15px;
		font-weight: 700;
		white-space: nowrap;
		margin-left: auto;
	}
	.stat-value.positive { color: var(--green); }
	.stat-value.negative { color: var(--red); }
	@media (max-width: 1100px) {
		.stats-row { grid-template-columns: 1fr 1fr; }
	}
	@media (max-width: 560px) {
		.stats-row { grid-template-columns: 1fr; }
	}

	.table-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
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
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tbody tr:last-child td { border-bottom: none; }
	.amount-in { color: var(--green); font-weight: 600; white-space: nowrap; }
	.amount-out { color: var(--text); white-space: nowrap; }
	.posting-muted { color: var(--red); font-weight: 600; }
	.empty-state {
		padding: 40px 16px;
		text-align: center;
		color: var(--text-muted);
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 13px;
		margin-bottom: 16px;
	}
	.banner.ok {
		background: #eafaf3;
		color: var(--green);
	}
	.banner.error {
		background: #fdecec;
		color: var(--red);
	}
	.banner.warning {
		background: #fef6e7;
		color: #a86400;
	}
	.banner.warning form {
		margin: 0 0 0 auto;
	}
	.banner.warning .btn-primary {
		font: inherit;
		cursor: pointer;
		padding: 6px 12px;
		font-size: 12px;
	}

	.topbar {
		justify-content: flex-start;
	}
	.topbar h1 {
		white-space: nowrap;
	}
	.topbar-actions form {
		margin: 0;
	}
	.topbar-actions .btn-primary {
		font: inherit;
		cursor: pointer;
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

	tbody tr[data-tx-id] {
		cursor: pointer;
	}
	tbody tr[data-tx-id]:hover {
		background: var(--bg);
	}

	.modal-card.drawer-modal-card {
		width: 380px;
		padding: 0;
	}
	.drawer-modal-card .drawer-header {
		padding: 18px 20px;
	}
	.drawer-modal-card .drawer-body {
		padding: 20px;
		max-height: 70vh;
	}
	.modal-card select,
	.modal-card input[type="text"] {
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
`;

// Баланс на конец переданной даты, посчитанный от якоря (balance_anchor_date/amount)
// плюс сумма движений между якорем и этой датой. /balance/final ПриватБанка отдаёт
// только баланс на конец последнего закрытого дня, поэтому исторические даты считаем сами.
async function balanceAtEndOf(db: D1Database, accountId: number, anchorDate: string, anchorAmount: number, targetDate: string): Promise<number> {
	if (targetDate === anchorDate) return anchorAmount;

	if (targetDate > anchorDate) {
		const row = await db
			.prepare(
				`SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS net
				 FROM bank_transactions
				 WHERE account_id = ? AND operation_date > ? AND operation_date <= ?`,
			)
			.bind(accountId, anchorDate, targetDate)
			.first<{ net: number }>();
		return anchorAmount + (row?.net ?? 0);
	}

	const row = await db
		.prepare(
			`SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS net
			 FROM bank_transactions
			 WHERE account_id = ? AND operation_date > ? AND operation_date <= ?`,
		)
		.bind(accountId, targetDate, anchorDate)
		.first<{ net: number }>();
	return anchorAmount - (row?.net ?? 0);
}

function accountLabel(code: string): string {
	const acc = CHART_OF_ACCOUNTS.find((a) => a.code === code);
	return acc ? `${acc.code} · ${acc.name}` : code;
}

function renderRow(tx: TxRow): string {
	const posting = tx.posting_account ? accountLabel(tx.posting_account) + (tx.posting_subconto ? ` / ${tx.posting_subconto}` : "") : "Не указано";
	const postingClass = tx.posting_account ? "" : "posting-muted";
	const displayCounterparty = tx.counterparty_name ?? "—";
	const purpose = tx.purpose ?? "—";
	const amountLabel = `${tx.direction === "in" ? "+" : "-"}${formatMoney(tx.amount)} грн`;

	const dataAttrs = [
		`data-tx-id="${tx.id}"`,
		`data-date="${escapeHtml(isoToDisplay(tx.operation_date))}"`,
		`data-purpose="${escapeHtml(purpose)}"`,
		`data-amount="${escapeHtml(amountLabel)}"`,
		`data-account="${tx.posting_account ?? ""}"`,
		`data-subconto="${escapeHtml(tx.posting_subconto ?? "")}"`,
		`data-raw-account="${escapeHtml(tx.counterparty_account ?? "")}"`,
		`data-raw-name="${escapeHtml(tx.counterparty_name ?? "")}"`,
	].join(" ");

	return `
		<tr ${dataAttrs}>
			<td>${isoToDisplay(tx.operation_date)}</td>
			<td>${escapeHtml(displayCounterparty)}</td>
			<td>${escapeHtml(purpose)}</td>
			<td class="amount-in">${tx.direction === "in" ? formatMoney(tx.amount) : "—"}</td>
			<td class="amount-out">${tx.direction === "out" ? formatMoney(tx.amount) : "—"}</td>
			<td class="${postingClass}">${escapeHtml(posting)}</td>
		</tr>`;
}

function renderDrawer(period: string, accountSubcontoMap: Record<string, string[]>): string {
	const accountOptionsHtml = CHART_OF_ACCOUNTS.map((a) => `<option value="${a.code}">${a.code} — ${escapeHtml(a.name)}</option>`).join("\n");

	return `
	<div class="modal-overlay" id="drawerOverlay">
		<div class="modal-card drawer-modal-card">
			<div class="drawer-header">
				<h2>Операция</h2>
				<button type="button" class="drawer-close" id="drawerClose">✕</button>
			</div>
			<div class="drawer-body">
				<div class="drawer-field">
					<span class="drawer-label">Дата</span>
					<span class="drawer-value" id="drawerDate"></span>
				</div>
				<div class="drawer-field">
					<span class="drawer-label">Назначение (из банка)</span>
					<span class="drawer-value" id="drawerPurpose"></span>
				</div>
				<div class="drawer-field">
					<span class="drawer-label">Сумма</span>
					<span class="drawer-value" id="drawerAmount"></span>
				</div>
				<div class="drawer-divider"></div>
				<form method="post" action="/bank/transactions/update" id="drawerForm">
					<input type="hidden" name="id" id="drawerTxId" value="" />
					<input type="hidden" name="period" value="${period}" />
					<div class="drawer-field">
						<span class="drawer-label">Счёт</span>
						<select name="account" id="drawerAccount">
							<option value="">Не указано</option>
							${accountOptionsHtml}
						</select>
					</div>
					<div class="drawer-field">
						<span class="drawer-label">Субконто</span>
						<select name="subconto" id="drawerSubcontoSelect" hidden>
							<option value="">Не выбрано</option>
						</select>
						<input type="text" name="subconto" id="drawerSubcontoText" placeholder="необязательно" />
					</div>
					<div class="drawer-divider"></div>
					<div class="drawer-field">
						<label class="drawer-checkbox">
							<input type="checkbox" name="create_rule" id="drawerCreateRule" value="1" />
							<span>Добавить правило — размечать так все будущие операции автоматически</span>
						</label>
						<div class="drawer-hint" id="drawerRuleHint"></div>
						<input type="hidden" name="rule_match_field" id="drawerRuleMatchField" value="" />
						<input type="hidden" name="rule_match_value" id="drawerRuleMatchValue" value="" />
					</div>
					<div class="drawer-actions">
						<button type="submit" class="btn-primary">Сохранить</button>
					</div>
				</form>
			</div>
		</div>
	</div>
	<script>
		(function () {
			var overlay = document.getElementById("drawerOverlay");
			var closeBtn = document.getElementById("drawerClose");
			var accountSelect = document.getElementById("drawerAccount");
			var subcontoSelect = document.getElementById("drawerSubcontoSelect");
			var subcontoText = document.getElementById("drawerSubcontoText");
			var accountSubconto = ${JSON.stringify(accountSubcontoMap)};

			function syncSubconto() {
				var names = accountSubconto[accountSelect.value];
				if (names) {
					subcontoSelect.innerHTML = '<option value="">Не выбрано</option>';
					names.forEach(function (name) {
						var opt = document.createElement("option");
						opt.value = name;
						opt.textContent = name;
						subcontoSelect.appendChild(opt);
					});
					subcontoSelect.hidden = false;
					subcontoSelect.disabled = false;
					subcontoText.hidden = true;
					subcontoText.disabled = true;
				} else {
					subcontoSelect.hidden = true;
					subcontoSelect.disabled = true;
					subcontoText.hidden = false;
					subcontoText.disabled = false;
				}
			}

			function setupRuleCheckbox(row) {
				var checkbox = document.getElementById("drawerCreateRule");
				var hint = document.getElementById("drawerRuleHint");
				var fieldInput = document.getElementById("drawerRuleMatchField");
				var valueInput = document.getElementById("drawerRuleMatchValue");
				var account = row.dataset.rawAccount;
				var name = row.dataset.rawName;

				checkbox.checked = false;

				if (account) {
					fieldInput.value = "counterparty_account";
					valueInput.value = account;
					hint.textContent = "По счёту контрагента: " + account;
					checkbox.disabled = false;
				} else if (name) {
					fieldInput.value = "counterparty_name";
					valueInput.value = name;
					hint.textContent = "По имени контрагента: " + name;
					checkbox.disabled = false;
				} else {
					fieldInput.value = "";
					valueInput.value = "";
					hint.textContent = "Недостаточно данных для правила";
					checkbox.disabled = true;
				}
			}

			function openDrawer(row) {
				document.getElementById("drawerTxId").value = row.dataset.txId;
				document.getElementById("drawerDate").textContent = row.dataset.date;
				document.getElementById("drawerPurpose").textContent = row.dataset.purpose;
				document.getElementById("drawerAmount").textContent = row.dataset.amount;
				accountSelect.value = row.dataset.account || "";
				syncSubconto();
				if (!subcontoSelect.hidden) {
					subcontoSelect.value = row.dataset.subconto || "";
				} else {
					subcontoText.value = row.dataset.subconto || row.dataset.rawName || "";
				}
				setupRuleCheckbox(row);
				overlay.classList.add("open");
			}

			function closeDrawer() {
				overlay.classList.remove("open");
			}

			document.querySelectorAll("tbody tr[data-tx-id]").forEach(function (row) {
				row.addEventListener("click", function () {
					openDrawer(row);
				});
			});

			accountSelect.addEventListener("change", syncSubconto);
			closeBtn.addEventListener("click", closeDrawer);
		})();
	</script>
	`;
}

export async function renderBankPage(env: Env, url: URL): Promise<string> {
	const period = resolvePeriodToken(url.searchParams.get("period"), "this_month");

	const account = await env.DB.prepare(
		`SELECT id, name, iban, bank_name, balance_anchor_date, balance_anchor_amount, posting_subconto FROM bank_accounts LIMIT 1`,
	).first<AccountRow>();

	if (!account || account.balance_anchor_date === null || account.balance_anchor_amount === null) {
		return renderPage(
			"/bank",
			"Банк",
			`<div class="topbar"><h1>Банк</h1></div><div class="table-card"><div class="empty-state">Счёт не найден в базе. Сначала нужно загрузить выписку.</div></div>`,
			env,
		);
	}

	const { from: periodFrom, to: periodTo } = periodRangeFromToken(period);

	const { results: transactions } = await env.DB.prepare(
		`SELECT id, operation_date, direction, amount, counterparty_name, counterparty_account, purpose, posting_account, posting_subconto
		 FROM bank_transactions
		 WHERE account_id = ? AND operation_date BETWEEN ? AND ?
		 ORDER BY operation_date DESC, id DESC`,
	)
		.bind(account.id, periodFrom, periodTo)
		.all<TxRow>();

	// Субконто-подсказки зависят от выбранного счёта — те же тестовые справочники, что и в
	// ручных проводках Бухгалтерии (Настройки → Справочники).
	const neededKinds = Array.from(new Set(CHART_OF_ACCOUNTS.map((a) => a.refKind).filter((k): k is TestRefKind => k !== null)));
	const refListEntries = await Promise.all(neededKinds.map(async (kind) => [kind, (await listTestRefItems(env, kind)).map((i) => i.name)] as const));
	const refLists = Object.fromEntries(refListEntries) as Record<TestRefKind, string[]>;
	const accountSubcontoMap: Record<string, string[]> = {};
	for (const acc of CHART_OF_ACCOUNTS) {
		if (acc.refKind) accountSubcontoMap[acc.code] = refLists[acc.refKind] ?? [];
	}

	const totals = await env.DB.prepare(
		`SELECT
			COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS total_in,
			COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS total_out
		 FROM bank_transactions
		 WHERE account_id = ? AND operation_date BETWEEN ? AND ?`,
	)
		.bind(account.id, periodFrom, periodTo)
		.first<{ total_in: number; total_out: number }>();

	const balanceStart = await balanceAtEndOf(env.DB, account.id, account.balance_anchor_date, account.balance_anchor_amount, addDaysIso(periodFrom, -1));
	const balanceEnd = await balanceAtEndOf(env.DB, account.id, account.balance_anchor_date, account.balance_anchor_amount, periodTo);

	const totalIn = totals?.total_in ?? 0;
	const totalOut = totals?.total_out ?? 0;

	const rowsHtml = transactions.length
		? transactions.map(renderRow).join("\n")
		: `<tr><td colspan="6" class="empty-state">За этот период операций нет</td></tr>`;

	let banner = "";

	const syncError = url.searchParams.get("sync_error");
	const synced = url.searchParams.get("synced");
	if (syncError) {
		banner += `<div class="banner error">⚠ Не удалось получить выписку из банка: ${syncError}</div>`;
	} else if (synced !== null) {
		const added = parseInt(synced, 10);
		banner += added > 0
			? `<div class="banner ok">✓ Добавлено новых операций: ${added}</div>`
			: `<div class="banner ok">✓ Новых операций нет, всё уже загружено</div>`;
	}

	const rulesApplied = url.searchParams.get("rules_applied");
	if (rulesApplied !== null) {
		const count = parseInt(rulesApplied, 10);
		banner += count > 0
			? `<div class="banner ok">✓ Разнесено по правилам: ${count}</div>`
			: `<div class="banner ok">✓ Подходящих операций для авторазноски не найдено</div>`;
	}

	const unposted = transactions.filter((t) => t.posting_account === null).length;
	if (unposted > 0) {
		banner += `<div class="banner warning"><span>⚠ Неразнесённых операций за период: ${unposted}</span></div>`;
	}

	const content = `
	<style>${STYLES}${PERIOD_PICKER_STYLES}${DRAWER_STYLES}${SUB_TABS_STYLES}${MODAL_STYLES}</style>
	${banner}
	<div class="topbar">
		<h1>Банк · ${account.bank_name}</h1>
		<div class="topbar-actions">
			${renderPeriodPicker("/bank", period, periodFrom, periodTo)}
			<div class="icon-btn">⋯</div>
			<form method="post" action="/bank/rules/apply">
				<input type="hidden" name="period" value="${period}" />
				<button type="submit" class="btn-secondary">Применить правила</button>
			</form>
			<form method="post" action="/bank/sync">
				<input type="hidden" name="period" value="${period}" />
				<button type="submit" class="btn-primary">⬇ Получить из банка</button>
			</form>
		</div>
	</div>
	${renderSubTabs(BANK_TABS, "/bank")}

	<div class="stats-row">
		<div class="stat-card">
			<div class="stat-label">Остаток на начало</div>
			<div class="stat-value">${formatMoney(balanceStart)} грн</div>
		</div>
		<div class="stat-card">
			<div class="stat-label">Приход за период</div>
			<div class="stat-value positive">+${formatMoney(totalIn)} грн</div>
		</div>
		<div class="stat-card">
			<div class="stat-label">Расход за период</div>
			<div class="stat-value negative">-${formatMoney(totalOut)} грн</div>
		</div>
		<div class="stat-card highlight">
			<div class="stat-label">Остаток на конец</div>
			<div class="stat-value">${formatMoney(balanceEnd)} грн</div>
		</div>
	</div>

	<div class="table-card">
		<table>
			<thead>
				<tr>
					<th>Дата ▾</th>
					<th>Контрагент</th>
					<th>Назначение</th>
					<th>Приход</th>
					<th>Расход</th>
					<th>Разноска</th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
			</tbody>
		</table>
	</div>

	${renderDrawer(period, accountSubcontoMap)}
	`;

	return renderPage("/bank", "Банк", content, env);
}


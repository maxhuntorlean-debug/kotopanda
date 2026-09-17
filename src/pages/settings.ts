import { renderPage } from "../layout";
import { escapeHtml } from "../format";
import { SUB_TABS_STYLES, renderSubTabs, type SubTab } from "../ui";
import { getAuthContext } from "../auth";

// Справочники и План счетов живут тут же (раньше были отдельными пунктами меню "Справочники
// (тест)"/"План счетов (тест)", см. referencesTest.ts/chartOfAccountsTest.ts), Учёт — то, что
// было на /settings всегда. Администрирование — тоже вкладка здесь (перенесли из отдельного
// пункта меню, см. обсуждение "перенесём во Настройки"), но видна только is_admin-ролям.
export function settingsTabs(env: Env): SubTab[] {
	const auth = getAuthContext(env);
	const tabs: SubTab[] = [
		{ href: "/settings/references", label: "Справочники" },
		{ href: "/settings/chart", label: "План счетов" },
		{ href: "/settings", label: "Учёт" },
	];
	if (auth?.isAdmin) tabs.push({ href: "/settings/admin", label: "Администрирование" });
	return tabs;
}

const STYLES = `
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
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tbody tr:last-child td { border-bottom: none; }
	.acc { font-weight: 600; }
	.inline-form {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.inline-form input[type="text"] {
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
		width: 220px;
	}
	.inline-form button {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px 10px;
		cursor: pointer;
	}
`;

export async function renderSettingsPage(env: Env): Promise<string> {
	const bankAccount = await env.DB.prepare(`SELECT posting_subconto FROM bank_accounts LIMIT 1`).first<{ posting_subconto: string | null }>();
	const cardAccount = await env.DB.prepare(`SELECT posting_subconto FROM card_accounts LIMIT 1`).first<{ posting_subconto: string | null }>();

	// Касса Котопанда/Элитка и Взаимозачёт убраны из этой таблицы — боевые cash_registers/
	// offset_settings снесены вместе со старыми модулями (см. обсуждение "тестовые станут
	// боевыми"); у новой Кассы своя, не настраиваемая тут привязка субконто
	// (TEST_CASH_REGISTER_SUBCONTO_NAME в cashTest.ts), а Взаимозачёт пока без функционала.
	// Субконто Приватбанка/Карточки — свободный текст: справочник "Счета" (own_accounts),
	// который раньше подсказывал варианты, снесён вместе с Бухгалтерией.
	const rowsHtml = `
		<tr>
			<td>Приватбанк</td>
			<td class="acc">31</td>
			<td>
				<form method="post" action="/bank/settings" class="inline-form">
					<input type="text" name="posting_subconto" value="${bankAccount?.posting_subconto ? escapeHtml(bankAccount.posting_subconto) : ""}" placeholder="Без субконто" />
					<button type="submit" title="Сохранить">💾</button>
				</form>
			</td>
		</tr>
		<tr>
			<td>Карточка Универсальная</td>
			<td class="acc">31</td>
			<td>
				<form method="post" action="/card-universal/settings" class="inline-form">
					<input type="text" name="posting_subconto" value="${cardAccount?.posting_subconto ? escapeHtml(cardAccount.posting_subconto) : ""}" placeholder="Без субконто" />
					<button type="submit" title="Сохранить">💾</button>
				</form>
			</td>
		</tr>
	`;

	const content = `
	<style>${STYLES}${SUB_TABS_STYLES}</style>
	<div class="topbar">
		<h1>Настройки</h1>
	</div>
	${renderSubTabs(settingsTabs(env), "/settings")}

	<div class="table-card">
		<table>
			<thead><tr><th>Учёт</th><th>Счёт</th><th>Субконто</th></tr></thead>
			<tbody>${rowsHtml}</tbody>
		</table>
	</div>
	`;

	return renderPage("/settings", "Настройки", content, env);
}

import type { TestRefKind } from "./referencesTest";

// Данные для "План счетов (тест)" — настоящая таблица (test_chart_of_accounts, см.
// migrations/0034), в отличие от боевого CHART_OF_ACCOUNTS, захардкоженного в accounting.ts.
// План счетов полностью неизменяем — только чтение, без создания/редактирования/удаления.

export type ChartAccountTest = { code: string; name: string; refKind: TestRefKind | null };

export async function listChartAccountsTest(env: Env): Promise<ChartAccountTest[]> {
	const { results } = await env.DB.prepare(`SELECT code, name, ref_kind FROM test_chart_of_accounts ORDER BY code`).all<{
		code: string;
		name: string;
		ref_kind: TestRefKind | null;
	}>();
	return results.map((r) => ({ code: r.code, name: r.name, refKind: r.ref_kind }));
}

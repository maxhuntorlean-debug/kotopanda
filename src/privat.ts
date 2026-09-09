const BASE_URL = "https://acp.privatbank.ua/api/statements";

export type PrivatTransaction = {
	ID: string;
	DAT_OD: string;
	TRANTYPE: "C" | "D";
	SUM: string;
	CCY: string;
	AUT_CNTR_NAM?: string;
	AUT_CNTR_ACC?: string;
	OSND?: string;
	[key: string]: unknown;
};

async function privatFetch(env: Env, url: string): Promise<unknown> {
	const response = await fetch(url, {
		headers: {
			token: env.PRIVAT_TOKEN,
			id: env.PRIVAT_ID,
		},
	});

	if (!response.ok) {
		throw new Error(`PrivatBank API HTTP ${response.status}`);
	}

	const buffer = await response.arrayBuffer();
	const text = new TextDecoder("windows-1251").decode(buffer);
	const json = JSON.parse(text) as { status: string; message?: string };

	if (json.status !== "SUCCESS") {
		throw new Error(`PrivatBank API error: ${json.message ?? json.status}`);
	}

	return json;
}

// dd-MM-yyyy, как требует API ПриватБанка
export function toPrivatDate(iso: string): string {
	const [y, m, d] = iso.split("-");
	return `${d}-${m}-${y}`;
}

export async function fetchPrivatTransactions(env: Env, acc: string, startDateIso: string, endDateIso: string): Promise<PrivatTransaction[]> {
	const startDate = toPrivatDate(startDateIso);
	const endDate = toPrivatDate(endDateIso);
	const accEnc = encodeURIComponent(acc);

	let all: PrivatTransaction[] = [];
	let followId: string | null = null;
	let guard = 0;

	while (guard < 50) {
		guard++;
		let url = `${BASE_URL}/transactions?acc=${accEnc}&startDate=${startDate}&endDate=${endDate}&limit=500`;
		if (followId) {
			url += `&followId=${encodeURIComponent(followId)}`;
		}

		const json = (await privatFetch(env, url)) as {
			transactions?: PrivatTransaction[];
			exist_next_page?: boolean;
			next_page_id?: string;
		};

		all = all.concat(json.transactions ?? []);

		if (!json.exist_next_page || !json.next_page_id) break;
		followId = json.next_page_id;
	}

	return all;
}

export async function fetchPrivatBalanceAnchor(env: Env, acc: string): Promise<{ date: string; amount: number } | null> {
	// /balance/final игнорирует startDate/endDate и всегда отдаёт баланс на конец
	// последнего закрытого банковского дня — даты в запросе для API не важны.
	const accEnc = encodeURIComponent(acc);
	const today = toPrivatDate(new Date().toISOString().slice(0, 10));
	const url = `${BASE_URL}/balance/final?acc=${accEnc}&startDate=${today}&endDate=${today}`;

	const json = (await privatFetch(env, url)) as {
		balances?: { dpd: string; balanceOut: string }[];
	};

	const balance = json.balances?.[0];
	if (!balance) return null;

	const [day, month, year] = balance.dpd.split(" ")[0].split(".");
	return {
		date: `${year}-${month}-${day}`,
		amount: parseFloat(balance.balanceOut),
	};
}

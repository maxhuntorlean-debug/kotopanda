export type PeriodKey = "this_month" | "last_month";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
	{ key: "this_month", label: "Текущий месяц" },
	{ key: "last_month", label: "Прошлый месяц" },
];

export function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function formatMoney(value: number): string {
	const rounded = Math.round(value * 100) / 100;
	const [intPart, fracPart] = rounded.toFixed(2).split(".");
	const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
	return `${withSpaces},${fracPart}`;
}

export function isoToDisplay(iso: string): string {
	const [y, m, d] = iso.split("-");
	return `${d}.${m}.${y}`;
}

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
	const d = new Date(iso + "T00:00:00Z");
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

export function firstDayOfMonthIso(iso: string): string {
	const [y, m] = iso.split("-");
	return `${y}-${m}-01`;
}

export function periodRange(period: PeriodKey): { from: string; to: string } {
	const today = todayIso();
	switch (period) {
		case "last_month": {
			const lastMonthEnd = addDaysIso(firstDayOfMonthIso(today), -1);
			return { from: firstDayOfMonthIso(lastMonthEnd), to: lastMonthEnd };
		}
		case "this_month":
		default:
			return { from: firstDayOfMonthIso(today), to: today };
	}
}

export function parsePeriod(periodParam: string | null, fallback: PeriodKey = "this_month"): PeriodKey {
	return PERIOD_OPTIONS.some((p) => p.key === periodParam) ? (periodParam as PeriodKey) : fallback;
}

const MONTH_NAMES = [
	"Январь",
	"Февраль",
	"Март",
	"Апрель",
	"Май",
	"Июнь",
	"Июль",
	"Август",
	"Сентябрь",
	"Октябрь",
	"Ноябрь",
	"Декабрь",
];

function lastDayOfMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

export function monthRange(year: number, month: number): { from: string; to: string } {
	return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}` };
}

export function quarterRange(year: number, quarter: number): { from: string; to: string } {
	const startMonth = (quarter - 1) * 3 + 1;
	return { from: monthRange(year, startMonth).from, to: monthRange(year, startMonth + 2).to };
}

export function yearRange(year: number): { from: string; to: string } {
	return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function monthLabel(year: number, month: number): string {
	return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function quarterLabel(year: number, quarter: number): string {
	return `${quarter} квартал ${year}`;
}

// Свободный период (месяц/квартал/год/произвольный диапазон, выбранный вручную) кодируется
// прямо в query-параметр period как "range:YYYY-MM-DD:YYYY-MM-DD" — это позволяет ему прозрачно
// проходить через все существующие hidden-поля/редиректы, которые уже просто носят period как строку.
export function encodeRangeToken(from: string, to: string): string {
	return `range:${from}:${to}`;
}

export function periodRangeFromToken(token: string): { from: string; to: string } {
	if (token.startsWith("range:")) {
		const parts = token.split(":");
		if (parts.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) && /^\d{4}-\d{2}-\d{2}$/.test(parts[2]) && parts[1] <= parts[2]) {
			return { from: parts[1], to: parts[2] };
		}
	}
	return periodRange(parsePeriod(token));
}

export function periodTokenLabel(token: string): string {
	const preset = PERIOD_OPTIONS.find((p) => p.key === token);
	if (preset) return preset.label;

	const { from, to } = periodRangeFromToken(token);
	const [fy, fm, fd] = from.split("-").map(Number);
	const [ty, tm, td] = to.split("-").map(Number);

	if (fy === ty && fm === tm && fd === 1 && td === lastDayOfMonth(fy, fm)) {
		return monthLabel(fy, fm);
	}
	if (fy === ty && fd === 1 && fm % 3 === 1 && tm === fm + 2 && td === lastDayOfMonth(ty, tm)) {
		return quarterLabel(fy, Math.ceil(fm / 3));
	}
	if (fy === ty && fm === 1 && fd === 1 && tm === 12 && td === 31) {
		return String(fy);
	}
	return `${isoToDisplay(from)} – ${isoToDisplay(to)}`;
}

// Достаёт period из query-параметра как есть (это либо ключ из PERIOD_OPTIONS, либо
// "range:..." — оба варианта дальше понимает periodRangeFromToken/periodTokenLabel напрямую).
export function resolvePeriodToken(periodParam: string | null, fallback: PeriodKey): string {
	if (!periodParam) return fallback;
	if (periodParam.startsWith("range:")) return periodParam;
	return PERIOD_OPTIONS.some((p) => p.key === periodParam) ? periodParam : fallback;
}

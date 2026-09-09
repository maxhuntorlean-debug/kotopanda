import { renderPage, NAV_ITEMS } from "../layout";

export function renderPlaceholderPage(href: string): string {
	const item = NAV_ITEMS.find((i) => i.href === href);
	const title = item ? item.label : "Страница";
	const content = `
	<div class="topbar">
		<h1>${title}</h1>
	</div>
	<div class="placeholder">
		<h2>${item ? item.icon : ""} ${title}</h2>
		<p>Раздел в разработке</p>
	</div>
	`;
	return renderPage(href, title, content);
}

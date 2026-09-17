import { escapeHtml } from "../format";

export function renderLoginPage(error: string | null, next: string): string {
	return `<!doctype html>
<html lang="ru">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Вход · Котопанда</title>
	<style>
		* { box-sizing: border-box; }
		html, body {
			margin: 0;
			height: 100%;
			background: #f5f6f8;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.login-card {
			width: 320px;
			max-width: calc(100vw - 32px);
			background: #fff;
			border: 1px solid #e5e7eb;
			border-radius: 14px;
			padding: 28px 24px;
		}
		.login-brand {
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 700;
			font-size: 17px;
			margin-bottom: 20px;
		}
		label {
			display: block;
			font-size: 13px;
			color: #8a8f99;
			margin-bottom: 6px;
		}
		input {
			width: 100%;
			padding: 10px 12px;
			border: 1px solid #e5e7eb;
			border-radius: 8px;
			font: inherit;
			font-size: 14px;
			margin-bottom: 16px;
			box-sizing: border-box;
		}
		button {
			width: 100%;
			background: #3b6ef6;
			color: #fff;
			border: none;
			border-radius: 10px;
			padding: 11px 16px;
			font: inherit;
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
		}
		.login-error {
			background: #fdecec;
			color: #e5484d;
			border-radius: 8px;
			padding: 9px 12px;
			font-size: 13px;
			margin-bottom: 16px;
		}
	</style>
</head>
<body>
	<div class="login-card">
		<div class="login-brand"><span>🐾</span>Котопанда</div>
		${error ? `<div class="login-error">${escapeHtml(error)}</div>` : ""}
		<form method="post" action="/login">
			<input type="hidden" name="next" value="${escapeHtml(next)}" />
			<label for="username">Логин</label>
			<input type="text" name="username" id="username" autofocus required />
			<label for="password">Пароль</label>
			<input type="password" name="password" id="password" required />
			<button type="submit">Войти</button>
		</form>
	</div>
</body>
</html>`;
}

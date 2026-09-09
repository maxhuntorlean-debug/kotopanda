// Минимальный service worker — только для установки приложения (ярлык, отдельное окно),
// без офлайн-режима и кеширования: все запросы просто уходят в сеть как обычно.
self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
	event.respondWith(fetch(event.request));
});

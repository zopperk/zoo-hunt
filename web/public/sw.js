/* Zoo Hunt service worker: keeps the app shell + art available offline, never caches the API. */
const VERSION = 'zoo-hunt-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/art/monkey-head.png', '/art/gate.jpg', '/art/george-welcome.png', '/art/paper-texture.png', '/art/bronx-zoo-map.png', '/art/bronx-zoo-map-key.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(VERSION)
			.then((c) => c.addAll(SHELL))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return; // fonts etc. go straight to the network
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return; // live data, never cached

	// App navigation: network first (fresh build), fall back to the cached shell when offline.
	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(VERSION).then((c) => c.put('/', copy));
					return res;
				})
				.catch(() => caches.match('/')),
		);
		return;
	}

	// Hashed bundles, art, icons: cache first, then network (and remember it).
	if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/art/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/favicon.svg') {
		event.respondWith(
			caches.match(req).then(
				(hit) =>
					hit ||
					fetch(req).then((res) => {
						if (res.ok) {
							const copy = res.clone();
							caches.open(VERSION).then((c) => c.put(req, copy));
						}
						return res;
					}),
			),
		);
	}
});

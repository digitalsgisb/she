const CACHE = 'she-shell-mobile-nav-v1';
const ASSETS = ['/', '/styles.css', '/script.js', '/patrol.js', '/cmms-ui.js', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
    return;
  }
  if (ASSETS.includes(url.pathname)) event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(url.pathname, copy)); return response;
  }).catch(() => caches.match(url.pathname)));
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {body: event.data?.text()}; }
  const id = String(payload.tag || '').match(/^work-order-([a-zA-Z0-9-]+)$/)?.[1];
  const url = id ? `/#/work-orders/${id}` : '/#/work-orders';
  event.waitUntil(self.registration.showNotification(payload.title || 'SHE Digital', {
    body: payload.body || 'A SHE work order has been updated.', icon: '/favicon.svg', badge: '/favicon.svg',
    tag: payload.tag || 'safety-work-orders', data: {url}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/#/work-orders', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(async clients => {
    for (const client of clients) { if ('navigate' in client) await client.navigate(url); if ('focus' in client) return client.focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
  }));
});

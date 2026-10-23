/* Separate scope keeps SHE report subscriptions independent of CMMS alerts. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a generic report alert. */ }
  const id = Number(payload.report_id);
  const url = Number.isSafeInteger(id) && id > 0 ? '/#/reporting-inbox/' + id : '/#/reporting-inbox';
  event.waitUntil(self.registration.showNotification(payload.title || 'New Report to SHE', {
    body: payload.body || 'A new report is waiting in the SHE inbox.',
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: payload.tag || 'she-report', data: {url}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url;
  const url = new URL(/^\/#\/reporting-inbox(?:\/\d+)?$/.test(path || '') ? path : '/#/reporting-inbox', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.navigate(url); return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

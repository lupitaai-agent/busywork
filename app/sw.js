/* Offline support for the hosted copy (it never runs from a downloaded file: browsers only allow
   service workers on https and localhost). Network first, so updates arrive straight away; the
   last copy of each file is kept for when there is no connection. Business data is never cached:
   it lives in the user's folder or browser storage, not on the network. */
const CACHE = 'busywork-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});

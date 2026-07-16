/* Hijrah Bareng — Service Worker */
const CACHE_NAME = 'hijrah-bareng-cache-v18';

// App shell + data assets to pre-cache on install.
// Large ebook/QRIS data files are included so the app works fully offline
// after the first successful load (they only need to download once).
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './ebook_alfalaq.b64.js',
  './ebook_alasr.b64.js',
  './ebook_aladiyat.b64.js',
  './ebook_allahab.b64.js',
  './ebook_alkautsar.b64.js',
  './qris_data.b64.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => console.warn('[SW] Precache gagal (sebagian file mungkin belum ada):', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategy: cache-first for same-origin GET requests, falling back to
// network, then updating the cache in the background (stale-while-revalidate-ish).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't intercept cross-origin (e.g. YouTube links)

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const notif = event.notification;
  const action = event.action;
  notif.close();

  if(action === 'mark_prayer' && notif.data && notif.data.wajibId){
    event.waitUntil(
      self.clients.matchAll({type:'window', includeUncontrolled:true}).then((clientList) => {
        if(clientList.length > 0){
          clientList[0].postMessage({type:'MARK_PRAYER', wajibId: notif.data.wajibId});
          return clientList[0].focus();
        }
        return self.clients.openWindow('./index.html');
      })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then((clientList) => {
      if(clientList.length > 0) return clientList[0].focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

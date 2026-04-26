// ============================================================
// BecaKita — Service Worker
// Menangani cache untuk index.html DAN admin.html
// ============================================================

const CACHE_NAME = 'becakita-v1.2.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/admin.html',
  '/connecting.html',
  '/driver-ready.png'
];

// Install
self.addEventListener('install', (event) => {
  console.log('[BecaKita SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — hapus cache versi lama
self.addEventListener('activate', (event) => {
  console.log('[BecaKita SW] Activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Selalu fresh untuk API eksternal
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('githubusercontent.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('picsum.photos')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        })
      )
  );
});

// Push Notification
self.addEventListener('push', (event) => {
  console.log('[BecaKita SW] Push diterima');
  let data = { title: 'BecaKita', body: 'Ada notifikasi baru' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'https://img.icons8.com/fluency/96/bicycle.png',
      badge: 'https://img.icons8.com/fluency/48/bicycle.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Buka' },
        { action: 'dismiss', title: 'Tutup' }
      ]
    })
  );
});

// Klik notifikasi
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-location') {
    console.log('[BecaKita SW] Background sync: sync-location');
  }
});

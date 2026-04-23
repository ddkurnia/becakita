// ============================================================
// BecaKita — Service Worker
// File ini HARUS terpisah dari index.html
// Taruh di root folder, sama level dengan index.html
// ============================================================

const CACHE_NAME = 'becakita-v1.0.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

// Install: cache file dasar
self.addEventListener('install', (event) => {
  console.log('[BecaKita SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: hapus cache lama
self.addEventListener('activate', (event) => {
  console.log('[BecaKita SW] Activate');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network first, fallback ke cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Firebase & Google Maps & CDN requests (selalu fresh)
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('cartocdn.com') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('gstatic.com')) {
    return; // biarkan network handle langsung
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback ke cache jika offline
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback halaman offline untuk HTML requests
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ============================================================
// PUSH NOTIFICATION
// ============================================================
self.addEventListener('push', (event) => {
  console.log('[BecaKita SW] Push diterima');
  let data = { title: 'BecaKita', body: 'Ada notifikasi baru' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'https://img.icons8.com/fluency/96/bicycle.png',
    badge: 'https://img.icons8.com/fluency/48/bicycle.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Buka' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Klik notifikasi → buka app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Cek apakah app sudah terbuka
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            return;
          }
        }
        // Buka window baru
        return self.clients.openWindow(urlToOpen);
      })
  );
});

// ============================================================
// BACKGROUND SYNC (untuk kirim lokasi saat online kembali)
// ============================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-location') {
    console.log('[BecaKita SW] Background sync: sync-location');
    // Di sini bisa ditambahkan logic kirim lokasi terakhir
    // yang gagal terkirim saat offline
  }
});

// ============================================================
// UPDATE CHECK — beritahu user ada versi baru
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Trigger fetch ulang index.html untuk cek perubahan
    fetch('/index.html', { cache: 'no-store' })
      .then(response => response.text())
      .then(html => {
        // Kirim sinyal ke client
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'UPDATE_AVAILABLE', hash: html.length });
          });
        });
      })
      .catch(() => {});
  }
});

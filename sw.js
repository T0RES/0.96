// sw.js
const CACHE_NAME = 'homework-tracker-v1.5';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'  // ← ДОБАВЛЕНО КЭШИРОВАНИЕ САМОГО SW
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэшируем файлы');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Установка завершена');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Ошибка кэширования:', err);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Активация завершена');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase API — Network First
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(JSON.stringify([]), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Статические ресурсы — Cache First
  if (
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    url.pathname.endsWith('sw.js')  // ← SW тоже кэшируется
  ) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML и manifest — Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        return cachedResponse || new Response('Нет соединения', { 
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
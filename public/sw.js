// public/sw.js
const CACHE_NAME = 'ebro-lift-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url || '';
  // 빌드 청크(/assets/*), API 통신, 외부 호출은 서비스워커 개입 없이 100% 브라우저 직통 (청크 404 및 캐시 고착 원천 방지)
  if (url.includes('/assets/') || url.includes('/api/') || url.includes('supabase') || event.request.method !== 'GET') {
    return;
  }

  // HTML 문서 탐색은 무조건 네트워크 우선 (캐시 우회)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
});

// 🔔 PWA 푸시 알림 수신 이벤트 (잠금화면 및 백그라운드 수신)
self.addEventListener('push', (event) => {
  let data = { 
    title: 'e-Bro 업무알림', 
    body: '새로운 업무 의뢰가 접수되었습니다.', 
    tag: 'work-alert', 
    url: '/' 
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 300],
    tag: data.tag || 'work-alert',
    data: { url: data.url || '/' },
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 📲 알림 터치/클릭 시 해당 업무 화면으로 포커스 직결 (Deep Link)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

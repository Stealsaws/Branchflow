// Service Worker สำหรับ Branch Hub PWA
const CACHE_NAME = 'branch-hub-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', e => {
  // ข้าม Supabase และ Google API requests
  if (e.request.url.includes('supabase.co') ||
      e.request.url.includes('googleapis.com') ||
      e.request.url.includes('script.google.com') ||
      e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // cache response ใหม่
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push notification (พร้อมสำหรับอนาคต)
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'ศูนย์ประสานงาน', {
      body: data.body || 'มีประกาศใหม่',
      icon: data.icon || './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || './'));
});

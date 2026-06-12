// sw.js — BranchFlow Service Worker
// ใส่ไว้ที่ root ของ GitHub Pages repo เดียวกับ index.html

const CACHE_NAME = 'branchflow-v3';
const OFFLINE_URL = '/Branchflow/offline.html';

// Assets ที่ cache ไว้ทันที (App Shell)
const PRECACHE_ASSETS = [
  '/Branchflow/',
  '/Branchflow/index.html',
  '/Branchflow/manifest.json',
  'https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap',
];

// ────────────────────────────────────────────────────────────
// INSTALL — cache app shell
// ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // cache assets one-by-one (ถ้า fail บางอัน ไม่ blocking)
      for (const url of PRECACHE_ASSETS) {
        try { await cache.add(url); } catch (e) { console.warn('[SW] Precache miss:', url); }
      }
    })
  );
  self.skipWaiting(); // activate ทันทีไม่รอ reload
});

// ────────────────────────────────────────────────────────────
// ACTIVATE — ลบ cache เก่า
// ────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // ควบคุม tab ที่เปิดอยู่ทันที
});

// ────────────────────────────────────────────────────────────
// FETCH — Strategy:
//   Supabase API  → Network only (ไม่ cache ข้อมูล live)
//   Google Fonts  → Cache first
//   App Shell     → Network first, fallback cache
// ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ไม่ cache POST/DELETE/PATCH
  if (event.request.method !== 'GET') return;

  // Supabase — network only
  if (url.hostname.includes('supabase.co')) return;

  // Google Apps Script — network only
  if (url.hostname.includes('script.google.com')) return;

  // Google Fonts — cache first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // App shell — Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // cache ถ้า response ปกติ
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ────────────────────────────────────────────────────────────
// PUSH NOTIFICATION (เปิดใช้เมื่อตั้งค่า VAPID keys)
// ────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body, icon, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title || 'BranchFlow', {
      body: body || 'มีประกาศใหม่',
      icon: icon || '/Branchflow/icon.svg',
      badge: '/Branchflow/icon.svg',
      data: { url: url || '/Branchflow/' },
      vibrate: [200, 100, 200],
      requireInteraction: body?.includes('งานด่วน'),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/Branchflow/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ────────────────────────────────────────────────────────────
// BACKGROUND SYNC — sync read receipts เมื่อกลับมา online
// ────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-read-receipts') {
    event.waitUntil(syncReadReceipts());
  }
});

async function syncReadReceipts() {
  // ดึง pending receipts จาก IndexedDB แล้วส่ง Supabase
  // (implement ใน main app ด้วย idb-keyval หรือ localStorage)
  console.log('[SW] Syncing read receipts...');
}

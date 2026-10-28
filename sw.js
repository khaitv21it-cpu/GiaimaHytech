/* Service Worker - Giải mã Hytech (PWA Offline) */
const CACHE_VERSION = "hytech-v1";
const CACHE_NAME = `hytech-pwa-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png"
];

// Cài đặt Service Worker và precache tài nguyên cốt lõi
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Kích hoạt Service Worker và dọn dẹp các cache phiên bản cũ
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith("hytech-pwa-")) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Chiến lược Fetch: Cache First, Network Fallback cho tài nguyên tĩnh
self.addEventListener("fetch", (event) => {
  // Chỉ xử lý các yêu cầu HTTP/HTTPS GET, bỏ qua POST, PUT, DELETE...
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Chỉ can thiệp các yêu cầu cùng origin
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Cập nhật ngầm trong nền nếu có mạng (Stale-While-Revalidate nhẹ nhàng cho app shell)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
          // Bỏ qua lỗi mạng khi offline
        });
        return cachedResponse;
      }

      // Nếu chưa có trong cache, fetch từ mạng và lưu vào cache
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Khi hoàn toàn offline và request là điều hướng (HTML navigation)
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});

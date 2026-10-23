/*
 * ANATOMIX.AI service worker.
 * - Sayfalar (HTML): her zaman ağdan; bağlantı yoksa çevrimdışı sayfası. Oturuma bağlı sayfalar önbelleğe alınmaz.
 * - /api/*: hiçbir zaman önbelleğe alınmaz (oturum ve sağlık verisi içerir).
 * - Derlenmiş dosyalar (/_next/static) ve 3B modeller (/models, /draco): önce önbellek. Modeller büyük olduğu için
 *   bir kez indirildikten sonra tekrar açılışlar hızlanır.
 * - Marka görselleri ve ikonlar: önbellekten hemen, arka planda yenilenir.
 * Sürüm değişince eski önbellekler silinir.
 */
const VERSION = "anx-v3";
const STATIC_CACHE = `${VERSION}-static`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/brand/anatomix-mark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Önbellek tarayıcı tarafından boşaltılmış olabilir: çevrimiçiyken eksik çevrimdışı dosyaları yeniden yükle. */
async function ensurePrecache() {
  const cache = await caches.open(STATIC_CACHE);
  const missing = [];
  for (const url of PRECACHE) if (!(await cache.match(url))) missing.push(url);
  if (missing.length) await cache.addAll(missing).catch(() => undefined);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  // Ön yüklenen dosyalar (ör. logo) STATIC_CACHE'te: tüm önbelleklerde ara.
  const hit = await caches.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok && res.type === "basic") cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(
        (res) => {
          event.waitUntil(ensurePrecache());
          return res;
        },
        async () => (await caches.match(OFFLINE_URL)) || Response.error(),
      ),
    );
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/models/") || url.pathname.startsWith("/draco/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Wordly Service Worker: network-first with offline fallback so updates
// show up immediately when online while keeping all 9 games playable offline.
const CACHE_NAME = "wordly-pwa-v6";
const CORE_ASSETS = [
  "/",
  "/wordly",
  "/bee",
  "/boxed",
  "/connections",
  "/strands",
  "/mini",
  "/crossword",
  "/tiles",
  "/sudoku",
  "/style.css?v=6",
  "/games.css?v=6",
  "/common.js?v=6",
  "/manifest.json",
  "/icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});

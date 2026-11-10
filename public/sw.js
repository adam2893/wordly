// Wordly Service Worker: pre-caches every game HTML, JS, CSS, icon, and
// puzzle dictionary on install so all 11 games work 100% offline on phones,
// while using network-first when online so updates appear immediately.
const CACHE_NAME = "wordly-pwa-v7";
const PRECACHE_ASSETS = [
  "/",
  "/wordly",
  "/bee",
  "/boxed",
  "/connections",
  "/strands",
  "/wordsearch",
  "/mini",
  "/midi",
  "/crossword",
  "/tiles",
  "/sudoku",
  "/style.css",
  "/games.css",
  "/common.js",
  "/wordly.js",
  "/bee.js",
  "/boxed.js",
  "/connections.js",
  "/strands.js",
  "/wordsearch.js",
  "/crossword.js",
  "/tiles.js",
  "/sudoku.js",
  "/words.js",
  "/words-bee.js",
  "/words-boxed.js",
  "/words-connections.js",
  "/words-strands.js",
  "/words-wordsearch.js",
  "/words-mini.js",
  "/words-midi.js",
  "/words-crossword.js",
  "/words-sudoku.js",
  "/manifest.json",
  "/icon.png",
];

function canonicalKey(urlStr) {
  const u = new URL(urlStr, self.location.origin);
  if (u.pathname === "/index.html") u.pathname = "/";
  if (u.pathname.endsWith(".html")) u.pathname = u.pathname.slice(0, -5);
  // Strip ?v=... cache-busting query on static assets; keep page query only if not needed
  u.search = "";
  return u.origin + u.pathname;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.all(
          PRECACHE_ASSETS.map(async (assetPath) => {
            try {
              const res = await fetch(assetPath, { cache: "reload" });
              if (res && res.ok) {
                await cache.put(canonicalKey(assetPath), res.clone());
              }
            } catch {
              // ignore individual offline fetch failure
            }
          })
        );
      })
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

  const key = canonicalKey(req.url);

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(key, copy))
            .catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const hit = (await cache.match(key)) || (await cache.match(req, { ignoreSearch: true }));
        if (hit) return hit;
        if (req.mode === "navigate") {
          return (await cache.match(canonicalKey("/"))) || Response.error();
        }
        return Response.error();
      })
  );
});

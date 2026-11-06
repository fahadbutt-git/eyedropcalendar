// Offline support: network first, falling back to the cached copy. Only good
// responses are cached, and old cached files are cleared when the app updates.
const CACHE = "edt-v6";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon-192.png"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // The app is one page with hash routes, so only "/" is the app shell. The
  // privacy, terms and licence pages are cached under their own address.
  const page = req.mode === "navigate" && !/\.[a-z]+$/i.test(new URL(req.url).pathname);
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(page ? "./" : req, copy)));
        }
        return res;
      })
      .catch(() => caches.match(page ? "./" : req).then((r) => r || (page ? caches.match("./") : Response.error())))
  );
});

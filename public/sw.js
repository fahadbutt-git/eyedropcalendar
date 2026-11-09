// Offline support. The app files are saved when the service worker installs,
// so the site opens without a connection after the first visit. Pages are
// network first, falling back to the saved copy. The build's hashed files
// never change, so they are served from the saved copy first, whatever the
// Vary header of the response that saved them. Only good
// responses are saved, and old saved files are cleared when the app updates.
// The build writes the list of app files and a version into the two lines
// below (see vite.config.js).
const PRECACHE = [];
const CACHE = "edt-v7-dev";
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon-192.png", ...PRECACHE]))
      .then(() => self.skipWaiting())
  );
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
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // Files under /assets/ have a content hash in their name.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(req, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
            }
            return res;
          })
      )
    );
    return;
  }
  // The app is one page with hash routes, so only "/" is the app shell. The
  // privacy, terms and licence pages are cached under their own address.
  const page = req.mode === "navigate" && !/\.[a-z]+$/i.test(url.pathname);
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(page ? "./" : req, copy)));
        }
        return res;
      })
      .catch(() => caches.match(page ? "./" : req, { ignoreVary: true }).then((r) => r || (page ? caches.match("./", { ignoreVary: true }) : Response.error())))
  );
});

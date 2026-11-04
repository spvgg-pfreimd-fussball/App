/* Service Worker: macht die App installierbar und offline nutzbar.
   Updates kommen automatisch an, eine Neuinstallation ist nie nötig:
   Eigene Dateien werden immer zuerst frisch aus dem Netz geholt und nur
   ohne Netz aus dem Zwischenspeicher geladen. Daten von FuPa und aus dem
   Shop werden hier nicht zwischengespeichert. */
const CACHE = "spvgg-app-v1.5";
const SHELL = ["./", "index.html", "style.css", "app.js", "daten/inhalte.json",
  "img/wappen.webp", "img/icon-192.png", "manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

const VERSION = "lahza-network-v2";
const APP_CACHE = `${VERSION}-app`;
const IMAGE_CACHE = `${VERSION}-images`;
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.destination === "image") {
    event.respondWith(caches.open(IMAGE_CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("", { status: 503, statusText: "Offline" });
      }
    }));
    return;
  }

  if (request.mode === "navigate" || request.destination === "script" || request.destination === "style" || request.destination === "font") {
    event.respondWith(caches.open(APP_CACHE).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached || caches.match("/"));
      return cached || network;
    }));
  }
});

const CACHE = "aluvi-v32";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./index.html"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  const ehDocumento =
    e.request.mode === "navigate" ||
    e.request.destination === "document" ||
    (e.request.headers.get("accept") || "").includes("text/html");

  if (ehDocumento) {
    /* REDE PRIMEIRO para o app em si.
       Garante que o ALUVI nunca fique preso numa versao antiga em cache.
       Sem internet, cai para o cache e continua funcionando offline. */
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp && resp.ok) {
            const cp = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, cp));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  /* Demais recursos: cache primeiro, atualizando em segundo plano. */
  e.respondWith(
    caches.match(e.request).then(hit => {
      const rede = fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const cp = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
        }
        return resp;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});

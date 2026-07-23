const CACHE = "aluvi-v44";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./index.html"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  /* NUNCA interceptar chamadas para fora deste site (ex.: banco de dados Supabase).
     Dado tem que vir sempre fresco da rede. Guardar resposta de API em cache faz o
     app mostrar informacao antiga depois de salvar — parece que o dado "sumiu". */
  let alvo;
  try { alvo = new URL(e.request.url); } catch (_) { return; }
  if (alvo.origin !== self.location.origin) return;

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

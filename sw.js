// =====================================
// SERVICE WORKER (PWA)
// Guarda a "casca" do app no celular pra abrir rápido e funcionar como
// app instalado. Os dados (/api) sempre vêm do servidor — nunca do cache,
// pra ninguém ver saldo velho.
// Ao mudar o app.html, aumente a VERSAO pra forçar atualização.
// =====================================
const VERSAO = "coinzinho-v3";
const CASCA = ["/", "/manifest.json", "/icone.svg", "/icone-192.png", "/icone-512.png"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)));
  self.skipWaiting();
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// Rede primeiro; sem rede, usa a cópia guardada.
self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  ev.respondWith(
    fetch(ev.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(VERSAO).then((c) => c.put(ev.request, copia));
        return resp;
      })
      .catch(() => caches.match(ev.request))
  );
});

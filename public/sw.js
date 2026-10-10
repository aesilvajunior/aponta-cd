// ============================================================
// Aponta CD: Service Worker
//  - Cache do "esqueleto" do app para abrir rápido e abrir mesmo sem rede
//  - Notificações push (clique abre/foca o app)
//  - Atualização controlada: a versão nova espera o usuário aceitar
//    (botão "Atualizar" na barra de status), para não trocar de versão
//    no meio de um apontamento.
// Nunca guarda cache de chamadas ao Supabase nem de /api (dados sempre ao vivo).
// ============================================================

const VERSION = "v2";
const SHELL_CACHE = `aponta-cd-shell-${VERSION}`;
const ASSET_CACHE = `aponta-cd-assets-${VERSION}`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Aponta CD</title>
<body style="font-family:system-ui,sans-serif;background:#0e1013;color:#f4f5f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><h2>Sem conexão</h2><p style="color:#8d95a0">Não foi possível abrir o Aponta CD agora. Confira o Wi-Fi e tente de novo.</p>
<button onclick="location.reload()" style="padding:10px 20px;border:0;border-radius:6px;background:#ffb020;font-weight:600">Tentar de novo</button></div></body></html>`;

self.addEventListener("install", (event) => {
  // Sem skipWaiting aqui de propósito: a versão nova só assume quando o
  // usuário aceitar (mensagem SKIP_WAITING abaixo).
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("aponta-cd-") && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase etc.: direto na rede
  if (url.pathname.startsWith("/api/")) return; // funções do servidor: sempre ao vivo

  // Navegação (abrir/recarregar o app): rede primeiro, cache como reserva
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", fresh.clone());
          return fresh;
        } catch {
          const cached = (await caches.match("/")) || (await caches.match(request));
          return (
            cached ||
            new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })
          );
        }
      })()
    );
    return;
  }

  // Arquivos com hash (/assets/*): nunca mudam, então cache primeiro
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  // Ícones e manifest: usa o cache e atualiza em segundo plano
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
});

// Clique na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

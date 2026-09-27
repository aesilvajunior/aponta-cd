// ============================================================
// Aponta CD — Service Worker básico
// Cuida de notificações push e cache básico
// ============================================================

const CACHE_NAME = "aponta-cd-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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

// (Opcional) Cache básico — deixa passar tudo, sem cache agressivo
self.addEventListener("fetch", (event) => {
  // não intercepta nada por enquanto
});
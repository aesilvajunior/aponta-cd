// Registra o service worker e avisa o app quando existe versão nova esperando.
// onUpdateReady recebe uma função "aplicar" que ativa a versão nova e recarrega.
export function registerServiceWorker({ onUpdateReady } = {}) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  if (import.meta.env.DEV) return () => {};

  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  const onControllerChange = () => {
    // Só recarrega se já havia uma versão antes (troca pedida pelo usuário),
    // não na primeira instalação.
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

  let intervalId = null;
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      const notify = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          onUpdateReady?.(() => reg.waiting?.postMessage({ type: "SKIP_WAITING" }));
        }
      };
      notify();
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") notify();
        });
      });
      intervalId = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    })
    .catch(() => {});

  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    if (intervalId) clearInterval(intervalId);
  };
}

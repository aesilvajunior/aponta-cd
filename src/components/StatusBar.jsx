import React, { useEffect, useState } from "react";
import { getQueueState, subscribeQueue, retryFailed, syncQueue } from "../lib/offlineSync";

// Faixa de status no topo: sem conexão, pendências offline, envios que
// falharam e aviso de versão nova. Some quando está tudo normal.
export default function StatusBar({ realtimeStatus, updateReady }) {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queue, setQueue] = useState(getQueueState());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const unsub = subscribeQueue(setQueue);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
    };
  }, []);

  async function syncNow() {
    setSyncing(true);
    try { await syncQueue(); } finally { setSyncing(false); }
  }

  function retry() {
    retryFailed();
    syncNow();
  }

  const disconnected = !online || realtimeStatus === "offline";
  if (!disconnected && queue.pending === 0 && queue.failed === 0 && !updateReady) return null;

  return (
    <div className="status-bar-wrap" role="status" aria-live="polite">
      {disconnected && (
        <div className="status-bar status-bar-warn">
          <strong>Sem conexão.</strong>
          <span>
            {queue.pending > 0
              ? ` ${queue.pending} apontamento(s) guardado(s) neste aparelho. Serão enviados quando a internet voltar.`
              : " Os dados na tela podem estar desatualizados. Reconectando..."}
          </span>
        </div>
      )}

      {!disconnected && queue.pending > 0 && (
        <div className="status-bar status-bar-info">
          <span>{queue.pending} apontamento(s) aguardando envio.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={syncNow} disabled={syncing}>
            {syncing ? "Enviando..." : "Enviar agora"}
          </button>
        </div>
      )}

      {queue.failed > 0 && (
        <div className="status-bar status-bar-danger">
          <span>{queue.failed} apontamento(s) não puderam ser enviados. Avise o administrador.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>
            Tentar de novo
          </button>
        </div>
      )}

      {updateReady && (
        <div className="status-bar status-bar-info">
          <span>Nova versão do Aponta CD disponível.</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={updateReady}>
            Atualizar agora
          </button>
        </div>
      )}
    </div>
  );
}

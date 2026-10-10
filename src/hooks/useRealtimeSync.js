import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

// Assina mudanças de várias tabelas num único canal e se recupera sozinho:
//  - ao reconectar o websocket (SUBSCRIBED depois de uma queda)
//  - quando a aba volta a ficar visível
//  - quando a internet volta (evento "online")
//  - a cada `resyncMs` (rede de segurança contra evento perdido)
// Em todos esses casos chama onResync (com pequeno debounce).
//
// handlers: { nome_da_tabela: (payload) => void }
// Retorna "connecting" | "online" | "offline".
export function useRealtimeSync({ channelName, handlers, onResync, resyncMs = 5 * 60 * 1000, enabled = true }) {
  const [status, setStatus] = useState("connecting");
  const handlersRef = useRef(handlers);
  const resyncRef = useRef(onResync);
  handlersRef.current = handlers;
  resyncRef.current = onResync;

  // Só recria o canal se a lista de tabelas mudar
  const tablesKey = Object.keys(handlers || {}).sort().join(",");

  useEffect(() => {
    if (!enabled) return undefined;
    let disposed = false;
    let wasDown = false;
    let timer = null;

    const resync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!disposed) resyncRef.current?.();
      }, 400);
    };

    let channel = supabase.channel(channelName);
    tablesKey.split(",").filter(Boolean).forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => handlersRef.current?.[table]?.(payload)
      );
    });

    channel.subscribe((s) => {
      if (disposed) return;
      if (s === "SUBSCRIBED") {
        setStatus("online");
        if (wasDown) {
          wasDown = false;
          resync(); // pode ter perdido eventos enquanto estava fora
        }
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        wasDown = true;
        setStatus("offline");
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", resync);
    const iv = setInterval(resync, resyncMs);

    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", resync);
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, resyncMs, tablesKey]);

  return status;
}

// Aplica um evento realtime numa lista (insere, atualiza ou remove).
// Útil para evitar recarregar a tabela inteira a cada evento.
export function applyRealtimeChange(list, payload, { key = "id", compare = null, accept = null } = {}) {
  const { eventType, new: next, old: prev } = payload || {};
  if (eventType === "DELETE") {
    const k = prev?.[key];
    return k === undefined ? list : list.filter((item) => item[key] !== k);
  }
  if (!next) return list;
  const idx = list.findIndex((item) => item[key] === next[key]);
  if (accept && !accept(next)) {
    // saiu da janela/filtro: remove se existia
    return idx >= 0 ? list.filter((item) => item[key] !== next[key]) : list;
  }
  if (idx >= 0) {
    const copy = list.slice();
    copy[idx] = next;
    return compare ? copy.sort(compare) : copy;
  }
  const merged = [next, ...list];
  return compare ? merged.sort(compare) : merged;
}

// ============================================================
// Notificações push (locais + browser notification API)
// Simples: usa Notification API, sem backend de push
// ============================================================

const STORAGE_KEY = "aponta_push_enabled";

export function isPushSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPushPermission() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export function isPushEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export async function requestPushPermission() {
  if (!isPushSupported()) return { error: "Navegador não suporta notificações" };
  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
      return { granted: true };
    }
    try { localStorage.setItem(STORAGE_KEY, "0"); } catch {}
    return { granted: false, error: "Permissão negada" };
  } catch (e) {
    return { error: e.message };
  }
}

export function disablePush() {
  try { localStorage.setItem(STORAGE_KEY, "0"); } catch {}
}

export function enablePushWithoutPrompt() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

// Notificação local
export function showLocalNotification(title, body, opts = {}) {
  if (!isPushSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: opts.tag || "aponta-cd",
      requireInteraction: opts.requireInteraction || false,
      silent: opts.silent || false,
    });
    if (opts.onClick) {
      n.onclick = (e) => {
        e.preventDefault();
        opts.onClick();
        n.close();
      };
    }
    if (!opts.persistent) {
      setTimeout(() => n.close(), opts.timeout || 8000);
    }
    return n;
  } catch (e) {
    console.warn("Erro ao mostrar notificação:", e);
  }
}

// Helpers específicos pra casos de uso do Aponta CD
export function notifyNewConferenceItem(item) {
  const label = item.transfer_type
    ? `${item.transfer_type} #${item.transfer_number || ""}`
    : item.order_number
    ? `Pedido #${item.order_number}`
    : "Item";
  const customer = item.customer_name ? ` · ${item.customer_name}` : "";
  showLocalNotification(
    "Novo pedido na mesa de conferência",
    `${label}${customer} — separado por ${item.separated_by_name || "—"}`,
    {
      tag: `conference-${item.id}`,
      onClick: () => {
        window.focus();
        window.location.href = "/?tab=conference";
      },
    }
  );
}

export function notifyLateActivity(session, elapsedSeconds) {
  showLocalNotification(
    "Atividade demorada",
    `${session.operator_name} — ${session.activity} há ${formatSeconds(elapsedSeconds)}`,
    {
      tag: `late-${session.operator_code}`,
      requireInteraction: true,
      onClick: () => {
        window.focus();
        window.location.href = "/?tab=panel";
      },
    }
  );
}

export function notifySlaBottleneck(alert, onOpen) {
  if (!alert) return;
  showLocalNotification(
    alert.severity === "critical" ? `🚨 ${alert.title}` : `⚠️ ${alert.title}`,
    alert.message,
    {
      tag: `sla-${alert.id}`,
      requireInteraction: alert.severity === "critical",
      onClick: () => {
        window.focus();
        if (onOpen) onOpen(alert);
      },
    }
  );
}

function formatSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
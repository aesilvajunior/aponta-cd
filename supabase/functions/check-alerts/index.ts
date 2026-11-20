// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "";

async function sendWhatsApp(to: string, message: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) return { ok: false, error: "sem token" };
  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });
  return { ok: res.ok };
}

serve(async (req) => {
  const auth = requireCronAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = Date.now();

  const { data: settings } = await supabase
    .from("alert_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!settings?.whatsapp_enabled || !settings?.whatsapp_number) {
    return new Response(JSON.stringify({ skipped: "alertas desativados" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: activities } = await supabase
    .from("activities")
    .select("name, target_seconds")
    .eq("active", true);

  const { data: sessions } = await supabase
    .from("active_sessions")
    .select("*")
    .is("paused_at", null);

  const activityMap: Record<string, any> = {};
  (activities || []).forEach((a: any) => { activityMap[a.name] = a; });

  const alertsToSend: { alertType: string; message: string; payload: any }[] = [];

  // 1) Atividades muito atrasadas
  (sessions || []).forEach((s: any) => {
    const pausedSecs = s.total_paused_seconds || 0;
    const elapsed = Math.max(0, Math.round((now - new Date(s.start_time).getTime()) / 1000) - pausedSecs);
    const cfg = activityMap[s.activity];
    const threshold = cfg?.target_seconds || 1800;
    const multiplier = settings.alert_late_multiplier || 3;
    if (elapsed > threshold * multiplier) {
      alertsToSend.push({
        alertType: "late_activity",
        message: `⚠️ Atividade muito atrasada\n${s.operator_name} — ${s.activity}\nTempo: ${Math.round(elapsed / 60)} min (meta: ${Math.round(threshold / 60)} min)`,
        payload: { operator_code: s.operator_code, activity: s.activity, elapsed },
      });
    }
  });

  // 2) Mesa acumulada
  const { data: waiting } = await supabase
    .from("conference_queue")
    .select("id")
    .eq("status", "aguardando");
  const waitingCount = (waiting || []).length;
  const mesaThreshold = settings.alert_mesa_threshold || 10;
  if (waitingCount >= mesaThreshold) {
    alertsToSend.push({
      alertType: "mesa_acumulada",
      message: `🔴 Mesa de conferência com ${waitingCount} pedidos aguardando. Reforce a equipe!`,
      payload: { waitingCount },
    });
  }

  // 3) Sessões "esquecidas" (abertas há muito tempo)
  const missingHours = settings.alert_missing_hours || 4;
  (sessions || []).forEach((s: any) => {
    const elapsedHours = (now - new Date(s.start_time).getTime()) / (1000 * 60 * 60);
    if (elapsedHours > missingHours) {
      alertsToSend.push({
        alertType: "missing_operator",
        message: `👻 Sessão esquecida\n${s.operator_name} — ${s.activity}\nAberta há ${elapsedHours.toFixed(1)}h`,
        payload: { operator_code: s.operator_code, elapsedHours },
      });
    }
  });

  // 4) Erros do sistema (tablets/TV): vários erros em pouco tempo
  if (settings.alert_system_enabled !== false) {
    const sinceErrors = new Date(now - 15 * 60 * 1000).toISOString();
    const { data: errs } = await supabase
      .from("client_errors")
      .select("id, message, station")
      .gte("created_at", sinceErrors);
    const errThreshold = settings.alert_errors_threshold || 5;
    if ((errs || []).length >= errThreshold) {
      const last = (errs || [])[0];
      alertsToSend.push({
        alertType: "system_errors",
        message: `🛠️ ${errs!.length} erros no sistema nos últimos 15 min\nÚltimo: ${String(last?.message || "").slice(0, 120)}\nVeja em Sistema > Saúde do sistema.`,
        payload: { count: errs!.length },
      });
    }
  }

  // Evita repetir o mesmo alerta a cada execução (a função roda de poucos em poucos minutos):
  // um alerta igual só é reenviado depois de 60 min.
  const sinceDedup = new Date(now - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("alert_log")
    .select("alert_type, payload, success")
    .gte("sent_at", sinceDedup)
    .eq("success", true);
  const keyOf = (type: string, p: any) => `${type}:${p?.operator_code || ""}:${p?.activity || ""}`;
  const alreadySent = new Set((recent || []).map((r: any) => keyOf(r.alert_type, r.payload)));
  const fresh = alertsToSend.filter((a) => !alreadySent.has(keyOf(a.alertType, a.payload)));

  // Envia cada um
  let sent = 0;
  for (const alert of fresh) {
    const res = await sendWhatsApp(settings.whatsapp_number, alert.message);
    await supabase.from("alert_log").insert({
      alert_type: alert.alertType,
      payload: alert.payload,
      success: res.ok,
      error_message: res.ok ? null : res.error,
    });
    if (res.ok) sent++;
  }

  return new Response(
    JSON.stringify({ checked: (sessions || []).length, alertsSent: sent, skippedDuplicates: alertsToSend.length - fresh.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
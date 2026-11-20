// Edge Function: notify-late-routine
// Rodar via cron a cada 5 min (config abaixo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, requireCronAuth } from "../_shared/security.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const supabase = createClient(SB_URL, SB_KEY);

function nowBRT(): { hhmm: string; date: string; iso: string } {
  const now = new Date();
  // Ajuste para o fuso do CD (America/Sao_Paulo = UTC-3)
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const hh = String(brt.getUTCHours()).padStart(2, "0");
  const mm = String(brt.getUTCMinutes()).padStart(2, "0");
  const date = brt.toISOString().slice(0, 10);
  return { hhmm: `${hh}:${mm}`, date, iso: now.toISOString() };
}

async function sendTelegram(chat_id: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req) => {
  const auth = requireCronAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { hhmm, date } = nowBRT();

  // 1. Busca config das etapas ativas
  const { data: steps } = await supabase
    .from("routine_steps_config")
    .select("*")
    .eq("active", true);

  if (!steps?.length) return new Response("no steps", { status: 200 });

  // 2. Busca o que já foi concluído hoje
  const { data: done } = await supabase
    .from("daily_routine_progress")
    .select("step_key")
    .eq("routine_date", date);
  const doneSet = new Set((done ?? []).map((d) => d.step_key));

  // 3. Busca subscribers ativos
  const { data: subs } = await supabase
    .from("telegram_subscribers")
    .select("chat_id, label")
    .eq("active", true);
  if (!subs?.length) return new Response("no subs", { status: 200 });

  const alerts: string[] = [];

  for (const s of steps) {
    if (doneSet.has(s.step_key)) continue;

    const [dh, dm] = s.deadline_time.split(":").map(Number);
    const [nh, nm] = hhmm.split(":").map(Number);
    const deadlineMin = dh * 60 + dm;
    const nowMin = nh * 60 + nm;
    const diff = nowMin - deadlineMin;

    // Ainda não passou do prazo + margem?
    if (diff < s.alert_after_min) continue;

    // Já avisou nos últimos X min?
    const since = new Date(Date.now() - s.repeat_every_min * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("routine_alerts_log")
      .select("id")
      .eq("alert_date", date)
      .eq("step_key", s.step_key)
      .gte("sent_at", since)
      .limit(1);
    if (recent?.length) continue;

    // Registra e enfileira alerta
    await supabase.from("routine_alerts_log").insert({
      alert_date: date,
      step_key: s.step_key,
    });

    const late = diff - s.alert_after_min;
    alerts.push(
      `⏰ <b>${escapeHtml(s.label)}</b>\n` +
      `Prazo: ${escapeHtml(s.deadline_time)} | Atrasada há ${late} min\n` +
      `<i>${escapeHtml(s.description ?? "")}</i>`
    );
  }

  if (!alerts.length) return new Response("ok, nothing late", { status: 200 });

  const text =
    `🚨 <b>Rotina do Líder — ${date}</b>\n\n` +
    alerts.join("\n\n") +
    `\n\n👉 Marque no app: Aponta CD → Rotina do Líder`;

  await Promise.all(subs.map((s) => sendTelegram(s.chat_id, text)));

  return new Response(`enviado para ${subs.length} destino(s)`, { status: 200 });
});
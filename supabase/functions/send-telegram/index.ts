// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isOriginAllowed, requireUserAuth } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";

async function sendTelegram(text: string, chatId: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados");
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4000),
      parse_mode: "HTML",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.description || "Erro ao enviar Telegram");
  }
  return json;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, "POST, OPTIONS");

  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ error: "Origem não autorizada." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUserAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { text, chatId, alertType = "generic", payload = {}, logToDb = true } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'text' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Impede abuso como open relay: só permite enviar para TELEGRAM_CHAT_ID padrão
    // ou para um chat_id cadastrado e ativo em telegram_subscribers.
    let target = TELEGRAM_CHAT_ID;
    if (chatId && String(chatId) !== String(TELEGRAM_CHAT_ID)) {
      const { data: sub } = await supabase
        .from("telegram_subscribers")
        .select("chat_id")
        .eq("chat_id", String(chatId))
        .eq("active", true)
        .maybeSingle();
      if (!sub) {
        return new Response(
          JSON.stringify({ error: "chatId não autorizado." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      target = String(sub.chat_id);
    }

    let success = true;
    let errorMessage: string | null = null;

    try {
      await sendTelegram(text, target);
    } catch (e) {
      success = false;
      errorMessage = String(e);
    }

    if (logToDb) {
      await supabase.from("alert_log").insert({
        alert_type: String(alertType).slice(0, 60),
        payload: { text: text.slice(0, 500), chatId: target, ...payload },
        success,
        error_message: errorMessage,
      });
    }

    return new Response(
      JSON.stringify({ ok: success, error: errorMessage }),
      { status: success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao processar envio do Telegram." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendTelegram(text: string, chatId?: string) {
  const target = chatId || TELEGRAM_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !target) {
    throw new Error("TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados");
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: target,
      text,
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, chatId, alertType = "generic", payload = {}, logToDb = true } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'text' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let success = true;
    let errorMessage: string | null = null;

    try {
      await sendTelegram(text, chatId);
    } catch (e) {
      success = false;
      errorMessage = String(e);
    }

    if (logToDb) {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      await supabase.from("alert_log").insert({
        alert_type: alertType,
        payload: { text, chatId, ...payload },
        success,
        error_message: errorMessage,
      });
    }

    return new Response(
      JSON.stringify({ ok: success, error: errorMessage }),
      { status: success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
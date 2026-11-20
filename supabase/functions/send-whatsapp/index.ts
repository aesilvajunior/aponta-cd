// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isOriginAllowed, requireUserAuth } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "";

async function sendWhatsApp(to: string, message: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    throw new Error("WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID não configurados");
  }
  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: message.slice(0, 4000) },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "Erro ao enviar WhatsApp");
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
    const { to, message, alertType = "generic", payload = {}, logToDb = true } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'message' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Impede open relay de SMS/WhatsApp: só permite enviar para o número configurado em alert_settings
    const { data: settings } = await supabase
      .from("alert_settings")
      .select("whatsapp_number")
      .eq("id", 1)
      .maybeSingle();

    const configuredTo = String(settings?.whatsapp_number || "").replace(/\D/g, "");
    const requestedTo = String(to || configuredTo).replace(/\D/g, "");

    if (!requestedTo || (!auth.isService && configuredTo && requestedTo !== configuredTo)) {
      return new Response(
        JSON.stringify({ error: "Número de destino não autorizado." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let success = true;
    let errorMessage: string | null = null;

    try {
      await sendWhatsApp(requestedTo, message);
    } catch (e) {
      success = false;
      errorMessage = String(e);
    }

    if (logToDb) {
      await supabase.from("alert_log").insert({
        alert_type: String(alertType).slice(0, 60),
        payload: { to: requestedTo, message: message.slice(0, 500), ...payload },
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
      JSON.stringify({ error: "Erro ao processar envio do WhatsApp." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

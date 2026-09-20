// ============================================================
// Edge Function — criar/editar/remover evento no Google Calendar
// Roda no Cloudflare Pages Functions (serverless).
//
// Lê as credenciais de 2 formas (prioridade pra base64):
//   1) GOOGLE_SERVICE_ACCOUNT_JSON_B64 (base64 do JSON)
//   2) GOOGLE_SERVICE_ACCOUNT_JSON (JSON cru — legado)
// ============================================================

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlEncode(input) {
  let str = "";
  if (input instanceof ArrayBuffer) {
    const bytes = new Uint8Array(input);
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  } else {
    str = input;
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Decodifica base64 -> string (o JSON original)
function b64ToString(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimB64 = base64UrlEncode(JSON.stringify(claim));
  const toSign = `${headerB64}.${claimB64}`;

  const keyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(toSign)
  );

  const jwt = `${toSign}.${base64UrlEncode(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao obter token do Google: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

function buildEventBody(payload) {
  const {
    scheduled_at,
    supplier_name,
    invoice_number,
    carrier,
    purchase_order,
    volume_weight,
    responsible_name,
    observation,
  } = payload;

  const start = new Date(scheduled_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const descLines = [];
  if (invoice_number) descLines.push(`Nota fiscal: ${invoice_number}`);
  if (carrier) descLines.push(`Transportadora: ${carrier}`);
  if (purchase_order) descLines.push(`Pedido de compra: ${purchase_order}`);
  if (volume_weight) descLines.push(`Volume/Peso: ${volume_weight}`);
  if (responsible_name) descLines.push(`Responsável: ${responsible_name}`);
  if (observation) descLines.push(`Observação: ${observation}`);
  descLines.push("");
  descLines.push("— Gerado automaticamente pelo Aponta CD");

  return {
    summary: `📥 Recebimento — ${supplier_name}`,
    description: descLines.join("\n"),
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Tenta ler de 2 formas: base64 (novo) OU texto cru (legado)
    const credB64 = env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
    const credRaw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const calendarId = env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_CALENDAR_ID não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!credB64 && !credRaw) {
      return new Response(
        JSON.stringify({
          error: "GOOGLE_SERVICE_ACCOUNT_JSON_B64 (ou GOOGLE_SERVICE_ACCOUNT_JSON) não configurada.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let credJson;
    try {
      credJson = credB64 ? b64ToString(credB64) : credRaw;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Falha ao decodificar base64 do JSON: " + e.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(credJson);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "JSON inválido: " + e.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(serviceAccount);
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    // DELETE
    if (request.method === "DELETE") {
      const body = await request.json().catch(() => ({}));
      const eventId = body?.google_event_id;
      if (!eventId) {
        return new Response(JSON.stringify({ ok: true, skipped: "sem google_event_id" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const delRes = await fetch(`${baseUrl}/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return new Response(JSON.stringify({ ok: delRes.ok }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST / PUT
    const body = await request.json();
    const eventBody = buildEventBody(body);

    if (request.method === "PUT") {
      const googleEventId = body.google_event_id;
      if (!googleEventId) {
        const createRes = await fetch(baseUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        });
        if (!createRes.ok) {
          const err = await createRes.text();
          throw new Error(`Google retornou ${createRes.status}: ${err}`);
        }
        const created = await createRes.json();
        return new Response(JSON.stringify({ eventId: created.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updRes = await fetch(`${baseUrl}/${googleEventId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      if (!updRes.ok) {
        const err = await updRes.text();
        throw new Error(`Google retornou ${updRes.status}: ${err}`);
      }
      const updated = await updRes.json();
      return new Response(JSON.stringify({ eventId: updated.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST (default)
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Google retornou ${createRes.status}: ${err}`);
    }

    const created = await createRes.json();
    return new Response(JSON.stringify({ eventId: created.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
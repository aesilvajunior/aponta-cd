// ============================================================
// Edge Function — criar/editar/remover evento no Google Calendar
// Variáveis de ambiente (Cloudflare Pages > Settings > Variables):
//   GOOGLE_SA_EMAIL     e-mail da conta de serviço
//   GOOGLE_SA_KEY       chave privada (com \n literais)
//   GOOGLE_CALENDAR_ID  agenda onde os eventos são criados
//   SUPABASE_URL        mesma URL do projeto Supabase usada no app
//   SUPABASE_ANON_KEY   mesma chave anon usada no app
//   ALLOWED_ORIGIN      (opcional) outros domínios autorizados, separados
//                       por vírgula. O próprio domínio do site já é aceito.
//
// Segurança: só atende quem estiver logado no app (token do Supabase no
// header Authorization) e só a partir de origens autorizadas.
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

async function getAccessToken(email, key) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimB64 = base64UrlEncode(JSON.stringify(claim));
  const toSign = `${headerB64}.${claimB64}`;

  const keyBuffer = pemToArrayBuffer(key);
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

const EVENT_ID_RE = /^[a-zA-Z0-9_-]{5,1024}$/;

function sanitizeText(v, max = 300) {
  return Array.from(String(v ?? ""))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join("")
    .trim()
    .slice(0, max);
}

function validateEventId(id) {
  const s = String(id ?? "").trim();
  return EVENT_ID_RE.test(s) ? s : null;
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
  } = payload || {};

  const start = new Date(scheduled_at);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Data/hora do agendamento inválida.");
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const supplier = sanitizeText(supplier_name, 160);
  if (!supplier) {
    throw new Error("Nome do fornecedor é obrigatório.");
  }

  const descLines = [];
  if (invoice_number) descLines.push(`Nota fiscal: ${sanitizeText(invoice_number, 80)}`);
  if (carrier) descLines.push(`Transportadora: ${sanitizeText(carrier, 120)}`);
  if (purchase_order) descLines.push(`Pedido de compra: ${sanitizeText(purchase_order, 80)}`);
  if (volume_weight) descLines.push(`Volume/Peso: ${sanitizeText(volume_weight, 80)}`);
  if (responsible_name) descLines.push(`Responsável: ${sanitizeText(responsible_name, 120)}`);
  if (observation) descLines.push(`Observação: ${sanitizeText(observation, 500)}`);
  descLines.push("");
  descLines.push("— Gerado automaticamente pelo Aponta CD");

  return {
    summary: `📥 Recebimento — ${supplier}`,
    description: descLines.join("\n"),
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Confere com o Supabase se o token é de uma sessão válida.
async function isLoggedIn(request, env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { ok: false, misconfigured: true };

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false };

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  // Origens aceitas: o próprio site + as listadas em ALLOWED_ORIGIN
  const selfOrigin = new URL(request.url).origin;
  const allowedOrigins = [
    selfOrigin,
    ...(env.ALLOWED_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean),
  ];
  const origin = request.headers.get("Origin");

  const corsHeaders = {
    "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : selfOrigin,
    "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };

  if (origin && !allowedOrigins.includes(origin)) {
    return json({ error: "Origem não autorizada." }, 403, corsHeaders);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const login = await isLoggedIn(request, env);
  if (login.misconfigured) {
    return json({ error: "SUPABASE_URL / SUPABASE_ANON_KEY não configuradas nas variáveis do servidor." }, 500, corsHeaders);
  }
  if (!login.ok) {
    return json({ error: "Não autorizado. Faça login novamente." }, 401, corsHeaders);
  }

  try {
    const email = env.GOOGLE_SA_EMAIL;
    const key = env.GOOGLE_SA_KEY;
    const calendarId = env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_CALENDAR_ID não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!email || !key) {
      return new Response(
        JSON.stringify({
          error: "GOOGLE_SA_EMAIL ou GOOGLE_SA_KEY não configuradas.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(email, key);
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    // DELETE
    if (request.method === "DELETE") {
      const body = await request.json().catch(() => ({}));
      const rawEventId = body?.google_event_id;
      if (!rawEventId) {
        return json({ ok: true, skipped: "sem google_event_id" }, 200, corsHeaders);
      }
      const eventId = validateEventId(rawEventId);
      if (!eventId) {
        return json({ error: "Identificador de evento inválido." }, 400, corsHeaders);
      }
      const delRes = await fetch(`${baseUrl}/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return json({ ok: delRes.ok }, 200, corsHeaders);
    }

    // POST / PUT
    const body = await request.json();
    const eventBody = buildEventBody(body);

    if (request.method === "PUT") {
      const rawEventId = body.google_event_id;
      if (!rawEventId) {
        const createRes = await fetch(baseUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        });
        if (!createRes.ok) {
          throw new Error(`Erro ao criar evento no Google Calendar (HTTP ${createRes.status}).`);
        }
        const created = await createRes.json();
        return json({ eventId: created.id }, 200, corsHeaders);
      }
      const googleEventId = validateEventId(rawEventId);
      if (!googleEventId) {
        return json({ error: "Identificador de evento inválido." }, 400, corsHeaders);
      }
      const updRes = await fetch(`${baseUrl}/${encodeURIComponent(googleEventId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      if (!updRes.ok) {
        throw new Error(`Erro ao atualizar evento no Google Calendar (HTTP ${updRes.status}).`);
      }
      const updated = await updRes.json();
      return json({ eventId: updated.id }, 200, corsHeaders);
    }

    // POST (default)
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody),
    });

    if (!createRes.ok) {
      throw new Error(`Erro ao criar evento no Google Calendar (HTTP ${createRes.status}).`);
    }

    const created = await createRes.json();
    return json({ eventId: created.id }, 200, corsHeaders);
  } catch (err) {
    const safeMsg = err?.message && /inválid|obrigatóri|HTTP \d+/i.test(err.message)
      ? err.message
      : "Erro interno ao processar agendamento no Google Calendar.";
    return json({ error: safeMsg }, 500, corsHeaders);
  }
}
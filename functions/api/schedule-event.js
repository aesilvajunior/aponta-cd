// ============================================================
// Edge Function — Google Calendar
// Credenciais embutidas (roda no servidor, não vai pro navegador)
// ============================================================

const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "aponta-cd",
  private_key_id: "e80889c4c34cad59220055b76a4a488556b4390b",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDgoCSMJgCTISfX\nkHgn6DTtII0X6FdG99vL/QjQxDtsQM9QT9Q8l5tTLSNeLxz5F2btVeaMdwu20e15\noBZDCsWuvGGoZHZMOoG5OpznYWlIb2S6abp4UTH7rOMmPQEJMs9V9QtR5rjanuFx\nW7IjwkDo+/y8ycr7qM4A1u4V71EYhgWJVrY9crEi3hiF3pKgH6AkDSCLxJOcuaOL\nU2SXBaLCuGG0GQ4MFhTrO3lEE8bg8U3z6/2wHGUDs6qL0YFjLYJzGSuqzCR/2B31\n6OHYw9grl1WUiqfQ2G0DnEG6ShXDQlfGJIlVNyHvyXdwXV9/II3dJu6lZT+Qg+8d\nFoRSy0KbAgMBAAECggEAY9t9c9pfDglCy4dbiy4k/Ten0bWFuzRrv2r9FMXvvsev\nAf6DFO6268qYuwGJyUh4htDVvaMcj4kSn6ulyecLi4sOhQwoNOobiks+vnPlGIEA\n0Ag5j8xUwpQQpQqgn8S5PHbDsgS2L+ZKxZikgFYWghyntgulU6wu7FugGxs5O4Nf\n0+CvPlekyplaXE6uCKCF/kSuGlYtEpfBS7lzLrmE848AIahhyh+e06AiRWqQcI7C\n3iCUd3tt31CPl5JIhZwbolUnKN7e4/Uvu6KDgLmxXDCjTK7WGUHa2wNswKMn1/uT\n7fkinQgV9gLpXJ6GRqIPWDg3dQI2ArNfmexdktGBnQKBgQDwTw5GXXRLroZ1UNJU\nm8FblYr3dHfp5Lso/raYXKOiVXK3ZHTiwxHukp5Zk9xejYV2nZ/PCLpsy/D15YoO\nNvUv7EL0zSaJKO/S0y88PImipfr6oW9obYtbGAoXhbwRyNMrFFPNizXBBnRHHKZo\nK0yO+QO335iEwFTO88xcaBuUFQKBgQDvSu30GniaN56hkAs98I7NAl2fIPioQNv6\nalrYOHYMGpakn+eNJyXtQ8Rw/hLYxjgvHBk0YL8KgEZFkLIByvLY3V8S3s52mU3u\n+xyqHsWKh/qUuqHcAytK3Ctox7nqK4yJXC7GHLWvOAddapeceX+rKvIaUIQX3LcS\npz/M+K237wKBgARFk35iuOeDgbZiKmsAnc5P+Tlu45bPzxfqdzp8IxiGplRmP8Gs\nMAxqpM/41ekEYQP7x1R51j6K3YyxeOPJzE/+xi3t26qChMjdojBS7ytqAe0ko4Na\ntyh2Y++JHA/A3ygb42V6/QiiYbzF4JtncaP0/0Dsg5yQgrFvGgnme98FAoGAbX2I\ngY/3LQFUGTLSogXHIXD6q4wnmr0KqnstlA/Jm+IymaL9DS4jgXvnj5gBwaR5Ir0l\nnzzBTSnCfaQmfwGAutAX54eBSuz8puPJiuHHm4p6ksEOvJ/KmFdDmY8Bt28zv8op\nMMcELudhH1JdiuBhFU3yNy4uMsjwD53taHlE64sCgYAJfFbyNRh7hnWs4oDjq6MK\nq1AJtK4A7TjrOhi44la/VyujAPYC5fX0sJBvtbx+xz4sXlyI7fgIi0viDO2fvRWI\nm+vzfofJ5tdJ8yuXcGsjoJI0XYMYh9ZB2LOSlFqtheTmNW68b29Hyq02ebOQlu7C\nZV+ZjD1hf1UQmtpciKKppw==\n-----END PRIVATE KEY-----\n",
  client_email: "aponta-cd-bot@aponta-cd.iam.gserviceaccount.com",
};

const CALENDAR_ID = "7023e3979f32f3aed71a7d0fcc1ec21d673c587f35a09ed81bef65a387f953d9@group.calendar.google.com";

function pemToArrayBuffer(pem) {
  const normalized = pem.replace(/\\n/g, "\n");
  const b64 = normalized
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
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimB64 = base64UrlEncode(JSON.stringify(claim));
  const toSign = `${headerB64}.${claimB64}`;

  const keyBuffer = pemToArrayBuffer(SERVICE_ACCOUNT.private_key);
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
  const { scheduled_at, supplier_name, invoice_number, carrier, purchase_order, volume_weight, responsible_name, observation } = payload;
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
  const { request } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = await getAccessToken();
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;

    if (request.method === "DELETE") {
      const body = await request.json().catch(() => ({}));
      const eventId = body?.google_event_id;
      if (!eventId) {
        return new Response(JSON.stringify({ ok: true, skipped: "sem google_event_id" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const delRes = await fetch(`${baseUrl}/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return new Response(JSON.stringify({ ok: delRes.ok }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
        return new Response(JSON.stringify({ eventId: created.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ eventId: updated.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
    return new Response(JSON.stringify({ eventId: created.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
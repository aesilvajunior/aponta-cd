// ============================================================
// Helpers compartilhados de segurança para Supabase Edge Functions
// ============================================================

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Comparação em tempo constante para segredos (evita timing attacks)
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// CORS restrito quando ALLOWED_ORIGIN está definido nos Secrets do Supabase
export function getCorsHeaders(req: Request, methods = "POST, OPTIONS") {
  const allowedRaw = (Deno.env.get("ALLOWED_ORIGIN") || "").trim();
  const origin = req.headers.get("Origin") || "";
  let allowOrigin = "*";

  if (allowedRaw) {
    const allowed = allowedRaw.split(",").map((s) => s.trim()).filter(Boolean);
    allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  } else if (origin) {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": methods,
    Vary: "Origin",
  };
}

export function isOriginAllowed(req: Request): boolean {
  const allowedRaw = (Deno.env.get("ALLOWED_ORIGIN") || "").trim();
  if (!allowedRaw) return true;
  const origin = req.headers.get("Origin");
  if (!origin) return true; // chamadas server-to-server/cron sem Origin
  const allowed = allowedRaw.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin);
}

// Valida se o chamador é um usuário autenticado no Supabase Auth OU usa a service_role key
export async function requireUserAuth(req: Request): Promise<{ ok: boolean; isService?: boolean; userId?: string; status: number; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, error: "Token de autenticação ausente." };
  }

  // Aceita chamadas internas com service_role
  if (serviceKey && timingSafeEqual(token, serviceKey)) {
    return { ok: true, isService: true, status: 200 };
  }

  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: "Servidor sem configuração do Supabase." };
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { ok: false, status: 401, error: "Sessão inválida ou expirada." };
    }
    const user = await res.json();
    if (!user?.id) {
      return { ok: false, status: 401, error: "Usuário não autenticado." };
    }
    return { ok: true, isService: false, userId: user.id, status: 200 };
  } catch {
    return { ok: false, status: 401, error: "Falha ao validar autenticação." };
  }
}

// Valida chamadas de cron / scheduler (exige service_role Bearer ou header x-cron-secret)
export function requireCronAuth(req: Request): { ok: boolean; status: number; error?: string } {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";

  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = (req.headers.get("x-cron-secret") || "").trim();

  if (serviceKey && bearer && timingSafeEqual(bearer, serviceKey)) {
    return { ok: true, status: 200 };
  }
  if (cronSecret && ((headerSecret && timingSafeEqual(headerSecret, cronSecret)) || (bearer && timingSafeEqual(bearer, cronSecret)))) {
    return { ok: true, status: 200 };
  }
  return { ok: false, status: 401, error: "Não autorizado para executar rotina agendada." };
}

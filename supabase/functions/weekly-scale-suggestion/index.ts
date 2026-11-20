// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isOriginAllowed, requireUserAuth } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, "GET, POST, OPTIONS");

  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ error: "Origem não autorizada." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUserAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Últimos 60 dias
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: entries } = await supabase
    .from("entries")
    .select("start_time, duration_seconds")
    .gte("start_time", since);

  // Agrupa por (dia da semana, hora)
  const buckets: Record<string, { count: number; totalSec: number }> = {};
  (entries || []).forEach((e: any) => {
    const d = new Date(e.start_time);
    const key = `${d.getDay()}-${d.getHours()}`;
    if (!buckets[key]) buckets[key] = { count: 0, totalSec: 0 };
    buckets[key].count++;
    buckets[key].totalSec += e.duration_seconds || 0;
  });

  // Média por bucket
  const weeks = 60 / 7;
  const suggestion: any[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 6; hour < 22; hour++) {
      const key = `${day}-${hour}`;
      const b = buckets[key];
      const avgCount = b ? Math.round(b.count / weeks) : 0;
      const avgSec = b && b.count > 0 ? Math.round(b.totalSec / b.count) : 0;
      // Estimativa: 1 operador a cada 8 registros/hora
      const operatorsNeeded = Math.max(1, Math.ceil(avgCount / 8));
      suggestion.push({ day, hour, avgCount, avgSec, operatorsNeeded });
    }
  }

  return new Response(JSON.stringify({ suggestion }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

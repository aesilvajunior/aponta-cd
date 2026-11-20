// Edge Function: run-scheduled-reports
// Envia por e-mail os relatórios cadastrados em "Sistema > Export agendado".
// Rodar de HORA EM HORA (veja docs/RELATORIOS-AGENDADOS.md). Cada relatório só sai na hora
// e no dia configurados, e no máximo uma vez por dia.
//
// Variáveis (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY        chave da conta no resend.com
//   REPORTS_FROM_EMAIL    ex.: "Aponta CD <relatorios@seudominio.com.br>"
//   (SUPABASE_URL e a chave de serviço já existem; aceita SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY)
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import { isDue, periodFor, toCsv, summarizeByOperator } from "../_shared/reportLogic.js";
import { escapeHtml, requireCronAuth } from "../_shared/security.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("REPORTS_FROM_EMAIL") || "";

const supabase = createClient(SB_URL, SB_KEY);

const TITLES: Record<string, string> = {
  apontamentos: "Apontamentos",
  faltas: "Faltas de material",
  erros: "Erros de separação",
  conferencia: "Conferência",
  metas: "Resumo por operador",
};

async function buildRows(type: string, fromIso: string, toIso: string) {
  switch (type) {
    case "apontamentos": {
      const { data } = await supabase.from("entries").select("*")
        .gte("start_time", fromIso).lt("start_time", toIso).order("start_time").limit(20000);
      return { rows: data || [], columns: [
        { key: "start_time", label: "Início" }, { key: "end_time", label: "Fim" },
        { key: "operator_name", label: "Operador" }, { key: "activity", label: "Atividade" },
        { key: "duration_seconds", label: "Duração (s)" }, { key: "shift", label: "Turno" },
        { key: "order_number", label: "Pedido" }, { key: "customer_name", label: "Cliente" },
        { key: "note", label: "Observação" },
      ] };
    }
    case "faltas": {
      const { data } = await supabase.from("entry_shortages").select("*")
        .gte("created_at", fromIso).lt("created_at", toIso).order("created_at").limit(20000);
      return { rows: data || [], columns: [
        { key: "created_at", label: "Quando" }, { key: "product_code", label: "Produto" },
        { key: "quantity", label: "Quantidade" }, { key: "supplier_name", label: "Fornecedor" },
      ] };
    }
    case "erros": {
      const { data } = await supabase.from("separation_errors").select("*")
        .gte("created_at", fromIso).lt("created_at", toIso).order("created_at").limit(20000);
      return { rows: data || [], columns: [
        { key: "created_at", label: "Quando" }, { key: "operator_name", label: "Registrado por" },
        { key: "error_type", label: "Tipo de erro" }, { key: "error_operator_name", label: "Quem errou" },
        { key: "order_number", label: "Pedido" }, { key: "station", label: "Estação" }, { key: "note", label: "Observação" },
      ] };
    }
    case "conferencia": {
      const { data } = await supabase.from("conference_queue").select("*")
        .gte("conference_finished_at", fromIso).lt("conference_finished_at", toIso)
        .order("conference_finished_at").limit(20000);
      return { rows: data || [], columns: null };
    }
    case "metas": {
      const { data } = await supabase.from("entries").select("operator_code, operator_name, duration_seconds")
        .gte("start_time", fromIso).lt("start_time", toIso).limit(50000);
      return { rows: summarizeByOperator(data || []), columns: [
        { key: "operador", label: "Operador" }, { key: "codigo", label: "Código" },
        { key: "registros", label: "Registros" }, { key: "media", label: "Tempo médio" }, { key: "total", label: "Tempo total" },
      ] };
    }
    default:
      return { rows: [], columns: null };
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function sendEmail(to: string, subject: string, html: string, filename: string, csv: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], subject, html,
      attachments: [{ filename, content: toBase64(csv) }],
    }),
  });
  return { ok: res.ok, detail: res.ok ? "" : await res.text() };
}

// @ts-ignore
Deno.serve(async (req) => {
  const auth = requireCronAuth(req);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (!RESEND_KEY || !FROM) {
    return Response.json({ skipped: "RESEND_API_KEY / REPORTS_FROM_EMAIL não configurados" });
  }

  const now = new Date();
  const { data: reports, error } = await supabase.from("scheduled_reports").select("*").eq("active", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: any[] = [];
  for (const report of (reports || []).filter((r: any) => isDue(r, now))) {
    try {
      const { fromIso, toIso, label } = periodFor(report, now);
      const { rows, columns } = await buildRows(report.report_type, fromIso, toIso);
      const title = TITLES[report.report_type] || report.report_type;
      const csv = toCsv(rows, columns);
      const subject = `${report.name || title} (${label})`;
      const html = `<p>Olá!</p><p>Segue o relatório <strong>${escapeHtml(title)}</strong> referente a <strong>${escapeHtml(label)}</strong>.</p>` +
        `<p>${rows.length} registro(s). O arquivo em anexo abre no Excel.</p><p style="color:#888">Enviado automaticamente pelo Aponta CD.</p>`;
      const sent = await sendEmail(report.email_to, subject, html, `${report.report_type}_${label.replace(/ /g, "_")}.csv`, csv);
      if (sent.ok) {
        await supabase.from("scheduled_reports").update({ last_sent_at: now.toISOString() }).eq("id", report.id);
      }
      results.push({ id: report.id, name: report.name, ok: sent.ok, rows: rows.length, detail: sent.detail });
    } catch (e) {
      results.push({ id: report.id, name: report.name, ok: false, detail: String(e) });
    }
  }
  return Response.json({ checked: (reports || []).length, sent: results.filter((r) => r.ok).length, results });
});

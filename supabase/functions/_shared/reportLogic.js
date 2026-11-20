// Lógica pura dos relatórios agendados (sem banco, sem rede).
// Usada pela função run-scheduled-reports e testada em src/lib/__tests__/reportLogic.test.js.
// Fuso do CD: America/Sao_Paulo = UTC-3 (sem horário de verão desde 2019).

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

// "Agora" no relógio de Brasília, lido com os getters UTC.
export function toBrt(date = new Date()) {
  return new Date(date.getTime() - BRT_OFFSET_MS);
}

export function brtDateString(date = new Date()) {
  return toBrt(date).toISOString().slice(0, 10);
}

// O relatório deve sair agora? (a função roda de hora em hora)
export function isDue(report, now = new Date()) {
  if (!report || report.active === false) return false;
  const brt = toBrt(now);
  if (Number(report.hour ?? 8) !== brt.getUTCHours()) return false;

  if (report.frequency === "semanal" && Number(report.day_of_week) !== brt.getUTCDay()) return false;
  if (report.frequency === "mensal" && Number(report.day_of_month) !== brt.getUTCDate()) return false;
  if (!["diario", "semanal", "mensal"].includes(report.frequency)) return false;

  // não repete no mesmo dia (no horário de Brasília)
  if (report.last_sent_at && brtDateString(new Date(report.last_sent_at)) === brtDateString(now)) return false;
  return true;
}

// Período coberto: sempre termina na meia-noite de hoje (Brasília), sem incluir o dia de hoje.
// diário = ontem · semanal = 7 dias · mensal = 30 dias. Retorna { fromIso, toIso, label }.
export function periodFor(report, now = new Date()) {
  const days = report.frequency === "mensal" ? 30 : report.frequency === "semanal" ? 7 : 1;
  const brt = toBrt(now);
  // meia-noite de hoje em Brasília, expressa em UTC
  const todayMidnightUtc = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + BRT_OFFSET_MS;
  const fromMs = todayMidnightUtc - days * 86400000;
  const fromLabel = new Date(fromMs - BRT_OFFSET_MS).toISOString().slice(0, 10);
  const toLabel = new Date(todayMidnightUtc - 86400000 - BRT_OFFSET_MS).toISOString().slice(0, 10);
  return {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(todayMidnightUtc).toISOString(),
    label: fromLabel === toLabel ? fromLabel : `${fromLabel} a ${toLabel}`,
  };
}

function cell(value) {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Protege contra CSV Formula Injection no Excel (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(text) && !/^-\d+([.,]\d+)?$/.test(text)) {
    text = `'${text}`;
  }
  // ";" é o separador do Excel em português; aspas dobradas protegem texto com ; ou quebra de linha
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Gera CSV (com BOM para o Excel abrir acentos corretamente).
// columns: [{ key, label }]. Sem columns, usa as chaves da primeira linha.
export function toCsv(rows, columns = null) {
  const cols = columns || Object.keys(rows[0] || {}).map((key) => ({ key, label: key }));
  const head = cols.map((c) => cell(c.label)).join(";");
  const body = rows.map((r) => cols.map((c) => cell(r[c.key])).join(";"));
  return "\ufeff" + [head, ...body].join("\r\n");
}

export function formatSeconds(sec) {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(r).padStart(2, "0")}s`;
}

// Resumo por operador (usado no relatório "metas")
export function summarizeByOperator(entries) {
  const by = {};
  for (const e of entries) {
    const o = (by[e.operator_code] ||= { operador: e.operator_name, codigo: e.operator_code, registros: 0, total_segundos: 0 });
    o.registros += 1;
    o.total_segundos += Number(e.duration_seconds) || 0;
  }
  return Object.values(by)
    .map((o) => ({ ...o, media: formatSeconds(o.registros ? o.total_segundos / o.registros : 0), total: formatSeconds(o.total_segundos) }))
    .sort((a, b) => b.registros - a.registros);
}

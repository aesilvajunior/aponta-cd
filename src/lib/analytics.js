// ============================================================
// Análises de carga de trabalho (funções puras, sem banco).
// Todas usam o horário LOCAL do navegador (Brasília), não UTC.
// ============================================================
import { localISODate } from "./format";

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Mapa de calor: contagem de lançamentos por dia da semana x hora do dia.
// Retorna { cells: number[7][24], max, total }
export function buildHeatmap(entries) {
  const cells = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  let total = 0;
  for (const e of entries) {
    const d = new Date(e.start_time);
    if (Number.isNaN(d.getTime())) continue;
    const v = ++cells[d.getDay()][d.getHours()];
    if (v > max) max = v;
    total += 1;
  }
  return { cells, max, total };
}

// Média de lançamentos por dia da semana (considera só dias que tiveram
// movimento, para feriados/fins de semana sem operação não puxarem a média).
// Retorna array de 7 posições: { weekday, avg, days }
export function weekdayAverages(entries) {
  const perDay = {};
  for (const e of entries) {
    const key = localISODate(e.start_time);
    perDay[key] = (perDay[key] || 0) + 1;
  }
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const [iso, n] of Object.entries(perDay)) {
    const [y, m, d] = iso.split("-").map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    sums[wd] += n;
    counts[wd] += 1;
  }
  return sums.map((sum, wd) => ({
    weekday: wd,
    label: WEEKDAYS[wd],
    avg: counts[wd] ? sum / counts[wd] : 0,
    days: counts[wd],
  }));
}

// Previsão simples para os próximos `days` dias: média do mesmo dia da semana.
// `from` é a data de partida (Date). Retorna [{ date, label, expected, basedOnDays }]
export function forecastNextDays(entries, days = 7, from = new Date()) {
  const avgs = weekdayAverages(entries);
  const out = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const a = avgs[d.getDay()];
    out.push({
      date: localISODate(d),
      label: WEEKDAYS[d.getDay()],
      expected: Math.round(a.avg),
      basedOnDays: a.days,
    });
  }
  return out;
}

function median(values) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Ranking justo: compara cada lançamento com a MEDIANA da própria atividade,
// em vez de comparar tempos brutos. Quem pega atividades mais demoradas não é
// punido. Índice 1,00 = na média; acima de 1 = mais rápido que a mediana.
// Usa a média geométrica das razões (mediana / tempo), limitadas entre 0,25 e 4,
// para um lançamento fora da curva não distorcer. `minRecords` evita ranquear
// quem tem poucos registros.
export function fairRanking(entries, { minRecords = 5 } = {}) {
  const byActivity = {};
  for (const e of entries) {
    if (!e.duration_seconds || e.duration_seconds <= 0) continue;
    (byActivity[e.activity] ||= []).push(e.duration_seconds);
  }
  const baseline = {};
  for (const [act, list] of Object.entries(byActivity)) {
    if (list.length >= 3) baseline[act] = median(list);
  }

  const byOp = {};
  for (const e of entries) {
    const base = baseline[e.activity];
    if (!base || !e.duration_seconds || e.duration_seconds <= 0) continue;
    const ratio = Math.min(4, Math.max(0.25, base / e.duration_seconds));
    const o = (byOp[e.operator_code] ||= { code: e.operator_code, name: e.operator_name, logs: 0, sumLog: 0 });
    o.logs += 1;
    o.sumLog += Math.log(ratio);
  }

  return Object.values(byOp)
    .filter((o) => o.logs >= minRecords)
    .map((o) => ({ code: o.code, name: o.name, records: o.logs, index: Math.exp(o.sumLog / o.logs) }))
    .sort((a, b) => b.index - a.index);
}

// Ocupação: tempo trabalhando vs. tempo parado entre um lançamento e o próximo
// (no mesmo dia). Esperas acima de `maxGapMinutes` (almoço, fim de turno) não
// entram. Retorna por operador: { workSeconds, idleSeconds, occupancy 0..1 }
export function occupancyByOperator(entries, { maxGapMinutes = 45 } = {}) {
  const byOp = {};
  for (const e of entries) {
    if (!e.start_time || !e.end_time) continue;
    (byOp[e.operator_code] ||= { code: e.operator_code, name: e.operator_name, list: [] }).list.push(e);
  }
  const maxGap = maxGapMinutes * 60;

  return Object.values(byOp)
    .map((op) => {
      const list = op.list.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      let work = 0;
      let idle = 0;
      for (let i = 0; i < list.length; i++) {
        const start = new Date(list[i].start_time).getTime();
        const end = new Date(list[i].end_time).getTime();
        work += Math.max(0, (end - start) / 1000);
        const next = list[i + 1];
        if (next && localISODate(list[i].end_time) === localISODate(next.start_time)) {
          const gap = (new Date(next.start_time).getTime() - end) / 1000;
          if (gap > 0 && gap <= maxGap) idle += gap;
        }
      }
      const total = work + idle;
      return { code: op.code, name: op.name, workSeconds: work, idleSeconds: idle, occupancy: total ? work / total : 0 };
    })
    .sort((a, b) => b.workSeconds - a.workSeconds);
}

// Resumo das pausas por motivo: [{ reason, count, seconds, avgSeconds }]
export function summarizePauses(pauses) {
  const by = {};
  for (const p of pauses) {
    const k = p.reason || "sem_motivo";
    const o = (by[k] ||= { reason: k, count: 0, seconds: 0 });
    o.count += 1;
    o.seconds += p.duration_seconds || 0;
  }
  return Object.values(by)
    .map((o) => ({ ...o, avgSeconds: o.count ? Math.round(o.seconds / o.count) : 0 }))
    .sort((a, b) => b.seconds - a.seconds);
}

// Pausas por operador: [{ code, name, count, seconds }]
export function pausesByOperator(pauses) {
  const by = {};
  for (const p of pauses) {
    const o = (by[p.operator_code] ||= { code: p.operator_code, name: p.operator_name, count: 0, seconds: 0 });
    o.count += 1;
    o.seconds += p.duration_seconds || 0;
  }
  return Object.values(by).sort((a, b) => b.seconds - a.seconds);
}

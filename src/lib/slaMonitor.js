// ============================================================
// Monitor Proativo de Gargalos (SLA)
// Integra Workload (produtividade do turno), PauseReasons
// (tempo limite de pausas) e ConferenceQueue (fila travada)
// com PushSetup para notificar o líder automaticamente.
// Funções puras testáveis + persistência em system_status/localStorage.
// ============================================================
import { localISODate } from "./format";
import { reasonLabel } from "./pauseReasons";
import { fetchSystemStatus, upsertSystemStatus } from "./api";

const SLA_STORAGE_KEY = "aponta_sla_config_v1";

export const DEFAULT_SLA_CONFIG = {
  enabled: true,
  maxPauseMinutes: 20,
  pauseLimitsByReason: {
    almoco: 65,
    banheiro: 15,
    falta_material: 15,
    aguardando_equipamento: 15,
    aguardando_lideranca: 10,
    reuniao: 30,
    outro: 15,
  },
  conferenceStallMinutes: 20,
  conferenceMaxQueue: 8,
  shiftProductivityMinPct: 80,
  shiftMinEntriesForCheck: 3,
  cooldownMinutes: 15,
};

export function mergeSlaConfig(saved) {
  return {
    ...DEFAULT_SLA_CONFIG,
    ...(saved || {}),
    pauseLimitsByReason: {
      ...DEFAULT_SLA_CONFIG.pauseLimitsByReason,
      ...(saved?.pauseLimitsByReason || {}),
    },
  };
}

export function readLocalSlaConfig() {
  try {
    const raw = localStorage.getItem(SLA_STORAGE_KEY);
    return raw ? mergeSlaConfig(JSON.parse(raw)) : mergeSlaConfig();
  } catch {
    return mergeSlaConfig();
  }
}

export function writeLocalSlaConfig(cfg) {
  try {
    localStorage.setItem(SLA_STORAGE_KEY, JSON.stringify(mergeSlaConfig(cfg)));
  } catch {
    /* ignora */
  }
}

export async function loadSlaConfig() {
  const local = readLocalSlaConfig();
  try {
    const { data } = await fetchSystemStatus();
    const row = (data || []).find((r) => r.key === "sla_config");
    if (row?.value) {
      const merged = mergeSlaConfig(row.value);
      writeLocalSlaConfig(merged);
      return merged;
    }
  } catch {
    /* usa cache local */
  }
  return local;
}

export async function saveSlaConfig(cfg) {
  const merged = mergeSlaConfig(cfg);
  writeLocalSlaConfig(merged);
  try {
    const { error } = await upsertSystemStatus("sla_config", merged);
    return { config: merged, error };
  } catch (e) {
    return { config: merged, error: e };
  }
}

export function pauseLimitSecondsFor(reason, cfg = DEFAULT_SLA_CONFIG) {
  const merged = mergeSlaConfig(cfg);
  const mins = merged.pauseLimitsByReason?.[reason] ?? merged.maxPauseMinutes ?? 20;
  return Math.max(1, Number(mins)) * 60;
}

// ============================================================
// 1) SLA de Pausas: sessões pausadas além do tempo limite
// ============================================================
export function evaluatePauseSlas(activeSessions = [], openPauseLogs = [], cfg = DEFAULT_SLA_CONFIG, now = Date.now()) {
  const merged = mergeSlaConfig(cfg);
  const alerts = [];
  const seenOps = new Set();

  // Mapeia o motivo da pausa em aberto por operador (quando existir em session_pauses)
  const reasonByOp = new Map();
  (openPauseLogs || []).forEach((p) => {
    if (!p.resumed_at && p.operator_code && !reasonByOp.has(p.operator_code)) {
      reasonByOp.set(p.operator_code, p);
    }
  });

  (activeSessions || []).forEach((s) => {
    if (!s.paused_at) return;
    const pausedMs = new Date(s.paused_at).getTime();
    if (Number.isNaN(pausedMs)) return;
    const elapsedSec = Math.max(0, Math.round((now - pausedMs) / 1000));
    const log = reasonByOp.get(s.operator_code);
    const reasonKey = log?.reason || "outro";
    const limitSec = pauseLimitSecondsFor(reasonKey, merged);
    seenOps.add(s.operator_code);

    if (elapsedSec >= limitSec) {
      const elapsedMin = Math.round(elapsedSec / 60);
      const limitMin = Math.round(limitSec / 60);
      alerts.push({
        id: `pause:${s.operator_code}`,
        type: "pause_exceeded",
        severity: elapsedSec >= limitSec * 1.5 ? "critical" : "warning",
        title: "Pausa acima do limite (SLA)",
        message: `${s.operator_name || s.operator_code} em "${reasonLabel(reasonKey)}" há ${elapsedMin}min (limite: ${limitMin}min)`,
        metric: `${elapsedMin}min / ${limitMin}min`,
        operatorCode: s.operator_code,
        operatorName: s.operator_name,
        reason: reasonKey,
        elapsedSeconds: elapsedSec,
        limitSeconds: limitSec,
        tab: "pauses",
      });
    }
  });

  // Caso exista pausa aberta em session_pauses cujo operador não estava em activeSessions
  (openPauseLogs || []).forEach((p) => {
    if (p.resumed_at || !p.paused_at || seenOps.has(p.operator_code)) return;
    const pausedMs = new Date(p.paused_at).getTime();
    if (Number.isNaN(pausedMs)) return;
    const elapsedSec = Math.max(0, Math.round((now - pausedMs) / 1000));
    const limitSec = pauseLimitSecondsFor(p.reason, merged);
    if (elapsedSec >= limitSec) {
      const elapsedMin = Math.round(elapsedSec / 60);
      const limitMin = Math.round(limitSec / 60);
      alerts.push({
        id: `pause:${p.operator_code}`,
        type: "pause_exceeded",
        severity: elapsedSec >= limitSec * 1.5 ? "critical" : "warning",
        title: "Pausa acima do limite (SLA)",
        message: `${p.operator_name || p.operator_code} em "${reasonLabel(p.reason)}" há ${elapsedMin}min (limite: ${limitMin}min)`,
        metric: `${elapsedMin}min / ${limitMin}min`,
        operatorCode: p.operator_code,
        operatorName: p.operator_name,
        reason: p.reason,
        elapsedSeconds: elapsedSec,
        limitSeconds: limitSec,
        tab: "pauses",
      });
    }
  });

  return alerts;
}

// ============================================================
// 2) SLA da Mesa de Conferência: fila travada ou acumulada
// ============================================================
export function evaluateConferenceSla(conferenceQueue = [], cfg = DEFAULT_SLA_CONFIG, now = Date.now()) {
  const merged = mergeSlaConfig(cfg);
  const waiting = (conferenceQueue || []).filter((q) => q.status === "aguardando");
  const inProgress = (conferenceQueue || []).filter((q) => q.status === "em_conferencia");
  const alerts = [];

  if (waiting.length === 0) return alerts;

  const oldest = waiting.reduce((acc, w) =>
    new Date(w.separated_at) < new Date(acc.separated_at) ? w : acc
  );
  const oldestWaitSec = Math.max(0, Math.round((now - new Date(oldest.separated_at).getTime()) / 1000));
  const oldestWaitMin = Math.round(oldestWaitSec / 60);
  const stallMin = Number(merged.conferenceStallMinutes) || 20;
  const maxQueue = Number(merged.conferenceMaxQueue) || 8;

  const stalled = oldestWaitMin >= stallMin;
  const overloaded = waiting.length >= maxQueue;

  if (stalled || overloaded) {
    const noChecker = inProgress.length === 0;
    const parts = [];
    if (stalled) parts.push(`pedido mais antigo esperando há ${oldestWaitMin}min (SLA: ${stallMin}min)`);
    if (overloaded) parts.push(`${waiting.length} pedidos na fila (limite: ${maxQueue})`);
    if (noChecker) parts.push("nenhum conferente ativo na mesa");

    alerts.push({
      id: "conference:stalled",
      type: "conference_stalled",
      severity: (stalled && noChecker) || waiting.length >= maxQueue * 1.5 ? "critical" : "warning",
      title: noChecker ? "Fila de conferência travada" : "Gargalo na mesa de conferência",
      message: parts.join(" · "),
      metric: `${waiting.length} fila · ${oldestWaitMin}min`,
      waitingCount: waiting.length,
      inProgressCount: inProgress.length,
      oldestWaitMinutes: oldestWaitMin,
      tab: "conference",
    });
  }

  return alerts;
}

// ============================================================
// 3) SLA de Produtividade do Turno (Workload + Metas)
// ============================================================
export function currentShiftWindow(now = Date.now()) {
  const d = new Date(now);
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 6 && h < 14) {
    return { shift: "Manhã", startHour: 6, endHour: 14, elapsedHours: Math.max(0.5, h - 6) };
  }
  if (h >= 14 && h < 22) {
    return { shift: "Tarde", startHour: 14, endHour: 22, elapsedHours: Math.max(0.5, h - 14) };
  }
  return null; // fora do horário operacional
}

export function computeShiftProductivityStatus(entries = [], teamGoals = [], cfg = DEFAULT_SLA_CONFIG, now = Date.now()) {
  const merged = mergeSlaConfig(cfg);
  const win = currentShiftWindow(now);
  if (!win) {
    return {
      shift: null,
      active: false,
      todayCount: 0,
      expectedSoFar: 0,
      pctOfTarget: null,
      belowSla: false,
      targetPct: merged.shiftProductivityMinPct,
    };
  }

  const today = localISODate(now);
  const todayShiftEntries = entries.filter(
    (e) => e.shift === win.shift && localISODate(e.start_time) === today
  );

  // Baseline histórica do mesmo turno nos dias anteriores
  const byPastDay = {};
  entries.forEach((e) => {
    if (e.shift !== win.shift) return;
    const d = localISODate(e.start_time);
    if (d === today) return;
    byPastDay[d] = (byPastDay[d] || 0) + 1;
  });
  const pastDayCounts = Object.values(byPastDay);
  const avgFullShift =
    pastDayCounts.length > 0
      ? pastDayCounts.reduce((s, n) => s + n, 0) / pastDayCounts.length
      : 0;

  // Se existir meta explícita de equipe para o turno (ex: "Manhã" ou "Tarde")
  const matchedGoal = (teamGoals || []).find(
    (g) => String(g.team_name || "").toLowerCase().includes(win.shift.toLowerCase()) && g.goal_count > 0
  );
  const fullShiftTarget = matchedGoal ? Number(matchedGoal.goal_count) : avgFullShift;

  const shiftTotalHours = win.endHour - win.startHour;
  const progressRatio = Math.min(1, win.elapsedHours / shiftTotalHours);
  const expectedSoFar = Math.round(fullShiftTarget * progressRatio);

  const todayCount = todayShiftEntries.length;
  const pctOfTarget = expectedSoFar > 0 ? Math.round((todayCount / expectedSoFar) * 100) : null;
  const enoughSample =
    win.elapsedHours >= 1 &&
    expectedSoFar >= (merged.shiftMinEntriesForCheck || 3) &&
    fullShiftTarget > 0;
  const belowSla = enoughSample && pctOfTarget !== null && pctOfTarget < merged.shiftProductivityMinPct;

  return {
    shift: win.shift,
    active: true,
    elapsedHours: Math.round(win.elapsedHours * 10) / 10,
    todayCount,
    fullShiftTarget: Math.round(fullShiftTarget),
    expectedSoFar,
    pctOfTarget,
    belowSla,
    targetPct: merged.shiftProductivityMinPct,
    source: matchedGoal ? "meta" : "historico",
  };
}

export function evaluateShiftProductivitySla(entries = [], teamGoals = [], cfg = DEFAULT_SLA_CONFIG, now = Date.now()) {
  const status = computeShiftProductivityStatus(entries, teamGoals, cfg, now);
  if (!status.belowSla) return [];

  return [
    {
      id: `shift:${status.shift}:${localISODate(now)}`,
      type: "shift_productivity_low",
      severity: status.pctOfTarget < Math.max(50, status.targetPct - 20) ? "critical" : "warning",
      title: `Turno ${status.shift} abaixo da meta de produtividade`,
      message: `${status.todayCount} registros até agora (esperado ~${status.expectedSoFar} — ${status.pctOfTarget}% da meta de ${status.targetPct}%)`,
      metric: `${status.pctOfTarget}% da meta`,
      status,
      tab: "workload",
    },
  ];
}

// Avaliação consolidada de todos os gargalos SLA
export function evaluateAllSlaBottlenecks({
  activeSessions = [],
  openPauseLogs = [],
  conferenceQueue = [],
  entries = [],
  teamGoals = [],
  cfg = DEFAULT_SLA_CONFIG,
  now = Date.now(),
} = {}) {
  const merged = mergeSlaConfig(cfg);
  if (!merged.enabled) return [];

  return [
    ...evaluatePauseSlas(activeSessions, openPauseLogs, merged, now),
    ...evaluateConferenceSla(conferenceQueue, merged, now),
    ...evaluateShiftProductivitySla(entries, teamGoals, merged, now),
  ];
}

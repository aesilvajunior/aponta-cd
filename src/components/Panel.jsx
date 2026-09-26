import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";
import { computeMetrics, computeWeeklyTrend, computeMonthlyBuckets, monthLabel, mean as meanM } from "../lib/metrics";
import { exportHistoricoExcel, exportShortagesExcel, exportErrorsExcel } from "../utils/excel";
import OperatorProfile from "./OperatorProfile";
import { fetchConferenceHistory, deleteEntry } from "../lib/api";
import { logAudit } from "../lib/api";
import logo from "../assets/logo.png";

const COLORS = ["#0a3d7a", "#00a0e4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#6b7280"];
const DEFAULT_ALERT_SECONDS = 1800;

function todayLocalISODate() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function periodFilename(prefix, ext, dateFrom, dateTo, fallbackEntries) {
  let fromStr = dateFrom;
  let toStr = dateTo;
  if (!fromStr || !toStr) {
    if (fallbackEntries && fallbackEntries.length > 0) {
      const sorted = [...fallbackEntries].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      if (!fromStr) fromStr = sorted[0].start_time.slice(0, 10);
      if (!toStr) toStr = sorted[sorted.length - 1].start_time.slice(0, 10);
    } else {
      const today = todayLocalISODate();
      if (!fromStr) fromStr = today;
      if (!toStr) toStr = today;
    }
  }
  return `${prefix}_${fromStr}_a_${toStr}.${ext}`;
}

function periodLabel(dateFrom, dateTo, fallbackEntries) {
  if (dateFrom || dateTo) {
    return `${dateFrom ? fmtDate(dateFrom + "T12:00:00") : "início"} até ${dateTo ? fmtDate(dateTo + "T12:00:00") : "hoje"}`;
  }
  if (fallbackEntries && fallbackEntries.length > 0) {
    const sorted = [...fallbackEntries].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    return `${fmtDate(sorted[0].start_time)} até ${fmtDate(sorted[sorted.length - 1].start_time)}`;
  }
  return "todo o histórico";
}

function downloadCsv(lines, filename) {
  const csv = "\ufeff" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function quickRange(type) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toISO = (d) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  };
  if (type === "hoje") return { from: toISO(today), to: toISO(today) };
  if (type === "ontem") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: toISO(y), to: toISO(y) };
  }
  if (type === "7dias") {
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    return { from: toISO(past), to: toISO(today) };
  }
  if (type === "mes") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toISO(first), to: toISO(today) };
  }
  return { from: "", to: "" };
}

export default function Panel({
  entries,
  activities,
  operators,
  activeSessions,
  separationErrors = [],
  shortages = [],
  alertThreshold = DEFAULT_ALERT_SECONDS,
  onResetEntries,
  onResetSeparationErrors,
  onResetShortages,
  externalProfileOperator = null,
  onExternalProfileHandled,
  externalFilter = null,
  onExternalFilterHandled,
  onOpenAdminMaster = null,
}) {
  const [viewOperator, setViewOperator] = useState(null);

  const [filterOperator, setFilterOperator] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [filterStation, setFilterStation] = useState("");
  const [filterEncaixe, setFilterEncaixe] = useState("");
  const [filterShortage, setFilterShortage] = useState("");
  const [filterProductCode, setFilterProductCode] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterOrderNumber, setFilterOrderNumber] = useState("");
  const [filterErrorOperator, setFilterErrorOperator] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeQuickFilter, setActiveQuickFilter] = useState("");

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

  const [confirmingResetErrors, setConfirmingResetErrors] = useState(false);
  const [resetErrorsPhrase, setResetErrorsPhrase] = useState("");
  const [resettingErrors, setResettingErrors] = useState(false);

  const [confirmingResetShortages, setConfirmingResetShortages] = useState(false);
  const [resetShortagesPhrase, setResetShortagesPhrase] = useState("");
  const [resettingShortages, setResettingShortages] = useState(false);

  const [copyLabel, setCopyLabel] = useState("Copiar resumo do dia");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const alertedRef = useRef(new Set());

  const [now, setNow] = useState(Date.now());
  const [monthA, setMonthA] = useState("");
  const [monthB, setMonthB] = useState("");

  const [conferenceHistory, setConferenceHistory] = useState([]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await fetchConferenceHistory({ limit: 2000 });
      setConferenceHistory(data || []);
    })();
  }, []);

  useEffect(() => {
    if (externalProfileOperator) {
      setViewOperator(externalProfileOperator);
      onExternalProfileHandled?.();
    }
  }, [externalProfileOperator, onExternalProfileHandled]);

  useEffect(() => {
    if (!externalFilter) return;

    if (
      externalFilter.type === "hoje" ||
      externalFilter.type === "ontem" ||
      externalFilter.type === "7dias" ||
      externalFilter.type === "mes"
    ) {
      const range = quickRange(externalFilter.type);
      setActiveQuickFilter(externalFilter.type);
      setDateFrom(range.from);
      setDateTo(range.to);
    }

    if (externalFilter.type === "pedido" && externalFilter.value) {
      setFilterOrderNumber(String(externalFilter.value));
    }

    onExternalFilterHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFilter, onExternalProfileHandled]);

  const shortagesByEntry = useMemo(() => {
    const map = {};
    shortages.forEach((s) => {
      if (!map[s.entry_id]) map[s.entry_id] = [];
      map[s.entry_id].push(s);
    });
    return map;
  }, [shortages]);

  const dateFilteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const d = new Date(e.start_time);
      if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [entries, dateFrom, dateTo]);

  const metrics = useMemo(() => computeMetrics(dateFilteredEntries, activities), [dateFilteredEntries, activities]);

  const filteredEntries = useMemo(() => {
    return dateFilteredEntries
      .filter((e) => !filterOperator || e.operator_code === filterOperator)
      .filter((e) => !filterActivity || e.activity === filterActivity)
      .filter((e) => !filterShift || e.shift === filterShift)
      .filter((e) => !filterStation || e.station === filterStation)
      .filter((e) => !filterCustomer || (e.customer_name || "").toLowerCase().includes(filterCustomer.toLowerCase()))
      .filter((e) => {
        if (!filterOrderNumber) return true;
        return (e.order_number || "").includes(filterOrderNumber);
      })
      .filter((e) => {
        if (filterEncaixe === "yes") return e.is_encaixe === true;
        if (filterEncaixe === "no") return !e.is_encaixe;
        return true;
      })
      .filter((e) => {
        const list = shortagesByEntry[e.id] || [];
        const hasShortage = list.length > 0;
        if (filterShortage === "yes") return hasShortage;
        if (filterShortage === "no") return !hasShortage;
        return true;
      })
      .filter((e) => {
        if (!filterProductCode.trim()) return true;
        const list = shortagesByEntry[e.id] || [];
        return list.some((s) => s.product_code.toLowerCase().includes(filterProductCode.trim().toLowerCase()));
      })
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [dateFilteredEntries, filterOperator, filterActivity, filterShift, filterStation, filterCustomer, filterOrderNumber, filterEncaixe, filterShortage, filterProductCode, shortagesByEntry]);

  const knownStations = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => e.station && set.add(e.station));
    return Array.from(set).sort();
  }, [entries]);

  const stats = useMemo(() => {
    const encaixes = dateFilteredEntries.filter((e) => e.is_encaixe).length;
    const entriesComFalta = dateFilteredEntries.filter((e) => shortagesByEntry[e.id]?.length).length;
    const totalFaltas = dateFilteredEntries.reduce((sum, e) => sum + (shortagesByEntry[e.id]?.length || 0), 0);
    const pctEncaixe = dateFilteredEntries.length > 0 ? Math.round((encaixes / dateFilteredEntries.length) * 100) : 0;
    const pctFalta = dateFilteredEntries.length > 0 ? Math.round((entriesComFalta / dateFilteredEntries.length) * 100) : 0;
    return { encaixes, entriesComFalta, totalFaltas, pctEncaixe, pctFalta };
  }, [dateFilteredEntries, shortagesByEntry]);

  const topShortageProducts = useMemo(() => {
    const byCode = {};
    dateFilteredEntries.forEach((e) => {
      const list = shortagesByEntry[e.id] || [];
      list.forEach((s) => {
        const code = s.product_code;
        if (!byCode[code]) byCode[code] = { code, count: 0, totalQty: 0 };
        byCode[code].count += 1;
        byCode[code].totalQty += s.quantity || 0;
      });
    });
    return Object.values(byCode).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10);
  }, [dateFilteredEntries, shortagesByEntry]);

  const topShortageCustomers = useMemo(() => {
    const byCustomer = {};
    dateFilteredEntries.forEach((e) => {
      const list = shortagesByEntry[e.id] || [];
      if (list.length === 0) return;
      const name = e.customer_name || "(sem cliente)";
      if (!byCustomer[name]) byCustomer[name] = { name, entriesCount: 0, totalFaltas: 0, totalQty: 0 };
      byCustomer[name].entriesCount += 1;
      byCustomer[name].totalFaltas += list.length;
      list.forEach((s) => { byCustomer[name].totalQty += s.quantity || 0; });
    });
    return Object.values(byCustomer).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10);
  }, [dateFilteredEntries, shortagesByEntry]);

  const shortagesByDay = useMemo(() => {
    const byDay = {};
    dateFilteredEntries.forEach((e) => {
      const list = shortagesByEntry[e.id] || [];
      if (list.length === 0) return;
      const day = e.start_time.slice(0, 10);
      if (!byDay[day]) byDay[day] = { day, entries: 0, totalFaltas: 0, totalQty: 0 };
      byDay[day].entries += 1;
      byDay[day].totalFaltas += list.length;
      list.forEach((s) => { byDay[day].totalQty += s.quantity || 0; });
    });
    return Object.values(byDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({
        label: fmtDate(d.day + "T12:00:00").slice(0, 5),
        entries: d.entries,
        totalFaltas: d.totalFaltas,
        totalQty: d.totalQty,
      }));
  }, [dateFilteredEntries, shortagesByEntry]);

  const shortageEntries = useMemo(() => {
    return dateFilteredEntries
      .filter((e) => {
        const list = shortagesByEntry[e.id] || [];
        if (list.length === 0) return false;
        if (!filterProductCode.trim()) return true;
        return list.some((s) => s.product_code.toLowerCase().includes(filterProductCode.trim().toLowerCase()));
      })
      .filter((e) => !filterCustomer || (e.customer_name || "").toLowerCase().includes(filterCustomer.toLowerCase()))
      .filter((e) => {
        if (!filterOrderNumber) return true;
        return (e.order_number || "").includes(filterOrderNumber);
      })
      .filter((e) => !filterOperator || e.operator_code === filterOperator)
      .filter((e) => !filterActivity || e.activity === filterActivity)
      .filter((e) => !filterShift || e.shift === filterShift)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [dateFilteredEntries, shortagesByEntry, filterProductCode, filterCustomer, filterOrderNumber, filterOperator, filterActivity, filterShift]);

  const activityAlerts = useMemo(() => {
    return activeSessions
      .map((s) => {
        const elapsed = Math.round((now - new Date(s.start_time).getTime()) / 1000);
        const activityConfig = activities.find((a) => a.name === s.activity);
        let threshold = alertThreshold || DEFAULT_ALERT_SECONDS;
        if (activityConfig?.target_seconds) threshold = activityConfig.target_seconds;
        return { ...s, elapsed, threshold, isLate: elapsed > threshold };
      })
      .filter((s) => s.isLate)
      .sort((a, b) => b.elapsed - a.elapsed);
  }, [activeSessions, activities, alertThreshold, now]);

  useEffect(() => {
    if (!soundEnabled) return;
    const currentKeys = new Set(activityAlerts.map((a) => a.operator_code));
    activityAlerts.forEach((a) => {
      if (!alertedRef.current.has(a.operator_code)) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.18;
          osc.start();
          osc.stop(ctx.currentTime + 0.28);
        } catch {}
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Atividade demorada", {
            body: `${a.operator_name} — ${a.activity} — ${fmtDuration(a.elapsed)}`,
          });
        }
      }
    });
    alertedRef.current = currentKeys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityAlerts, soundEnabled]);

  const targetComparison = useMemo(() => {
    return activities
      .filter((a) => a.target_seconds)
      .map((a) => {
        const real = metrics.avgByActivity.find((m) => m.name === a.name);
        const media = real?.media ?? 0;
        const deltaPct = media > 0 ? Math.round(((media - a.target_seconds) / a.target_seconds) * 100) : null;
        return { name: a.name, target: a.target_seconds, media, registros: real?.registros ?? 0, deltaPct };
      });
  }, [activities, metrics.avgByActivity]);

  const coverage = useMemo(() => {
    return operators.map((op) => {
      const opEntries = dateFilteredEntries.filter((e) => e.operator_code === op.code);
      const counts = {};
      activities.forEach((a) => {
        counts[a.name] = opEntries.filter((e) => e.activity === a.name).length;
      });
      const done = activities.filter((a) => counts[a.name] > 0).length;
      return { operator: op, counts, done, total: activities.length };
    });
  }, [operators, activities, dateFilteredEntries]);

  const weeklyTrend = useMemo(() => computeWeeklyTrend(dateFilteredEntries, activities), [dateFilteredEntries, activities]);

  const dateFilteredErrors = useMemo(() => {
    return separationErrors.filter((e) => {
      const d = new Date(e.created_at);
      if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (filterErrorOperator && e.error_operator_code !== filterErrorOperator) return false;
      return true;
    });
  }, [separationErrors, dateFrom, dateTo, filterErrorOperator]);

  const errorsByType = useMemo(() => {
    const byType = {};
    dateFilteredErrors.forEach((e) => {
      byType[e.error_type] = (byType[e.error_type] || 0) + 1;
    });
    return Object.entries(byType)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [dateFilteredErrors]);

  const errorRanking = useMemo(() => {
    const byOp = {};
    dateFilteredErrors.forEach((e) => {
      if (!e.error_operator_code) return;
      const key = e.error_operator_code;
      if (!byOp[key]) byOp[key] = { code: key, name: e.error_operator_name || key, count: 0 };
      byOp[key].count += 1;
    });
    return Object.values(byOp).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [dateFilteredErrors]);

  const maxErrorCount = useMemo(() => Math.max(1, ...errorRanking.map((r) => r.count)), [errorRanking]);

  const errorsByReporter = useMemo(() => {
    const byOp = {};
    dateFilteredErrors.forEach((e) => {
      const key = `${e.operator_name} (${e.operator_code})`;
      byOp[key] = (byOp[key] || 0) + 1;
    });
    return Object.entries(byOp)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [dateFilteredErrors]);

  const errorOperatorsList = useMemo(() => {
    const set = new Map();
    separationErrors.forEach((e) => {
      if (e.error_operator_code && !set.has(e.error_operator_code)) {
        set.set(e.error_operator_code, e.error_operator_name || e.error_operator_code);
      }
    });
    return Array.from(set.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [separationErrors]);

  const monthlyBuckets = useMemo(() => computeMonthlyBuckets(entries, activities), [entries, activities]);
  const availableMonths = useMemo(() => Object.keys(monthlyBuckets).sort(), [monthlyBuckets]);

  const conferenceFiltered = useMemo(() => {
    return conferenceHistory.filter((c) => {
      if (!c.conference_finished_at) return false;
      const d = new Date(c.conference_finished_at);
      if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [conferenceHistory, dateFrom, dateTo]);

  const conferenceStats = useMemo(() => {
    const total = conferenceFiltered.length;
    const ok = conferenceFiltered.filter((c) => c.status === "conferido").length;
    const problems = conferenceFiltered.filter((c) => c.status === "com_problema").length;
    const durations = conferenceFiltered.map((c) => c.duration_seconds || 0).filter((d) => d > 0);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const problemRate = total > 0 ? Math.round((problems / total) * 100) : 0;
    return { total, ok, problems, avgDuration, problemRate };
  }, [conferenceFiltered]);

  const conferenceRanking = useMemo(() => {
    const byOp = {};
    conferenceFiltered
      .filter((c) => c.status === "conferido")
      .forEach((c) => {
        const key = c.conference_finished_by_code || "?";
        if (!byOp[key]) {
          byOp[key] = {
            code: key,
            name: c.conference_finished_by_name || "—",
            count: 0,
            totalSeconds: 0,
          };
        }
        byOp[key].count += 1;
        byOp[key].totalSeconds += c.duration_seconds || 0;
      });
    return Object.values(byOp)
      .map((o) => ({ ...o, avg: o.count > 0 ? Math.round(o.totalSeconds / o.count) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [conferenceFiltered]);

  const conferenceProblems = useMemo(() => {
    const byReason = {};
    conferenceFiltered
      .filter((c) => c.status === "com_problema")
      .forEach((c) => {
        const r = c.problem_reason || "Sem motivo";
        byReason[r] = (byReason[r] || 0) + 1;
      });
    return Object.entries(byReason)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [conferenceFiltered]);

  const conferenceSeparatorsRanking = useMemo(() => {
    const byOp = {};
    conferenceFiltered.forEach((c) => {
      const key = c.separated_by_code || "?";
      if (!byOp[key]) byOp[key] = { code: key, name: c.separated_by_name || "—", count: 0, problems: 0 };
      byOp[key].count += 1;
      if (c.status === "com_problema") byOp[key].problems += 1;
    });
    return Object.values(byOp)
      .map((o) => ({ ...o, problemRate: o.count > 0 ? Math.round((o.problems / o.count) * 100) : 0 }))
      .sort((a, b) => b.problems - a.problems || b.count - a.count)
      .slice(0, 10);
  }, [conferenceFiltered]);

  useEffect(() => {
    if (availableMonths.length === 0) return;
    if (!monthA && !monthB) {
      const last = availableMonths[availableMonths.length - 1];
      const prev = availableMonths[availableMonths.length - 2] || last;
      setMonthA(prev);
      setMonthB(last);
    }
  }, [availableMonths, monthA, monthB]);

  const monthComparisonRows = useMemo(() => {
    if (!monthA || !monthB) return [];
    const statsA = monthlyBuckets[monthA];
    const statsB = monthlyBuckets[monthB];
    if (!statsA || !statsB) return [];
    return activities.map((act) => {
      const a = statsA.avgByActivity.find((x) => x.name === act.name);
      const b = statsB.avgByActivity.find((x) => x.name === act.name);
      const mediaA = a?.media ?? 0;
      const mediaB = b?.media ?? 0;
      const deltaPct = mediaA > 0 && mediaB > 0 ? Math.round(((mediaB - mediaA) / mediaA) * 100) : null;
      return { name: act.name, mediaA, registrosA: a?.registros ?? 0, mediaB, registrosB: b?.registros ?? 0, deltaPct };
    });
  }, [monthA, monthB, monthlyBuckets, activities]);

  // ============================================================
  // FUNÇÕES (não são hooks)
  // ============================================================

  function applyQuickFilter(type) {
    if (type === "") {
      setActiveQuickFilter("");
      setDateFrom("");
      setDateTo("");
      return;
    }
    const range = quickRange(type);
    setActiveQuickFilter(type);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function handleDateFromChange(value) {
    setDateFrom(value);
    setActiveQuickFilter("");
  }
  function handleDateToChange(value) {
    setDateTo(value);
    setActiveQuickFilter("");
  }

  function clearFilters() {
    setFilterOperator("");
    setFilterActivity("");
    setFilterShift("");
    setFilterStation("");
    setFilterEncaixe("");
    setFilterShortage("");
    setFilterProductCode("");
    setFilterCustomer("");
    setFilterOrderNumber("");
    setFilterErrorOperator("");
    setDateFrom("");
    setDateTo("");
    setActiveQuickFilter("");
  }

  function filterLines() {
    const lines = [];
    if (filterOperator) lines.push(`Operador filtrado:;${operators.find((o) => o.code === filterOperator)?.name || filterOperator}`);
    if (filterActivity) lines.push(`Atividade filtrada:;${filterActivity}`);
    if (filterShift) lines.push(`Turno filtrado:;${filterShift}`);
    if (filterStation) lines.push(`Estação filtrada:;${filterStation}`);
    if (filterEncaixe === "yes") lines.push(`Tipo:;Somente encaixes`);
    if (filterEncaixe === "no") lines.push(`Tipo:;Sem encaixe`);
    if (filterShortage === "yes") lines.push(`Faltas:;Somente com falta`);
    if (filterShortage === "no") lines.push(`Faltas:;Sem falta`);
    if (filterProductCode) lines.push(`Produto filtrado:;${filterProductCode}`);
    if (filterCustomer) lines.push(`Cliente filtrado:;${filterCustomer}`);
    if (filterOrderNumber) lines.push(`Pedido filtrado:;${filterOrderNumber}`);
    if (filterErrorOperator) {
      const op = errorOperatorsList.find((o) => o.code === filterErrorOperator);
      lines.push(`Operador que errou:;${op?.name || filterErrorOperator}`);
    }
    return lines;
  }

  function playAlertBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.18;
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {}
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      playAlertBeep();
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }

  // ==================== ADMIN QUICK ACTIONS ====================

  function openInAdminMaster(entityId, entityType) {
    if (onOpenAdminMaster) {
      onOpenAdminMaster({ tab: entityType, id: entityId });
    }
  }

  async function quickDeleteEntry(entry) {
    if (!window.confirm(`Apagar este lançamento de "${entry.operator_name}" (${entry.activity})?`)) return;
    const { error } = await deleteEntry(entry.id);
    if (error) {
      alert("Erro ao apagar: " + error.message);
      return;
    }
    try {
      await logAudit({
        actorCode: "admin",
        actorName: "Admin (rápido)",
        action: "remover",
        entity: "entry",
        entityId: String(entry.id),
        details: `Lançamento apagado rápido pelo admin`,
        beforeData: entry,
      });
    } catch {}
  }

  // ==================== EXPORTAÇÕES ====================

  function exportHistoricoCSV() {
    if (filteredEntries.length === 0) { alert("Nenhum registro no período para exportar."); return; }
    const totalRegistros = filteredEntries.length;
    const totalSegundos = filteredEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0);
    const mediaSegundos = totalRegistros > 0 ? Math.round(totalSegundos / totalRegistros) : 0;
    const totalEncaixes = filteredEntries.filter((e) => e.is_encaixe).length;
    const totalComFalta = filteredEntries.filter((e) => shortagesByEntry[e.id]?.length).length;
    const totalFaltas = filteredEntries.reduce((s, e) => s + (shortagesByEntry[e.id]?.length || 0), 0);

    const lines = [];
    lines.push("RELATÓRIO DE APONTAMENTOS");
    lines.push("Hidráulica Tropeiro — Aponta CD");
    lines.push("");
    lines.push(`Período:;${periodLabel(dateFrom, dateTo, filteredEntries)}`);
    lines.push(`Gerado em:;${fmtDateTime(new Date())}`);
    filterLines().forEach((l) => lines.push(l));
    lines.push("");
    lines.push(`Total de registros:;${totalRegistros}`);
    lines.push(`Tempo médio por registro:;${fmtDuration(mediaSegundos)}`);
    lines.push(`Tempo total:;${fmtDuration(totalSegundos)}`);
    lines.push(`Encaixes:;${totalEncaixes}`);
    lines.push(`Registros com falta:;${totalComFalta}`);
    lines.push(`Total de faltas:;${totalFaltas}`);
    lines.push("");
    lines.push("");

    const headers = [
      "Data", "Hora de Início", "Hora de Fim", "Duração", "Turno",
      "Operador", "Código do Operador", "Atividade", "Tipo",
      "Pedido", "Cliente", "Transferência", "Urgente", "Nº Transferência",
      "Veículo", "Placa", "Estação", "Lançado Manualmente", "Faltas", "Observação",
    ];
    lines.push(headers.map(csvEscape).join(";"));

    const sorted = [...filteredEntries].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    sorted.forEach((e) => {
      const tipo = e.is_encaixe ? "Encaixe" : e.transfer_type ? "Transferência" : e.order_number ? "Pedido" : "—";
      const faltas = (shortagesByEntry[e.id] || []).map((s) => `${s.product_code} (${s.quantity})`).join(" | ") || "—";
      lines.push([
        fmtDate(e.start_time), fmtClock(e.start_time).slice(0, 5), fmtClock(e.end_time).slice(0, 5),
        fmtDuration(e.duration_seconds), e.shift, e.operator_name, e.operator_code, e.activity, tipo,
        e.order_number || "—", e.customer_name || "—", e.transfer_type || "—",
        e.transfer_urgent === true ? "Sim" : e.transfer_urgent === false ? "Não" : "—",
        e.transfer_number || "—", e.vehicle || "—", e.plate || "—", e.station || "—",
        e.manual_entry ? "Sim" : "Não", faltas, e.note || "—",
      ].map(csvEscape).join(";"));
    });

    lines.push("");
    lines.push(`TOTAL DE REGISTROS:;${totalRegistros}`);
    lines.push(`TEMPO TOTAL:;${fmtDuration(totalSegundos)}`);
    lines.push(`TEMPO MÉDIO:;${fmtDuration(mediaSegundos)}`);
    lines.push(`ENCAIXES:;${totalEncaixes}`);
    lines.push(`REGISTROS COM FALTA:;${totalComFalta}`);

    if (metrics.opStats.length > 0) {
      lines.push("");
      lines.push("RESUMO POR OPERADOR");
      lines.push("Operador;Registros;Tempo Total;Tempo Médio");
      metrics.opStats.forEach((o) => {
        lines.push([csvEscape(o.name), o.registros, fmtDuration(o.total), fmtDuration(o.media)].join(";"));
      });
    }

    if (metrics.avgByActivity.length > 0) {
      lines.push("");
      lines.push("RESUMO POR ATIVIDADE");
      lines.push("Atividade;Registros;Tempo Médio");
      metrics.avgByActivity.filter((a) => a.registros > 0).forEach((a) => {
        lines.push([csvEscape(a.name), a.registros, fmtDuration(a.media)].join(";"));
      });
    }

    downloadCsv(lines, periodFilename("apontamentos", "csv", dateFrom, dateTo, filteredEntries));
  }

  function exportHistoricoXLSX() {
    exportHistoricoExcel({
      entries: filteredEntries,
      shortagesByEntry,
      metrics,
      periodLabel: periodLabel(dateFrom, dateTo, filteredEntries),
      dateFrom,
      dateTo,
    });
  }

  function exportShortagesCSV() {
    if (shortageEntries.length === 0) { alert("Nenhuma falta no período filtrado para exportar."); return; }
    const rows = [];
    shortageEntries.forEach((e) => {
      const list = shortagesByEntry[e.id] || [];
      list.forEach((s) => rows.push({ entry: e, shortage: s }));
    });
    const totalFaltas = rows.length;
    const totalPedidos = shortageEntries.length;
    const totalProdutos = new Set(rows.map((r) => r.shortage.product_code)).size;
    const totalQtd = rows.reduce((sum, r) => sum + (r.shortage.quantity || 0), 0);

    const lines = [];
    lines.push("RELATÓRIO DE FALTAS DE PRODUTO");
    lines.push("Hidráulica Tropeiro — Aponta CD");
    lines.push("");
    lines.push(`Período:;${periodLabel(dateFrom, dateTo, shortageEntries)}`);
    lines.push(`Gerado em:;${fmtDateTime(new Date())}`);
    filterLines().forEach((l) => lines.push(l));
    lines.push("");
    lines.push(`Total de faltas:;${totalFaltas}`);
    lines.push(`Total de pedidos afetados:;${totalPedidos}`);
    lines.push(`Total de produtos distintos:;${totalProdutos}`);
    lines.push(`Quantidade total de itens faltantes:;${totalQtd}`);
    lines.push("");
    lines.push("");

    const headers = [
      "Data", "Hora", "Turno", "Operador", "Código do Operador", "Atividade", "Tipo",
      "Pedido", "Cliente", "Transferência", "Urgente", "Nº Transferência",
      "Veículo", "Placa", "Estação", "Código do Produto", "Quantidade",
      "Duração da Atividade", "Encaixe",
    ];
    lines.push(headers.map(csvEscape).join(";"));

    const sorted = [...rows].sort((a, b) => new Date(a.entry.start_time) - new Date(b.entry.start_time));
    sorted.forEach(({ entry: e, shortage: s }) => {
      const tipo = e.is_encaixe ? "Encaixe" : e.transfer_type ? "Transferência" : e.order_number ? "Pedido" : "—";
      lines.push([
        fmtDate(e.start_time), fmtClock(e.start_time).slice(0, 5), e.shift,
        e.operator_name, e.operator_code, e.activity, tipo,
        e.order_number || "—", e.customer_name || "—", e.transfer_type || "—",
        e.transfer_urgent === true ? "Sim" : e.transfer_urgent === false ? "Não" : "—",
        e.transfer_number || "—", e.vehicle || "—", e.plate || "—", e.station || "—",
        s.product_code, s.quantity, fmtDuration(e.duration_seconds), e.is_encaixe ? "Sim" : "Não",
      ].map(csvEscape).join(";"));
    });

    lines.push("");
    lines.push(`TOTAL DE FALTAS:;${totalFaltas}`);
    lines.push(`TOTAL DE PEDIDOS AFETADOS:;${totalPedidos}`);
    lines.push(`TOTAL DE PRODUTOS DISTINTOS:;${totalProdutos}`);
    lines.push(`QUANTIDADE TOTAL DE ITENS FALTANTES:;${totalQtd}`);

    downloadCsv(lines, periodFilename("faltas", "csv", dateFrom, dateTo, shortageEntries));
  }

  function exportShortagesXLSX() {
    exportShortagesExcel({
      shortageEntries,
      shortagesByEntry,
      topShortageProducts,
      topShortageCustomers,
      periodLabel: periodLabel(dateFrom, dateTo, shortageEntries),
      dateFrom,
      dateTo,
    });
  }

  function exportErrorsCSV() {
    if (dateFilteredErrors.length === 0) { alert("Nenhum erro no período para exportar."); return; }
    const totalErros = dateFilteredErrors.length;
    const tiposDistintos = new Set(dateFilteredErrors.map((e) => e.error_type)).size;
    const operadoresQueApontaram = new Set(dateFilteredErrors.map((e) => e.operator_code)).size;
    const operadoresQueErraram = new Set(dateFilteredErrors.filter((e) => e.error_operator_code).map((e) => e.error_operator_code)).size;

    const lines = [];
    lines.push("RELATÓRIO DE ERROS DE SEPARAÇÃO");
    lines.push("Hidráulica Tropeiro — Aponta CD");
    lines.push("");
    lines.push(`Período:;${periodLabel(dateFrom, dateTo, dateFilteredErrors.map((e) => ({ start_time: e.created_at })))}`);
    lines.push(`Gerado em:;${fmtDateTime(new Date())}`);
    filterLines().forEach((l) => lines.push(l));
    lines.push("");
    lines.push(`Total de erros:;${totalErros}`);
    lines.push(`Tipos distintos de erro:;${tiposDistintos}`);
    lines.push(`Operadores que apontaram:;${operadoresQueApontaram}`);
    lines.push(`Operadores que erraram:;${operadoresQueErraram}`);
    lines.push("");
    lines.push("");

    const headers = [
      "Data", "Hora", "Tipo do Pedido", "Número",
      "Tipo de Erro", "Observação",
      "Operador que Errou", "Código de Quem Errou",
      "Quem Apontou", "Código de Quem Apontou", "Estação",
    ];
    lines.push(headers.map(csvEscape).join(";"));

    const sorted = [...dateFilteredErrors].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    sorted.forEach((e) => {
      lines.push([
        fmtDate(e.created_at), fmtClock(e.created_at).slice(0, 5),
        e.order_type === "pedido" ? "Pedido" : e.order_type === "transferencia" ? "Transferência" : "—",
        e.order_number || "—", e.error_type, e.note || "—",
        e.error_operator_name || "—", e.error_operator_code || "—",
        e.operator_name, e.operator_code, e.station || "—",
      ].map(csvEscape).join(";"));
    });

    lines.push("");
    lines.push(`TOTAL DE ERROS:;${totalErros}`);

    downloadCsv(lines, periodFilename("erros_separacao", "csv", dateFrom, dateTo, dateFilteredErrors.map((e) => ({ start_time: e.created_at }))));
  }

  function exportErrorsXLSX() {
    exportErrorsExcel({
      errors: dateFilteredErrors,
      errorsByType,
      errorRanking,
      errorsByReporter,
      periodLabel: periodLabel(dateFrom, dateTo, dateFilteredErrors.map((e) => ({ start_time: e.created_at }))),
      dateFrom,
      dateTo,
    });
  }

  function openPrintableReport() {
    const period = periodLabel(dateFrom, dateTo, filteredEntries);
    const esc = (s) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const activityRows = metrics.avgByActivity.filter((a) => a.registros > 0)
      .map((a) => `<tr><td>${esc(a.name)}</td><td class="right">${a.registros}</td><td>${esc(fmtDuration(a.media))}</td></tr>`).join("");

    const opRows = metrics.opStats
      .map((o) => `<tr><td>${esc(o.name)}</td><td class="right">${o.registros}</td><td>${esc(fmtDuration(o.media))}</td><td>${esc(fmtDuration(o.total))}</td></tr>`).join("");

    const coverageHeaders = activities.map((a) => `<th>${esc(a.name)}</th>`).join("");
    const coverageRows = coverage.map((row) => {
      const cells = activities.map((a) => `<td class="center">${row.counts[a.name] > 0 ? row.counts[a.name] : "—"}</td>`).join("");
      return `<tr><td>${esc(row.operator.name)}</td>${cells}<td class="center">${row.done}/${row.total}</td></tr>`;
    }).join("");

    const errorRows = errorsByType.map((e) => `<tr><td>${esc(e.name)}</td><td class="right">${e.total}</td></tr>`).join("");
    const errorRankingRows = errorRanking.map((r, i) => `<tr><td class="center">${i + 1}º</td><td>${esc(r.name)}</td><td>${esc(r.code)}</td><td class="right">${r.count}</td></tr>`).join("");

    const totalSegundos = filteredEntries.reduce((s, e) => s + (e.duration_seconds || 0), 0);
    const mediaSegundos = filteredEntries.length > 0 ? Math.round(totalSegundos / filteredEntries.length) : 0;
    const encaixesCount = filteredEntries.filter((e) => e.is_encaixe).length;
    const comFaltaCount = filteredEntries.filter((e) => shortagesByEntry[e.id]?.length).length;
    const totalFaltas = filteredEntries.reduce((s, e) => s + (shortagesByEntry[e.id]?.length || 0), 0);

    const topProductsRows = topShortageProducts.map((p) => `<tr><td>${esc(p.code)}</td><td class="right">${p.count}</td><td class="right">${p.totalQty}</td></tr>`).join("");
    const topCustomersRows = topShortageCustomers.map((c) => `<tr><td>${esc(c.name)}</td><td class="right">${c.entriesCount}</td><td class="right">${c.totalFaltas}</td><td class="right">${c.totalQty}</td></tr>`).join("");

    const conferenceBlock = conferenceStats.total > 0 ? `
      <h2>Mesa de conferência</h2>
      <table>
        <thead><tr><th>Métrica</th><th class="right">Valor</th></tr></thead>
        <tbody>
          <tr><td>Total conferido</td><td class="right">${conferenceStats.total}</td></tr>
          <tr><td>Sem problema</td><td class="right">${conferenceStats.ok}</td></tr>
          <tr><td>Com problema</td><td class="right">${conferenceStats.problems} (${conferenceStats.problemRate}%)</td></tr>
          <tr><td>Tempo médio de conferência</td><td class="right">${esc(fmtDuration(conferenceStats.avgDuration))}</td></tr>
        </tbody>
      </table>
    ` : "";

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Aponta CD</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Inter", Arial, Helvetica, sans-serif; color: #1a1d21; padding: 0; margin: 0; font-size: 11.5px; line-height: 1.5; }
  header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0a3d7a; padding-bottom: 14px; margin-bottom: 18px; }
  header img { width: 52px; height: 52px; border-radius: 50%; }
  h1 { font-size: 20px; margin: 0; color: #0a3d7a; }
  .meta { color: #555; font-size: 11px; margin-top: 3px; }
  .summary { background: #f5f7fa; border-left: 4px solid #0a3d7a; padding: 12px 16px; margin-bottom: 18px; border-radius: 4px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
  .summary-item { font-size: 11.5px; color: #444; }
  .summary-item strong { color: #0a3d7a; display: block; font-size: 15px; margin-bottom: 2px; }
  h2 { font-size: 14px; margin: 22px 0 8px 0; color: #0a3d7a; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 6px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  th { background: #eef2f7; color: #0a3d7a; font-weight: 600; }
  tr:nth-child(even) td { background: #fafbfc; }
  .right { text-align: right; }
  .center { text-align: center; }
  footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
  .signature { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .signature-line { border-top: 1px solid #333; padding-top: 6px; text-align: center; font-size: 10.5px; }
  @media print { body { padding: 0; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head>
<body>
  <header>
    <img src="${window.location.origin}${logo}" alt="" />
    <div>
      <h1>Relatório de Atividades — Aponta CD</h1>
      <div class="meta"><strong>Hidráulica Tropeiro</strong> · Período: ${esc(period)}<br />Gerado em ${esc(fmtDateTime(new Date()))}</div>
    </div>
  </header>

  <div class="summary">
    <div class="summary-grid">
      <div class="summary-item"><strong>${filteredEntries.length}</strong>Registros no período</div>
      <div class="summary-item"><strong>${esc(fmtDuration(mediaSegundos))}</strong>Tempo médio por registro</div>
      <div class="summary-item"><strong>${esc(fmtDuration(totalSegundos))}</strong>Tempo total</div>
      <div class="summary-item"><strong>${encaixesCount}</strong>Encaixes</div>
      <div class="summary-item"><strong>${comFaltaCount}</strong>Pedidos com falta</div>
      <div class="summary-item"><strong>${totalFaltas}</strong>Total de faltas registradas</div>
    </div>
  </div>

  <h2>Resumo por atividade</h2>
  <table><thead><tr><th>Atividade</th><th class="right">Registros</th><th>Tempo médio</th></tr></thead><tbody>${activityRows || '<tr><td colspan="3" class="center">Sem registros</td></tr>'}</tbody></table>

  <h2>Produtividade por operador</h2>
  <table><thead><tr><th>Operador</th><th class="right">Registros</th><th>Tempo médio</th><th>Tempo total</th></tr></thead><tbody>${opRows || '<tr><td colspan="4" class="center">Sem registros</td></tr>'}</tbody></table>

  <h2>Cobertura de rodízio</h2>
  <table><thead><tr><th>Operador</th>${coverageHeaders}<th class="center">Cobertura</th></tr></thead><tbody>${coverageRows || `<tr><td colspan="${activities.length + 2}" class="center">Sem operadores</td></tr>`}</tbody></table>

  ${topShortageProducts.length > 0 ? `<h2>Produtos com mais faltas</h2><table><thead><tr><th>Código</th><th class="right">Ocorrências</th><th class="right">Qtd. total</th></tr></thead><tbody>${topProductsRows}</tbody></table>` : ""}

  ${topShortageCustomers.length > 0 ? `<h2>Clientes mais afetados por falta</h2><table><thead><tr><th>Cliente</th><th class="right">Pedidos afetados</th><th class="right">Faltas</th><th class="right">Qtd. total</th></tr></thead><tbody>${topCustomersRows}</tbody></table>` : ""}

  ${errorsByType.length > 0 ? `<h2>Erros de separação por tipo</h2><table><thead><tr><th>Tipo de erro</th><th class="right">Ocorrências</th></tr></thead><tbody>${errorRows}</tbody></table>` : ""}

  ${errorRanking.length > 0 ? `<h2>Ranking — Operadores que mais erraram</h2><table><thead><tr><th class="center">Posição</th><th>Operador</th><th>Código</th><th class="right">Total</th></tr></thead><tbody>${errorRankingRows}</tbody></table>` : ""}

  ${conferenceBlock}

  <div class="signature">
    <div class="signature-line">Responsável pelo CD</div>
    <div class="signature-line">Conferência</div>
  </div>

  <footer>Aponta CD · Hidráulica Tropeiro — relatório gerado automaticamente</footer>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  }

  async function copyDailySummary() {
    const today = todayLocalISODate();
    const todayEntries = entries.filter((e) => e.start_time.slice(0, 10) === today);
    const todayMetrics = computeMetrics(todayEntries, activities);
    const todayErrors = separationErrors.filter((e) => e.created_at.slice(0, 10) === today);

    const lines = [];
    lines.push(`RESUMO DO DIA`);
    lines.push(`Aponta CD — Hidráulica Tropeiro`);
    lines.push(`Data: ${fmtDate(new Date())}`);
    lines.push("");
    lines.push(`Total de registros: ${todayEntries.length}`);
    lines.push(`Tempo médio geral: ${fmtDuration(Math.round(meanM(todayEntries.map((e) => e.duration_seconds))))}`);
    const encaixesHoje = todayEntries.filter((e) => e.is_encaixe).length;
    if (encaixesHoje > 0) lines.push(`Encaixes: ${encaixesHoje}`);
    const faltasHoje = todayEntries.reduce((sum, e) => sum + (shortagesByEntry[e.id]?.length || 0), 0);
    if (faltasHoje > 0) lines.push(`Faltas registradas: ${faltasHoje}`);
    if (todayErrors.length > 0) lines.push(`Erros de separação: ${todayErrors.length}`);

    lines.push("");
    lines.push("Por atividade:");
    todayMetrics.avgByActivity.filter((a) => a.registros > 0)
      .forEach((a) => lines.push(`  • ${a.name}: ${a.registros} registro(s), média ${fmtDuration(a.media)}`));
    lines.push("");
    lines.push("Por operador:");
    todayMetrics.opStats.forEach((o) => lines.push(`  • ${o.name}: ${o.registros} registro(s), total ${fmtDuration(o.total)}`));

    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("Copiado! ✓");
    } catch {
      setCopyLabel("Não foi possível copiar");
    }
    setTimeout(() => setCopyLabel("Copiar resumo do dia"), 2500);
  }

  async function confirmReset() {
    if (resetPhrase.trim().toUpperCase() !== "ZERAR") return;
    setResetting(true);
    await onResetEntries?.();
    setResetting(false);
    setConfirmingReset(false);
    setResetPhrase("");
  }
  async function confirmResetErrors() {
    if (resetErrorsPhrase.trim().toUpperCase() !== "ZERAR") return;
    setResettingErrors(true);
    await onResetSeparationErrors?.();
    setResettingErrors(false);
    setConfirmingResetErrors(false);
    setResetErrorsPhrase("");
  }
  async function confirmResetShortages() {
    if (resetShortagesPhrase.trim().toUpperCase() !== "ZERAR") return;
    setResettingShortages(true);
    await onResetShortages?.();
    setResettingShortages(false);
    setConfirmingResetShortages(false);
    setResetShortagesPhrase("");
  }

  const hasFilters = filterOperator || filterActivity || filterShift || filterStation || filterEncaixe || filterShortage || filterProductCode || filterCustomer || filterOrderNumber || filterErrorOperator || dateFrom || dateTo;

  // ============================================================
  // RETORNO CONDICIONAL
  // ============================================================

  if (viewOperator) {
    return (
      <OperatorProfile
        operator={viewOperator}
        entries={entries}
        activities={activities}
        separationErrors={separationErrors}
        shortagesByEntry={shortagesByEntry}
        onBack={() => setViewOperator(null)}
      />
    );
  }

  // ============ MODO PAINEL ============
  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Painel de métricas</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {filteredEntries.length} de {entries.length} registros · {activeSessions.length} em andamento agora
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={copyDailySummary}>{copyLabel}</button>
          <button className="btn-small" onClick={openPrintableReport}>Gerar relatório (PDF)</button>
          <button className="btn-small" onClick={exportHistoricoCSV}>Exportar CSV</button>
          <button className="btn-small btn-excel" onClick={exportHistoricoXLSX}>Exportar Excel</button>
          <button className="btn-danger-outline" onClick={() => setConfirmingReset((v) => !v)}>
            Zerar resultados
          </button>
        </div>
      </div>

      {confirmingReset && (
        <div className="confirm-box" style={{ marginBottom: 22 }}>
          <strong style={{ color: "var(--danger)", fontSize: 14 }}>Isso apaga todo o histórico de registros, permanentemente.</strong>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 12px 0" }}>
            Não afeta a lista de operadores nem de atividades. Para confirmar, digite <strong>ZERAR</strong> abaixo.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="Digite ZERAR"
              value={resetPhrase}
              onChange={(e) => setResetPhrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmReset()}
            />
            <button className="btn-danger-outline" onClick={confirmReset} disabled={resetPhrase.trim().toUpperCase() !== "ZERAR" || resetting}>
              {resetting ? "Apagando..." : "Confirmar"}
            </button>
            <button className="btn-small" onClick={() => { setConfirmingReset(false); setResetPhrase(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      {activityAlerts.length > 0 && (
        <div className="confirm-box alert-box-pulsing" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "var(--danger)", fontSize: 15 }}>
              ⚠ {activityAlerts.length} atividade(s) em andamento há mais tempo que o esperado
            </strong>
            <button className="btn-small" onClick={toggleSound}>
              {soundEnabled ? "🔔 Alerta sonoro ativado" : "🔕 Ativar alerta sonoro"}
            </button>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {activityAlerts.map((a) => (
              <div key={a.operator_code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{a.operator_name} — {a.activity}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--danger)" }}>{fmtDuration(a.elapsed)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activityAlerts.length === 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="btn-small" onClick={toggleSound}>
            {soundEnabled ? "🔔 Alerta sonoro ativado" : "🔕 Ativar alerta sonoro"}
          </button>
        </div>
      )}

      <div className="stat-strip">
        <div className="stat-cell">
          <div className="stat-num">{filteredEntries.length}</div>
          <div className="stat-label">Registros no período</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{fmtDuration(Math.round(meanM(filteredEntries.map((e) => e.duration_seconds))))}</div>
          <div className="stat-label">Tempo médio geral</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num accent">{stats.encaixes}</div>
          <div className="stat-label">Encaixes ({stats.pctEncaixe}%)</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num danger">{stats.entriesComFalta}</div>
          <div className="stat-label">Pedidos com falta ({stats.pctFalta}%)</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Filtros</div>
        <div className="quick-filters">
          <span className="quick-filters-label">Período rápido:</span>
          <button className={`quick-filter-btn ${activeQuickFilter === "hoje" ? "active" : ""}`} onClick={() => applyQuickFilter("hoje")}>Hoje</button>
          <button className={`quick-filter-btn ${activeQuickFilter === "ontem" ? "active" : ""}`} onClick={() => applyQuickFilter("ontem")}>Ontem</button>
          <button className={`quick-filter-btn ${activeQuickFilter === "7dias" ? "active" : ""}`} onClick={() => applyQuickFilter("7dias")}>Últimos 7 dias</button>
          <button className={`quick-filter-btn ${activeQuickFilter === "mes" ? "active" : ""}`} onClick={() => applyQuickFilter("mes")}>Este mês</button>
          {(dateFrom || dateTo) && (
            <button className="quick-filter-clear" onClick={() => applyQuickFilter("")}>✕ Limpar período</button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="field" style={{ width: "auto" }} value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}>
            <option value="">Todos operadores (apontaram)</option>
            {operators.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
          <select className="field" style={{ width: "auto" }} value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)}>
            <option value="">Todas atividades</option>
            {activities.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
          <select className="field" style={{ width: "auto" }} value={filterShift} onChange={(e) => setFilterShift(e.target.value)}>
            <option value="">Ambos turnos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
          </select>
          {knownStations.length > 0 && (
            <select className="field" style={{ width: "auto" }} value={filterStation} onChange={(e) => setFilterStation(e.target.value)}>
              <option value="">Todas estações</option>
              {knownStations.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select className="field" style={{ width: "auto" }} value={filterEncaixe} onChange={(e) => setFilterEncaixe(e.target.value)}>
            <option value="">Todos (encaixe)</option>
            <option value="yes">Só encaixes</option>
            <option value="no">Sem encaixe</option>
          </select>
          <select className="field" style={{ width: "auto" }} value={filterShortage} onChange={(e) => setFilterShortage(e.target.value)}>
            <option value="">Todos (falta)</option>
            <option value="yes">Só com falta</option>
            <option value="no">Sem falta</option>
          </select>
          {errorOperatorsList.length > 0 && (
            <select className="field" style={{ width: "auto" }} value={filterErrorOperator} onChange={(e) => setFilterErrorOperator(e.target.value)}>
              <option value="">Todos (quem errou)</option>
              {errorOperatorsList.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
            </select>
          )}
          <input className="field" style={{ width: 160, fontFamily: "var(--font-mono)" }} placeholder="Código produto..." value={filterProductCode} onChange={(e) => setFilterProductCode(e.target.value)} />
          <input className="field" style={{ width: 180 }} placeholder="Cliente..." value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} />
          <input
            className="field"
            style={{ width: 140, fontFamily: "var(--font-mono)" }}
            placeholder="Nº pedido..."
            value={filterOrderNumber}
            onChange={(e) => setFilterOrderNumber(e.target.value.replace(/\D/g, ""))}
          />
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>de</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)} />
          <span style={{ color: "var(--text-faint)", fontSize: 12 }}>até</span>
          <input type="date" className="field" style={{ width: "auto" }} value={dateTo} onChange={(e) => handleDateToChange(e.target.value)} />
          {hasFilters && <button className="btn-small" onClick={clearFilters}>Limpar todos os filtros</button>}
        </div>
      </div>

      {conferenceStats.total > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">✅ Mesa de conferência</div>

          <div className="stat-strip" style={{ marginBottom: 16 }}>
            <div className="stat-cell">
              <div className="stat-num accent">{conferenceStats.total}</div>
              <div className="stat-label">Total conferido</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num" style={{ color: "var(--ok)" }}>{conferenceStats.ok}</div>
              <div className="stat-label">Sem problema</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num danger">{conferenceStats.problems}</div>
              <div className="stat-label">Com problema ({conferenceStats.problemRate}%)</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{fmtDuration(conferenceStats.avgDuration)}</div>
              <div className="stat-label">Tempo médio de conferência</div>
            </div>
          </div>

          {conferenceRanking.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
                🏆 Ranking de conferentes
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Posição</th><th>Conferente</th><th>Conferências</th><th>Tempo médio</th></tr>
                </thead>
                <tbody>
                  {conferenceRanking.map((r, i) => (
                    <tr key={r.code}>
                      <td><span style={{ fontSize: 16 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}</span></td>
                      <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{r.name}</td>
                      <td>{r.count}</td>
                      <td>{fmtDuration(r.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {conferenceProblems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
                ⚠ Problemas por motivo
              </div>
              <ResponsiveContainer width="100%" height={Math.max(140, conferenceProblems.length * 34)}>
                <BarChart data={conferenceProblems} layout="vertical">
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={140} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "var(--text)" }} />
                  <Bar dataKey="total" fill="var(--danger)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {conferenceSeparatorsRanking.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
                🎯 Separadores com mais problemas
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Separador</th><th>Total conferido</th><th>Com problema</th><th>% problema</th></tr>
                </thead>
                <tbody>
                  {conferenceSeparatorsRanking.map((r) => (
                    <tr key={r.code}>
                      <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{r.name}</td>
                      <td>{r.count}</td>
                      <td style={{ color: r.problems > 0 ? "var(--danger)" : "var(--text-muted)", fontWeight: 600 }}>{r.problems}</td>
                      <td style={{ color: r.problemRate > 20 ? "var(--danger)" : r.problemRate > 0 ? "var(--warning)" : "var(--ok)", fontWeight: 600 }}>
                        {r.problemRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Tempo médio por atividade (segundos)</div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={metrics.avgByActivity}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "var(--text)" }} />
            <Bar dataKey="media" radius={[3, 3, 0, 0]}>
              {metrics.avgByActivity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Tendência semanal por atividade (segundos, média)</div>
        {weeklyTrend.length > 1 ? (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "var(--text)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activities.map((a, i) => (
                <Line key={a.name} type="monotone" dataKey={a.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Ainda não há dados de mais de uma semana no período filtrado.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Comparação mês a mês</div>
          {availableMonths.length > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="field" style={{ width: "auto" }} value={monthA} onChange={(e) => setMonthA(e.target.value)}>
                {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <span style={{ color: "var(--text-faint)", fontSize: 12 }}>vs</span>
              <select className="field" style={{ width: "auto" }} value={monthB} onChange={(e) => setMonthB(e.target.value)}>
                {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
          )}
        </div>
        {availableMonths.length > 1 ? (
          <table className="data-table">
            <thead><tr><th>Atividade</th><th>{monthLabel(monthA)}</th><th>{monthLabel(monthB)}</th><th>Diferença</th></tr></thead>
            <tbody>
              {monthComparisonRows.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{r.name}</td>
                  <td>{r.registrosA > 0 ? fmtDuration(r.mediaA) : "sem registros"}</td>
                  <td>{r.registrosB > 0 ? fmtDuration(r.mediaB) : "sem registros"}</td>
                  <td style={{ color: r.deltaPct === null ? "var(--text-faint)" : r.deltaPct < 0 ? "var(--ok)" : "var(--danger)" }}>
                    {r.deltaPct === null ? "—" : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Ainda não há registros de mais de um mês para comparar.</p>
        )}
      </div>

      {targetComparison.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Meta vs. real por atividade</div>
          <table className="data-table">
            <thead><tr><th>Atividade</th><th>Meta</th><th>Real (média)</th><th>Diferença</th></tr></thead>
            <tbody>
              {targetComparison.map((t) => (
                <tr key={t.name}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{t.name}</td>
                  <td>{fmtDuration(t.target)}</td>
                  <td>{t.registros > 0 ? fmtDuration(t.media) : "sem registros"}</td>
                  <td style={{ color: t.deltaPct === null ? "var(--text-faint)" : t.deltaPct > 0 ? "var(--danger)" : "var(--ok)" }}>
                    {t.deltaPct === null ? "—" : `${t.deltaPct > 0 ? "+" : ""}${t.deltaPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Produtividade por operador</div>
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -8, marginBottom: 12 }}>
          💡 Clique no nome de um operador para ver o perfil completo.
        </p>
        <table className="data-table">
          <thead><tr><th>Operador</th><th>Registros</th><th>Tempo médio</th><th>Tempo total</th></tr></thead>
          <tbody>
            {metrics.opStats.map((o) => {
              const op = operators.find((x) => x.name === o.name);
              return (
                <tr key={o.name}>
                  <td
                    className={op ? "clickable-name" : ""}
                    onClick={op ? () => setViewOperator(op) : undefined}
                    title={op ? `Ver perfil de ${o.name}` : ""}
                  >
                    {o.name}
                  </td>
                  <td>{o.registros}</td>
                  <td>{fmtDuration(o.media)}</td>
                  <td>{fmtDuration(o.total)}</td>
                </tr>
              );
            })}
            {metrics.opStats.length === 0 && <tr><td colSpan={4}>Nenhum registro no período.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>🚨 Erros de separação no período</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-small" onClick={exportErrorsCSV}>Exportar CSV</button>
            <button className="btn-small btn-excel" onClick={exportErrorsXLSX}>Exportar Excel</button>
            <button className="btn-danger-outline" onClick={() => setConfirmingResetErrors((v) => !v)}>
              Zerar erros
            </button>
          </div>
        </div>

        {confirmingResetErrors && (
          <div className="confirm-box" style={{ marginBottom: 14 }}>
            <strong style={{ color: "var(--danger)", fontSize: 14 }}>Isso apaga todo o histórico de erros de separação, permanentemente.</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                className="field"
                style={{ flex: 1 }}
                placeholder="Digite ZERAR"
                value={resetErrorsPhrase}
                onChange={(e) => setResetErrorsPhrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmResetErrors()}
              />
              <button className="btn-danger-outline" onClick={confirmResetErrors} disabled={resetErrorsPhrase.trim().toUpperCase() !== "ZERAR" || resettingErrors}>
                {resettingErrors ? "Apagando..." : "Confirmar"}
              </button>
              <button className="btn-small" onClick={() => { setConfirmingResetErrors(false); setResetErrorsPhrase(""); }}>Cancelar</button>
            </div>
          </div>
        )}

        {errorRanking.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
              🏆 Operadores que mais erraram
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {errorRanking.map((r, i) => {
                const pct = (r.count / maxErrorCount) * 100;
                const op = operators.find((x) => x.code === r.code);
                return (
                  <div key={r.code} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: i === 0 ? "#ef4444" : i === 1 ? "#f97316" : i === 2 ? "#f59e0b" : "var(--surface-raised)",
                        color: i < 3 ? "#fff" : "var(--text-muted)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 12, flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span
                          className={op ? "clickable-name" : ""}
                          onClick={op ? () => setViewOperator(op) : undefined}
                          style={{ fontWeight: 600 }}
                        >
                          {r.name} <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>#{r.code}</span>
                        </span>
                        <span style={{ color: "var(--danger)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{r.count}</span>
                      </div>
                      <div style={{ height: 6, background: "var(--surface-sunken)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--danger)", borderRadius: 3, transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {errorsByType.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              📊 Erros por tipo
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={errorsByType}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10.5 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "var(--text)" }} />
                <Bar dataKey="total" fill="var(--danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {dateFilteredErrors.length > 0 ? (
          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>📋 Detalhes</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th><th>Pedido/Transf.</th><th>Tipo de Erro</th>
                  <th>Quem errou</th><th>Quem apontou</th><th>Observação</th><th>Estação</th>
                </tr>
              </thead>
              <tbody>
                {dateFilteredErrors.slice(0, 100).map((e) => {
                  const opErr = operators.find((x) => x.code === e.error_operator_code);
                  const opApo = operators.find((x) => x.code === e.operator_code);
                  return (
                    <tr key={e.id}>
                      <td>{fmtDate(e.created_at)} {fmtClock(e.created_at).slice(0, 5)}</td>
                      <td>
                        {e.order_number ? (
                          <>
                            <span style={{ color: "var(--text-faint)", fontSize: 10.5 }}>
                              {e.order_type === "pedido" ? "📦" : e.order_type === "transferencia" ? "🔄" : ""}
                            </span>{" "}
                            <span style={{ fontFamily: "var(--font-mono)" }}>{e.order_number}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td>{e.error_type}</td>
                      <td style={{ color: "var(--danger)", fontWeight: 600 }}>
                        <span
                          className={opErr ? "clickable-name" : ""}
                          onClick={opErr ? () => setViewOperator(opErr) : undefined}
                          style={{ color: "var(--danger)" }}
                        >
                          {e.error_operator_name || "—"}
                        </span>
                        {e.error_operator_code && <span style={{ color: "var(--text-faint)", fontWeight: 400 }}> #{e.error_operator_code}</span>}
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        <span
                          className={opApo ? "clickable-name" : ""}
                          onClick={opApo ? () => setViewOperator(opApo) : undefined}
                          style={{ color: "var(--text-muted)" }}
                        >
                          {e.operator_name}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{e.note || "—"}</td>
                      <td style={{ color: "var(--text-muted)" }}>{e.station || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum erro registrado no período filtrado.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>📦 Produtos que mais faltam</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-small" onClick={exportShortagesCSV}>Exportar CSV</button>
            <button className="btn-small btn-excel" onClick={exportShortagesXLSX}>Exportar Excel</button>
          </div>
        </div>

        {topShortageProducts.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, topShortageProducts.length * 32)}>
              <BarChart data={topShortageProducts} layout="vertical">
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="code" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "var(--text)" }} />
                <Bar dataKey="totalQty" fill="var(--danger)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <table className="data-table" style={{ marginTop: 14 }}>
              <thead><tr><th>Código</th><th>Ocorrências</th><th>Quantidade total</th></tr></thead>
              <tbody>
                {topShortageProducts.map((p) => (
                  <tr key={p.code}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{p.code}</td>
                    <td>{p.count}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{p.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhuma falta registrada no período.</p>
        )}
      </div>

      {shortagesByDay.length > 1 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">📈 Faltas ao longo do tempo</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={shortagesByDay}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, borderRadius: 8 }} labelStyle={{ color: "var(--text)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="totalFaltas" name="Faltas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="totalQty" name="Quantidade total" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {topShortageCustomers.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🏢 Clientes mais afetados por falta</div>
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Pedidos afetados</th><th>Faltas</th><th>Qtd. total</th></tr></thead>
            <tbody>
              {topShortageCustomers.map((c) => (
                <tr key={c.name}>
                  <td style={{ fontFamily: "var(--font-display)" }}>{c.name}</td>
                  <td>{c.entriesCount}</td>
                  <td>{c.totalFaltas}</td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>{c.totalQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Pedidos com falta ({shortageEntries.length})</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-small" onClick={exportShortagesCSV}>Exportar CSV</button>
            <button className="btn-small btn-excel" onClick={exportShortagesXLSX}>Exportar Excel</button>
            <button className="btn-danger-outline" onClick={() => setConfirmingResetShortages((v) => !v)}>
              Zerar faltas
            </button>
          </div>
        </div>

        {confirmingResetShortages && (
          <div className="confirm-box" style={{ marginBottom: 14 }}>
            <strong style={{ color: "var(--danger)", fontSize: 14 }}>Isso apaga todas as faltas registradas, permanentemente.</strong>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 12px 0" }}>
              Os registros de atividades (histórico) <strong>não</strong> são apagados. Digite <strong>ZERAR</strong> abaixo pra confirmar.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="field"
                style={{ flex: 1 }}
                placeholder="Digite ZERAR"
                value={resetShortagesPhrase}
                onChange={(e) => setResetShortagesPhrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmResetShortages()}
              />
              <button className="btn-danger-outline" onClick={confirmResetShortages} disabled={resetShortagesPhrase.trim().toUpperCase() !== "ZERAR" || resettingShortages}>
                {resettingShortages ? "Apagando..." : "Confirmar"}
              </button>
              <button className="btn-small" onClick={() => { setConfirmingResetShortages(false); setResetShortagesPhrase(""); }}>Cancelar</button>
            </div>
          </div>
        )}

        {shortageEntries.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Data</th><th>Operador</th><th>Atividade</th><th>Pedido</th><th>Cliente</th><th>Encaixe</th><th>Faltas</th></tr>
              </thead>
              <tbody>
                {shortageEntries.slice(0, 150).map((e) => {
                  const list = shortagesByEntry[e.id] || [];
                  const op = operators.find((x) => x.code === e.operator_code);
                  return (
                    <tr key={e.id}>
                      <td>{fmtDate(e.start_time)}</td>
                      <td
                        className={op ? "clickable-name" : ""}
                        onClick={op ? () => setViewOperator(op) : undefined}
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {e.operator_name}
                      </td>
                      <td>{e.activity}</td>
                      <td>{e.order_number || "—"}</td>
                      <td style={{ color: "var(--text-muted)" }}>{e.customer_name || "—"}</td>
                      <td>
                        {e.is_encaixe ? (
                          <span style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>ENC.</span>
                        ) : "—"}
                      </td>
                      <td style={{ color: "var(--danger)" }}>
                        {list.map((s) => `${s.product_code} (${s.quantity})`).join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Nenhum pedido com falta no período filtrado.</p>
        )}
      </div>

      <div className="card">
        <div className="page-header-row" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Histórico detalhado</div>
          {onOpenAdminMaster && (
            <button className="btn-small" onClick={() => onOpenAdminMaster({ tab: "entries" })}>
              ✏️ Abrir no Admin Master
            </button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th><th>Operador</th><th>Atividade</th><th>Turno</th>
                <th>Estação</th><th>Início</th><th>Fim</th><th>Duração</th><th>Flags</th>
                <th style={{ width: 130 }}>Admin</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.slice(0, 150).map((e) => {
                const isOutlier = metrics.outliers.some((o) => o.id === e.id);
                const faltas = shortagesByEntry[e.id] || [];
                const op = operators.find((x) => x.code === e.operator_code);
                return (
                  <tr key={e.id}>
                    <td>{fmtDate(e.start_time)}</td>
                    <td
                      className={op ? "clickable-name" : ""}
                      onClick={op ? () => setViewOperator(op) : undefined}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {e.operator_name}
                    </td>
                    <td>
                      {e.activity}
                      {(e.transfer_type || e.customer_name || e.order_number) && (
                        <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                          {e.transfer_type || e.customer_name}
                          {e.order_number ? ` · #${e.order_number}` : ""}
                          {e.transfer_number ? ` · #${e.transfer_number}` : ""}
                          {e.transfer_urgent ? " · 🔴 urgente" : ""}
                        </div>
                      )}
                      {e.vehicle && (
                        <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                          {e.vehicle}{e.plate ? ` · ${e.plate}` : ""}
                        </div>
                      )}
                    </td>
                    <td>{e.shift}</td>
                    <td style={{ color: "var(--text-muted)" }}>{e.station || "—"}</td>
                    <td>{fmtClock(e.start_time)}</td>
                    <td>{fmtClock(e.end_time)}</td>
                    <td>
                      {fmtDuration(e.duration_seconds)}
                      {isOutlier && <span className="outlier-tag">fora do padrão</span>}
                      {e.manual_entry && <span className="outlier-tag" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>manual</span>}
                      {e.note && <span title={e.note} style={{ marginLeft: 6, cursor: "help" }}>📝</span>}
                    </td>
                    <td>
                      {e.is_encaixe && (
                        <span style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, marginRight: 4 }}>
                          ENCAIXE
                        </span>
                      )}
                      {faltas.length > 0 && (
                        <span title={faltas.map((f) => `${f.product_code} x${f.quantity}`).join(", ")} style={{ background: "var(--danger-soft)", color: "var(--danger)", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "help" }}>
                          ⚠ {faltas.length} FALTA{faltas.length > 1 ? "S" : ""}
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {onOpenAdminMaster && (
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => onOpenAdminMaster({ tab: "entries", id: e.id })}>
                          ✏️
                        </button>
                      )}
                      <button
                        className="btn-small"
                        style={{ padding: "4px 8px", color: "var(--danger)", borderColor: "var(--danger)" }}
                        onClick={async () => {
                          await quickDeleteEntry(e);
                          onOpenAdminMaster?.({ tab: "entries", refresh: true });
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && <tr><td colSpan={10}>Nenhum registro encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
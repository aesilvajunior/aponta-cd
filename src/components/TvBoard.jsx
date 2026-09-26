import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  fetchActiveSessions,
  fetchEntries,
  fetchShortages,
  fetchConferenceQueue,
  fetchConferenceHistory,
} from "../lib/api";
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";
import { useTheme } from "../context/ThemeContext";
import {
  IconPackage,
  IconZap,
  IconArrowLeftRight,
  IconFlag,
  IconCheck,
  IconAlertTriangle,
  IconTrendingUp,
  IconTarget,
  IconTrophy,
  IconAward,
  IconSun,
  IconMoon,
  IconTv,
  IconMapPin,
  IconClock,
  IconEye,
  IconEyeOff,
  IconVolume2,
  IconVolumeX,
  IconMaximize,
  IconMinimize,
  IconFilter,
  IconActivity,
} from "./Icons";

const ACCENT_LIGHT = "#4a7ba7";
const ACCENT_DARK = "#4a7ba7";
const DEFAULT_ALERT_SECONDS = 1800;
const STALE_OPERATOR_SECONDS = 2 * 60 * 60;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function timeAgo(iso, now) {
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getStationFromUrl() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const s = params.get("station");
  return s ? s.trim() : "";
}

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

const PALETTES = {
  dark: {
    bg: "#0a0e14",
    surface: "#111823",
    border: "#1f2937",
    text: "#f3f4f6",
    textMuted: "#94a3b8",
    accent: ACCENT_DARK,
    danger: "#f87171",
    warning: "#fbbf24",
    ok: "#34d399",
    purple: "#c084fc",
    blue: "#60a5fa",
    gradient: "radial-gradient(ellipse at top, #0f1a2e 0%, #0a0e14 60%)",
    medalColors: ["#fbbf24", "#cbd5e1", "#b45309"],
    medalText: "#0a0e14",
  },
  light: {
    bg: "#f5f6f8",
    surface: "#ffffff",
    border: "#e5e7eb",
    text: "#111827",
    textMuted: "#6b7280",
    accent: ACCENT_LIGHT,
    danger: "#ef4444",
    warning: "#f59e0b",
    ok: "#10b981",
    purple: "#8b5cf6",
    blue: "#3b82f6",
    gradient: "radial-gradient(ellipse at top, #e0eaf3 0%, #f5f6f8 60%)",
    medalColors: ["#fbbf24", "#cbd5e1", "#b45309"],
    medalText: "#0a0e14",
  },
};

export default function TvBoard() {
  const [sessions, setSessions] = useState([]);
  const [todayEntries, setTodayEntries] = useState([]);
  const [weekEntries, setWeekEntries] = useState([]);
  const [todayShortages, setTodayShortages] = useState([]);
  const [alertThreshold, setAlertThreshold] = useState(DEFAULT_ALERT_SECONDS);
  const [activities, setActivities] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(false);

  const [conferenceQueue, setConferenceQueue] = useState([]);
  const [conferenceHistory, setConferenceHistory] = useState([]);

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("tv_theme") || "dark"; } catch { return "dark"; }
  });
  const [hideNames, setHideNames] = useState(() => {
    try { return localStorage.getItem("tv_hide_names") === "1"; } catch { return false; }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [hiddenSessions, setHiddenSessions] = useState(() => {
    try { return localStorage.getItem("tv_hide_timer") === "1"; } catch { return false; }
  });

  const { resolvedTheme } = useTheme();
  const stationFilter = useMemo(() => getStationFromUrl(), []);

  const seenSessions = useRef(new Set());
  const alertedRef = useRef(new Set());
  const palette = PALETTES[theme] || PALETTES.dark;

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      console.log("[TV] Auto-refresh para evitar travamento");
      window.location.reload();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("tv_theme", theme); } catch {}
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem("tv_hide_names", hideNames ? "1" : "0"); } catch {}
  }, [hideNames]);
  useEffect(() => {
    try { localStorage.setItem("tv_hide_timer", hiddenSessions ? "1" : "0"); } catch {}
  }, [hiddenSessions]);

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: acts }] = await Promise.all([
        supabase.from("admin_config").select("alert_threshold_seconds").eq("id", 1).maybeSingle(),
        supabase.from("activities").select("*").eq("active", true),
      ]);
      if (cfg?.alert_threshold_seconds) setAlertThreshold(cfg.alert_threshold_seconds);
      if (acts) setActivities(acts);
    })();

    const ch = supabase
      .channel("tv-config")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_config" }, (payload) => {
        const v = payload?.new?.alert_threshold_seconds;
        if (v) {
          setAlertThreshold(v);
        } else if (payload?.eventType === "DELETE") {
          setAlertThreshold(DEFAULT_ALERT_SECONDS);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, async () => {
        const { data } = await supabase.from("activities").select("*").eq("active", true);
        if (data) setActivities(data);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function loadAll() {
    const [
      { data: s },
      { data: e },
      { data: sh },
      { data: cq },
      { data: ch },
    ] = await Promise.all([
      fetchActiveSessions(),
      fetchEntries({ limit: 2000 }),
      fetchShortages({ limit: 500 }),
      fetchConferenceQueue(),
      fetchConferenceHistory({ limit: 200 }),
    ]);
    if (s) setSessions(s);
    if (e) {
      const today = new Date().toISOString().slice(0, 10);
      setTodayEntries(e.filter((x) => x.start_time.slice(0, 10) === today));

      const { monday, sunday } = getWeekRange();
      setWeekEntries(
        e.filter((x) => {
          const d = new Date(x.start_time);
          return d >= monday && d <= sunday;
        })
      );
    }
    if (sh) {
      const today = new Date().toISOString().slice(0, 10);
      setTodayShortages(sh.filter((x) => x.created_at.slice(0, 10) === today));
    }
    if (cq) setConferenceQueue(cq);
    if (ch) setConferenceHistory(ch);
  }

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("tv-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entry_shortages" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "conference_queue" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  function enterFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function exitFullscreen() {
    document.exitFullscreen?.().catch(() => {});
  }

  const filteredSessions = useMemo(() => {
    if (!stationFilter) return sessions;
    return sessions.filter((s) => (s.station || "").toLowerCase() === stationFilter.toLowerCase());
  }, [sessions, stationFilter]);

  const activityAlerts = useMemo(() => {
    return filteredSessions
      .map((s) => {
        const elapsed = Math.round((now - new Date(s.start_time).getTime()) / 1000);
        const cfg = activities.find((a) => a.name === s.activity);
        let threshold = alertThreshold || DEFAULT_ALERT_SECONDS;
        if (cfg?.target_seconds) threshold = cfg.target_seconds;
        return { ...s, elapsed, threshold, isLate: elapsed > threshold };
      })
      .filter((s) => s.isLate);
  }, [filteredSessions, activities, alertThreshold, now]);

  const staleSessions = useMemo(() => {
    return filteredSessions.filter((s) => {
      const elapsed = Math.round((now - new Date(s.start_time).getTime()) / 1000);
      return elapsed > STALE_OPERATOR_SECONDS;
    });
  }, [filteredSessions, now]);

  const visibleSessions = useMemo(() => {
    if (!hiddenSessions) return filteredSessions;
    return filteredSessions.filter((s) => {
      const elapsed = Math.round((now - new Date(s.start_time).getTime()) / 1000);
      const cfg = activities.find((a) => a.name === s.activity);
      let threshold = alertThreshold || DEFAULT_ALERT_SECONDS;
      if (cfg?.target_seconds) threshold = cfg.target_seconds;
      return elapsed > threshold;
    });
  }, [filteredSessions, hiddenSessions, activities, alertThreshold, now]);

  function playAlertBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.22;
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      setTimeout(() => {
        try {
          const c2 = new (window.AudioContext || window.webkitAudioContext)();
          const o2 = c2.createOscillator();
          const g2 = c2.createGain();
          o2.connect(g2); g2.connect(c2.destination);
          o2.frequency.value = 880; g2.gain.value = 0.22;
          o2.start(); o2.stop(c2.currentTime + 0.35);
        } catch {}
      }, 400);
    } catch {}
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) playAlertBeep();
  }

  useEffect(() => {
    if (!soundEnabled) return;
    const currentKeys = new Set(activityAlerts.map((a) => a.operator_code));
    activityAlerts.forEach((a) => {
      if (!alertedRef.current.has(a.operator_code)) playAlertBeep();
    });
    alertedRef.current = currentKeys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityAlerts, soundEnabled]);

  const sorted = useMemo(
    () => [...visibleSessions].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [visibleSessions]
  );

  const entriesWithShortageIds = useMemo(
    () => new Set(todayShortages.map((s) => s.entry_id)),
    [todayShortages]
  );

  const ranking = useMemo(() => {
    const byOp = {};
    todayEntries.forEach((e) => {
      if (!byOp[e.operator_name]) {
        byOp[e.operator_name] = { name: e.operator_name, count: 0, totalSeconds: 0, activityCount: {} };
      }
      const op = byOp[e.operator_name];
      op.count += 1;
      op.totalSeconds += e.duration_seconds || 0;
      op.activityCount[e.activity] = (op.activityCount[e.activity] || 0) + 1;
    });
    return Object.values(byOp)
      .map((op) => {
        const entries = Object.entries(op.activityCount);
        entries.sort((a, b) => b[1] - a[1]);
        return { name: op.name, count: op.count, totalSeconds: op.totalSeconds, mainActivity: entries[0]?.[0] || "—" };
      })
      .sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds)
      .slice(0, 5);
  }, [todayEntries]);

  const conferenceRanking = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayConf = conferenceHistory.filter(
      (h) => h.conference_finished_at?.slice(0, 10) === today && h.status === "conferido"
    );
    const byOp = {};
    todayConf.forEach((h) => {
      const key = h.conference_finished_by_code || "?";
      if (!byOp[key]) byOp[key] = { code: key, name: h.conference_finished_by_name || "—", count: 0 };
      byOp[key].count += 1;
    });
    return Object.values(byOp).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [conferenceHistory]);

  const latestEntries = useMemo(
    () => [...todayEntries].sort((a, b) => new Date(b.end_time) - new Date(a.end_time)).slice(0, 5),
    [todayEntries]
  );

  const waiting = useMemo(
    () => conferenceQueue.filter((q) => q.status === "aguardando"),
    [conferenceQueue]
  );
  const inProgress = useMemo(
    () => conferenceQueue.filter((q) => q.status === "em_conferencia"),
    [conferenceQueue]
  );

  const mesaAcumulando = useMemo(() => {
    const oldWaiting = waiting.filter((w) => {
      const secs = Math.round((now - new Date(w.separated_at).getTime()) / 1000);
      return secs > 10 * 60;
    });
    return oldWaiting.length >= 3;
  }, [waiting, now]);

  const weekByOperator = useMemo(() => {
    const byOp = {};
    weekEntries.forEach((e) => {
      const key = e.operator_code;
      if (!byOp[key]) {
        byOp[key] = { name: e.operator_name, code: key, count: 0, totalSeconds: 0, durations: [] };
      }
      byOp[key].count += 1;
      byOp[key].totalSeconds += e.duration_seconds || 0;
      byOp[key].durations.push(e.duration_seconds || 0);
    });
    return Object.values(byOp).map((op) => ({
      ...op,
      avg: op.count > 0 ? op.totalSeconds / op.count : 0,
      consistency: op.durations.length > 1 ? stdDev(op.durations) : Infinity,
    }));
  }, [weekEntries]);

  const MIN_REGISTROS = 3;

  const fastestRanking = useMemo(
    () => [...weekByOperator].filter((op) => op.count >= MIN_REGISTROS && op.avg > 0).sort((a, b) => a.avg - b.avg).slice(0, 3),
    [weekByOperator]
  );
  const volumeRanking = useMemo(
    () => [...weekByOperator].filter((op) => op.count >= MIN_REGISTROS).sort((a, b) => b.count - a.count).slice(0, 3),
    [weekByOperator]
  );
  const consistentRanking = useMemo(
    () => [...weekByOperator].filter((op) => op.count >= MIN_REGISTROS && op.consistency !== Infinity).sort((a, b) => a.consistency - b.consistency).slice(0, 3),
    [weekByOperator]
  );

  const goalsAchieved = useMemo(() => {
    const withTarget = activities.filter((a) => a.target_seconds);
    if (withTarget.length === 0) return { achieved: 0, total: 0 };
    let achieved = 0;
    let total = 0;
    withTarget.forEach((a) => {
      const list = weekEntries.filter((e) => e.activity === a.name);
      if (list.length === 0) return;
      total += 1;
      const avg = list.reduce((s, e) => s + (e.duration_seconds || 0), 0) / list.length;
      if (avg <= a.target_seconds) achieved += 1;
    });
    return { achieved, total };
  }, [activities, weekEntries]);

  const alertIds = new Set(activityAlerts.map((a) => a.operator_code));
  const staleIds = new Set(staleSessions.map((a) => a.operator_code));

  function displayName(name) {
    if (!hideNames) return name;
    const parts = (name || "").split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + "•••";
    return `${parts[0].charAt(0).toUpperCase()}••• ${parts[parts.length - 1].charAt(0).toUpperCase()}•••`;
  }

  const p = palette;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: p.gradient,
        color: p.text,
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        padding: "28px 36px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
      />

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.9); }
        }
        @keyframes pulseAlert {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.4); }
          50%      { box-shadow: 0 0 0 8px rgba(248, 113, 113, 0); }
        }
        @keyframes pulseMesa {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.02); opacity: 0.92; }
        }
        .tv-row-enter { animation: slideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .tv-rank-enter { animation: fadeUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .tv-pulse { animation: pulseDot 1.6s ease-in-out infinite; }
        .tv-alert { animation: pulseAlert 1.8s ease-in-out infinite; }
        .tv-mesa-alert { animation: pulseMesa 2s ease-in-out infinite; }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 22,
          borderBottom: `2px solid ${p.accent}`,
          paddingBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Atividades em andamento
            </div>
            <div style={{ color: p.textMuted, fontSize: 13, marginTop: 2, fontWeight: 500 }}>
              Aponta CD
              {stationFilter && (
                <span
                  style={{
                    marginLeft: 12,
                    background: p.accent,
                    color: "#0a0e14",
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <IconMapPin size={11} /> {stationFilter}
                </span>
              )}
              {activityAlerts.length > 0 && (
                <span style={{ marginLeft: 14, color: p.danger, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <IconAlertTriangle size={13} /> {activityAlerts.length} alerta{activityAlerts.length > 1 ? "s" : ""}
                </span>
              )}
              {staleIds.size > 0 && (
                <span style={{ marginLeft: 14, color: p.warning, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <IconClock size={13} /> {staleIds.size} sumiu{staleIds.size > 1 ? "ram" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: p.text,
            }}
          >
            {fmtClock(now)}
          </div>
          <div style={{ color: p.textMuted, fontSize: 13, textTransform: "capitalize", marginTop: 2 }}>
            {fmtDate(now)}
          </div>
        </div>
      </div>

      {mesaAcumulando && (
        <div
          className="tv-mesa-alert"
          style={{
            background: p.danger,
            color: "#fff",
            padding: "14px 22px",
            borderRadius: 12,
            marginBottom: 16,
            fontWeight: 700,
            fontSize: 15,
            textAlign: "center",
            boxShadow: `0 4px 20px ${p.danger}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <IconAlertTriangle size={18} /> Mesa de conferência acumulando — {waiting.length} pedido{waiting.length > 1 ? "s" : ""} aguardando
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, flex: 1, minHeight: 0 }}>
        <div style={{ overflow: "auto", paddingRight: 4 }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 20px", color: p.textMuted, fontSize: 18, fontWeight: 500 }}>
              {stationFilter
                ? `Nenhuma atividade em andamento em "${stationFilter}"`
                : hiddenSessions
                ? "Nenhuma atividade passou do tempo limite ainda"
                : "Nenhuma atividade em andamento"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sorted.map((s, i) => {
                const isNew = !seenSessions.current.has(s.operator_code);
                const isAlert = alertIds.has(s.operator_code);
                const isStale = staleIds.has(s.operator_code);
                const accentColor = isStale ? p.warning : isAlert ? p.danger : s.is_encaixe ? p.warning : p.accent;
                return (
                  <div
                    key={s.operator_code}
                    className={`${isNew ? "tv-row-enter" : ""} ${isAlert ? "tv-alert" : ""}`}
                    style={{
                      background: p.surface,
                      border: `1px solid ${isAlert ? "#7f1d1d" : isStale ? p.warning : p.border}`,
                      borderRadius: 12,
                      padding: "16px 22px",
                      display: "flex",
                      alignItems: "center",
                      gap: 18,
                      position: "relative",
                      overflow: "hidden",
                      animationDelay: isNew ? `${i * 0.05}s` : "0s",
                    }}
                  >
                    <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: accentColor }} />
                    <div
                      className="tv-pulse"
                      style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: accentColor, flexShrink: 0,
                        boxShadow: `0 0 10px ${accentColor}`,
                      }}
                    />
                    <div style={{ flex: "0 0 200px", minWidth: 0 }}>
                      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {displayName(s.operator_name)}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                        {s.station && (
                          <span style={{ fontSize: 11, color: p.textMuted, display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <IconMapPin size={10} /> {s.station}
                          </span>
                        )}
                        {s.is_encaixe && (
                          <span style={{ background: `${p.warning}26`, color: p.warning, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <IconZap size={10} /> ENCAIXE
                          </span>
                        )}
                        {isAlert && (
                          <span style={{ background: `${p.danger}33`, color: p.danger, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <IconAlertTriangle size={10} /> DEMORADA
                          </span>
                        )}
                        {isStale && (
                          <span style={{ background: `${p.warning}33`, color: p.warning, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <IconClock size={10} /> SUMIU
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: p.accent, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.activity}
                      </div>
                      {(s.transfer_type || s.customer_name || s.order_number || s.vehicle) && (
                        <div style={{ fontSize: 12, color: p.textMuted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.transfer_type && (<>{s.transfer_type}{s.transfer_number ? ` #${s.transfer_number}` : ""}{s.transfer_urgent ? " · urgente" : ""}</>)}
                          {s.customer_name && (s.transfer_type ? " · " : "") + s.customer_name}
                          {s.order_number && ` · Pedido ${s.order_number}`}
                          {s.vehicle && ` · ${s.vehicle}`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 120 }}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 20, fontWeight: 600,
                          color: isAlert ? p.danger : isStale ? p.warning : p.text,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {timeAgo(s.start_time, now)}
                      </div>
                      <div style={{ fontSize: 11, color: p.textMuted, marginTop: 3 }}>
                        início {fmtClock(s.start_time)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", paddingRight: 4 }}>
          <div
            style={{
              background: p.surface,
              border: `1px solid ${mesaAcumulando ? p.danger : p.border}`,
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Mesa de conferência
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: waiting.length > 0 ? p.warning : p.textMuted }}>
                  {waiting.length} aguard.
                </span>
                <span style={{ color: p.textMuted }}>
                  {inProgress.length} em conf.
                </span>
              </div>
            </div>

            {waiting.length === 0 && inProgress.length === 0 ? (
              <div style={{ color: p.textMuted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                Mesa limpa
              </div>
            ) : (
              <>
                {waiting.slice(0, 4).map((w) => {
                  const secs = Math.round((now - new Date(w.separated_at).getTime()) / 1000);
                  const mins = Math.floor(secs / 60);
                  const color = mins < 5 ? p.ok : mins < 15 ? p.warning : p.danger;
                  return (
                    <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${p.border}` }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {w.is_encaixe && "ENC · "}
                          {w.transfer_type ? `${w.transfer_type} #${w.transfer_number || ""}` : w.order_number ? `#${w.order_number}` : "—"}
                        </div>
                        {w.customer_name && (
                          <div style={{ fontSize: 11, color: p.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {hideNames ? displayName(w.customer_name) : w.customer_name}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color, fontWeight: 600, marginLeft: 8 }}>
                        {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60}m`}
                      </div>
                    </div>
                  );
                })}
                {waiting.length > 4 && (
                  <div style={{ fontSize: 11, color: p.textMuted, textAlign: "center", marginTop: 8 }}>
                    +{waiting.length - 4} aguardando
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: p.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              Ranking do dia
            </div>
            <div style={{ fontSize: 11, color: p.textMuted, marginBottom: 14 }}>
              {todayEntries.length} registros hoje
              {todayShortages.length > 0 && (
                <span style={{ color: p.danger, fontWeight: 600 }}>
                  {" · "} {todayShortages.length} falta{todayShortages.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {ranking.length === 0 ? (
              <div style={{ color: p.textMuted, fontSize: 12.5, padding: "10px 0", textAlign: "center" }}>
                Sem registros ainda
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ranking.map((r, i) => {
                  const isTop3 = i < 3;
                  return (
                    <div key={r.name} className="tv-rank-enter" style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < ranking.length - 1 ? `1px solid ${p.border}` : "none", animationDelay: `${i * 0.06}s` }}>
                      <div
                        style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: isTop3 ? p.medalColors[i] : p.border,
                          color: isTop3 ? p.medalText : p.textMuted,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 11, flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: p.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {displayName(r.name)}
                        </div>
                        <div style={{ fontSize: 11, color: p.accent, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.mainActivity}
                        </div>
                        <div style={{ fontSize: 10, color: p.textMuted, marginTop: 2 }}>
                          {fmtDuration(r.totalSeconds)} · {r.count} {r.count === 1 ? "registro" : "registros"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {conferenceRanking.length > 0 && (
            <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.ok, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <IconCheck size={13} /> Conferentes do dia
              </div>
              {conferenceRanking.map((c, i) => (
                <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span style={{ fontSize: 13, width: 20, color: p.accent, fontWeight: 700 }}>{i + 1}º</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {displayName(c.name)}
                    </div>
                    <div style={{ fontSize: 10, color: p.textMuted }}>
                      {c.count} conferência{c.count > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: p.warning, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <IconTrophy size={13} /> Destaques da semana
            </div>

            {fastestRanking.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.ok, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <IconZap size={11} /> Mais rápido
                </div>
                {fastestRanking.map((op, i) => (
                  <div key={op.code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ fontSize: 12, width: 18, color: p.accent, fontWeight: 700 }}>{i + 1}º</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(op.name)}</div>
                      <div style={{ fontSize: 10, color: p.textMuted }}>{op.count} reg · média {fmtDuration(Math.round(op.avg))}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {volumeRanking.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.blue, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <IconTrendingUp size={11} /> Maior volume
                </div>
                {volumeRanking.map((op, i) => (
                  <div key={op.code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ fontSize: 12, width: 18, color: p.accent, fontWeight: 700 }}>{i + 1}º</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(op.name)}</div>
                      <div style={{ fontSize: 10, color: p.textMuted }}>{op.count} registros no total</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {consistentRanking.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.purple, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <IconTarget size={11} /> Mais consistente
                </div>
                {consistentRanking.map((op, i) => (
                  <div key={op.code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ fontSize: 12, width: 18, color: p.accent, fontWeight: 700 }}>{i + 1}º</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(op.name)}</div>
                      <div style={{ fontSize: 10, color: p.textMuted }}>variação {fmtDuration(Math.round(op.consistency))}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {fastestRanking.length === 0 && volumeRanking.length === 0 && consistentRanking.length === 0 && (
              <div style={{ color: p.textMuted, fontSize: 11.5, textAlign: "center", padding: "12px 0" }}>
                Ninguém bateu o mínimo de {MIN_REGISTROS} registros ainda
              </div>
            )}

            {goalsAchieved.total > 0 && (
              <div style={{ borderTop: `1px solid ${p.border}`, paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: p.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <IconAward size={11} /> Metas semana
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: goalsAchieved.achieved === goalsAchieved.total ? p.ok : p.warning }}>
                  {goalsAchieved.achieved}/{goalsAchieved.total}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {latestEntries.length > 0 && (
        <div
          style={{
            marginTop: 16, padding: "12px 20px", background: p.surface,
            border: `1px solid ${p.border}`, borderRadius: 10,
            display: "flex", alignItems: "center", gap: 18,
            fontSize: 12.5, color: p.textMuted, overflow: "hidden",
          }}
        >
          <div style={{ fontWeight: 700, color: p.accent, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Últimos registros
          </div>
          <div style={{ display: "flex", gap: 24, overflow: "hidden", flex: 1 }}>
            {latestEntries.map((e) => {
              const hasShortage = entriesWithShortageIds.has(e.id);
              return (
                <div key={e.id} style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                  <span style={{ color: p.text, fontWeight: 600 }}>{displayName(e.operator_name)}</span>
                  <span style={{ margin: "0 6px" }}>·</span>
                  <span>{e.activity}</span>
                  {hasShortage && <span style={{ margin: "0 6px", color: p.danger, fontWeight: 700 }}>falta</span>}
                  {!hasShortage && <span style={{ margin: "0 6px" }}>·</span>}
                  {!hasShortage && <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtClock(e.end_time)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "calc(100% - 40px)" }}>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={btnStyle(p)} title="Alternar tema claro/escuro">
          {theme === "dark" ? (
            <>
              <IconSun size={14} /> Claro
            </>
          ) : (
            <>
              <IconMoon size={14} /> Escuro
            </>
          )}
        </button>

        <button onClick={() => setHideNames((v) => !v)} style={btnStyle(p, hideNames)} title="Esconder/mostrar nomes">
          {hideNames ? (
            <>
              <IconEye size={14} /> Mostrar nomes
            </>
          ) : (
            <>
              <IconEyeOff size={14} /> Esconder nomes
            </>
          )}
        </button>

        <button onClick={() => setHiddenSessions((v) => !v)} style={btnStyle(p, hiddenSessions)} title="Esconder atividades até passarem do tempo limite">
          <IconFilter size={14} />
          {hiddenSessions ? "Mostrar todas" : "Só atrasadas"}
        </button>

        <button onClick={toggleSound} style={btnStyle(p, soundEnabled)} title="Ativar/desativar som de alerta">
          {soundEnabled ? (
            <>
              <IconVolume2 size={14} /> Som ativado
            </>
          ) : (
            <>
              <IconVolumeX size={14} /> Som desativado
            </>
          )}
        </button>

        {isFullscreen ? (
          <button onClick={exitFullscreen} style={btnStyle(p, true)} title="Sair da tela cheia (Esc também sai)">
            <IconMinimize size={14} /> Sair da tela cheia
          </button>
        ) : (
          <button onClick={enterFullscreen} style={btnStyle(p)} title="Entrar em tela cheia">
            <IconMaximize size={14} /> Tela cheia
          </button>
        )}
      </div>
    </div>
  );
}

function btnStyle(p, active = false) {
  return {
    background: active ? p.accent : p.surface,
    color: active ? "#0a0e14" : p.textMuted,
    border: `1px solid ${active ? p.accent : p.border}`,
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
    fontFamily: "inherit",
    transition: "all 150ms ease",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}
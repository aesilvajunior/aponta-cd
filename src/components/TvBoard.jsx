import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchActiveSessions, fetchEntries, fetchShortages } from "../lib/api";
import { fmtClock, fmtDate, fmtDuration } from "../lib/format";
import { useTheme } from "../context/ThemeContext";
import logo from "../assets/logo.png";

const ACCENT = "#00a0e4";
const DEFAULT_ALERT_SECONDS = 1800;

function timeAgo(iso, now) {
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Pega o parâmetro ?station= da URL
function getStationFromUrl() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const s = params.get("station");
  return s ? s.trim() : "";
}

// Semana atual (segunda a domingo)
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

// Desvio padrão (pra consistência)
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export default function TvBoard() {
  const [sessions, setSessions] = useState([]);
  const [todayEntries, setTodayEntries] = useState([]);
  const [weekEntries, setWeekEntries] = useState([]);
  const [todayShortages, setTodayShortages] = useState([]);
  const [alertThreshold, setAlertThreshold] = useState(DEFAULT_ALERT_SECONDS);
  const [activities, setActivities] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const { resolvedTheme } = useTheme();

  // Filtro de estação (vindo da URL)
  const stationFilter = useMemo(() => getStationFromUrl(), []);

  const seenSessions = useRef(new Set());
  const alertedRef = useRef(new Set());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Carrega config + atividades
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
          // Se a config foi deletada, volta ao default
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
    const [{ data: s }, { data: e }, { data: sh }] = await Promise.all([
      fetchActiveSessions(),
      fetchEntries({ limit: 2000 }),
      fetchShortages({ limit: 500 }),
    ]);
    if (s) setSessions(s);
    if (e) {
      const today = new Date().toISOString().slice(0, 10);
      setTodayEntries(e.filter((x) => x.start_time.slice(0, 10) === today));

      // Filtra entries da semana
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
  }

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("tv-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "entry_shortages" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // Aplica filtro de estação (se tiver)
  const filteredSessions = useMemo(() => {
    if (!stationFilter) return sessions;
    return sessions.filter((s) => (s.station || "").toLowerCase() === stationFilter.toLowerCase());
  }, [sessions, stationFilter]);

  // Alertas
  const activityAlerts = useMemo(() => {
    return filteredSessions
      .map((s) => {
        const elapsed = Math.round((now - new Date(s.start_time).getTime()) / 1000);
        const activityConfig = activities.find((a) => a.name === s.activity);
        let threshold = alertThreshold || DEFAULT_ALERT_SECONDS;
        if (activityConfig?.target_seconds) threshold = activityConfig.target_seconds;
        return { ...s, elapsed, threshold, isLate: elapsed > threshold };
      })
      .filter((s) => s.isLate);
  }, [filteredSessions, activities, alertThreshold, now]);

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
    () => [...filteredSessions].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [filteredSessions]
  );

  const entriesWithShortageIds = useMemo(() => {
    return new Set(todayShortages.map((s) => s.entry_id));
  }, [todayShortages]);

  // ============================================================
  // RANKING DO DIA (atual)
  // ============================================================
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

  const latestEntries = useMemo(
    () => [...todayEntries].sort((a, b) => new Date(b.end_time) - new Date(a.end_time)).slice(0, 5),
    [todayEntries]
  );

  // ============================================================
  // METAS GAMIFICADAS DA SEMANA
  // ============================================================

  // Agrupa entries da semana por operador
  const weekByOperator = useMemo(() => {
    const byOp = {};
    weekEntries.forEach((e) => {
      const key = e.operator_code;
      if (!byOp[key]) {
        byOp[key] = {
          name: e.operator_name,
          code: key,
          count: 0,
          totalSeconds: 0,
          durations: [],
        };
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

  // 🥇 Mais rápido (menor tempo médio, mín. 3 registros)
  const fastestRanking = useMemo(() => {
    return [...weekByOperator]
      .filter((op) => op.count >= MIN_REGISTROS && op.avg > 0)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3);
  }, [weekByOperator]);

  // 🥇 Mais volume (maior número de registros)
  const volumeRanking = useMemo(() => {
    return [...weekByOperator]
      .filter((op) => op.count >= MIN_REGISTROS)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [weekByOperator]);

  // 🥇 Mais consistente (menor desvio padrão, mín. 3 registros)
  const consistentRanking = useMemo(() => {
    return [...weekByOperator]
      .filter((op) => op.count >= MIN_REGISTROS && op.consistency !== Infinity)
      .sort((a, b) => a.consistency - b.consistency)
      .slice(0, 3);
  }, [weekByOperator]);

  // Metas atingidas (semana)
  const goalsAchieved = useMemo(() => {
    const activitiesWithTarget = activities.filter((a) => a.target_seconds);
    if (activitiesWithTarget.length === 0) return { achieved: 0, total: 0 };

    let achieved = 0;
    let total = 0;
    activitiesWithTarget.forEach((a) => {
      const entriesForActivity = weekEntries.filter((e) => e.activity === a.name);
      if (entriesForActivity.length === 0) return;
      total += 1;
      const avg =
        entriesForActivity.reduce((s, e) => s + (e.duration_seconds || 0), 0) /
        entriesForActivity.length;
      if (avg <= a.target_seconds) achieved += 1;
    });
    return { achieved, total };
  }, [activities, weekEntries]);

  const bg = "#0a0e14";
  const surface = "#111823";
  const border = "#1f2937";
  const text = "#f3f4f6";
  const textMuted = "#94a3b8";
  const accent = ACCENT;

  const medalColors = ["#fbbf24", "#cbd5e1", "#b45309"];
  const medalEmoji = ["🥇", "🥈", "🥉"];

  const alertIds = new Set(activityAlerts.map((a) => a.operator_code));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse at top, #0f1a2e 0%, ${bg} 60%)`,
        color: text,
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        padding: "32px 40px",
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
        .tv-row-enter { animation: slideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .tv-rank-enter { animation: fadeUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .tv-pulse { animation: pulseDot 1.6s ease-in-out infinite; }
        .tv-alert { animation: pulseAlert 1.8s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 26,
          borderBottom: `2px solid ${accent}`,
          paddingBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={logo} alt="" style={{ width: 60, height: 60, borderRadius: "50%" }} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Atividades em andamento
            </div>
            <div style={{ color: textMuted, fontSize: 13.5, marginTop: 2, fontWeight: 500 }}>
              Hidráulica Tropeiro · Aponta CD
              {stationFilter && (
                <span
                  style={{
                    marginLeft: 12,
                    background: accent,
                    color: "#0a0e14",
                    padding: "2px 10px",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  📍 {stationFilter}
                </span>
              )}
              {activityAlerts.length > 0 && (
                <span style={{ marginLeft: 14, color: "#f87171", fontWeight: 700 }}>
                  ⚠ {activityAlerts.length} alerta{activityAlerts.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: text,
            }}
          >
            {fmtClock(now)}
          </div>
          <div style={{ color: textMuted, fontSize: 13.5, textTransform: "capitalize", marginTop: 2 }}>
            {fmtDate(now)}
          </div>
        </div>
      </div>

      {/* Corpo: sessões + coluna direita com ranking + metas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 22, flex: 1, minHeight: 0 }}>
        {/* Coluna esquerda: sessões ativas */}
        <div style={{ overflow: "auto", paddingRight: 4 }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "100px 20px", color: textMuted, fontSize: 20, fontWeight: 500 }}>
              {stationFilter
                ? `Nenhuma atividade em andamento em "${stationFilter}"`
                : "Nenhuma atividade em andamento"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sorted.map((s, i) => {
                const isNew = !seenSessions.current.has(s.operator_code);
                const isAlert = alertIds.has(s.operator_code);
                const accentColor = isAlert ? "#f87171" : s.is_encaixe ? "#fbbf24" : accent;
                return (
                  <div
                    key={s.operator_code}
                    className={`${isNew ? "tv-row-enter" : ""} ${isAlert ? "tv-alert" : ""}`}
                    style={{
                      background: surface,
                      border: `1px solid ${isAlert ? "#7f1d1d" : border}`,
                      borderRadius: 14,
                      padding: "18px 22px",
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      position: "relative",
                      overflow: "hidden",
                      animationDelay: isNew ? `${i * 0.05}s` : "0s",
                    }}
                  >
                    <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: accentColor }} />
                    <div
                      className="tv-pulse"
                      style={{
                        width: 12, height: 12, borderRadius: "50%",
                        background: accentColor, flexShrink: 0,
                        boxShadow: `0 0 12px ${accentColor}`,
                      }}
                    />
                    <div style={{ flex: "0 0 240px", minWidth: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.operator_name}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                        {s.station && <span style={{ fontSize: 12, color: textMuted }}>📍 {s.station}</span>}
                        {s.is_encaixe && (
                          <span style={{ background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", padding: "2px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em" }}>
                            ⚡ ENCAIXE
                          </span>
                        )}
                        {isAlert && (
                          <span style={{ background: "rgba(248, 113, 113, 0.2)", color: "#f87171", padding: "2px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em" }}>
                            ⚠ DEMORADA
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: accent, fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.activity}
                      </div>
                      {(s.transfer_type || s.customer_name || s.order_number || s.vehicle) && (
                        <div style={{ fontSize: 13, color: textMuted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.transfer_type && (<>{s.transfer_type}{s.transfer_number ? ` #${s.transfer_number}` : ""}{s.transfer_urgent ? " · 🔴 Urgente" : ""}</>)}
                          {s.customer_name && (s.transfer_type ? " · " : "") + s.customer_name}
                          {s.order_number && ` · Pedido ${s.order_number}`}
                          {s.vehicle && ` · ${s.vehicle}`}
                          {s.plate && ` · ${s.plate}`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 130 }}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 22, fontWeight: 600,
                          color: isAlert ? "#f87171" : text,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {timeAgo(s.start_time, now)}
                      </div>
                      <div style={{ fontSize: 11.5, color: textMuted, marginTop: 2 }}>
                        início {fmtClock(s.start_time)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna direita: ranking + metas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", paddingRight: 4 }}>
          {/* Ranking do dia */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Ranking do dia
            </div>
            <div style={{ fontSize: 11.5, color: textMuted, marginBottom: 14 }}>
              {todayEntries.length} registros hoje
              {todayShortages.length > 0 && (
                <span style={{ color: "#f87171", fontWeight: 600 }}>
                  {" · "}⚠ {todayShortages.length} falta{todayShortages.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {ranking.length === 0 ? (
              <div style={{ color: textMuted, fontSize: 13, padding: "10px 0", textAlign: "center" }}>
                Sem registros ainda
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ranking.map((r, i) => {
                  const isTop3 = i < 3;
                  return (
                    <div
                      key={r.name}
                      className="tv-rank-enter"
                      style={{
                        display: "flex", gap: 12, padding: "8px 0",
                        borderBottom: i < ranking.length - 1 ? `1px solid ${border}` : "none",
                        animationDelay: `${i * 0.06}s`,
                      }}
                    >
                      <div
                        style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: isTop3 ? medalColors[i] : "#1f2937",
                          color: isTop3 ? "#0a0e14" : textMuted,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 12, flexShrink: 0,
                        }}
                      >
                        {isTop3 ? medalEmoji[i] : i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: accent, fontWeight: 600, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.mainActivity}
                        </div>
                        <div style={{ fontSize: 10.5, color: textMuted, marginTop: 1 }}>
                          {fmtDuration(r.totalSeconds)} · {r.count} {r.count === 1 ? "registro" : "registros"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={toggleSound}
              style={{
                marginTop: 14,
                width: "100%",
                background: soundEnabled ? "rgba(52, 211, 153, 0.12)" : "transparent",
                border: `1px solid ${soundEnabled ? "#34d399" : border}`,
                color: soundEnabled ? "#34d399" : textMuted,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {soundEnabled ? "🔔 Alerta sonoro ativado" : "🔕 Ativar alerta sonoro"}
            </button>
          </div>

          {/* ============ METAS GAMIFICADAS DA SEMANA ============ */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              🏆 Destaques da semana
            </div>
            <div style={{ fontSize: 11.5, color: textMuted, marginBottom: 14 }}>
              Mínimo de {MIN_REGISTROS} registros pra entrar no ranking
            </div>

            {/* Mais rápido */}
            {fastestRanking.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginBottom: 8 }}>
                  ⚡ Mais rápido (menor tempo médio)
                </div>
                {fastestRanking.map((op, i) => (
                  <div key={op.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                    <span style={{ fontSize: 16, width: 22 }}>{medalEmoji[i]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {op.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: textMuted }}>
                        {op.count} registros · média {fmtDuration(Math.round(op.avg))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mais volume */}
            {volumeRanking.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>
                  📊 Maior volume
                </div>
                {volumeRanking.map((op, i) => (
                  <div key={op.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                    <span style={{ fontSize: 16, width: 22 }}>{medalEmoji[i]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {op.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: textMuted }}>
                        {op.count} registros no total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mais consistente */}
            {consistentRanking.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#c084fc", marginBottom: 8 }}>
                  🎯 Mais consistente
                </div>
                {consistentRanking.map((op, i) => (
                  <div key={op.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                    <span style={{ fontSize: 16, width: 22 }}>{medalEmoji[i]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {op.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: textMuted }}>
                        variação de {fmtDuration(Math.round(op.consistency))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {fastestRanking.length === 0 && volumeRanking.length === 0 && consistentRanking.length === 0 && (
              <div style={{ color: textMuted, fontSize: 12.5, textAlign: "center", padding: "16px 0" }}>
                Ninguém bateu o mínimo de {MIN_REGISTROS} registros nesta semana ainda.
              </div>
            )}

            {/* Metas atingidas */}
            {goalsAchieved.total > 0 && (
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Metas da semana
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: goalsAchieved.achieved === goalsAchieved.total ? "#34d399" : "#fbbf24",
                    }}
                  >
                    {goalsAchieved.achieved}/{goalsAchieved.total}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: textMuted, marginTop: 4 }}>
                  Atividades cuja média ficou dentro da meta
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticker: últimos registros */}
      {latestEntries.length > 0 && (
        <div
          style={{
            marginTop: 20, padding: "12px 20px", background: surface,
            border: `1px solid ${border}`, borderRadius: 12,
            display: "flex", alignItems: "center", gap: 20,
            fontSize: 13, color: textMuted, overflow: "hidden",
          }}
        >
          <div style={{ fontWeight: 700, color: accent, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            Últimos registros
          </div>
          <div style={{ display: "flex", gap: 24, overflow: "hidden", flex: 1 }}>
            {latestEntries.map((e) => {
              const hasShortage = entriesWithShortageIds.has(e.id);
              return (
                <div key={e.id} style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>
                  <span style={{ color: text, fontWeight: 600 }}>{e.operator_name}</span>
                  <span style={{ margin: "0 6px" }}>·</span>
                  <span>{e.activity}</span>
                  {hasShortage && <span style={{ margin: "0 6px", color: "#f87171", fontWeight: 700 }}>⚠</span>}
                  {!hasShortage && <span style={{ margin: "0 6px" }}>·</span>}
                  {!hasShortage && <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtClock(e.end_time)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Botões de ação */}
      <div style={{ position: "fixed", bottom: 22, right: 22, display: "flex", gap: 10 }}>
        <button
          onClick={() => {
            // Se tiver filtro, copia o link pra clipboard
            if (stationFilter) {
              navigator.clipboard.writeText(window.location.href).catch(() => {});
            }
          }}
          style={{
            background: surface, color: textMuted,
            border: `1px solid ${border}`, borderRadius: 10,
            padding: "10px 18px", fontSize: 12.5,
            cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
          }}
          title="Salva o link com o filtro atual"
        >
          🔗 Copiar link
        </button>
        <button
          onClick={goFullscreen}
          style={{
            background: surface, color: textMuted,
            border: `1px solid ${border}`, borderRadius: 10,
            padding: "10px 18px", fontSize: 12.5,
            cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
          }}
        >
          Tela cheia
        </button>
      </div>
    </div>
  );
}
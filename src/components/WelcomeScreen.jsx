import React, { useEffect, useMemo, useState } from "react";
import { fetchEntries, fetchActiveSessionFor } from "../lib/api";
import { fmtDuration, todayLocalISODate, localISODate, shiftFor } from "../lib/format";
import {
  IconActivity,
  IconTrendingUp,
  IconCheck,
  IconZap,
  IconTarget,
  IconClock,
} from "./Icons";

function greeting(now) {
  const h = now.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function WelcomeScreen({ operator, onContinue, onViewStats }) {
  const [entries, setEntries] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(new Date());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: e }, { data: s }] = await Promise.all([
        fetchEntries({ limit: 2000 }),
        fetchActiveSessionFor(operator.code),
      ]);
      if (!mounted) return;
      setEntries(e || []);
      setActiveSession(s || null);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [operator.code]);

  const stats = useMemo(() => {
    const today = todayLocalISODate();
    const todayMine = entries.filter(
      (e) => e.operator_code === operator.code && localISODate(e.start_time) === today
    );
    const totalSec = todayMine.reduce((s, e) => s + (e.duration_seconds || 0), 0);
    const avg = todayMine.length > 0 ? Math.round(totalSec / todayMine.length) : 0;
    const encaixes = todayMine.filter((e) => e.is_encaixe).length;
    return {
      count: todayMine.length,
      totalSec,
      avg,
      encaixes,
    };
  }, [entries, operator.code]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "40px 36px",
          boxShadow: "var(--shadow-xl)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <IconActivity size={34} strokeWidth={1.5} />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
          {greeting(now)}, {operator.name.split(" ")[0]}!
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8, marginBottom: 26 }}>
          Turno {shiftFor(now.toISOString())} · {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>

        {!loading && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <StatBox
                label="Registros hoje"
                value={stats.count}
                icon={<IconCheck size={16} />}
                color="var(--ok)"
              />
              <StatBox
                label="Tempo total"
                value={fmtDuration(stats.totalSec)}
                icon={<IconClock size={16} />}
                color="var(--accent)"
              />
              <StatBox
                label="Tempo médio"
                value={fmtDuration(stats.avg)}
                icon={<IconTrendingUp size={16} />}
                color="var(--text)"
              />
            </div>

            {activeSession && (
              <div
                style={{
                  padding: "14px 18px",
                  background: "var(--warning-soft)",
                  border: "1px solid var(--warning)",
                  borderRadius: 12,
                  marginBottom: 24,
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <IconZap size={13} /> Sessão em andamento
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  {activeSession.activity}
                </div>
                {activeSession.customer_name && (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {activeSession.customer_name}
                  </div>
                )}
              </div>
            )}

            {stats.encaixes > 0 && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--accent-2-soft)",
                  color: "var(--accent-2)",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 20,
                }}
              >
                <IconZap size={13} /> {stats.encaixes} encaixe{stats.encaixes > 1 ? "s" : ""} hoje
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <button
            className="kiosk-btn kiosk-btn-primary"
            onClick={onContinue}
            style={{ width: "100%", fontSize: 15, padding: "16px 20px" }}
          >
            Começar
          </button>
          {onViewStats && (
            <button
              className="btn-small"
              onClick={onViewStats}
              style={{ width: "100%" }}
            >
              Ver minhas estatísticas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color }) {
  return (
    <div
      style={{
        padding: "14px 12px",
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        textAlign: "center",
      }}
    >
      <div style={{ color, display: "flex", justifyContent: "center", marginBottom: 6 }}>
        {icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchEntries } from "../lib/api";
import { localISODate, todayLocalISODate, fmtDuration } from "../lib/format";
import { IconCrown, IconZap } from "./Icons";

export default function TvGamification({ palette: p, hideNames, displayName }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await fetchEntries({ limit: 3000 });
      setEntries(data || []);
    })();
    const ch = supabase
      .channel("tv-gamification")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, async () => {
        const { data } = await fetchEntries({ limit: 3000 });
        setEntries(data || []);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const operadorDoDia = useMemo(() => {
    const today = todayLocalISODate();
    const todayEntries = entries.filter((e) => localISODate(e.start_time) === today);
    const m = {};
    todayEntries.forEach((e) => {
      const k = e.operator_code;
      if (!m[k]) m[k] = { code: k, name: e.operator_name, count: 0, totalSec: 0 };
      m[k].count += 1;
      m[k].totalSec += e.duration_seconds || 0;
    });
    const ranked = Object.values(m)
      .map((o) => ({ ...o, avg: o.count > 0 ? o.totalSec / o.count : 0 }))
      .filter((o) => o.count >= 3)
      .sort((a, b) => {
        const scoreA = a.count * 100 - a.avg * 0.1;
        const scoreB = b.count * 100 - b.avg * 0.1;
        return scoreB - scoreA;
      });
    return ranked[0] || null;
  }, [entries]);

  const streak = useMemo(() => {
    const byDay = {};
    entries.forEach((e) => {
      const d = localISODate(e.start_time);
      if (!byDay[d]) byDay[d] = {};
      byDay[d][e.operator_code] = (byDay[d][e.operator_code] || 0) + 1;
    });

    const days = Object.keys(byDay).sort().reverse();
    const streakByOp = {};

    days.forEach((d, idx) => {
      if (idx > 0) {
        const prev = new Date(days[idx - 1] + "T12:00:00");
        const cur = new Date(d + "T12:00:00");
        const diff = (prev - cur) / (1000 * 60 * 60 * 24);
        if (diff !== 1) return;
      }
      const dayOps = byDay[d];
      Object.entries(dayOps).forEach(([code, count]) => {
        if (count >= 5) {
          if (!streakByOp[code]) streakByOp[code] = { code, streak: 0, name: null };
          streakByOp[code].streak += 1;
        }
      });
    });

    const nameByCode = {};
    entries.forEach((e) => { if (!nameByCode[e.operator_code]) nameByCode[e.operator_code] = e.operator_name; });

    return Object.values(streakByOp)
      .map((s) => ({ ...s, name: nameByCode[s.code] || s.code }))
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3);
  }, [entries]);

  const display = (name) => hideNames ? displayName(name) : name;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {operadorDoDia && (
        <div
          style={{
            background: `linear-gradient(135deg, ${p.accent}22, ${p.surface})`,
            border: `2px solid ${p.accent}`,
            borderRadius: 14,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: p.accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <IconCrown size={12} /> Operador do dia
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 40 }}>🏆</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {display(operadorDoDia.name)}
              </div>
              <div style={{ fontSize: 12.5, color: p.textMuted, marginTop: 4 }}>
                {operadorDoDia.count} registros · média {fmtDuration(Math.round(operadorDoDia.avg))}
              </div>
            </div>
          </div>
        </div>
      )}

      {streak.length > 0 && (
        <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.warning, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <IconZap size={12} /> Streak (dias batendo meta)
          </div>
          {streak.map((s, i) => (
            <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span style={{ fontSize: 13, width: 20, fontWeight: 700, color: p.accent }}>{i + 1}º</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {display(s.name)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 14 }}>🔥</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: p.warning }}>{s.streak}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  fetchEntries,
  fetchSeparationErrors,
  fetchAchievementDefinitions,
  fetchAllAchievements,
  unlockAchievement,
} from "../lib/api";
import { fmtDate } from "../lib/format";
import {
  IconAward,
  IconRefresh,
  IconTrophy,
  IconTarget,
  IconZap,
  IconShield,
} from "./Icons";

const ICONS = {
  "100_sem_falta": "💯",
  semana_perfeita: "⭐",
  mes_ouro: "🥇",
  speed_demon: "⚡",
  zero_erro_30d: "🛡️",
  streak_7: "🔥",
  streak_30: "💎",
};

export default function Achievements({ operators = [] }) {
  const [definitions, setDefinitions] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [entries, setEntries] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    const [{ data: d }, { data: a }, { data: e }, { data: er }] = await Promise.all([
      fetchAchievementDefinitions(),
      fetchAllAchievements({ limit: 500 }),
      fetchEntries({ limit: 3000 }),
      fetchSeparationErrors(),
    ]);
    setDefinitions(d || []);
    setUnlocked(a || []);
    setEntries(e || []);
    setErrors(er || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("achievements")
      .on("postgres_changes", { event: "*", schema: "public", table: "operator_achievements" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====================== SCANNER ======================
  // Roda em memória, calcula e desbloqueia novos achievements
  async function runScan() {
    setScanning(true);
    setError("");
    const unlocks = [];

    // Agrupa entries por operador
    const byOp = {};
    entries.forEach((e) => {
      if (!byOp[e.operator_code]) byOp[e.operator_code] = { name: e.operator_name, list: [] };
      byOp[e.operator_code].list.push(e);
    });

    const alreadyUnlocked = new Set(unlocked.map((u) => `${u.operator_code}::${u.achievement_id}`));

    for (const [code, info] of Object.entries(byOp)) {
      const list = info.list.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      // streak de dias com >= 5 registros
      const dayCount = {};
      list.forEach((e) => {
        const d = e.start_time.slice(0, 10);
        dayCount[d] = (dayCount[d] || 0) + 1;
      });
      const days = Object.keys(dayCount).sort();
      let streak = 0, maxStreak = 0;
      for (let i = 0; i < days.length; i++) {
        if (i === 0) { streak = 1; }
        else {
          const prev = new Date(days[i - 1] + "T12:00:00");
          const cur = new Date(days[i] + "T12:00:00");
          const diff = (cur - prev) / (1000 * 60 * 60 * 24);
          streak = diff === 1 ? streak + 1 : 1;
        }
        if (dayCount[days[i]] >= 5) maxStreak = Math.max(maxStreak, streak);
        else streak = 0;
      }

      if (maxStreak >= 7 && !alreadyUnlocked.has(`${code}::streak_7`)) {
        unlocks.push({ code, name: info.name, id: "streak_7" });
      }
      if (maxStreak >= 30 && !alreadyUnlocked.has(`${code}::streak_30`)) {
        unlocks.push({ code, name: info.name, id: "streak_30" });
      }

      // speed demon: 5+ atividades no mesmo dia com tempo abaixo da média geral
      const sameDay = {};
      list.forEach((e) => {
        const d = e.start_time.slice(0, 10);
        if (!sameDay[d]) sameDay[d] = [];
        sameDay[d].push(e);
      });
      const globalAvg = list.reduce((s, e) => s + (e.duration_seconds || 0), 0) / list.length;
      const hasSpeedDay = Object.values(sameDay).some((dayList) =>
        dayList.length >= 5 && dayList.filter((e) => (e.duration_seconds || 0) < globalAvg).length >= 5
      );
      if (hasSpeedDay && !alreadyUnlocked.has(`${code}::speed_demon`)) {
        unlocks.push({ code, name: info.name, id: "speed_demon" });
      }

      // zero_erro_30d: sem erros nos últimos 30 dias
      const errorsOfOp = errors.filter(
        (er) => er.error_operator_code === code &&
        (Date.now() - new Date(er.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 30
      );
      if (errorsOfOp.length === 0 && list.length > 0 && !alreadyUnlocked.has(`${code}::zero_erro_30d`)) {
        unlocks.push({ code, name: info.name, id: "zero_erro_30d" });
      }
    }

    // Aplica os unlocks
    for (const u of unlocks) {
      await unlockAchievement(u.code, u.name, u.id);
    }

    setScanning(false);
    await loadAll();
  }

  const unlockedByOp = useMemo(() => {
    const m = {};
    unlocked.forEach((u) => {
      if (!m[u.operator_code]) m[u.operator_code] = [];
      m[u.operator_code].push(u);
    });
    return m;
  }, [unlocked]);

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Conquistas</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Badges desbloqueadas por operador
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-small" onClick={loadAll}><IconRefresh size={14} /> Atualizar</button>
          <button className="btn-small btn-excel" onClick={runScan} disabled={scanning}>
            {scanning ? "Escaneando..." : "Escanear conquistas"}
          </button>
        </div>
      </div>

      {error && <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Catálogo de conquistas</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {definitions.map((d) => (
            <div key={d.id} style={{ padding: 14, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{ICONS[d.id] || d.icon}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{d.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{d.description}</div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : operators.length === 0 ? (
        <div className="schedule-empty">Sem operadores.</div>
      ) : (
        <div className="card">
          <div className="card-title">Conquistas por operador</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Operador</th>
                <th>Código</th>
                <th>Conquistas</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => {
                const list = unlockedByOp[op.code] || [];
                return (
                  <tr key={op.code}>
                    <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{op.name}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>#{op.code}</td>
                    <td>
                      {list.length === 0 ? (
                        <span style={{ color: "var(--text-faint)", fontSize: 12 }}>Nenhuma</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {list.map((u) => (
                            <span
                              key={u.id}
                              title={`${u.achievement_id} em ${fmtDate(u.unlocked_at)}`}
                              style={{
                                background: "var(--accent-soft)",
                                color: "var(--accent)",
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 14,
                                cursor: "help",
                              }}
                            >
                              {ICONS[u.achievement_id] || "🏆"}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
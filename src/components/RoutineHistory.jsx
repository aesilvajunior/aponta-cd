import React, { useCallback, useEffect, useState } from "react";
import { fetchRoutineHistory, fetchRoutineConfig } from "../lib/api";
import { localISODate } from "../lib/format";

export default function RoutineHistory() {
  const [rows, setRows] = useState([]);
  const [cfg, setCfg] = useState({});
  const [days, setDays] = useState(14);

  const load = useCallback(async () => {
    const from = localISODate(new Date(Date.now() - days * 864e5));
    const [{ data: hist }, { data: steps }] = await Promise.all([
      fetchRoutineHistory({ from }),
      fetchRoutineConfig(),
    ]);
    setRows(hist ?? []);
    const map = {};
    (steps ?? []).forEach((s) => (map[s.step_key] = s));
    setCfg(map);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  // Agrupa por data
  const byDate = rows.reduce((acc, r) => {
    (acc[r.routine_date] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="rh-wrap">
      <div className="rh-toolbar">
        <label>Últimos <input type="number" min="1" max="90" value={days} onChange={(e) => setDays(Number(e.target.value) || 14)} /> dias</label>
      </div>

      {Object.keys(byDate).length === 0 && <p>Nenhum registro no período.</p>}

      {Object.entries(byDate)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, items]) => (
          <div key={date} className="rh-day">
            <h3>{new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</h3>
            <ul>
              {items
                .sort((a, b) => (cfg[a.step_key]?.sort_order ?? 0) - (cfg[b.step_key]?.sort_order ?? 0))
                .map((it) => (
                  <li key={it.id}>
                    ✓ <b>{cfg[it.step_key]?.label ?? it.step_key}</b>{" "}
                    <small>
                      {new Date(it.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {it.completed_name && ` • ${it.completed_name}`}
                    </small>
                  </li>
                ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
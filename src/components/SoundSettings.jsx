import React, { useEffect, useState } from "react";
import {
  fetchSoundPrefs,
  updateSoundPrefs,
  SOUND_OPTIONS,
  previewSound,
  defaultPrefs,
} from "../lib/sounds";
import { supabase } from "../supabaseClient";
import { IconVolume2, IconRefresh, IconCheck } from "./Icons";

const EVENT_LABELS = {
  sound_late_activity: "Atividade demorada",
  sound_new_conference: "Novo item na mesa",
  sound_shortage: "Falta registrada",
  sound_goal: "Meta da equipe",
  sound_activity_start: "Atividade iniciada",
  sound_activity_finish: "Atividade finalizada",
  sound_error_registered: "Erro registrado",
  sound_goal_hit: "Meta individual batida",
};

export default function SoundSettings() {
  const [prefs, setPrefs] = useState(defaultPrefs());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const data = await fetchSoundPrefs();
    setPrefs({ ...defaultPrefs(), ...data });
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("sound-prefs")
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_sounds" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function change(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }));
    previewSound(value);
  }

  async function save() {
    setSaving(true);
    setError("");
    const patch = {};
    Object.keys(EVENT_LABELS).forEach((k) => {
      patch[k] = prefs[k];
    });
    const { error: err } = await updateSoundPrefs(patch);
    setSaving(false);
    if (err) return setError(err.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1 className="page-title">Sons do sistema</h1>
      <p className="page-sub">
        Cada tipo de evento pode ter um som diferente. Clicar em uma opção toca uma prévia.
      </p>

      <div className="card" style={{ maxWidth: 860 }}>
        {loading ? (
          <div className="schedule-empty">Carregando...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <div key={key}>
                  <label className="schedule-modal-label">{label}</label>
                  <select
                    className="field"
                    style={{ width: "100%" }}
                    value={prefs[key] || "beep"}
                    onChange={(e) => change(key, e.target.value)}
                    disabled={saving}
                  >
                    {SOUND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {error && (
              <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn-small btn-excel" onClick={save} disabled={saving}>
                {saved ? <><IconCheck size={14} /> Salvo</> : saving ? "Salvando..." : "Salvar preferências"}
              </button>
              <button className="btn-small" onClick={load} disabled={saving}>
                <IconRefresh size={14} /> Recarregar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
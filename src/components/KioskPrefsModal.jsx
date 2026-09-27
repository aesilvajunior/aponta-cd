import React, { useEffect, useMemo, useState } from "react";
import {
  fetchOperatorPrefs,
  saveOperatorPrefs,
  FONT_SCALES,
  THEME_OPTIONS,
} from "../lib/operatorPrefs";
import { IconX, IconCheck, IconSettings, IconStar } from "./Icons";

export default function KioskPrefsModal({ operator, activities, onClose, onSaved }) {
  const [prefs, setPrefs] = useState({
    theme: "auto",
    font_scale: 1.0,
    favorite_activities: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await fetchOperatorPrefs(operator.code);
      setPrefs({
        theme: data?.theme || "auto",
        font_scale: Number(data?.font_scale) || 1.0,
        favorite_activities: data?.favorite_activities || [],
      });
      setLoading(false);
    })();
  }, [operator.code]);

  function toggleFavorite(name) {
    setPrefs((p) => {
      const has = p.favorite_activities.includes(name);
      return {
        ...p,
        favorite_activities: has
          ? p.favorite_activities.filter((x) => x !== name)
          : [...p.favorite_activities, name],
      };
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    const { error: err } = await saveOperatorPrefs(operator.code, {
      theme: prefs.theme,
      font_scale: prefs.font_scale,
      favorite_activities: prefs.favorite_activities,
    });
    setSaving(false);
    if (err) return setError(err.message);
    onSaved?.(prefs);
    onClose?.();
  }

  const orderedActivities = useMemo(() => {
    const fav = new Set(prefs.favorite_activities);
    const favList = activities.filter((a) => fav.has(a.name));
    const rest = activities.filter((a) => !fav.has(a.name));
    return [...favList, ...rest];
  }, [activities, prefs.favorite_activities]);

  return (
    <div className="kiosk-modal-backdrop" onClick={onClose}>
      <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="kiosk-modal-header">
          <div>
            <div className="kiosk-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconSettings size={18} /> Minhas preferências
            </div>
            <div className="kiosk-modal-sub">
              {operator.name} · #{operator.code}
            </div>
          </div>
          <button className="kiosk-modal-close" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </button>
        </div>

        <div className="kiosk-modal-body" style={{ maxHeight: "60vh" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Carregando...
            </div>
          ) : (
            <>
              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Tema</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, theme: t.value }))}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        background: prefs.theme === t.value ? "var(--accent-soft)" : "var(--surface-raised)",
                        border: `1px solid ${prefs.theme === t.value ? "var(--accent)" : "var(--border-strong)"}`,
                        borderRadius: 10,
                        color: prefs.theme === t.value ? "var(--accent)" : "var(--text)",
                        fontWeight: prefs.theme === t.value ? 700 : 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 13,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label">Tamanho da fonte</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {FONT_SCALES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, font_scale: f.value }))}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        background: prefs.font_scale === f.value ? "var(--accent-soft)" : "var(--surface-raised)",
                        border: `1px solid ${prefs.font_scale === f.value ? "var(--accent)" : "var(--border-strong)"}`,
                        borderRadius: 10,
                        color: prefs.font_scale === f.value ? "var(--accent)" : "var(--text)",
                        fontWeight: prefs.font_scale === f.value ? 700 : 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 13,
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="kiosk-modal-section">
                <label className="kiosk-modal-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconStar size={13} /> Atividades favoritas
                  <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400 }}>
                    (ficam no topo da lista)
                  </span>
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {orderedActivities.map((a) => {
                    const isFav = prefs.favorite_activities.includes(a.name);
                    return (
                      <button
                        key={a.name}
                        type="button"
                        onClick={() => toggleFavorite(a.name)}
                        style={{
                          padding: "8px 12px",
                          background: isFav ? "var(--accent-soft)" : "var(--surface-raised)",
                          border: `1px solid ${isFav ? "var(--accent)" : "var(--border-strong)"}`,
                          borderRadius: 8,
                          color: isFav ? "var(--accent)" : "var(--text)",
                          fontWeight: isFav ? 700 : 500,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontSize: 12.5,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {isFav && <IconStar size={11} />}
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="kiosk-modal-footer">
          <button className="kiosk-btn kiosk-btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="kiosk-btn kiosk-btn-primary" onClick={save} disabled={saving || loading}>
            <IconCheck size={14} /> {saving ? "Salvando..." : "Salvar preferências"}
          </button>
        </div>
      </div>
    </div>
  );
}
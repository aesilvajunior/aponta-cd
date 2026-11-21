import React, { useEffect, useRef, useState } from "react";
import { ACCENT_PRESETS, useTheme } from "../context/ThemeContext";
import { IconSun, IconMoon } from "./Icons";

export default function ThemeToggle({ compact = false, showColors = true }) {
  const { resolvedTheme, toggleTheme, accentId, setAccentId, accentPreset } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!paletteOpen) return undefined;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [paletteOpen]);

  if (compact) {
    return (
      <div ref={wrapRef} className="theme-control-wrap theme-control-compact">
        <button
          type="button"
          className="theme-toggle theme-toggle-compact"
          onClick={toggleTheme}
          title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
          aria-label="Alternar tema claro e escuro"
        >
          {isDark ? <IconSun size={17} /> : <IconMoon size={17} />}
        </button>

        {showColors && (
          <button
            type="button"
            className="theme-color-trigger"
            onClick={() => setPaletteOpen((v) => !v)}
            title={`Cor do tema: ${accentPreset.label}`}
            aria-label="Escolher cor do tema"
            aria-expanded={paletteOpen}
          >
            <span className="theme-color-dot" style={{ background: accentPreset.swatch }} />
          </button>
        )}

        {paletteOpen && (
          <div className="theme-palette-popover" role="menu" aria-label="Paleta de cores">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`theme-swatch-btn ${accentId === p.id ? "active" : ""}`}
                style={{ background: p.swatch }}
                title={p.label}
                aria-label={p.label}
                onClick={() => {
                  setAccentId(p.id);
                  setPaletteOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="theme-control-wrap">
      <div className="theme-control-row">
        <button
          type="button"
          className="theme-toggle"
          style={{ flex: 1 }}
          onClick={toggleTheme}
          title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
          aria-label="Alternar tema claro e escuro"
        >
          {isDark ? <IconSun size={17} /> : <IconMoon size={17} />}
          <span>{isDark ? "Modo Claro" : "Modo Escuro"}</span>
        </button>

        {showColors && (
          <button
            type="button"
            className="theme-color-trigger"
            onClick={() => setPaletteOpen((v) => !v)}
            title={`Cor do tema: ${accentPreset.label}`}
            aria-label="Escolher cor do tema"
            aria-expanded={paletteOpen}
          >
            <span className="theme-color-dot" style={{ background: accentPreset.swatch }} />
          </button>
        )}
      </div>

      {showColors && paletteOpen && (
        <div className="theme-palette-inline" role="group" aria-label="Escolher cor do tema">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`theme-swatch-btn ${accentId === p.id ? "active" : ""}`}
              style={{ background: p.swatch }}
              title={p.label}
              aria-label={p.label}
              onClick={() => setAccentId(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

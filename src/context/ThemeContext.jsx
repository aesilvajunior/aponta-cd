import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "aponta_theme"; // "light" | "dark" | "system"
const ACCENT_KEY = "aponta_accent";

export const ACCENT_PRESETS = [
  {
    id: "aponta",
    label: "Aponta Ciano",
    swatch: "#0ea5c6",
    light: { accent: "#16336e", hover: "#0f2552", soft: "#e6f4f8", accent2: "#0ea5c6" },
    dark: { accent: "#22d3ee", hover: "#67e8f9", soft: "#0f2933", accent2: "#38bdf8" },
  },
  {
    id: "royal",
    label: "Azul Royal",
    swatch: "#2563eb",
    light: { accent: "#1d4ed8", hover: "#1e40af", soft: "#e8f0fe", accent2: "#3b82f6" },
    dark: { accent: "#60a5fa", hover: "#93c5fd", soft: "#172544", accent2: "#3b82f6" },
  },
  {
    id: "emerald",
    label: "Esmeralda",
    swatch: "#10b981",
    light: { accent: "#059669", hover: "#047857", soft: "#e6f7f0", accent2: "#10b981" },
    dark: { accent: "#34d399", hover: "#6ee7b7", soft: "#0d2b22", accent2: "#10b981" },
  },
  {
    id: "amber",
    label: "Âmbar",
    swatch: "#f59e0b",
    light: { accent: "#d97706", hover: "#b45309", soft: "#fef4e4", accent2: "#f59e0b" },
    dark: { accent: "#fbbf24", hover: "#fcd34d", soft: "#2e220d", accent2: "#f59e0b" },
  },
  {
    id: "violet",
    label: "Violeta",
    swatch: "#7c3aed",
    light: { accent: "#6d28d9", hover: "#5b21b6", soft: "#f1ecfe", accent2: "#8b5cf6" },
    dark: { accent: "#a78bfa", hover: "#c4b5fd", soft: "#21173b", accent2: "#8b5cf6" },
  },
  {
    id: "slate",
    label: "Grafite",
    swatch: "#475569",
    light: { accent: "#1e293b", hover: "#0f172a", soft: "#eef2f6", accent2: "#475569" },
    dark: { accent: "#cbd5e1", hover: "#e2e8f0", soft: "#1e2430", accent2: "#94a3b8" },
  },
];

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch { /* ignora */ }
  return "system";
}

function getInitialAccent() {
  try {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (ACCENT_PRESETS.some((p) => p.id === saved)) return saved;
  } catch { /* ignora */ }
  return "aponta";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getInitialTheme);
  const [accentId, setAccentId] = useState(getInitialAccent);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    preference === "system" ? getSystemTheme() : preference
  );

  // Aplica tema (light/dark) + cor de destaque no <html>
  useEffect(() => {
    const final = preference === "system" ? getSystemTheme() : preference;
    setResolvedTheme(final);
    const root = document.documentElement;
    root.setAttribute("data-theme", final);

    const preset = ACCENT_PRESETS.find((p) => p.id === accentId) || ACCENT_PRESETS[0];
    const tokens = preset[final] || preset.light;
    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--accent-hover", tokens.hover);
    root.style.setProperty("--accent-soft", tokens.soft);
    root.style.setProperty("--accent-2", tokens.accent2);
  }, [preference, accentId]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* ignora */ }
  }, [preference]);

  useEffect(() => {
    try { localStorage.setItem(ACCENT_KEY, accentId); } catch { /* ignora */ }
  }, [accentId]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const final = getSystemTheme();
      setResolvedTheme(final);
      document.documentElement.setAttribute("data-theme", final);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  function toggleTheme() {
    setPreference(resolvedTheme === "dark" ? "light" : "dark");
  }

  const currentPreset = ACCENT_PRESETS.find((p) => p.id === accentId) || ACCENT_PRESETS[0];

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolvedTheme,
        setPreference,
        toggleTheme,
        accentId,
        setAccentId,
        accentPreset: currentPreset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}

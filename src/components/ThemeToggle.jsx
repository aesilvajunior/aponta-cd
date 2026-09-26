import React from "react";
import { useTheme } from "../context/ThemeContext";
import { IconSun, IconMoon } from "./Icons";

export default function ThemeToggle({ compact = false }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (compact) {
    return (
      <button
        className="theme-toggle theme-toggle-compact"
        onClick={toggleTheme}
        title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
        aria-label="Alternar tema"
      >
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>
    );
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      aria-label="Alternar tema"
    >
      {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      <span>{isDark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
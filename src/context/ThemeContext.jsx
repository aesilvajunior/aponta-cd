import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "aponta_theme"; // "light" | "dark" | "system"

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // localStorage indisponível — segue pro padrão
  }
  return "system";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getInitialTheme); // "light" | "dark" | "system"
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    preference === "system" ? getSystemTheme() : preference
  );

  // Aplica o tema no <html> (data-theme="light" | "dark")
  useEffect(() => {
    const final = preference === "system" ? getSystemTheme() : preference;
    setResolvedTheme(final);
    document.documentElement.setAttribute("data-theme", final);
  }, [preference]);

  // Salva a preferência
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignora
    }
  }, [preference]);

  // Escuta mudanças do sistema (se estiver em "system")
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

  // Alterna entre light e dark (ignora "system" quando aperta o botão)
  function toggleTheme() {
    setPreference(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}
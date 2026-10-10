// ============================================================
// Registro de erros do navegador (simples, sem serviço externo).
// Grava na tabela client_errors do Supabase (veja a migração em
// supabase/migrations/2026-10-10_hardening.sql). Se a tabela não
// existir ainda ou estiver sem internet, ignora em silêncio:
// nunca pode causar um erro novo.
// ============================================================
import { supabase } from "../supabaseClient";
import { getStationName } from "./station";

const MAX_PER_SESSION = 10;
let sent = 0;
const seen = new Set();

export async function reportError(error, context = {}) {
  try {
    if (sent >= MAX_PER_SESSION) return;
    const message = String(error?.message || error || "erro desconhecido").slice(0, 500);
    const stack = String(error?.stack || "").slice(0, 4000);
    const key = `${message}|${stack.slice(0, 120)}`;
    if (seen.has(key)) return; // não repete o mesmo erro
    seen.add(key);
    sent += 1;

    await supabase.from("client_errors").insert({
      message,
      stack,
      url: typeof location !== "undefined" ? location.href.slice(0, 500) : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
      station: getStationName() || null,
      context,
    });
  } catch {
    // nunca propaga
  }
}

export function installErrorReporting() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    reportError(e.error || e.message, { type: "window.error", source: e.filename, line: e.lineno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportError(e.reason, { type: "unhandledrejection" });
  });
}

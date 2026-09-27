// ============================================================
// Aponta CD — Preferências por operador
// ============================================================
import { supabase } from "../supabaseClient";

export async function fetchOperatorPrefs(operatorCode) {
  const { data, error } = await supabase
    .from("operator_prefs")
    .select("*")
    .eq("operator_code", operatorCode)
    .maybeSingle();
  if (error || !data) {
    return {
      data: {
        operator_code: operatorCode,
        theme: "auto",
        font_scale: 1.0,
        favorite_activities: [],
        welcome_shown_date: null,
      },
      error: null,
    };
  }
  return { data, error: null };
}

export async function saveOperatorPrefs(operatorCode, patch) {
  return supabase
    .from("operator_prefs")
    .upsert(
      {
        operator_code: operatorCode,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "operator_code" }
    )
    .select()
    .maybeSingle();
}

export async function markWelcomeShown(operatorCode) {
  const today = new Date().toISOString().slice(0, 10);
  return supabase
    .from("operator_prefs")
    .upsert(
      {
        operator_code: operatorCode,
        welcome_shown_date: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "operator_code" }
    );
}

export async function shouldShowWelcome(operatorCode) {
  const { data } = await fetchOperatorPrefs(operatorCode);
  const today = new Date().toISOString().slice(0, 10);
  return data?.welcome_shown_date !== today;
}

export const FONT_SCALES = [
  { value: 0.85, label: "Pequeno" },
  { value: 1.0, label: "Normal" },
  { value: 1.15, label: "Grande" },
  { value: 1.3, label: "Extra grande" },
];

export const THEME_OPTIONS = [
  { value: "auto", label: "Automático" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];
// ============================================================
// Aponta CD — Sons configuráveis
// ============================================================
import { supabase } from "../supabaseClient";

const SOUND_PATTERNS = {
  beep: [{ freq: 880, dur: 0.28, gap: 0 }],
  chime: [
    { freq: 660, dur: 0.18, gap: 0 },
    { freq: 880, dur: 0.22, gap: 0.06 },
  ],
  alert: [
    { freq: 880, dur: 0.28, gap: 0 },
    { freq: 880, dur: 0.28, gap: 0.12 },
  ],
  success: [
    { freq: 660, dur: 0.15, gap: 0 },
    { freq: 880, dur: 0.15, gap: 0.05 },
    { freq: 1320, dur: 0.22, gap: 0.05 },
  ],
  urgent: [
    { freq: 1200, dur: 0.12, gap: 0 },
    { freq: 900, dur: 0.12, gap: 0.04 },
    { freq: 1200, dur: 0.12, gap: 0.04 },
    { freq: 900, dur: 0.12, gap: 0.04 },
  ],
  soft: [{ freq: 520, dur: 0.35, gap: 0 }],
  goal: [
    { freq: 660, dur: 0.12, gap: 0 },
    { freq: 880, dur: 0.12, gap: 0.04 },
    { freq: 1320, dur: 0.12, gap: 0.04 },
    { freq: 1760, dur: 0.3, gap: 0.05 },
  ],
  error: [
    { freq: 400, dur: 0.18, gap: 0 },
    { freq: 320, dur: 0.28, gap: 0.05 },
  ],
};

let cachedPrefs = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export function defaultPrefs() {
  return {
    sound_late_activity: "alert",
    sound_new_conference: "chime",
    sound_shortage: "urgent",
    sound_goal: "success",
    sound_activity_start: "beep",
    sound_activity_finish: "success",
    sound_error_registered: "error",
    sound_goal_hit: "goal",
  };
}

export async function fetchSoundPrefs() {
  const now = Date.now();
  if (cachedPrefs && now - cachedAt < CACHE_MS) return cachedPrefs;
  const { data, error } = await supabase
    .from("notification_sounds")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return cachedPrefs || defaultPrefs();
  cachedPrefs = data;
  cachedAt = now;
  return data;
}

export async function updateSoundPrefs(patch) {
  const { data, error } = await supabase
    .from("notification_sounds")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .maybeSingle();
  if (!error) {
    cachedPrefs = data;
    cachedAt = Date.now();
  }
  return { data, error };
}

export function playSound(name) {
  const pattern = SOUND_PATTERNS[name] || SOUND_PATTERNS.beep;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    let t = ctx.currentTime;
    pattern.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
      osc.start(t);
      osc.stop(t + note.dur + 0.02);
      t += note.dur + (note.gap || 0);
    });
    setTimeout(() => { try { ctx.close?.(); } catch {} }, (t - ctx.currentTime + 0.5) * 1000);
  } catch {}
}

export async function playEventSound(eventKey) {
  const prefs = await fetchSoundPrefs();
  const soundName = prefs?.[eventKey] || defaultPrefs()[eventKey];
  playSound(soundName);
}

export const SOUND_OPTIONS = [
  { value: "beep", label: "Beep simples" },
  { value: "chime", label: "Campainha" },
  { value: "alert", label: "Alerta duplo" },
  { value: "success", label: "Sucesso (3 notas)" },
  { value: "urgent", label: "Urgente (rápido)" },
  { value: "soft", label: "Suave" },
  { value: "goal", label: "Meta batida (fanfarra)" },
  { value: "error", label: "Erro (grave)" },
];

export function previewSound(name) {
  playSound(name);
}
export function pad(n) {
  return String(n).padStart(2, "0");
}

export function fmtClock(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--:--";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--/--/----";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtDuration(sec) {
  if (sec == null || isNaN(sec)) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}

// Retorna a data (YYYY-MM-DD) no fuso LOCAL do navegador, não em UTC.
// Use isso em vez de `new Date().toISOString().slice(0,10)` — esse
// padrão pega a data em UTC e erra o dia entre ~21h e 23h59 no horário
// de Brasília (quando o UTC já virou o dia seguinte).
export function todayLocalISODate() {
  return localISODate(new Date());
}

export function localISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export function shiftFor(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Manhã";
  const totalMin = d.getHours() * 60 + d.getMinutes();
  return totalMin < 13 * 60 + 30 ? "Manhã" : "Tarde";
}
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

export function shiftFor(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Manhã";
  const totalMin = d.getHours() * 60 + d.getMinutes();
  return totalMin < 13 * 60 + 30 ? "Manhã" : "Tarde";
}
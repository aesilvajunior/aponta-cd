import { fmtDate, todayLocalISODate, localISODate } from "../../lib/format";

export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function csvEscape(v) {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-\d+([.,]\d+)?$/.test(s)) {
    s = `'${s}`;
  }
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function periodFilename(prefix, ext, dateFrom, dateTo, fallbackEntries) {
  let fromStr = dateFrom;
  let toStr = dateTo;
  if (!fromStr || !toStr) {
    if (fallbackEntries && fallbackEntries.length > 0) {
      const sorted = [...fallbackEntries].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      if (!fromStr) fromStr = localISODate(sorted[0].start_time);
      if (!toStr) toStr = localISODate(sorted[sorted.length - 1].start_time);
    } else {
      const today = todayLocalISODate();
      if (!fromStr) fromStr = today;
      if (!toStr) toStr = today;
    }
  }
  return `${prefix}_${fromStr}_a_${toStr}.${ext}`;
}

export function periodLabel(dateFrom, dateTo, fallbackEntries) {
  if (dateFrom || dateTo) {
    return `${dateFrom ? fmtDate(dateFrom + "T12:00:00") : "início"} até ${dateTo ? fmtDate(dateTo + "T12:00:00") : "hoje"}`;
  }
  if (fallbackEntries && fallbackEntries.length > 0) {
    const sorted = [...fallbackEntries].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    return `${fmtDate(sorted[0].start_time)} até ${fmtDate(sorted[sorted.length - 1].start_time)}`;
  }
  return "todo o histórico";
}

export function downloadCsv(lines, filename) {
  const csv = "\ufeff" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function quickRange(type) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toISO = (d) => localISODate(d);
  if (type === "hoje") return { from: toISO(today), to: toISO(today) };
  if (type === "ontem") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: toISO(y), to: toISO(y) };
  }
  if (type === "7dias") {
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    return { from: toISO(past), to: toISO(today) };
  }
  if (type === "mes") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toISO(first), to: toISO(today) };
  }
  return { from: "", to: "" };
}

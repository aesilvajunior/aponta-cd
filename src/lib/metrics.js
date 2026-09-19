export function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

export function computeMetrics(entries, activities) {
  const byActivity = {};
  activities.forEach((a) => (byActivity[a.name] = []));
  entries.forEach((e) => {
    if (!byActivity[e.activity]) byActivity[e.activity] = [];
    byActivity[e.activity].push(e.duration_seconds);
  });
  const avgByActivity = Object.entries(byActivity).map(([name, arr]) => ({
    name,
    media: Math.round(mean(arr)),
    registros: arr.length,
  }));

  const byOperator = {};
  entries.forEach((e) => {
    byOperator[e.operator_name] = byOperator[e.operator_name] || [];
    byOperator[e.operator_name].push(e.duration_seconds);
  });
  const opStats = Object.entries(byOperator)
    .map(([name, arr]) => ({
      name,
      total: arr.reduce((a, b) => a + b, 0),
      registros: arr.length,
      media: Math.round(mean(arr)),
    }))
    .sort((a, b) => b.total - a.total);

  const shiftData = ["Manhã", "Tarde"].map((sh) => {
    const arr = entries.filter((e) => e.shift === sh).map((e) => e.duration_seconds);
    return { name: sh, media: Math.round(mean(arr)), registros: arr.length };
  });

  const outliers = [];
  Object.entries(byActivity).forEach(([act, arr]) => {
    if (arr.length < 3) return;
    const m = mean(arr);
    const sd = stdDev(arr);
    entries
      .filter((e) => e.activity === act && e.duration_seconds > m + 1.5 * sd)
      .forEach((e) => outliers.push(e));
  });

  const rankByActivity = {};
  activities.forEach((act) => {
    const relevant = entries.filter((e) => e.activity === act.name);
    const byOp = {};
    relevant.forEach((e) => {
      byOp[e.operator_name] = byOp[e.operator_name] || [];
      byOp[e.operator_name].push(e.duration_seconds);
    });
    const arr = Object.entries(byOp).map(([name, durs]) => ({
      name,
      media: Math.round(mean(durs)),
    }));
    arr.sort((a, b) => a.media - b.media);
    rankByActivity[act.name] = arr;
  });

  return { avgByActivity, opStats, shiftData, outliers, rankByActivity };
}

// Segunda-feira da semana de uma data, no formato dd/mm — usado para
// agrupar registros por semana no gráfico de tendência.
function mondayLabel(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // volta até a segunda-feira
  d.setDate(d.getDate() + diff);
  const pad = (n) => String(n).padStart(2, "0");
  return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` };
}

// Monta os dados para o gráfico de tendência semanal: uma linha por
// atividade, mostrando como a média de tempo mudou semana a semana.
export function computeWeeklyTrend(entries, activities) {
  const weeks = {}; // key -> { label, [activityName]: [durations] }
  entries.forEach((e) => {
    const { key, label } = mondayLabel(e.start_time);
    if (!weeks[key]) weeks[key] = { key, label };
    if (!weeks[key][e.activity]) weeks[key][e.activity] = [];
    weeks[key][e.activity].push(e.duration_seconds);
  });

  return Object.values(weeks)
    .sort((a, b) => (a.key > b.key ? 1 : -1))
    .map((week) => {
      const row = { label: week.label };
      activities.forEach((a) => {
        const durs = week[a.name];
        row[a.name] = durs && durs.length ? Math.round(mean(durs)) : null;
      });
      return row;
    });
}

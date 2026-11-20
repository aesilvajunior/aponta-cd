// ============================================================
// Mapa de Calor (Curva ABC) e Sugestões de Slotting
// Cruza movimentação (bips, histórico, faltas, conferências e
// apontamentos) com a posição das prateleiras em relação à expedição.
// Funções puras (sem banco), testadas em __tests__/slotting.test.js.
// ============================================================

const DISPATCH_REGEX = /(expedi|doca|saida|saída|confer|despach|embarq)/i;

// Centro geométrico de uma área no sistema de coordenadas 0..100 do mapa 2D
export function areaCenter(area) {
  const x = (Number(area?.x) || 0) + (Number(area?.width) || 0) / 2;
  const y = (Number(area?.y) || 0) + (Number(area?.height) || 0) / 2;
  return { x, y };
}

// Localiza o ponto de referência da expedição/conferência.
// Prioriza áreas do tipo "conferencia" ou cujo código/rótulo cite expedição/doca/saída.
export function findDispatchOrigin(areas = []) {
  const explicit = areas.filter(
    (a) =>
      a.area_type === "conferencia" ||
      DISPATCH_REGEX.test(`${a.code || ""} ${a.label || ""}`)
  );

  if (explicit.length > 0) {
    const sum = explicit.reduce(
      (acc, a) => {
        const c = areaCenter(a);
        return { x: acc.x + c.x, y: acc.y + c.y };
      },
      { x: 0, y: 0 }
    );
    return {
      x: sum.x / explicit.length,
      y: sum.y / explicit.length,
      label:
        explicit.length === 1
          ? `${explicit[0].code} (${explicit[0].label || "Expedição"})`
          : `${explicit.length} pontos de conferência/expedição`,
      areaIds: explicit.map((a) => String(a.id)),
      inferred: false,
    };
  }

  // Fallback: base central do galpão (entrada/saída padrão)
  return {
    x: 50,
    y: 95,
    label: "Expedição (referência padrão)",
    areaIds: [],
    inferred: true,
  };
}

// Distância euclidiana em unidades do mapa (0..100) e estimativa em metros
export function distanceToOrigin(area, origin, { widthM = 60, depthM = 45 } = {}) {
  const c = areaCenter(area);
  const dxPct = c.x - origin.x;
  const dyPct = c.y - origin.y;
  const distancePct = Math.hypot(dxPct, dyPct);
  const dxM = (dxPct / 100) * widthM;
  const dyM = (dyPct / 100) * depthM;
  const distanceM = Math.hypot(dxM, dyM);
  return {
    distancePct: Math.round(distancePct * 10) / 10,
    distanceM: Math.round(distanceM * 10) / 10,
  };
}

// Gradiente térmico: azul frio (0) -> ciano -> âmbar -> laranja -> vermelho quente (1)
export function heatmapColor(heat) {
  const h = Math.max(0, Math.min(1, Number(heat) || 0));
  if (h < 0.05) return "#334155"; // sem movimentação registrada
  if (h < 0.25) return "#2563eb"; // frio (Curva C)
  if (h < 0.5) return "#06b6d4"; // moderado baixo
  if (h < 0.72) return "#f59e0b"; // médio (Curva B)
  if (h < 0.88) return "#f97316"; // quente (Curva A)
  return "#ef4444"; // muito quente (Top Curva A)
}

export function abcColor(abc) {
  if (abc === "A") return "#ef4444";
  if (abc === "B") return "#f59e0b";
  return "#3b82f6";
}

function normCode(v) {
  return String(v || "").trim().toUpperCase();
}

// Classificação Curva ABC por Pareto acumulado:
// A = primeiros 75% do giro (ou top 20% com score > 0)
// B = 75%..95%
// C = restante ou score 0
export function classifyABC(scoredEntries) {
  const sorted = [...scoredEntries].sort((a, b) => b.score - a.score);
  const totalScore = sorted.reduce((s, x) => s + Math.max(0, x.score), 0);
  const out = new Map();

  if (totalScore <= 0) {
    sorted.forEach((x) => out.set(x.key, "C"));
    return out;
  }

  let acc = 0;
  sorted.forEach((x, idx) => {
    if (x.score <= 0) {
      out.set(x.key, "C");
      return;
    }
    const prevShare = acc / totalScore;
    acc += x.score;
    if (idx === 0 || prevShare < 0.72) {
      out.set(x.key, "A");
    } else if (prevShare < 0.92) {
      out.set(x.key, "B");
    } else {
      out.set(x.key, "C");
    }
  });
  return out;
}

/**
 * Calcula giro, Mapa de Calor, Curva ABC e Sugestões de Slotting.
 *
 * Fontes cruzadas:
 *  - scans (stock_map_scans): bips de coleta/contagem (peso 3 por bip)
 *  - shortages (entry_shortages): faltas em separação (peso 4 + log da qtd — indica alto giro)
 *  - history (stock_map_history): movimentações/alterações no mapa (peso 2)
 *  - entries / conferenceHistory: separações e conferências com referência ao produto/área (peso 2)
 *  - items.quantity: proxy de volume quando há poucos logs (peso suave 0.25 * sqrt(qty))
 */
export function computeSlottingAnalysis({
  areas = [],
  items = [],
  scans = [],
  shortages = [],
  history = [],
  entries = [],
  conferenceHistory = [],
  warehouseConfig = { widthM: 60, depthM: 45 },
} = {}) {
  const origin = findDispatchOrigin(areas);
  const shelves = areas.filter((a) => a.area_type === "prateleira");
  const areaById = new Map(areas.map((a) => [String(a.id), a]));

  // Índices de eventos por produto e por área
  const productScore = new Map();
  const productSignals = new Map(); // { scans, shortages, history, conference }
  const areaDirectScore = new Map();

  const bumpProduct = (codeRaw, points, kind) => {
    const code = normCode(codeRaw);
    if (!code) return;
    productScore.set(code, (productScore.get(code) || 0) + points);
    const sig = productSignals.get(code) || { scans: 0, shortages: 0, history: 0, conference: 0 };
    if (kind) sig[kind] = (sig[kind] || 0) + 1;
    productSignals.set(code, sig);
  };

  const bumpArea = (areaId, points) => {
    if (!areaId) return;
    const id = String(areaId);
    areaDirectScore.set(id, (areaDirectScore.get(id) || 0) + points);
  };

  // 1) Bips do mapa
  scans.forEach((s) => {
    if (s.undone) return;
    const pts = 3 + Math.min(5, Math.max(0, Number(s.quantity_delta) || 0));
    bumpProduct(s.product_code || s.barcode, pts, "scans");
    if (s.area_id) bumpArea(s.area_id, 2);
  });

  // 2) Faltas registradas na separação (sinal fortíssimo de demanda/giro)
  shortages.forEach((sh) => {
    const qty = Math.max(1, Number(sh.quantity) || 1);
    const pts = 4 + Math.min(6, Math.log2(qty + 1) * 1.5);
    bumpProduct(sh.product_code, pts, "shortages");
  });

  // 3) Histórico de alterações do mapa
  history.forEach((h) => {
    if (h.area_id) bumpArea(h.area_id, 1.5);
    const code = h.after_data?.productCode || h.after_data?.product_code || h.before_data?.productCode;
    if (code) bumpProduct(code, 2, "history");
  });

  // 4) Menções em observações de apontamentos ou conferências (melhor esforço)
  const knownCodes = new Set(items.map((it) => normCode(it.product_code)).filter((c) => c.length >= 3));
  const checkText = (text, kind) => {
    if (!text || knownCodes.size === 0) return;
    const upper = String(text).toUpperCase();
    for (const code of knownCodes) {
      if (upper.includes(code)) bumpProduct(code, 2, kind);
    }
  };
  entries.slice(0, 500).forEach((e) => {
    if (e.note) checkText(e.note, "conference");
  });
  conferenceHistory.slice(0, 300).forEach((c) => {
    if (c.note) checkText(c.note, "conference");
    if (c.problem_reason) checkText(c.problem_reason, "conference");
  });

  // Score por item do mapa
  const itemRows = items.map((it) => {
    const code = normCode(it.product_code);
    const bc = normCode(it.barcode);
    const eventScore = (productScore.get(code) || 0) + (bc && bc !== code ? productScore.get(bc) || 0 : 0);
    const qtyProxy = Math.sqrt(Math.max(0, Number(it.quantity) || 0)) * 0.25;
    const score = Math.round((eventScore + qtyProxy) * 10) / 10;
    const area = areaById.get(String(it.area_id));
    const dist = area ? distanceToOrigin(area, origin, warehouseConfig) : { distancePct: 0, distanceM: 0 };
    const signals = productSignals.get(code) || { scans: 0, shortages: 0, history: 0, conference: 0 };
    return {
      key: String(it.id),
      item: it,
      area,
      score,
      eventScore: Math.round(eventScore * 10) / 10,
      signals,
      ...dist,
    };
  });

  const itemAbcMap = classifyABC(itemRows);
  const maxItemScore = Math.max(1, ...itemRows.map((r) => r.score));

  const itemMetrics = {};
  itemRows.forEach((r) => {
    itemMetrics[r.key] = {
      score: r.score,
      eventScore: r.eventScore,
      heat: r.score > 0 ? Math.min(1, r.score / maxItemScore) : 0,
      abc: itemAbcMap.get(r.key) || "C",
      distancePct: r.distancePct,
      distanceM: r.distanceM,
      signals: r.signals,
    };
  });

  // Agregação por área (prateleiras)
  const itemsByAreaId = new Map();
  itemRows.forEach((r) => {
    const k = String(r.item.area_id);
    if (!itemsByAreaId.has(k)) itemsByAreaId.set(k, []);
    itemsByAreaId.get(k).push(r);
  });

  const shelfRows = shelves.map((a) => {
    const list = itemsByAreaId.get(String(a.id)) || [];
    const itemsScore = list.reduce((s, r) => s + r.score, 0);
    const direct = areaDirectScore.get(String(a.id)) || 0;
    const score = Math.round((itemsScore + direct) * 10) / 10;
    const dist = distanceToOrigin(a, origin, warehouseConfig);
    const curvaACount = list.filter((r) => itemMetrics[r.key]?.abc === "A").length;
    const curvaBCount = list.filter((r) => itemMetrics[r.key]?.abc === "B").length;
    return {
      key: String(a.id),
      area: a,
      score,
      skus: list.length,
      curvaACount,
      curvaBCount,
      topItems: [...list].sort((x, y) => y.score - x.score).slice(0, 5),
      ...dist,
    };
  });

  const areaAbcMap = classifyABC(shelfRows);
  const maxAreaScore = Math.max(1, ...shelfRows.map((r) => r.score));

  // Limiar de distância para considerar "longe da expedição" (percentil 55 das prateleiras)
  const distances = shelfRows.map((r) => r.distanceM).sort((a, b) => a - b);
  const farThresholdM =
    distances.length >= 2 ? distances[Math.floor(distances.length * 0.55)] : 15;
  const nearThresholdM =
    distances.length >= 2 ? distances[Math.floor(distances.length * 0.35)] : 8;

  const areaMetrics = {};
  shelfRows.forEach((r) => {
    const abc = areaAbcMap.get(r.key) || "C";
    const isFarFromDispatch = r.distanceM >= farThresholdM && r.distanceM > nearThresholdM + 1;
    const needsSlottingAttention = (abc === "A" || r.curvaACount > 0) && isFarFromDispatch;
    areaMetrics[r.key] = {
      score: r.score,
      heat: r.score > 0 ? Math.min(1, r.score / maxAreaScore) : 0,
      abc,
      skus: r.skus,
      curvaACount: r.curvaACount,
      curvaBCount: r.curvaBCount,
      distancePct: r.distancePct,
      distanceM: r.distanceM,
      isFarFromDispatch,
      needsSlottingAttention,
      topItems: r.topItems.map((t) => ({
        id: t.item.id,
        product_code: t.item.product_code,
        product_name: t.item.product_name,
        score: t.score,
        abc: itemMetrics[t.key]?.abc || "C",
      })),
    };
  });

  // Áreas candidatas próximas da expedição (para receber itens Curva A distantes)
  const candidateTargets = shelfRows
    .filter((r) => r.distanceM <= farThresholdM)
    .sort((a, b) => {
      // Prioriza mais perto da expedição, depois menor concentração de Curva A
      const distDiff = a.distanceM - b.distanceM;
      if (Math.abs(distDiff) > 2) return distDiff;
      return a.curvaACount - b.curvaACount || a.skus - b.skus;
    });

  // Sugestões de Slotting: itens Curva A que estão longe da expedição
  const farHotItems = itemRows
    .filter((r) => {
      const m = itemMetrics[r.key];
      return r.area && r.area.area_type === "prateleira" && m?.abc === "A" && r.distanceM >= farThresholdM;
    })
    .sort((a, b) => b.score * b.distanceM - a.score * a.distanceM);

  const suggestions = [];
  farHotItems.forEach((r, idx) => {
    const target = candidateTargets.find(
      (t) => String(t.area.id) !== String(r.area.id) && t.distanceM + 2 < r.distanceM
    );
    if (!target) return;
    const savedDistanceM = Math.round((r.distanceM - target.distanceM) * 10) / 10;
    const savedPct = r.distanceM > 0 ? Math.round((savedDistanceM / r.distanceM) * 100) : 0;
    if (savedPct < 15) return;

    suggestions.push({
      id: `slot-${r.item.id}-${idx}`,
      item: r.item,
      productCode: r.item.product_code,
      productName: r.item.product_name || r.item.product_code,
      abc: "A",
      score: r.score,
      signals: r.signals,
      fromArea: r.area,
      fromDistanceM: r.distanceM,
      toArea: target.area,
      toDistanceM: target.distanceM,
      savedDistanceM,
      savedPct,
      impactScore: Math.round(r.score * savedDistanceM),
      reason: buildSuggestionReason(r),
    });
  });

  const curvaATotal = itemRows.filter((r) => itemMetrics[r.key]?.abc === "A").length;
  const curvaAFarCount = farHotItems.length;
  const avgSavedPct =
    suggestions.length > 0
      ? Math.round(suggestions.reduce((s, x) => s + x.savedPct, 0) / suggestions.length)
      : 0;

  return {
    origin,
    areaMetrics,
    itemMetrics,
    suggestions: suggestions.slice(0, 20),
    summary: {
      totalShelves: shelves.length,
      totalItems: items.length,
      curvaATotal,
      curvaAFarCount,
      suggestionsCount: suggestions.length,
      avgSavedPct,
      farThresholdM: Math.round(farThresholdM * 10) / 10,
    },
  };
}

function buildSuggestionReason(r) {
  const parts = [];
  if (r.signals.shortages > 0) parts.push(`${r.signals.shortages} falta(s) em separação`);
  if (r.signals.scans > 0) parts.push(`${r.signals.scans} bip(s) recentes`);
  if (r.signals.history > 0) parts.push(`${r.signals.history} mov. no mapa`);
  if (parts.length === 0) parts.push("alto giro / Curva A");
  return `${parts.join(" · ")} a ${r.distanceM}m da expedição`;
}

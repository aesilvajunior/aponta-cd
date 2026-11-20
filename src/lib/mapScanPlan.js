// ============================================================
// Decisão pura: o que fazer com um bip, dado o que já existe no mapa,
// + Roteirização de Escaneamento/Picking (serpentina por corredor/nível).
// (sem banco; testada em __tests__/mapScanPlan.test.js)
// ============================================================

const norm = (v) => (v === null || v === undefined ? "" : String(v).trim().toUpperCase());

// Procura, no mesmo endereço (área + lado + posição + nível), o mesmo produto.
export function findExistingItem(items, { areaId, side, slot, level, barcode, productCode }) {
  return (
    items.find(
      (it) =>
        String(it.area_id) === String(areaId) &&
        norm(it.side) === norm(side) &&
        norm(it.slot) === norm(slot) &&
        norm(it.level) === norm(level) &&
        ((barcode && norm(it.barcode) === norm(barcode)) ||
          (productCode && norm(it.product_code) === norm(productCode)) ||
          (barcode && norm(it.product_code) === norm(barcode)))
    ) || null
  );
}

// mode: "registrar" (o bip só diz "este produto mora aqui")
//       "contar"    (cada bip soma 1 unidade)
export function planScan({ items, area, side, slot, level, barcode, catalog, mode = "registrar", operator, now = new Date() }) {
  const productCode = catalog?.product_code || barcode;
  const existing = findExistingItem(items, { areaId: area.id, side, slot, level, barcode, productCode });
  const stamp = { counted_at: now.toISOString(), counted_by: operator?.code || null };

  if (existing) {
    if (mode === "contar") {
      return {
        action: "contou",
        quantityDelta: 1,
        itemId: existing.id,
        update: { quantity: (Number(existing.quantity) || 0) + 1, barcode: existing.barcode || barcode, ...stamp },
      };
    }
    return { action: "ja_existia", quantityDelta: 0, itemId: existing.id, update: { barcode: existing.barcode || barcode, ...stamp } };
  }

  return {
    action: "adicionou",
    quantityDelta: mode === "contar" ? 1 : 0,
    insert: {
      area_id: area.id,
      side: area.has_sides ? side || null : null,
      slot: slot || null,
      level: level || null,
      barcode,
      product_code: productCode,
      product_name: catalog?.product_name || null,
      category: catalog?.category || null,
      quantity: mode === "contar" ? 1 : 0,
      source: "coleta",
      ...stamp,
    },
  };
}

// Produtos que entraram só com o código de barras (sem nome): lista para o admin completar.
export function itemsWithoutName(items) {
  return items.filter((it) => it.source === "coleta" && !it.product_name);
}

// ============================================================
// Roteirização de Escaneamento / Picking (Serpentina por Corredor/Nível)
// Evita ir e voltar no mesmo corredor:
//  - Agrupa por andar -> corredor/rua (ordem natural ou espacial)
//  - Alterna sentido dos corredores (ida: slot crescente; volta: slot decrescente)
//  - Dentro da mesma posição (vão), ordena por lado e nível (1 -> 4)
// ============================================================

function parseFloorIdx(floor) {
  const s = String(floor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s || s.includes("terreo") || s.includes("terrea") || s === "0") return 0;
  const m = s.match(/\d+/);
  if (m) return Number(m[0]);
  if (s.includes("super") || s.includes("mezanin")) return 1;
  return 0;
}

function parseNumeric(val, fallback = 0) {
  const m = String(val ?? "").match(/\d+/);
  return m ? Number(m[0]) : fallback;
}

// Extrai chave estruturada do endereço para ordenação e cálculo de distância
export function parseAddressKey(stop, areaById = new Map()) {
  const area =
    stop.area ||
    areaById.get(String(stop.area_id ?? stop.areaId ?? "")) ||
    null;

  const areaCode = norm(stop.area_code || stop.areaCode || area?.code || "");
  const floorIdx = parseFloorIdx(stop.floor ?? area?.floor);

  // Extrai número do corredor/rua do código (ex.: "R1D" -> 1, "2V" -> 2, "C03" -> 3)
  const corridorMatch = areaCode.match(/([A-Z]*)(\d+)([A-Z]*)/);
  const corridorPrefix = corridorMatch ? corridorMatch[1] : areaCode;
  const corridorNum = corridorMatch ? Number(corridorMatch[2]) : 9999;
  const corridorSuffix = corridorMatch ? corridorMatch[3] : "";
  const corridorKey = corridorMatch ? `${corridorPrefix}${corridorNum}` : areaCode || "GERAL";

  const sideNorm = norm(stop.side);
  const sideOrder = sideNorm === "IMPAR" || sideNorm === "ÍMPAR" ? 0 : sideNorm === "PAR" ? 1 : 2;
  const slotNum = parseNumeric(stop.slot, 0);
  const levelNum = parseNumeric(stop.level, 1);

  // Coordenadas espaciais aproximadas (em metros virtuais no CD) para estimar economia
  const baseX = area ? (Number(area.x) || 0) + (Number(area.width) || 0) / 2 : corridorNum * 6;
  const baseY = area ? (Number(area.y) || 0) + (Number(area.height) || 0) / 2 : slotNum * 2;

  return {
    floorIdx,
    corridorKey,
    corridorPrefix,
    corridorNum,
    corridorSuffix,
    areaCode,
    sideOrder,
    slotNum,
    levelNum,
    x: baseX,
    y: baseY,
  };
}

export function routeStopKey(stop) {
  return [
    String(stop.id || ""),
    String(stop.area_id ?? stop.areaId ?? stop.area_code ?? stop.areaCode ?? ""),
    norm(stop.side),
    norm(stop.slot),
    norm(stop.level),
    norm(stop.product_code ?? stop.productCode),
  ].join("|");
}

function estimateStepDistance(a, b) {
  if (!a || !b) return 0;
  const floorPenalty = Math.abs(a.floorIdx - b.floorIdx) * 25;
  const slotTravel = Math.abs(a.slotNum - b.slotNum) * 1.5;
  if (a.corridorKey === b.corridorKey && a.floorIdx === b.floorIdx) {
    // Mesmo corredor: anda ao longo das posições (slot) + pequeno custo vertical de nível
    return slotTravel + Math.abs(a.levelNum - b.levelNum) * 0.2;
  }
  // Troca de corredor: travessia entre corredores + diferença longitudinal de posição (slot)
  // Assim, sair no fim de R1 (slot 10) e entrar no fim de R2 (slot 9) em serpentina custa muito menos
  // do que atravessar o corredor inteiro até o slot 1.
  const crossAisle =
    Math.abs(a.x - b.x) > 0
      ? Math.abs(a.x - b.x) * 0.4
      : Math.max(4, Math.abs(a.corridorNum - b.corridorNum) * 5);
  return floorPenalty + Math.max(3, crossAisle) + slotTravel;
}

function countBacktracks(keys) {
  let backtracks = 0;
  const visitedCorridors = new Set();
  let prevCorridor = null;
  let prevSlot = null;
  let dir = 0;

  for (const k of keys) {
    const corr = `${k.floorIdx}:${k.corridorKey}`;
    if (prevCorridor && corr !== prevCorridor) {
      if (visitedCorridors.has(corr)) backtracks += 1; // voltou a um corredor já visitado
      visitedCorridors.add(prevCorridor);
      dir = 0;
    } else if (prevCorridor === corr && prevSlot !== null && k.slotNum !== prevSlot) {
      const stepDir = k.slotNum > prevSlot ? 1 : -1;
      if (dir !== 0 && stepDir !== dir) backtracks += 1; // inverteu sentido dentro do mesmo corredor
      dir = stepDir;
    }
    prevCorridor = corr;
    prevSlot = k.slotNum;
  }
  return backtracks;
}

/**
 * Gera uma rota otimizada (serpentina S-shape) para escaneamento ou picking.
 *
 * @param {Array} stops - lista de paradas ({ id?, area_id, area_code, side, slot, level, product_code, ... })
 * @param {Array} areas - áreas do mapa (stock_map_areas) para coordenadas/andar
 * @param {Object} opts - { serpentine: true, levelDirection: "asc" | "desc" }
 */
export function buildOptimizedScanRoute(stops = [], areas = [], { serpentine = true, levelDirection = "asc" } = {}) {
  if (!Array.isArray(stops) || stops.length === 0) {
    return {
      orderedStops: [],
      corridors: [],
      totalDistance: 0,
      naiveDistance: 0,
      savedPct: 0,
      backtracksAvoided: 0,
    };
  }

  const areaById = new Map((areas || []).map((a) => [String(a.id), a]));
  const enriched = stops.map((stop, originalIndex) => ({
    stop,
    originalIndex,
    key: parseAddressKey(stop, areaById),
  }));

  // Distância e vai-e-voltas na ordem original (sem roteirização)
  let naiveDistance = 0;
  for (let i = 1; i < enriched.length; i++) {
    naiveDistance += estimateStepDistance(enriched[i - 1].key, enriched[i].key);
  }
  const naiveBacktracks = countBacktracks(enriched.map((e) => e.key));

  // Agrupa por andar -> corredor
  const groups = new Map();
  enriched.forEach((entry) => {
    const groupId = `${entry.key.floorIdx}|${entry.key.corridorKey}`;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        floorIdx: entry.key.floorIdx,
        corridorKey: entry.key.corridorKey,
        corridorPrefix: entry.key.corridorPrefix,
        corridorNum: entry.key.corridorNum,
        avgX: 0,
        entries: [],
      });
    }
    groups.get(groupId).entries.push(entry);
  });

  // Ordena corredores por andar, número natural do corredor e código
  const sortedCorridors = [...groups.values()].sort((a, b) => {
    if (a.floorIdx !== b.floorIdx) return a.floorIdx - b.floorIdx;
    if (a.corridorNum !== b.corridorNum) return a.corridorNum - b.corridorNum;
    return a.corridorKey.localeCompare(b.corridorKey, "pt-BR", { numeric: true });
  });

  const orderedEnriched = [];
  const corridorSummaries = [];

  sortedCorridors.forEach((corr, corrIdx) => {
    // Serpentina: corredores pares vão crescente (ida), ímpares decrescente (volta)
    const reverseSlots = serpentine && corrIdx % 2 === 1;
    const direction = reverseSlots ? "volta" : "ida";

    const sortedInCorridor = [...corr.entries].sort((a, b) => {
      const slotDiff = reverseSlots
        ? b.key.slotNum - a.key.slotNum
        : a.key.slotNum - b.key.slotNum;
      if (slotDiff !== 0) return slotDiff;

      // Mesmo vão: área/lado -> nível
      const codeDiff = a.key.areaCode.localeCompare(b.key.areaCode, "pt-BR", { numeric: true });
      if (codeDiff !== 0) return codeDiff;

      if (a.key.sideOrder !== b.key.sideOrder) return a.key.sideOrder - b.key.sideOrder;

      return levelDirection === "desc"
        ? b.key.levelNum - a.key.levelNum
        : a.key.levelNum - b.key.levelNum;
    });

    corridorSummaries.push({
      corridorKey: corr.corridorKey,
      floorIdx: corr.floorIdx,
      direction,
      count: sortedInCorridor.length,
    });

    sortedInCorridor.forEach((item) => orderedEnriched.push({ ...item, direction }));
  });

  // Calcula distância total da rota otimizada
  let totalDistance = 0;
  const orderedStops = orderedEnriched.map((item, idx) => {
    const stepDist = idx === 0 ? 0 : estimateStepDistance(orderedEnriched[idx - 1].key, item.key);
    totalDistance += stepDist;
    return {
      ...item.stop,
      routeKey: routeStopKey(item.stop),
      stepIndex: idx + 1,
      corridorKey: item.key.corridorKey,
      floorIdx: item.key.floorIdx,
      direction: item.direction,
      distanceFromPrev: Math.round(stepDist * 10) / 10,
    };
  });

  const optimizedBacktracks = countBacktracks(orderedEnriched.map((e) => e.key));
  const backtracksAvoided = Math.max(0, naiveBacktracks - optimizedBacktracks);
  const roundedTotal = Math.round(totalDistance * 10) / 10;
  const roundedNaive = Math.round(naiveDistance * 10) / 10;
  const savedPct =
    roundedNaive > 0
      ? Math.max(0, Math.round(((roundedNaive - roundedTotal) / roundedNaive) * 100))
      : 0;

  return {
    orderedStops,
    corridors: corridorSummaries,
    totalDistance: roundedTotal,
    naiveDistance: roundedNaive,
    savedPct,
    backtracksAvoided,
  };
}

// Retorna a próxima parada ainda não concluída na sequência otimizada
export function nextRouteStop(route, completedKeys = new Set()) {
  const done = completedKeys instanceof Set ? completedKeys : new Set(completedKeys || []);
  return (route?.orderedStops || []).find((s) => !done.has(s.routeKey)) || null;
}

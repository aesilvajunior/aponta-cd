// ============================================================
// Mapa 3D: conversão do desenho 2D (áreas em % de um quadro de 100x100) para
// metros, e posição de cada prateleira/produto. Funções puras (sem WebGL),
// testadas em __tests__/map3dLayout.test.js.
// Eixos (iguais aos do glTF/Blender exportado em Y-up):
//   X = esquerda→direita do mapa 2D · Z = cima→baixo do mapa 2D · Y = altura.
// ============================================================

export const DEFAULT_3D_CONFIG = {
  widthM: 60,        // largura real do galpão (corresponde a x = 0..100%)
  depthM: 45,        // profundidade real do galpão (y = 0..100%)
  floorHeightM: 4.5, // altura entre andares
  levels: 4,         // níveis (prateleiras) de cada estante
  bayM: 1.2,         // largura de cada vão da estante
  shell: { url: "/models/cd-shell.glb", scale: 1, offsetX: 0, offsetY: 0, offsetZ: 0, rotationY: 0 },
};

export function mergeConfig(saved) {
  const base = DEFAULT_3D_CONFIG;
  return { ...base, ...(saved || {}), shell: { ...base.shell, ...(saved?.shell || {}) } };
}

// "terreo" -> 0, "1"/"1o andar" -> 1, "super"/"mezanino" -> 1, desconhecido -> 0
export function floorIndex(floor) {
  const s = String(floor ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!s || s.includes("terreo") || s.includes("terrea") || s === "0") return 0;
  const digit = s.match(/\d+/);
  if (digit) return Number(digit[0]);
  if (s.includes("super") || s.includes("mezanin") || s.includes("superior")) return 1;
  return 0;
}

// Retângulo da área em metros (centro + tamanho), com altura do andar.
export function areaToMeters(area, cfg = DEFAULT_3D_CONFIG) {
  const w = Math.max(0.5, (Number(area.width) / 100) * cfg.widthM);
  const d = Math.max(0.5, (Number(area.height) / 100) * cfg.depthM);
  const x = (Number(area.x) / 100) * cfg.widthM + w / 2 - cfg.widthM / 2; // origem no centro do galpão
  const z = (Number(area.y) / 100) * cfg.depthM + d / 2 - cfg.depthM / 2;
  const floor = floorIndex(area.floor);
  return { x, z, w, d, floor, y: floor * cfg.floorHeightM };
}

// Cor estável por categoria (mesma categoria = mesma cor)
export function categoryColor(category) {
  const s = String(category || "Sem categoria");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return { h, s: 55, l: 55 };
}

function slotNumber(slot) {
  const m = String(slot ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

function levelNumber(level, maxLevels) {
  const n = Number(String(level ?? "").match(/\d+/)?.[0]);
  if (!Number.isFinite(n) || n < 1) return 1; // sem nível informado: fica no primeiro
  return Math.min(n, maxLevels);
}

// Geometria da estante de uma área: comprimento ao longo do lado maior.
export function rackGeometry(area, cfg = DEFAULT_3D_CONFIG) {
  const m = areaToMeters(area, cfg);
  const alongX = m.w >= m.d;
  const length = alongX ? m.w : m.d;
  const thickness = alongX ? m.d : m.w;
  const bays = Math.max(1, Math.round(length / cfg.bayM));
  return { ...m, alongX, length, thickness, bays, levels: cfg.levels, shelfTopY: m.y };
}

// Posição de cada produto da estante (centro da caixa) + tamanho.
// Lado "par" fica na metade positiva (direita), "ímpar" na negativa (esquerda).
export function layoutItems(area, items, cfg = DEFAULT_3D_CONFIG) {
  const g = rackGeometry(area, cfg);
  const levelH = Math.min(1.2, (cfg.floorHeightM - 0.6) / cfg.levels);
  const hasSides = !!area.has_sides && g.thickness > 0.8;

  // agrupa por lado + nível
  const groups = new Map();
  items.forEach((it) => {
    const side = hasSides ? (it.side === "impar" ? "impar" : "par") : "uni";
    const level = levelNumber(it.level, cfg.levels);
    const key = `${side}|${level}`;
    if (!groups.has(key)) groups.set(key, { side, level, list: [] });
    groups.get(key).list.push(it);
  });

  const out = [];
  groups.forEach(({ side, level, list }) => {
    // ordena por posição (slot numérico) e distribui pelos vãos
    const ordered = [...list].sort((a, b) => (slotNumber(a.slot) ?? 1e9) - (slotNumber(b.slot) ?? 1e9));
    const perBay = new Map();
    ordered.forEach((it, idx) => {
      const n = slotNumber(it.slot);
      const bay = n ? Math.min(g.bays, n) - 1 : Math.min(g.bays - 1, Math.floor((idx / ordered.length) * g.bays));
      if (!perBay.has(bay)) perBay.set(bay, []);
      perBay.get(bay).push(it);
    });

    perBay.forEach((inBay, bay) => {
      const bayLen = g.length / g.bays;
      inBay.forEach((it, k) => {
        const u = -g.length / 2 + bay * bayLen + ((k + 0.5) / inBay.length) * bayLen; // ao longo
        const faceW = hasSides ? g.thickness / 2 : g.thickness;
        const v = side === "par" ? faceW / 2 : side === "impar" ? -faceW / 2 : 0; // atravessado
        const qty = Math.max(1, Number(it.quantity) || 1);
        const boxH = Math.min(levelH * 0.85, 0.18 + Math.sqrt(qty) * 0.04);
        const boxU = Math.min(bayLen / inBay.length, 1.0) * 0.8;
        const boxV = Math.min(faceW, 0.9) * 0.85;
        const size = g.alongX ? [boxU, boxH, boxV] : [boxV, boxH, boxU];
        const px = g.x + (g.alongX ? u : v);
        const pz = g.z + (g.alongX ? v : u);
        const py = g.y + 0.1 + (level - 1) * levelH + boxH / 2;
        out.push({ item: it, position: [px, py, pz], size, level, side });
      });
    });
  });
  return out;
}

// Quais itens combinam com a busca (código, nome, código de barras).
export function matchItems(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return items.filter(
    (it) =>
      String(it.product_code || "").toLowerCase().includes(q) ||
      String(it.product_name || "").toLowerCase().includes(q) ||
      String(it.barcode || "").toLowerCase().includes(q)
  );
}

// JSON para o Blender: cada área em metros (origem no centro do galpão).
export function exportForBlender(areas, cfg = DEFAULT_3D_CONFIG) {
  return {
    versao: 1,
    unidade: "metros",
    eixos: "x=direita, y=altura, z=frente (como no glTF)",
    galpao: { larguraM: cfg.widthM, profundidadeM: cfg.depthM, alturaAndarM: cfg.floorHeightM, niveis: cfg.levels },
    areas: areas.map((a) => {
      const m = areaToMeters(a, cfg);
      return {
        codigo: a.code,
        nome: a.label,
        tipo: a.area_type,
        andar: m.floor,
        temLados: !!a.has_sides,
        centroX: round(m.x), centroZ: round(m.z), alturaBaseY: round(m.y),
        larguraX: round(m.w), profundidadeZ: round(m.d),
      };
    }),
  };
}

const round = (n) => Math.round(n * 1000) / 1000;

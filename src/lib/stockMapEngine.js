// ============================================================
// Motor do mapa v4 — agora só cuida do "view" (zoom / rotação / pan)
// do Stage do Konva.
//
// Antes desse arquivo tinha handTest, pointInRect, screenToWorld,
// screenDeltaToWorldDelta etc. — tudo reimplementando na mão o que o
// Konva já resolve de forma correta e testada: arrastar forma, detectar
// clique, redimensionar com Transformer. Isso elimina de vez a classe de
// bug que a versão anterior tinha (mover uma área dava errado quando o
// mapa estava rotacionado).
//
// O que sobra aqui é só matemática pura de câmera: zoom/rotação/pan do
// Stage como um todo, incluindo "zoom no cursor" e "pinça com 2 dedos"
// (que precisam saber ONDE na tela o gesto aconteceu pra não fazer o
// mapa "escapar" debaixo do dedo/cursor).
// ============================================================

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 6;
export const ZOOM_STEP = 0.25;
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;

// Unidade de "mundo" onde as áreas vivem — 4:3, mesma proporção que o
// container sempre teve (padding-bottom: 75%). x/y/width/height das áreas
// continuam gravados em % (0-100) no Supabase; só a camada de desenho
// converte pra essas unidades.
export const WORLD_W = 1000;
export const WORLD_H = 750;

// ---------- Estado inicial ----------

export function createInitialView() {
  return { zoom: 1, rotation: 0, panX: 0, panY: 0 };
}

// ---------- Zoom ----------

export function clampZoom(z) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function zoomIn(view) {
  return { ...view, zoom: clampZoom(view.zoom + ZOOM_STEP) };
}

export function zoomOut(view) {
  return { ...view, zoom: clampZoom(view.zoom - ZOOM_STEP) };
}

// ---------- Pan ----------

export function panBy(view, dx, dy) {
  return { ...view, panX: view.panX + dx, panY: view.panY + dy };
}

// ---------- Rotação ----------

export function rotateBy(view, deg) {
  let r = view.rotation + deg;
  while (r > 180) r -= 360;
  while (r < -180) r += 360;
  return { ...view, rotation: r };
}

export function rotateTo(view, deg) {
  return { ...view, rotation: deg };
}

// ---------- Reset ----------

export function resetView(view) {
  return { ...view, zoom: 1, rotation: 0, panX: 0, panY: 0 };
}

// ---------- Conversão % (Supabase) <-> unidades de mundo (Konva) ----------

export function areaToWorld(a) {
  return {
    x: (a.x / 100) * WORLD_W,
    y: (a.y / 100) * WORLD_H,
    width: (a.width / 100) * WORLD_W,
    height: (a.height / 100) * WORLD_H,
  };
}

export function worldToAreaPct(rect) {
  return {
    x: (rect.x / WORLD_W) * 100,
    y: (rect.y / WORLD_H) * 100,
    width: (rect.width / WORLD_W) * 100,
    height: (rect.height / WORLD_H) * 100,
  };
}

// ---------- Zoom/rotação com pivô fixo na tela ----------

function rotateVector(v, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

// Recalcula panX/panY pra manter um ponto (pivotX, pivotY, em pixels do
// container) fixo na tela enquanto zoom e/ou rotação mudam. Usado no
// scroll do mouse (zoom no cursor) e no gesto de pinça com dois dedos
// (zoom + rotação ao mesmo tempo). Sem isso o mapa "foge" do cursor/dedo
// a cada zoom.
export function repositionForTransform({
  view,
  pivotX,
  pivotY,
  containerWidth,
  containerHeight,
  baseScale,
  newZoom,
  newRotation,
}) {
  const oldScale = baseScale * view.zoom;
  const newScale = baseScale * newZoom;
  const oldStageX = containerWidth * (0.5 + view.panX);
  const oldStageY = containerHeight * (0.5 + view.panY);
  const angleDelta = newRotation - view.rotation;

  const rel = rotateVector({ x: pivotX - oldStageX, y: pivotY - oldStageY }, angleDelta);
  const scaleRatio = newScale / oldScale;

  const newStageX = pivotX - scaleRatio * rel.x;
  const newStageY = pivotY - scaleRatio * rel.y;

  return {
    ...view,
    zoom: newZoom,
    rotation: newRotation,
    panX: newStageX / containerWidth - 0.5,
    panY: newStageY / containerHeight - 0.5,
  };
}

// ---------- Touch (pinça de 2 dedos) ----------

export function createTouchState() {
  return {
    active: false,
    initialDistance: 0,
    initialAngle: 0,
    initialZoom: 1,
    initialRotation: 0,
    midpoint: { x: 0, y: 0 },
  };
}

export function distanceBetween(t1, t2) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(t1, t2) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function midpointBetween(t1, t2, containerRect) {
  return {
    x: (t1.clientX + t2.clientX) / 2 - containerRect.left,
    y: (t1.clientY + t2.clientY) / 2 - containerRect.top,
  };
}

// ============================================================
// Motor do mapa — zoom, pan, rotação, touch, teclado
// Inspirado em Google Maps / Apple Maps
// ============================================================

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 6;
export const ZOOM_STEP = 0.25;

export const MIN_ROTATION = -360;
export const MAX_ROTATION = 360;

// ---------- Estado inicial ----------

export function createInitialView() {
  return {
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
  };
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

// Zoom centrado no cursor (coordenada 0-1 do container)
export function zoomAt(view, deltaZoom, pivotX, pivotY) {
  const newZoom = clampZoom(view.zoom + deltaZoom);
  const scale = newZoom / view.zoom;

  // ponto de referência no espaço do "mundo"
  const worldX = (pivotX - 0.5) - view.panX / view.zoom;
  const worldY = (pivotY - 0.5) - view.panY / view.zoom;

  const newPanX = view.panX + worldX * view.zoom * (1 - scale) * -1;
  const newPanY = view.panY + worldY * view.zoom * (1 - scale) * -1;

  return {
    ...view,
    zoom: newZoom,
    panX: newPanX,
    panY: newPanY,
  };
}

// ---------- Pan ----------

export function panBy(view, dx, dy) {
  return {
    ...view,
    panX: view.panX + dx,
    panY: view.panY + dy,
  };
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
  return {
    ...view,
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
  };
}

// ---------- CSS Transform ----------

export function getTransform(view) {
  return `translate(${view.panX * 100}%, ${view.panY * 100}%) scale(${view.zoom}) rotate(${view.rotation}deg)`;
}

// ---------- Coordenadas ----------

// Converte % do container para coordenada de "mundo" (antes de rotação/escala)
export function screenToWorld(view, screenX, screenY) {
  const cx = 0.5;
  const cy = 0.5;
  const dx = screenX - cx - view.panX;
  const dy = screenY - cy - view.panY;
  const rad = (-view.rotation * Math.PI) / 180;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  return {
    x: rx / view.zoom + cx,
    y: ry / view.zoom + cy,
  };
}

// Verifica se um ponto (em %) está dentro de um retângulo
export function pointInRect(x, y, rect) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

// Encontra a área clicada (de cima pra baixo)
export function hitTest(areas, worldPoint) {
  for (let i = areas.length - 1; i >= 0; i--) {
    if (pointInRect(worldPoint.x, worldPoint.y, areas[i])) {
      return areas[i];
    }
  }
  return null;
}

// ---------- Viewport visível (útil pro minimap) ----------

export function getVisibleBounds(view) {
  const halfW = 0.5 / view.zoom;
  const halfH = 0.5 / view.zoom;
  return {
    x: 0.5 - halfW - view.panX / view.zoom,
    y: 0.5 - halfH - view.panY / view.zoom,
    width: halfW * 2,
    height: halfH * 2,
  };
}

// ---------- Detecção de gesto touch ----------

export function createTouchState() {
  return {
    touches: [],
    initialDistance: 0,
    initialAngle: 0,
    initialZoom: 1,
    initialRotation: 0,
    active: false,
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

// ---------- Constantes de interação ----------

export const DOUBLE_CLICK_DELAY = 260;
export const PAN_THRESHOLD_PX = 5; // pra diferenciar click de drag
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;
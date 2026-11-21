import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Line, Circle, Transformer } from "react-konva";
import Konva from "konva";
import {
  fetchMapAreas,
  addMapArea,
  updateMapArea,
  deleteMapArea,
  fetchMapItems,
  updateMapItem,
  deleteMapItem,
  AREA_TYPES,
  MAP_OBJECT_PRESETS,
  colorForType,
  labelForType,
  getAreaRotation,
  withAreaRotation,
  normalizeRotation,
  resolveSpecialAreaKind,
  groupItemsBySide,
  groupItemsByCategory,
  summarizeArea,
} from "../lib/stockMap";
import { floorIndex } from "../lib/map3dLayout";
import { logStockMapAction, fetchStockMapHistory, fetchConferenceHistory } from "../lib/api";
import { fetchRecentScans } from "../lib/mapScan";
import { computeSlottingAnalysis, heatmapColor, abcColor } from "../lib/slotting";
import {
  createInitialView,
  zoomIn,
  zoomOut,
  panBy,
  rotateBy,
  rotateTo,
  resetView,
  clampZoom,
  createTouchState,
  distanceBetween,
  angleBetween,
  midpointBetween,
  repositionForTransform,
  areaToWorld,
  worldToAreaPct,
  WORLD_W,
  WORLD_H,
  WHEEL_ZOOM_SENSITIVITY,
} from "../lib/stockMapEngine";
import { supabase } from "../supabaseClient";
import StockMapControls from "./StockMapControls";
import StockMapItemPicker from "./StockMapItemPicker";
import {
  IconSearch,
  IconEdit,
  IconTrash,
  IconX,
  IconPlus,
  IconGrid,
  IconList,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
} from "./Icons";

function occupancyColor(ratio) {
  if (ratio < 0.01) return "#94a3b8";
  if (ratio < 0.4) return "#4a7ba7";
  if (ratio < 0.7) return "#f59e0b";
  if (ratio < 0.9) return "#ef4444";
  return "#7f1d1d";
}

const SPECIAL_COLORS = {
  escada: "#7c3aed",
  elevador: "#4f46e5",
  conferencia_pedidos: "#10b981",
  conferencia_transferencia: "#0284c7",
  carro_apoio: "#d97706",
};

function renderSpecialAreaDetails(kind, world, alpha) {
  const { x, y, width: w, height: h } = world;
  if (w < 10 || h < 10) return null;

  if (kind === "escada") {
    const horizontal = w >= h;
    const steps = Math.max(4, Math.min(10, Math.floor((horizontal ? w : h) / 14)));
    const lines = [];
    for (let i = 1; i < steps; i++) {
      const frac = i / steps;
      const pts = horizontal
        ? [x + w * frac, y + 3, x + w * frac, y + h - 3]
        : [x + 3, y + h * frac, x + w - 3, y + h * frac];
      lines.push(
        <Line
          key={`step-${i}`}
          points={pts}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.3}
          opacity={alpha}
          listening={false}
          perfectDrawEnabled={false}
        />
      );
    }
    const cx = x + w / 2;
    const cy = y + h / 2;
    const arrowPts = horizontal
      ? [x + w * 0.18, cy, x + w * 0.82, cy]
      : [cx, y + h * 0.82, cx, y + h * 0.18];
    const headPts = horizontal
      ? [x + w * 0.72, cy - 5, x + w * 0.82, cy, x + w * 0.72, cy + 5]
      : [cx - 5, y + h * 0.28, cx, y + h * 0.18, cx + 5, y + h * 0.28];
    return (
      <>
        {lines}
        <Line points={arrowPts} stroke="rgba(255,255,255,0.7)" strokeWidth={1.6} opacity={alpha} listening={false} perfectDrawEnabled={false} />
        <Line points={headPts} stroke="rgba(255,255,255,0.7)" strokeWidth={1.6} opacity={alpha} listening={false} perfectDrawEnabled={false} />
      </>
    );
  }

  if (kind === "elevador") {
    const pad = Math.min(w, h) * 0.14;
    const ix = x + pad;
    const iy = y + pad;
    const iw = Math.max(4, w - pad * 2);
    const ih = Math.max(4, h - pad * 2);
    return (
      <>
        <Rect
          x={ix}
          y={iy}
          width={iw}
          height={ih}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.4}
          cornerRadius={3}
          opacity={alpha}
          listening={false}
          perfectDrawEnabled={false}
        />
        <Line
          points={[ix, iy, ix + iw, iy + ih]}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={1}
          opacity={alpha}
          listening={false}
          perfectDrawEnabled={false}
        />
        <Line
          points={[ix + iw, iy, ix, iy + ih]}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={1}
          opacity={alpha}
          listening={false}
          perfectDrawEnabled={false}
        />
        <Line
          points={[x + w / 2, y + 3, x + w / 2, y + pad]}
          stroke="rgba(255,255,255,0.75)"
          strokeWidth={2}
          opacity={alpha}
          listening={false}
          perfectDrawEnabled={false}
        />
        {h > 34 && (
          <Text
            x={x}
            y={y + 4}
            width={w}
            align="center"
            text="⇅ ELEVADOR"
            fontSize={8.5}
            fontStyle="700"
            fill="rgba(255,255,255,0.8)"
            opacity={alpha}
            listening={false}
          />
        )}
      </>
    );
  }

  if (kind === "conferencia_pedidos" || kind === "conferencia_transferencia") {
    const isTransf = kind === "conferencia_transferencia";
    const pad = 4;
    return (
      <>
        <Rect
          x={x + pad}
          y={y + pad}
          width={Math.max(4, w - pad * 2)}
          height={Math.max(4, h - pad * 2)}
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.2}
          dash={isTransf ? [5, 3] : undefined}
          cornerRadius={4}
          opacity={alpha}
          listening={false}
          perfectDrawEnabled={false}
        />
        {h > 36 && (
          <Text
            x={x}
            y={y + 6}
            width={w}
            align="center"
            text={isTransf ? "⇄ TRANSF." : "✓ PEDIDOS"}
            fontSize={8.5}
            fontStyle="700"
            fill="rgba(255,255,255,0.85)"
            opacity={alpha}
            listening={false}
          />
        )}
      </>
    );
  }

  if (kind === "carro_apoio") {
    const r = Math.max(2.5, Math.min(4.5, Math.min(w, h) * 0.08));
    const wheels = [
      [x + r + 2, y + r + 2],
      [x + w - r - 2, y + r + 2],
      [x + r + 2, y + h - r - 2],
      [x + w - r - 2, y + h - r - 2],
    ];
    return (
      <>
        {wheels.map(([wx, wy], idx) => (
          <Circle
            key={`wh-${idx}`}
            x={wx}
            y={wy}
            radius={r}
            fill="#0f172a"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={1.2}
            opacity={alpha}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}
        <Line
          points={[x + 4, y + 3, x + w - 4, y + 3]}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2.2}
          opacity={alpha}
          listening={false}
          perfectDrawEnabled={false}
        />
        {h > 34 && (
          <Text
            x={x}
            y={y + 7}
            width={w}
            align="center"
            text="APOIO"
            fontSize={8.5}
            fontStyle="700"
            fill="rgba(255,255,255,0.9)"
            opacity={alpha}
            listening={false}
          />
        )}
      </>
    );
  }

  return null;
}

const MIN_WORLD_W = 0.02 * WORLD_W;
const MIN_WORLD_H = 0.02 * WORLD_H;
const GRID_COLS = 20;
const GRID_ROWS = 15;

export default function StockMap({ isAdmin, onScanArea, focusAreaId, entries = [], shortages = [] }) {
  const [areas, setAreas] = useState([]);
  const [items, setItems] = useState([]);
  const [scans, setScans] = useState([]);
  const [mapHistory, setMapHistory] = useState([]);
  const [conferenceHistory, setConferenceHistory] = useState([]);
  const [slottingOpen, setSlottingOpen] = useState(false);
  const [relocatingId, setRelocatingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [view, setView] = useState(createInitialView());
  const [selectedArea, setSelectedArea] = useState(null);
  const [hoveredArea, setHoveredArea] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [activeFloor, setActiveFloor] = useState("all");
  const [extraFloors, setExtraFloors] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [panelView, setPanelView] = useState("lista");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Veio de outra tela (ex.: Mapa 3D "Ver no 2D"): já abre a área escolhida
  const appliedFocusRef = useRef(null);
  const [editingItem, setEditingItem] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, show: false });
  const [size, setSize] = useState({ width: 0, height: 0 });

  const [layers, setLayers] = useState({
    grid: true,
    labels: true,
    occupancy: true,
    heatmap: false,
    corridorFlow: true,
  });

  const [newAreaModal, setNewAreaModal] = useState(false);
  const [newAreaForm, setNewAreaForm] = useState({
    code: "", label: "", areaType: "prateleira", floor: "terreo",
    x: 40, y: 40, width: 10, height: 15, rotation: 0,
    hasSides: false,
  });
  const [areaBusy, setAreaBusy] = useState(false);

  const wrapperRef = useRef(null);
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const corridorLayerRef = useRef(null);
  const transformerRef = useRef(null);
  const shapeRefs = useRef({});
  const corridorLineRefs = useRef({});

  const viewRef = useRef(view);
  viewRef.current = view;
  const touchStateRef = useRef(createTouchState());

  // ---------- Auditoria ----------
  async function auditMap({ action, areaId, areaCode, beforeData, afterData }) {
    if (!isAdmin) return;
    try {
      await logStockMapAction({
        areaId,
        areaCode,
        action,
        beforeData,
        afterData,
        actorCode: "admin",
        actorName: "Admin",
      });
    } catch {}
  }

  async function loadAll() {
    setLoading(true);
    const [{ data: a, error: e1 }, { data: i, error: e2 }] = await Promise.all([
      fetchMapAreas(),
      fetchMapItems(),
    ]);
    if (e1 || e2) {
      setError((e1 || e2).message);
      setLoading(false);
      return;
    }
    setAreas(a || []);
    setItems(i || []);
    setError("");
    setLoading(false);

    // Dados de giro/movimentação para Mapa de Calor e Slotting (melhor esforço)
    Promise.all([
      fetchRecentScans({ limit: 500 }).catch(() => ({ data: [] })),
      fetchStockMapHistory({ limit: 500 }).catch(() => ({ data: [] })),
      fetchConferenceHistory({ limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([sc, hi, ch]) => {
      setScans(sc?.data || []);
      setMapHistory(hi?.data || []);
      setConferenceHistory(ch?.data || []);
    });
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("stock-map-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_map_areas" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_map_items" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    function measure() {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isFullscreen]);

  function toggleFullscreen() {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrapperRef.current.requestFullscreen?.();
  }

  function flashSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2500);
  }

  const itemsByArea = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      if (!map[it.area_id]) map[it.area_id] = [];
      map[it.area_id].push(it);
    });
    return map;
  }, [items]);

  const maxSkus = useMemo(() => {
    let max = 1;
    Object.values(itemsByArea).forEach((list) => {
      if (list.length > max) max = list.length;
    });
    return max;
  }, [itemsByArea]);

  useEffect(() => {
    if (!focusAreaId || areas.length === 0 || appliedFocusRef.current === focusAreaId) return;
    const a = areas.find((x) => String(x.id) === String(focusAreaId));
    if (a) {
      setSelectedArea(a);
      setPanelView("lista");
      appliedFocusRef.current = focusAreaId;
    }
  }, [focusAreaId, areas]);

  const slotting = useMemo(
    () =>
      computeSlottingAnalysis({
        areas,
        items,
        scans,
        shortages,
        history: mapHistory,
        entries,
        conferenceHistory,
      }),
    [areas, items, scans, shortages, mapHistory, entries, conferenceHistory]
  );

  async function handleApplySlotting(sug) {
    if (!isAdmin || !sug?.item || !sug?.toArea) return;
    if (!window.confirm(`Realocar ${sug.productCode} de ${sug.fromArea.code} para ${sug.toArea.code} (economia estimada de ${sug.savedPct}%)?`)) {
      return;
    }
    setRelocatingId(sug.id);
    const { error: err } = await updateMapItem(sug.item.id, { area_id: sug.toArea.id });
    setRelocatingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await auditMap({
      action: "slotting_move",
      areaId: sug.toArea.id,
      areaCode: sug.toArea.code,
      beforeData: { areaId: sug.fromArea.id, areaCode: sug.fromArea.code, productCode: sug.productCode },
      afterData: { areaId: sug.toArea.id, areaCode: sug.toArea.code, productCode: sug.productCode, savedPct: sug.savedPct },
    });
    await loadAll();
    flashSuccess(`${sug.productCode} movido para ${sug.toArea.code}`);
  }

  const floorOptions = useMemo(() => {
    const map = new Map([[0, "terreo"]]);
    areas.forEach((a) => {
      const idx = floorIndex(a.floor);
      if (!map.has(idx)) map.set(idx, a.floor || (idx === 0 ? "terreo" : `${idx}o_andar`));
    });
    extraFloors.forEach((fl) => {
      const idx = floorIndex(fl);
      if (!map.has(idx)) map.set(idx, fl);
    });
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, value]) => ({ idx, value, label: idx === 0 ? "Térreo" : `${idx}º andar` }));
  }, [areas, extraFloors]);

  const decoratedAreas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return areas
      .filter((a) => !filterType || a.area_type === filterType)
      .filter((a) => activeFloor === "all" || floorIndex(a.floor) === Number(activeFloor))
      .map((a) => {
        const list = itemsByArea[a.id] || [];
        const stats = summarizeArea(a, items);
        const occupancy = list.length / maxSkus;
        const heatMetric = slotting.areaMetrics[String(a.id)] || null;
        const matches =
          !q ||
          a.code.toLowerCase().includes(q) ||
          a.label.toLowerCase().includes(q) ||
          list.some(
            (it) =>
              it.product_code.toLowerCase().includes(q) ||
              (it.product_name || "").toLowerCase().includes(q) ||
              (it.category || "").toLowerCase().includes(q) ||
              (it.barcode || "").toLowerCase().includes(q)
          );
        return { ...a, stats, occupancy, heatMetric, matches, itemList: list };
      });
  }, [areas, itemsByArea, items, search, filterType, activeFloor, maxSkus, slotting.areaMetrics]);

  const baseScale = useMemo(() => {
    if (!size.width || !size.height) return 0;
    return Math.min(size.width / WORLD_W, size.height / WORLD_H);
  }, [size]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = editMode && selectedArea ? shapeRefs.current[selectedArea.id] : null;
    if (node) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [editMode, selectedArea, decoratedAreas]);

  useEffect(() => {
    const layer = corridorLayerRef.current;
    if (!layer) return;
    const dashPeriod = 24;
    const anim = new Konva.Animation((frame) => {
      const offset = -((frame.time / 35) % dashPeriod);
      Object.values(corridorLineRefs.current).forEach((node) => {
        if (node) node.dashOffset(offset);
      });
    }, layer);
    if (layers.corridorFlow) anim.start();
    return () => anim.stop();
  }, [layers.corridorFlow, decoratedAreas.length]);

  useEffect(() => {
    function onKeyDown(e) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") setSelectedArea(null);
      else if (e.key === "+" || e.key === "=") setView((v) => zoomIn(v));
      else if (e.key === "-" || e.key === "_") setView((v) => zoomOut(v));
      else if (e.key === "r" || e.key === "R") setView((v) => resetView(v));
      else if (e.key === "g") setView((v) => rotateBy(v, 90));
      else if (e.key === "G") setView((v) => rotateBy(v, -90));
      else if (e.key === "ArrowLeft") setView((v) => panBy(v, 0.05, 0));
      else if (e.key === "ArrowRight") setView((v) => panBy(v, -0.05, 0));
      else if (e.key === "ArrowUp") setView((v) => panBy(v, 0, 0.05));
      else if (e.key === "ArrowDown") setView((v) => panBy(v, 0, -0.05));
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const scaleLabel = useMemo(() => {
    const visibleWidthM = 12.85 / view.zoom;
    const visibleHeightM = visibleWidthM * 0.75;
    return `${visibleWidthM.toFixed(1)} m × ${visibleHeightM.toFixed(1)} m`;
  }, [view.zoom]);

  function handleWheel(e) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer || !baseScale) return;

    if (e.evt.shiftKey) {
      const delta = e.evt.deltaY > 0 ? -5 : 5;
      setView((v) => rotateBy(v, delta));
      return;
    }

    const deltaZoom = -e.evt.deltaY * WHEEL_ZOOM_SENSITIVITY;
    setView((v) => {
      const newZoom = clampZoom(v.zoom + deltaZoom);
      return repositionForTransform({
        view: v,
        pivotX: pointer.x,
        pivotY: pointer.y,
        containerWidth: size.width,
        containerHeight: size.height,
        baseScale,
        newZoom,
        newRotation: v.rotation,
      });
    });
  }

  function handleDoubleClick() {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer || !baseScale) return;
    setView((v) => {
      const newZoom = clampZoom(v.zoom + 0.5);
      return repositionForTransform({
        view: v,
        pivotX: pointer.x,
        pivotY: pointer.y,
        containerWidth: size.width,
        containerHeight: size.height,
        baseScale,
        newZoom,
        newRotation: v.rotation,
      });
    });
  }

  function handleTouchStart(e) {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      stageRef.current?.draggable(false);
      const rect = wrapperRef.current.getBoundingClientRect();
      touchStateRef.current = {
        active: true,
        initialDistance: distanceBetween(touches[0], touches[1]),
        initialAngle: angleBetween(touches[0], touches[1]),
        initialZoom: viewRef.current.zoom,
        initialRotation: viewRef.current.rotation,
        midpoint: midpointBetween(touches[0], touches[1], rect),
      };
    }
  }

  function handleTouchMove(e) {
    const touches = e.evt.touches;
    const ts = touchStateRef.current;
    if (touches.length === 2 && ts.active && baseScale) {
      e.evt.preventDefault();
      const dist = distanceBetween(touches[0], touches[1]);
      const angle = angleBetween(touches[0], touches[1]);
      const newZoom = clampZoom(ts.initialZoom * (dist / ts.initialDistance));
      const angleDelta = angle - ts.initialAngle;
      const newRotation = ((ts.initialRotation + angleDelta + 540) % 360) - 180;

      setView((v) =>
        repositionForTransform({
          view: v,
          pivotX: ts.midpoint.x,
          pivotY: ts.midpoint.y,
          containerWidth: size.width,
          containerHeight: size.height,
          baseScale,
          newZoom,
          newRotation,
        })
      );
    }
  }

  function handleTouchEnd(e) {
    if (e.evt.touches.length < 2) {
      touchStateRef.current.active = false;
      stageRef.current?.draggable(true);
    }
  }

  function handleStageDragEnd(e) {
    const stage = e.target;
    setView((v) => ({
      ...v,
      panX: stage.x() / size.width - 0.5,
      panY: stage.y() / size.height - 0.5,
    }));
  }

  function handleStageClick(e) {
    if (e.target === e.target.getStage()) setSelectedArea(null);
  }

  function handleStageMouseMove(e) {
    if (hoveredArea) setMousePos({ x: e.evt.clientX, y: e.evt.clientY, show: true });
  }

  function handleStageMouseLeave() {
    setHoveredArea(null);
    setMousePos((p) => ({ ...p, show: false }));
  }

  async function handleDeleteArea(a) {
    if (!window.confirm(`Remover a área "${a.label}"?`)) return;
    const beforeData = { code: a.code, label: a.label, areaType: a.area_type };
    const { error: err } = await deleteMapArea(a.id);
    if (err) { setError(err.message); return; }
    await auditMap({ action: "remover", areaId: a.id, areaCode: a.code, beforeData });
    if (selectedArea?.id === a.id) setSelectedArea(null);
    setHoveredArea(null);
    await loadAll();
    flashSuccess("Área removida");
  }

  function handleAddFloor() {
    const nextIdx = floorOptions.length > 0 ? Math.max(...floorOptions.map((f) => f.idx)) + 1 : 1;
    const floorValue = `${nextIdx}o_andar`;
    setExtraFloors((prev) => (prev.includes(floorValue) ? prev : [...prev, floorValue]));
    setActiveFloor(String(nextIdx));
    flashSuccess(`${nextIdx}º andar criado — adicione objetos nele!`);
  }

  function openNewObjectModal(preset = null) {
    const targetFloorOpt =
      activeFloor === "all"
        ? floorOptions[0]
        : floorOptions.find((f) => String(f.idx) === String(activeFloor)) || floorOptions[0];
    const floorVal = targetFloorOpt?.value || "terreo";
    if (preset) {
      const count = areas.filter((a) => a.area_type === preset.areaType).length + 1;
      setNewAreaForm({
        code: `${preset.prefix}-${count}`,
        label: `${preset.label} ${count}`,
        areaType: preset.areaType,
        floor: floorVal,
        x: 42,
        y: 42,
        width: preset.width,
        height: preset.height,
        hasSides: preset.hasSides,
      });
    } else {
      setNewAreaForm((f) => ({ ...f, floor: floorVal }));
    }
    setNewAreaModal(true);
  }

  async function handleChangeAreaFloor(a, newFloor) {
    const { error: err } = await updateMapArea(a.id, { floor: newFloor });
    if (err) { setError(err.message); return; }
    setAreas((prev) => prev.map((x) => (x.id === a.id ? { ...x, floor: newFloor } : x)));
    setSelectedArea((prev) => (prev?.id === a.id ? { ...prev, floor: newFloor } : prev));
    flashSuccess(`Movido para ${floorIndex(newFloor) === 0 ? "Térreo" : `${floorIndex(newFloor)}º andar`}`);
  }

  async function handleDeleteItem(it) {
    if (!isAdmin) return;
    if (!window.confirm(`Remover ${it.product_code}?`)) return;
    const beforeData = { productCode: it.product_code, quantity: it.quantity, areaId: it.area_id };
    await deleteMapItem(it.id);
    await auditMap({ action: "item_remove", areaId: it.area_id, areaCode: selectedArea?.code, beforeData });
    await loadAll();
    flashSuccess("Item removido");
  }

  async function handleAreaDragEnd(a, e) {
    const node = e.target;
    const world = areaToWorld(a);
    const pct = worldToAreaPct({
      x: node.x() - world.width / 2,
      y: node.y() - world.height / 2,
      width: world.width,
      height: world.height,
    });
    setActiveDragId(null);
    setAreas((prev) => prev.map((x) => (x.id === a.id ? { ...x, x: pct.x, y: pct.y } : x)));
    setSelectedArea((prev) => (prev?.id === a.id ? { ...prev, x: pct.x, y: pct.y } : prev));
    const beforeData = { x: a.x, y: a.y };
    const { error: err } = await updateMapArea(a.id, { x: pct.x, y: pct.y });
    if (err) {
      setError(err.message);
      return;
    }
    await auditMap({ action: "mover", areaId: a.id, areaCode: a.code, beforeData, afterData: { x: pct.x, y: pct.y } });
    flashSuccess("Área movida");
  }

  async function handleAreaTransformEnd(a, e) {
    const node = e.target;
    const world = areaToWorld(a);
    const newWorldWidth = Math.max(MIN_WORLD_W, world.width * node.scaleX());
    const newWorldHeight = Math.max(MIN_WORLD_H, world.height * node.scaleY());
    const nextRot = normalizeRotation(node.rotation());
    node.scaleX(1);
    node.scaleY(1);

    const pct = worldToAreaPct({
      x: node.x() - newWorldWidth / 2,
      y: node.y() - newWorldHeight / 2,
      width: newWorldWidth,
      height: newWorldHeight,
    });
    const nextMeta = withAreaRotation(a, nextRot);
    setAreas((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...pct, meta: nextMeta } : x)));
    setSelectedArea((prev) => (prev?.id === a.id ? { ...prev, ...pct, meta: nextMeta } : prev));
    const beforeData = { x: a.x, y: a.y, width: a.width, height: a.height, rotation: getAreaRotation(a) };
    const { error: err } = await updateMapArea(a.id, { ...pct, meta: nextMeta });
    if (err) {
      setError(err.message);
      return;
    }
    await auditMap({ action: "resize", areaId: a.id, areaCode: a.code, beforeData, afterData: { ...pct, rotation: nextRot } });
    flashSuccess(`Atualizado (${Math.round(nextRot)}°)`);
  }

  async function handleRotateArea(a, nextDeg) {
    const rot = normalizeRotation(nextDeg);
    const nextMeta = withAreaRotation(a, rot);
    setAreas((prev) => prev.map((x) => (x.id === a.id ? { ...x, meta: nextMeta } : x)));
    setSelectedArea((prev) => (prev?.id === a.id ? { ...prev, meta: nextMeta } : prev));
    const { error: err } = await updateMapArea(a.id, { meta: nextMeta });
    if (err) setError(err.message);
  }

  function handleTransformerBoundBox(oldBox, newBox) {
    if (newBox.width < MIN_WORLD_W || newBox.height < MIN_WORLD_H) return oldBox;
    return newBox;
  }

  async function handleCreateArea() {
    const code = newAreaForm.code.trim().toUpperCase();
    const label = newAreaForm.label.trim();
    if (!code) return setError("Digite o código da área.");
    if (!label) return setError("Digite o rótulo.");

    setAreaBusy(true);
    const { data, error: err } = await addMapArea({
      code,
      label,
      areaType: newAreaForm.areaType,
      floor: newAreaForm.floor || "terreo",
      hasSides: newAreaForm.hasSides,
      x: Number(newAreaForm.x),
      y: Number(newAreaForm.y),
      width: Number(newAreaForm.width),
      height: Number(newAreaForm.height),
      color: colorForType(newAreaForm.areaType),
      meta: Number(newAreaForm.rotation) ? { rotation: normalizeRotation(newAreaForm.rotation) } : null,
    });
    setAreaBusy(false);
    if (err) return setError(err.message);
    await auditMap({
      action: "criar",
      areaId: data?.id,
      areaCode: code,
      afterData: {
        code,
        label,
        areaType: newAreaForm.areaType,
        floor: newAreaForm.floor || "terreo",
        x: newAreaForm.x,
        y: newAreaForm.y,
        width: newAreaForm.width,
        height: newAreaForm.height,
        hasSides: newAreaForm.hasSides,
      },
    });
    setNewAreaModal(false);
    setNewAreaForm({ code: "", label: "", areaType: "prateleira", floor: newAreaForm.floor || "terreo", x: 40, y: 40, width: 10, height: 15, hasSides: false });
    await loadAll();
    flashSuccess(`"${label}" criado no mapa`);
  }

  const selectedAreaItems = selectedArea ? (itemsByArea[selectedArea.id] || []) : [];
  const bySide = selectedArea?.has_sides ? groupItemsBySide(selectedAreaItems) : null;
  const byCategory = selectedArea ? groupItemsByCategory(selectedAreaItems) : [];

  const gridLines = useMemo(() => {
    if (!layers.grid) return [];
    const lines = [];
    for (let i = 0; i <= GRID_COLS; i++) {
      const x = (i / GRID_COLS) * WORLD_W;
      lines.push({ key: `v${i}`, points: [x, 0, x, WORLD_H] });
    }
    for (let j = 0; j <= GRID_ROWS; j++) {
      const y = (j / GRID_ROWS) * WORLD_H;
      lines.push({ key: `h${j}`, points: [0, y, WORLD_W, y] });
    }
    return lines;
  }, [layers.grid]);

  const cursor = activeDragId
    ? "grabbing"
    : hoveredArea && !editMode
    ? "pointer"
    : editMode
    ? "default"
    : "grab";

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Mapa do estoque</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Arraste · Scroll pra zoom · Shift+scroll pra girar · Duplo-clique pra ampliar
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn-small"
            onClick={() => setLayers((l) => ({ ...l, heatmap: !l.heatmap }))}
            style={
              layers.heatmap
                ? { background: "#ef4444", color: "#fff", borderColor: "#ef4444", fontWeight: 700 }
                : undefined
            }
          >
            {layers.heatmap ? "🔥 Mapa de Calor: ATIVO" : "🔥 Mapa de Calor (ABC)"}
          </button>
          <button
            className="btn-small"
            onClick={() => setSlottingOpen((v) => !v)}
            style={
              slottingOpen || slotting.suggestions.length > 0
                ? {
                    borderColor: slotting.suggestions.length > 0 ? "var(--warning)" : "var(--border-strong)",
                    color: slottingOpen ? "#fff" : slotting.suggestions.length > 0 ? "var(--warning)" : "var(--text)",
                    background: slottingOpen ? "var(--accent)" : undefined,
                  }
                : undefined
            }
          >
            Sugestões de Slotting ({slotting.suggestions.length})
          </button>
          <button className="btn-small" onClick={loadAll}>
            <IconRefresh size={14} /> Atualizar
          </button>
          {isAdmin && (
            <button
              className={`btn-small ${editMode ? "btn-excel" : ""}`}
              onClick={() => setEditMode((v) => !v)}
              style={editMode ? { background: "var(--ok)", color: "#fff", borderColor: "var(--ok)" } : undefined}
            >
              <IconEdit size={14} /> {editMode ? "Sair do modo edição" : "Modo edição"}
            </button>
          )}
          {isAdmin && editMode && (
            <button className="btn-small btn-excel" onClick={() => openNewObjectModal()}>
              <IconPlus size={14} /> Novo objeto
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      {success && (
        <div className="alert-card" style={{ marginBottom: 16, background: "var(--ok-soft)", borderColor: "var(--ok)", color: "var(--ok)", display: "flex", alignItems: "center", gap: 8 }}>
          <IconCheck size={16} /> {success}
        </div>
      )}

      {editMode && (
        <>
          <div className="alert-card alert-warning" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertTriangle size={16} />
            <div style={{ flex: 1 }}>
              <strong>Modo edição ativo.</strong> Arraste qualquer objeto pra mover · Clique pra redimensionar pelas alças · Escolha um atalho abaixo para criar novos objetos ou andares.
            </div>
          </div>
          <div className="map-object-palette">
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", marginRight: 4 }}>
              Criar rápido:
            </span>
            {MAP_OBJECT_PRESETS.map((preset) => (
              <button
                key={preset.areaType}
                type="button"
                className="map-palette-chip"
                onClick={() => openNewObjectModal(preset)}
              >
                <span className="map-palette-dot" style={{ background: colorForType(preset.areaType) }} />
                + {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="map-palette-chip"
              style={{ borderStyle: "dashed", borderColor: "var(--accent)", color: "var(--accent)" }}
              onClick={handleAddFloor}
            >
              + Novo andar
            </button>
          </div>
        </>
      )}

      {slottingOpen && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>
                Inteligência de Slotting · Curva ABC × Distância da Expedição
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Referência de expedição: <strong>{slotting.origin.label}</strong> · {slotting.summary.curvaATotal} itens Curva A ({slotting.summary.curvaAFarCount} longe da expedição)
                {slotting.summary.avgSavedPct > 0 && ` · economia média estimada: -${slotting.summary.avgSavedPct}% de deslocamento`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!layers.heatmap && (
                <button className="btn-small btn-excel" onClick={() => setLayers((l) => ({ ...l, heatmap: true }))}>
                  Ver Mapa de Calor
                </button>
              )}
              <button className="btn-small" onClick={() => setSlottingOpen(false)}>Fechar</button>
            </div>
          </div>

          {slotting.suggestions.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Nenhuma realocação urgente identificada. Os itens de maior giro já estão bem posicionados em relação à expedição (ou ainda há poucos registros de movimentação/faltas).
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {slotting.suggestions.map((sug) => (
                <div
                  key={sug.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderLeft: "4px solid #ef4444",
                    borderRadius: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ background: "#ef4444", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>
                        CURVA A
                      </span>
                      <strong style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{sug.productCode}</strong>
                      {sug.productName && sug.productName !== sug.productCode && (
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{sug.productName}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      De <strong>{sug.fromArea.code}</strong> ({sug.fromDistanceM}m) → <strong>{sug.toArea.code}</strong> ({sug.toDistanceM}m) ·{" "}
                      <span style={{ color: "var(--ok)", fontWeight: 700 }}>-{sug.savedPct}% deslocamento (-{sug.savedDistanceM}m/ciclo)</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{sug.reason}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn-small"
                      onClick={() => {
                        setSelectedArea(sug.fromArea);
                        setLayers((l) => ({ ...l, heatmap: true }));
                      }}
                    >
                      Destacar {sug.fromArea.code}
                    </button>
                    {isAdmin && (
                      <button
                        className="btn-small btn-excel"
                        disabled={relocatingId === sug.id}
                        onClick={() => handleApplySlotting(sug)}
                      >
                        {relocatingId === sug.id ? "Movendo..." : `Mover p/ ${sug.toArea.code}`}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", display: "flex" }}>
              <IconSearch size={15} />
            </span>
            <input
              className="field"
              style={{ paddingLeft: 38 }}
              placeholder="Buscar área, produto ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="field" style={{ width: "auto" }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {AREA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="scan-chips" style={{ margin: 0 }} role="group" aria-label="Filtrar andar">
            <button
              type="button"
              className={`scan-chip ${activeFloor === "all" ? "active" : ""}`}
              style={{ minHeight: 36, padding: "4px 12px", fontSize: 12.5 }}
              onClick={() => setActiveFloor("all")}
            >
              Todos os andares
            </button>
            {floorOptions.map((f) => (
              <button
                key={f.idx}
                type="button"
                className={`scan-chip ${String(activeFloor) === String(f.idx) ? "active" : ""}`}
                style={{ minHeight: 36, padding: "4px 12px", fontSize: 12.5 }}
                onClick={() => setActiveFloor(String(f.idx))}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedArea ? "1fr 420px" : "1fr", gap: 16 }}>
        <div
          ref={wrapperRef}
          className={`map-wrapper ${isFullscreen ? "map-wrapper-fullscreen" : ""}`}
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: isFullscreen ? undefined : "75%",
            height: isFullscreen ? "100vh" : undefined,
            borderRadius: isFullscreen ? 0 : 16,
            overflow: "hidden",
            border: isFullscreen ? "none" : "1px solid var(--border)",
            boxShadow: isFullscreen ? "none" : "var(--shadow-lg)",
            background: "radial-gradient(ellipse at center, #111823 0%, #0a0e14 100%)",
          }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            {size.width > 0 && baseScale > 0 && (
              <Stage
                ref={stageRef}
                width={size.width}
                height={size.height}
                x={size.width * (0.5 + view.panX)}
                y={size.height * (0.5 + view.panY)}
                offsetX={WORLD_W / 2}
                offsetY={WORLD_H / 2}
                scaleX={baseScale * view.zoom}
                scaleY={baseScale * view.zoom}
                rotation={view.rotation}
                draggable
                onDragEnd={handleStageDragEnd}
                onWheel={handleWheel}
                onDblClick={handleDoubleClick}
                onDblTap={handleDoubleClick}
                onClick={handleStageClick}
                onTap={handleStageClick}
                onMouseMove={handleStageMouseMove}
                onMouseLeave={handleStageMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ cursor, touchAction: "none" }}
              >
                <Layer ref={layerRef} listening={!loading}>
                  {layers.grid &&
                    gridLines.map((g) => (
                      <Line
                        key={g.key}
                        points={g.points}
                        stroke="rgba(74, 123, 167, 0.15)"
                        strokeWidth={1}
                        strokeScaleEnabled={false}
                        listening={false}
                      />
                    ))}

                  {!loading &&
                    decoratedAreas.map((a) => {
                      const isCorridor = a.area_type === "corredor";
                      const specialKind = resolveSpecialAreaKind(a);
                      const isSelected = selectedArea?.id === a.id;
                      const world = areaToWorld(a);
                      const occupancy = layers.occupancy ? a.occupancy : 0.5;
                      const isHeatmapShelf = layers.heatmap && a.area_type === "prateleira";
                      const needsAttention = isHeatmapShelf && a.heatMetric?.needsSlottingAttention;
                      const fill = specialKind
                        ? SPECIAL_COLORS[specialKind]
                        : isCorridor
                        ? "rgba(0, 212, 255, 0.07)"
                        : isHeatmapShelf
                        ? heatmapColor(a.heatMetric?.heat ?? 0)
                        : layers.occupancy
                        ? occupancyColor(occupancy)
                        : (a.color || colorForType(a.area_type));
                      const stroke = isCorridor
                        ? `rgba(0, 212, 255, ${isSelected ? 0.9 : 0.45})`
                        : isSelected
                        ? "#00d4ff"
                        : needsAttention
                        ? "#fbbf24"
                        : specialKind
                        ? "rgba(255,255,255,0.38)"
                        : "rgba(255,255,255,0.15)";
                      const canInteract = editMode || a.matches;

                      const rot = getAreaRotation(a);
                      const localWorld = { x: 0, y: 0, width: world.width, height: world.height };

                      return (
                        <Group
                          key={a.id}
                          ref={(node) => {
                            if (node) shapeRefs.current[a.id] = node;
                            else delete shapeRefs.current[a.id];
                          }}
                          x={world.x + world.width / 2}
                          y={world.y + world.height / 2}
                          offsetX={world.width / 2}
                          offsetY={world.height / 2}
                          width={world.width}
                          height={world.height}
                          rotation={rot}
                          listening={canInteract}
                          draggable={editMode}
                          onDragStart={() => setActiveDragId(a.id)}
                          onDragEnd={(e) => handleAreaDragEnd(a, e)}
                          onTransformEnd={(e) => handleAreaTransformEnd(a, e)}
                          onClick={() => { setSelectedArea(a); setPanelView("lista"); }}
                          onTap={() => { setSelectedArea(a); setPanelView("lista"); }}
                          onMouseEnter={(e) => {
                            setHoveredArea(a);
                            setMousePos({ x: e.evt.clientX, y: e.evt.clientY, show: true });
                          }}
                          onMouseLeave={() => setHoveredArea(null)}
                        >
                          <Rect
                            x={0}
                            y={0}
                            width={world.width}
                            height={world.height}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            dash={isCorridor ? [8, 6] : undefined}
                            cornerRadius={isCorridor ? 14 : specialKind === "carro_apoio" ? 10 : 7}
                            opacity={a.matches ? 1 : 0.12}
                            perfectDrawEnabled={false}
                            shadowColor="black"
                            shadowBlur={isSelected ? 18 : 0}
                            shadowOpacity={isSelected ? 0.5 : 0}
                          />

                          {specialKind && renderSpecialAreaDetails(specialKind, localWorld, a.matches ? 1 : 0.12)}

                          {layers.labels && world.width > 16 && world.height > 10 && (
                            <Text
                              x={0}
                              y={world.height / 2 - 7}
                              width={world.width}
                              align="center"
                              text={isCorridor ? (a.label || "") : a.code}
                              fontStyle="700"
                              fontSize={isCorridor ? 12 : Math.max(10, Math.min(16, world.width * 0.05))}
                              fill={isCorridor ? "rgba(0, 212, 255, 0.85)" : "#fff"}
                              listening={false}
                            />
                          )}

                          {!isCorridor && layers.labels && world.height > 55 && (a.stats.skus > 0 || isHeatmapShelf) && (
                            <Text
                              x={0}
                              y={world.height / 2 + 9}
                              width={world.width}
                              align="center"
                              text={
                                isHeatmapShelf && a.heatMetric
                                  ? `Curva ${a.heatMetric.abc} · ${a.heatMetric.distanceM}m${needsAttention ? " ⚠" : ""}`
                                  : `${a.stats.skus} · ${a.stats.totalQty}`
                              }
                              fontSize={10}
                              fontFamily="var(--font-mono)"
                              fill={needsAttention ? "#fde047" : "rgba(255,255,255,0.85)"}
                              listening={false}
                            />
                          )}
                        </Group>
                      );
                    })}

                  {editMode && (
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled
                      rotationSnaps={[]}
                      keepRatio={false}
                      anchorFill="#0a0e14"
                      anchorStroke="#00d4ff"
                      anchorSize={9}
                      anchorCornerRadius={3}
                      borderStroke="#00d4ff"
                      borderDash={[4, 4]}
                      boundBoxFunc={handleTransformerBoundBox}
                    />
                  )}
                </Layer>

                <Layer ref={corridorLayerRef} listening={false}>
                  {!loading &&
                    layers.corridorFlow &&
                    decoratedAreas
                      .filter((a) => a.area_type === "corredor" && a.matches)
                      .map((a) => {
                        const world = areaToWorld(a);
                        const flowHorizontal = world.width >= world.height;
                        return (
                          <Line
                            key={a.id}
                            ref={(node) => {
                              if (node) corridorLineRefs.current[a.id] = node;
                              else delete corridorLineRefs.current[a.id];
                            }}
                            points={
                              flowHorizontal
                                ? [world.x + 8, world.y + world.height / 2, world.x + world.width - 8, world.y + world.height / 2]
                                : [world.x + world.width / 2, world.y + 8, world.x + world.width / 2, world.y + world.height - 8]
                            }
                            stroke="rgba(0, 212, 255, 0.85)"
                            strokeWidth={3}
                            dash={[14, 10]}
                            lineCap="round"
                            perfectDrawEnabled={false}
                            listening={false}
                          />
                        );
                      })}
                </Layer>
              </Stage>
            )}

            {loading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="loading-spinner" />
              </div>
            )}
          </div>

          <div className="map-north">
            <div className="map-north-letter">N</div>
          </div>

          {layers.heatmap && (
            <div
              style={{
                position: "absolute",
                bottom: 58,
                left: 20,
                background: "rgba(22, 27, 34, 0.9)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "8px 12px",
                zIndex: 20,
                color: "#e9edf3",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 700 }}>Giro (Curva ABC):</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#2563eb" }} /> C (baixo)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#f59e0b" }} /> B (médio)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444" }} /> A (alto)
              </span>
              <span style={{ color: "#fde047", fontWeight: 600 }}>⚠ Borda amarela = Curva A longe da expedição</span>
            </div>
          )}

          <StockMapControls
            view={view}
            onZoomIn={() => setView((v) => zoomIn(v))}
            onZoomOut={() => setView((v) => zoomOut(v))}
            onRotate={() => setView((v) => rotateBy(v, 90))}
            onRotateReset={() => setView((v) => rotateTo(v, 0))}
            onRotateSet={(deg) => setView((v) => rotateTo(v, deg))}
            onReset={() => setView((v) => resetView(v))}
            onFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            layers={layers}
            onToggleLayer={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
            scaleLabel={scaleLabel}
          />

          {hoveredArea && mousePos.show && !editMode && (
            <div
              className="map-tooltip"
              style={{
                left: Math.min(mousePos.x + 16, window.innerWidth - 260),
                top: mousePos.y + 16,
              }}
            >
              <div className="map-tooltip-title">{hoveredArea.code}</div>
              <div className="map-tooltip-sub">{hoveredArea.label}</div>
              {hoveredArea.stats.skus > 0 && (
                <div className="map-tooltip-stats">
                  {hoveredArea.stats.skus} SKUs · {hoveredArea.stats.totalQty} un
                </div>
              )}
              {hoveredArea.heatMetric && (
                <div className="map-tooltip-stats" style={{ color: abcColor(hoveredArea.heatMetric.abc), fontWeight: 700 }}>
                  Curva {hoveredArea.heatMetric.abc} · {hoveredArea.heatMetric.distanceM}m da expedição
                  {hoveredArea.heatMetric.needsSlottingAttention ? " · ⚠ Realocar" : ""}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedArea && (
          <div className="card map-panel" style={{ position: "sticky", top: 16, alignSelf: "flex-start", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                  {labelForType(selectedArea.area_type)}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {selectedArea.code}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  {selectedArea.label}
                </div>
              </div>
              <button
                onClick={() => setSelectedArea(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex" }}
                aria-label="Fechar"
              >
                <IconX size={16} />
              </button>
            </div>

            {selectedArea.area_type === "prateleira" && onScanArea && (
              <button className="btn-small" style={{ marginBottom: 12 }} onClick={() => onScanArea(selectedArea)}>
                Coletar aqui (bipar produtos)
              </button>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>SKUs</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedAreaItems.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Qtd. total</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>
                  {selectedAreaItems.reduce((s, i) => s + (i.quantity || 0), 0)}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
                  Andar do objeto:
                  <select
                    className="field"
                    style={{ marginTop: 4 }}
                    value={selectedArea.floor || "terreo"}
                    onChange={(e) => handleChangeAreaFloor(selectedArea, e.target.value)}
                  >
                    {floorOptions.map((f) => (
                      <option key={f.idx} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </label>

                <div style={{ padding: "8px 10px", borderRadius: 10, background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)" }}>Rotação livre (0°–360°)</span>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      step="1"
                      className="field"
                      style={{ width: 68, padding: "3px 6px", fontSize: 12, textAlign: "center" }}
                      value={Math.round(getAreaRotation(selectedArea))}
                      onChange={(e) => handleRotateArea(selectedArea, Number(e.target.value))}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    step="1"
                    value={Math.round(getAreaRotation(selectedArea))}
                    onChange={(e) => handleRotateArea(selectedArea, Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#00d4ff" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 6 }}>
                    {[-45, -15, 0, 15, 45].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        className="btn-small"
                        style={{ padding: "4px 2px", fontSize: 11, justifyContent: "center" }}
                        onClick={() => handleRotateArea(selectedArea, delta === 0 ? 0 : getAreaRotation(selectedArea) + delta)}
                      >
                        {delta === 0 ? "0°" : `${delta > 0 ? "+" : ""}${delta}°`}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="btn-small" style={{ width: "100%", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleDeleteArea(selectedArea)}>
                  <IconTrash size={13} /> Remover área
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <button
                className={`quick-filter-btn ${panelView === "lista" ? "active" : ""}`}
                onClick={() => setPanelView("lista")}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}
              >
                <IconList size={12} /> Lista
              </button>
              <button
                className={`quick-filter-btn ${panelView === "categoria" ? "active" : ""}`}
                onClick={() => setPanelView("categoria")}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}
              >
                <IconGrid size={12} /> Categoria
              </button>
            </div>

            {isAdmin && (
              <button className="btn-small btn-excel" style={{ width: "100%", marginBottom: 14 }} onClick={() => { setEditingItem(null); setPickerOpen(true); }}>
                <IconPlus size={14} /> Adicionar item
              </button>
            )}

            {selectedAreaItems.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-faint)", textAlign: "center", padding: "20px 0" }}>
                Nenhum item cadastrado nesta área.
              </div>
            ) : panelView === "lista" ? (
              selectedArea.has_sides && bySide ? (
                <>
                  <SideSection title="PAR · lado direito" items={bySide.par.filter((i) => i.side === "par")} isAdmin={isAdmin} onEdit={(it) => { setEditingItem(it); setPickerOpen(true); }} onDelete={handleDeleteItem} />
                  <SideSection title="ÍMPAR · lado esquerdo" items={bySide.impar} isAdmin={isAdmin} onEdit={(it) => { setEditingItem(it); setPickerOpen(true); }} onDelete={handleDeleteItem} />
                </>
              ) : (
                <SimpleItemList items={selectedAreaItems} isAdmin={isAdmin} onEdit={(it) => { setEditingItem(it); setPickerOpen(true); }} onDelete={handleDeleteItem} />
              )
            ) : (
              byCategory.map((cat) => (
                <div key={cat.category} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{cat.category}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {cat.skus} · {cat.totalQty} un
                    </div>
                  </div>
                  <SimpleItemList items={cat.items} isAdmin={isAdmin} onEdit={(it) => { setEditingItem(it); setPickerOpen(true); }} onDelete={handleDeleteItem} compact />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {pickerOpen && selectedArea && (
        <StockMapItemPicker
          area={selectedArea}
          item={editingItem}
          onClose={() => setPickerOpen(false)}
          onSaved={async (payload) => {
            // payload: { action, item } quando salvar
            if (payload?.action && payload?.item) {
              await auditMap({
                action: payload.action,
                areaId: selectedArea.id,
                areaCode: selectedArea.code,
                beforeData: payload.action === "item_edit" ? payload.before : null,
                afterData: payload.item,
              });
            }
            await loadAll();
          }}
        />
      )}

      {newAreaModal && (
        <div className="kiosk-modal-backdrop" onClick={() => !areaBusy && setNewAreaModal(false)}>
          <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">Nova área</div>
                <div className="kiosk-modal-sub">Posição e tamanho em % do mapa (0-100)</div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setNewAreaModal(false)}>
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body">
              <div className="schedule-modal-grid">
                <div>
                  <label className="schedule-modal-label">Código *</label>
                  <input className="schedule-modal-field" placeholder="Ex: 1V" value={newAreaForm.code} onChange={(e) => setNewAreaForm({ ...newAreaForm, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Tipo *</label>
                  <select className="schedule-modal-field" value={newAreaForm.areaType} onChange={(e) => setNewAreaForm({ ...newAreaForm, areaType: e.target.value })}>
                    {AREA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Rótulo *</label>
                  <input className="schedule-modal-field" placeholder="Ex: Prateleira 1V, Escada Principal, Sala Gerência" value={newAreaForm.label} onChange={(e) => setNewAreaForm({ ...newAreaForm, label: e.target.value })} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Andar *</label>
                  <select className="schedule-modal-field" value={newAreaForm.floor || "terreo"} onChange={(e) => setNewAreaForm({ ...newAreaForm, floor: e.target.value })}>
                    {floorOptions.map((f) => (
                      <option key={f.idx} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="schedule-modal-label">X (%)</label>
                  <input type="number" min="0" max="99" className="schedule-modal-field" value={newAreaForm.x} onChange={(e) => setNewAreaForm({ ...newAreaForm, x: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Y (%)</label>
                  <input type="number" min="0" max="99" className="schedule-modal-field" value={newAreaForm.y} onChange={(e) => setNewAreaForm({ ...newAreaForm, y: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Largura (%)</label>
                  <input type="number" min="2" max="100" className="schedule-modal-field" value={newAreaForm.width} onChange={(e) => setNewAreaForm({ ...newAreaForm, width: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Altura (%)</label>
                  <input type="number" min="2" max="100" className="schedule-modal-field" value={newAreaForm.height} onChange={(e) => setNewAreaForm({ ...newAreaForm, height: e.target.value })} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Rotação (0°–360°)</label>
                  <input type="number" min="0" max="360" className="schedule-modal-field" value={newAreaForm.rotation ?? 0} onChange={(e) => setNewAreaForm({ ...newAreaForm, rotation: e.target.value })} />
                </div>
                {newAreaForm.areaType === "prateleira" && (
                  <div className="schedule-modal-full">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newAreaForm.hasSides}
                        onChange={(e) => setNewAreaForm({ ...newAreaForm, hasSides: e.target.checked })}
                      />
                      Tem lado PAR e ÍMPAR (prateleira de dupla face)
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setNewAreaModal(false)} disabled={areaBusy}>Cancelar</button>
              <button className="kiosk-btn kiosk-btn-primary" onClick={handleCreateArea} disabled={areaBusy}>
                <IconCheck size={14} /> {areaBusy ? "Criando..." : "Criar área"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SideSection({ title, items, isAdmin, onEdit, onDelete }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 6, marginBottom: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
        <span style={{ fontWeight: 600, fontSize: 11.5 }}>{items.length} {items.length === 1 ? "item" : "itens"}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "8px 0 12px 0" }}>Nenhum item neste lado.</div>
      ) : (
        <SimpleItemList items={items} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

function SimpleItemList({ items, isAdmin, onEdit, onDelete, compact = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it) => (
        <div key={it.id} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: compact ? "8px 10px" : "10px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700 }}>{it.product_code}</span>
                {it.quantity > 0 && (
                  <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "1px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
                    {it.quantity} un
                  </span>
                )}
              </div>
              {it.product_name && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{it.product_name}</div>}
              {(it.slot || it.level) && (
                <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>
                  {[it.slot ? `Slot ${it.slot}` : null, it.level ? `Nível ${it.level}` : null].filter(Boolean).join(" · ")}
                </div>
              )}
              {it.barcode && <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2, fontFamily: "var(--font-mono)" }}>EAN {it.barcode}</div>}
              {it.counted_at && (
                <div style={{ fontSize: 10.5, color: "var(--success, #22c55e)", marginTop: 2 }}>
                  ✓ bipado em {new Date(it.counted_at).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button className="btn-small" style={{ padding: "4px 7px" }} onClick={() => onEdit(it)}>
                  <IconEdit size={11} />
                </button>
                <button className="btn-small" style={{ padding: "4px 7px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => onDelete(it)}>
                  <IconTrash size={11} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMapAreas,
  addMapArea,
  updateMapArea,
  deleteMapArea,
  fetchMapItems,
  deleteMapItem,
  AREA_TYPES,
  SIDES,
  colorForType,
  labelForType,
  groupItemsBySide,
  groupItemsByCategory,
  summarizeArea,
} from "../lib/stockMap";
import {
  createInitialView,
  zoomIn,
  zoomOut,
  zoomAt,
  panBy,
  rotateBy,
  rotateTo,
  resetView,
  screenToWorld,
  hitTest,
  getTransform,
  clampZoom,
  createTouchState,
  distanceBetween,
  angleBetween,
  PAN_THRESHOLD_PX,
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

export default function StockMap({ isAdmin }) {
  const [areas, setAreas] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [view, setView] = useState(createInitialView());
  const [selectedArea, setSelectedArea] = useState(null);
  const [hoveredArea, setHoveredArea] = useState(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [panelView, setPanelView] = useState("lista");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, show: false });

  const [layers, setLayers] = useState({
    grid: true,
    labels: true,
    occupancy: true,
  });

  const [dragState, setDragState] = useState(null);

  const [newAreaModal, setNewAreaModal] = useState(false);
  const [newAreaForm, setNewAreaForm] = useState({
    code: "", label: "", areaType: "prateleira",
    x: 40, y: 40, width: 10, height: 15,
    hasSides: false,
  });
  const [areaBusy, setAreaBusy] = useState(false);

  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panMovedRef = useRef(false);
  const touchStateRef = useRef(createTouchState());
  const dragStateRef = useRef(null);
  dragStateRef.current = dragState;

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

  const decoratedAreas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return areas
      .filter((a) => !filterType || a.area_type === filterType)
      .map((a) => {
        const list = itemsByArea[a.id] || [];
        const stats = summarizeArea(a, items);
        const occupancy = list.length / maxSkus;
        const matches =
          !q ||
          a.code.toLowerCase().includes(q) ||
          a.label.toLowerCase().includes(q) ||
          list.some(
            (it) =>
              it.product_code.toLowerCase().includes(q) ||
              (it.product_name || "").toLowerCase().includes(q) ||
              (it.category || "").toLowerCase().includes(q)
          );
        return { ...a, stats, occupancy, matches, itemList: list };
      });
  }, [areas, itemsByArea, items, search, filterType, maxSkus]);

  // -------- Coordenadas --------
  function getWorldPoint(clientX, clientY) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const sx = (clientX - rect.left) / rect.width;
    const sy = (clientY - rect.top) / rect.height;
    return screenToWorld(viewRef.current, sx, sy);
  }

  // -------- Hover --------
  function handleMouseMove(e) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX, y: e.clientY, show: true });

    if (dragStateRef.current) return;
    if (isPanningRef.current) return;

    const world = getWorldPoint(e.clientX, e.clientY);
    const hit = hitTest(decoratedAreas.filter((a) => a.matches), world);
    setHoveredArea(hit || null);
  }

  function handleMouseLeave() {
    setHoveredArea(null);
    setMousePos((p) => ({ ...p, show: false }));
  }

  // -------- Pan (só quando não tá editando área) --------
  function handleContainerMouseDown(e) {
    if (e.button !== 0) return;
    if (dragStateRef.current) return; // não inicia pan se já tem drag
    // Se tá em modo edição e o clique veio de uma área, o handler da área já parou o evento.
    // Aqui só chega clique no "fundo".
    isPanningRef.current = true;
    panMovedRef.current = false;
    panStartRef.current = { x: e.clientX, y: e.clientY, view: { ...viewRef.current } };
  }

  async function handleContainerMouseUp(e) {
    if (dragStateRef.current) {
      // salva drag
      const area = areas.find((a) => a.id === dragStateRef.current.areaId);
      if (area) {
        await updateMapArea(area.id, {
          x: Number(area.x),
          y: Number(area.y),
          width: Number(area.width),
          height: Number(area.height),
        });
        flashSuccess("Área atualizada");
      }
      setDragState(null);
      return;
    }

    if (!isPanningRef.current) return;
    isPanningRef.current = false;

    if (panMovedRef.current) return;

    // Foi click simples — hit test
    const world = getWorldPoint(e.clientX, e.clientY);
    if (!world) return;

    const hit = hitTest(decoratedAreas.filter((a) => a.matches), world);
    if (hit) {
      setSelectedArea(hit);
      setPanelView("lista");
    } else {
      setSelectedArea(null);
    }
  }

  // Window listeners — sempre ativos
  useEffect(() => {
    function onMouseMove(e) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // 1) Drag de área em modo edição
      if (dragStateRef.current) {
        const ds = dragStateRef.current;
        const dxPct = ((e.clientX - ds.startMouseX) / rect.width) / viewRef.current.zoom;
        const dyPct = ((e.clientY - ds.startMouseY) / rect.height) / viewRef.current.zoom;

        const updated = {
          x: ds.mode === "move" ? ds.startX + dxPct : ds.startX,
          y: ds.mode === "move" ? ds.startY + dyPct : ds.startY,
          width: ds.mode === "resize" ? Math.max(2, ds.startW + dxPct) : ds.startW,
          height: ds.mode === "resize" ? Math.max(2, ds.startH + dyPct) : ds.startH,
        };

        setAreas((prev) =>
          prev.map((a) => (a.id === ds.areaId ? { ...a, ...updated } : a))
        );
        return;
      }

      // 2) Pan
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;

      if (Math.abs(dx) > PAN_THRESHOLD_PX || Math.abs(dy) > PAN_THRESHOLD_PX) {
        panMovedRef.current = true;
      }

      const startView = panStartRef.current.view;
      setView({
        ...startView,
        panX: startView.panX + dx / rect.width,
        panY: startView.panY + dy / rect.height,
      });
    }

    function onMouseUp(e) {
      handleContainerMouseUp(e);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoratedAreas, areas]);

  function handleWheel(e) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;

    if (e.shiftKey) {
      const delta = e.deltaY > 0 ? -5 : 5;
      setView((v) => rotateBy(v, delta));
      return;
    }

    const delta = -e.deltaY * 0.0015;
    setView((v) => zoomAt(v, delta, sx, sy));
  }

  function handleDoubleClick(e) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    setView((v) => zoomAt(v, 0.5, sx, sy));
  }

  function handleTouchStart(e) {
    const touches = Array.from(e.touches);
    touchStateRef.current.touches = touches;
    if (touches.length === 2) {
      touchStateRef.current.active = true;
      touchStateRef.current.initialDistance = distanceBetween(touches[0], touches[1]);
      touchStateRef.current.initialAngle = angleBetween(touches[0], touches[1]);
      touchStateRef.current.initialZoom = viewRef.current.zoom;
      touchStateRef.current.initialRotation = viewRef.current.rotation;
    }
  }

  function handleTouchMove(e) {
    const touches = Array.from(e.touches);
    if (touches.length === 2 && touchStateRef.current.active) {
      e.preventDefault();
      const dist = distanceBetween(touches[0], touches[1]);
      const angle = angleBetween(touches[0], touches[1]);
      const scaleFactor = dist / touchStateRef.current.initialDistance;
      const newZoom = clampZoom(touchStateRef.current.initialZoom * scaleFactor);
      const angleDelta = angle - touchStateRef.current.initialAngle;
      const newRotation = touchStateRef.current.initialRotation + angleDelta;
      setView((v) => ({
        ...v,
        zoom: newZoom,
        rotation: ((newRotation + 540) % 360) - 180,
      }));
    }
  }

  function handleTouchEnd() {
    touchStateRef.current.active = false;
    touchStateRef.current.touches = [];
  }

  // Keyboard
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

  // -------- Ações --------
  async function handleDeleteArea(a) {
    if (!window.confirm(`Remover a área "${a.label}"?`)) return;
    await deleteMapArea(a.id);
    if (selectedArea?.id === a.id) setSelectedArea(null);
    await loadAll();
  }

  async function handleDeleteItem(it) {
    if (!window.confirm(`Remover ${it.product_code}?`)) return;
    await deleteMapItem(it.id);
    await loadAll();
  }

  // Iniciar drag da área
  function startDragArea(e, a, mode) {
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      areaId: a.id,
      mode,
      startX: a.x,
      startY: a.y,
      startW: a.width,
      startH: a.height,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    });
  }

  // Criar nova área
  async function handleCreateArea() {
    const code = newAreaForm.code.trim().toUpperCase();
    const label = newAreaForm.label.trim();
    if (!code) return setError("Digite o código da área.");
    if (!label) return setError("Digite o rótulo.");

    setAreaBusy(true);
    const { error: err } = await addMapArea({
      code,
      label,
      areaType: newAreaForm.areaType,
      floor: "terreo",
      hasSides: newAreaForm.hasSides,
      x: Number(newAreaForm.x),
      y: Number(newAreaForm.y),
      width: Number(newAreaForm.width),
      height: Number(newAreaForm.height),
      color: colorForType(newAreaForm.areaType),
    });
    setAreaBusy(false);
    if (err) return setError(err.message);
    setNewAreaModal(false);
    setNewAreaForm({ code: "", label: "", areaType: "prateleira", x: 40, y: 40, width: 10, height: 15, hasSides: false });
    await loadAll();
    flashSuccess("Área criada");
  }

  const selectedAreaItems = selectedArea ? (itemsByArea[selectedArea.id] || []) : [];
  const bySide = selectedArea?.has_sides ? groupItemsBySide(selectedAreaItems) : null;
  const byCategory = selectedArea ? groupItemsByCategory(selectedAreaItems) : [];

  const transform = getTransform(view);

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
            <button className="btn-small btn-excel" onClick={() => setNewAreaModal(true)}>
              <IconPlus size={14} /> Nova área
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
        <div className="alert-card alert-warning" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <IconAlertTriangle size={16} />
          <div style={{ flex: 1 }}>
            <strong>Modo edição ativo.</strong> Arraste uma prateleira pra mover · Arraste o handle azul no canto pra redimensionar · Clique em qualquer área pra ver o painel e adicionar itens.
          </div>
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
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedArea ? "1fr 420px" : "1fr", gap: 16 }}>
        <div
          ref={wrapperRef}
          className={`map-wrapper ${isFullscreen ? "map-wrapper-fullscreen" : ""}`}
          style={{
            position: "relative",
            width: "100%",
            borderRadius: isFullscreen ? 0 : 16,
            overflow: "hidden",
            border: isFullscreen ? "none" : "1px solid var(--border)",
            boxShadow: isFullscreen ? "none" : "var(--shadow-lg)",
          }}
        >
          <div
            ref={containerRef}
            className="map-container"
            style={{
              position: "relative",
              width: "100%",
              paddingBottom: isFullscreen ? "100vh" : "75%",
              background: "radial-gradient(ellipse at center, #111823 0%, #0a0e14 100%)",
              cursor: dragState ? "grabbing" : isPanningRef.current ? "grabbing" : "grab",
              userSelect: "none",
              touchAction: "none",
            }}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {layers.grid && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `
                    linear-gradient(rgba(74, 123, 167, 0.15) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(74, 123, 167, 0.15) 1px, transparent 1px)
                  `,
                  backgroundSize: "5% 5%",
                  transform,
                  transformOrigin: "center",
                  transition: isPanningRef.current || dragState ? "none" : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                  pointerEvents: "none",
                }}
              />
            )}

            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)", pointerEvents: "none", zIndex: 2 }} />

            <div
              style={{
                position: "absolute",
                inset: 0,
                transform,
                transformOrigin: "center",
                transition: isPanningRef.current || dragState ? "none" : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {loading ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="loading-spinner" />
                </div>
              ) : decoratedAreas.map((a, idx) => {
                const isSelected = selectedArea?.id === a.id;
                const isHovered = hoveredArea?.id === a.id;
                const isCorridor = a.code === "CORREDOR-CENTRAL";
                const hidden = !a.matches;
                const occupancy = layers.occupancy ? a.occupancy : 0.5;
                const baseColor = a.area_type === "conferencia"
                  ? "#10b981"
                  : layers.occupancy
                  ? occupancyColor(occupancy)
                  : (a.color || colorForType(a.area_type));
                const isDragging = dragState?.areaId === a.id;

                return (
                  <div
                    key={a.id}
                    onMouseDown={(e) => {
                      if (!editMode) return;
                      if (isCorridor) return;
                      startDragArea(e, a, "move");
                    }}
                    style={{
                      position: "absolute",
                      left: `${a.x}%`,
                      top: `${a.y}%`,
                      width: `${a.width}%`,
                      height: `${a.height}%`,
                      background: isCorridor ? "transparent" : baseColor,
                      border: isCorridor
                        ? `1px dashed rgba(74, 123, 167, 0.3)`
                        : `1.5px solid ${isSelected ? "#00d4ff" : "rgba(255,255,255,0.15)"}`,
                      borderRadius: isCorridor ? 12 : 6,
                      cursor: editMode
                        ? isDragging
                          ? "grabbing"
                          : "move"
                        : isCorridor
                        ? "default"
                        : "pointer",
                      transition: isDragging
                        ? "none"
                        : "box-shadow 250ms ease, border-color 250ms ease, background 250ms ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      padding: 3,
                      overflow: "visible",
                      opacity: hidden ? 0.12 : 1,
                      transform: isSelected || isDragging
                        ? "scale(1.05)"
                        : isHovered && !editMode
                        ? "scale(1.03)"
                        : "scale(1)",
                      boxShadow: isSelected || isDragging
                        ? "0 0 0 2px #00d4ff, 0 8px 24px rgba(0, 212, 255, 0.4)"
                        : isHovered && !editMode
                        ? "0 6px 16px rgba(0,0,0,0.5)"
                        : "0 2px 6px rgba(0,0,0,0.3)",
                      zIndex: isSelected || isDragging ? 100 : isHovered ? 50 : idx,
                    }}
                  >
                    <div style={{ overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 3 }}>
                      {!isCorridor && layers.labels && (
                        <>
                          <div
                            style={{
                              fontSize: Math.max(8, Math.min(14, a.width * 0.9)),
                              fontWeight: 800,
                              color: "#fff",
                              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "100%",
                              lineHeight: 1.1,
                              letterSpacing: "0.02em",
                            }}
                          >
                            {a.code}
                          </div>
                          {a.height >= 8 && a.stats.skus > 0 && (
                            <div
                              style={{
                                fontSize: 9,
                                color: "rgba(255,255,255,0.85)",
                                fontWeight: 700,
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {a.stats.skus} · {a.stats.totalQty}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Handle de resize */}
                    {editMode && !isCorridor && (
                      <div
                        onMouseDown={(e) => startDragArea(e, a, "resize")}
                        style={{
                          position: "absolute",
                          right: -8,
                          bottom: -8,
                          width: 18,
                          height: 18,
                          background: "#00d4ff",
                          border: "2px solid #0a0e14",
                          borderRadius: 5,
                          cursor: "nwse-resize",
                          zIndex: 10,
                          boxShadow: "0 2px 8px rgba(0,212,255,0.6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Arraste pra redimensionar"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="#0a0e14">
                          <rect x="6" y="6" width="3" height="3" />
                          <rect x="2" y="6" width="2" height="2" opacity="0.5" />
                          <rect x="6" y="2" width="2" height="2" opacity="0.5" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="map-north">
            <div className="map-north-letter">N</div>
          </div>

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
              <button className="btn-small" style={{ width: "100%", marginBottom: 14, color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleDeleteArea(selectedArea)}>
                <IconTrash size={13} /> Remover área
              </button>
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
        <StockMapItemPicker area={selectedArea} item={editingItem} onClose={() => setPickerOpen(false)} onSaved={loadAll} />
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
                  <input className="schedule-modal-field" placeholder="Ex: Prateleira 1V" value={newAreaForm.label} onChange={(e) => setNewAreaForm({ ...newAreaForm, label: e.target.value })} />
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
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newAreaForm.hasSides}
                      onChange={(e) => setNewAreaForm({ ...newAreaForm, hasSides: e.target.checked })}
                    />
                    Tem lado PAR e ÍMPAR (prateleira de dupla face)
                  </label>
                </div>
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
              {it.slot && <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>Slot {it.slot}</div>}
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
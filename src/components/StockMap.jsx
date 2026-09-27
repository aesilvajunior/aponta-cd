import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMapAreas,
  addMapArea,
  updateMapArea,
  deleteMapArea,
  fetchMapItems,
  addMapItem,
  updateMapItem,
  deleteMapItem,
  AREA_TYPES,
  colorForType,
  labelForType,
  summarizeArea,
} from "../lib/stockMap";
import { supabase } from "../supabaseClient";
import {
  IconMapPin,
  IconPlus,
  IconEdit,
  IconTrash,
  IconX,
  IconCheck,
  IconPackage,
  IconSearch,
  IconRefresh,
  IconAlertTriangle,
} from "./Icons";

export default function StockMap({ isAdmin }) {
  const [areas, setAreas] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedArea, setSelectedArea] = useState(null);
  const [hoveredAreaId, setHoveredAreaId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  // Modo edição
  const [editMode, setEditMode] = useState(false);

  // Modal criar/editar área
  const [areaModal, setAreaModal] = useState(null); // { mode: "new"|"edit", data }
  const [areaForm, setAreaForm] = useState({
    code: "", label: "", areaType: "rua",
    x: 5, y: 5, width: 15, height: 15,
    capacity: "", category: "",
  });

  // Modal item
  const [itemModal, setItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    productCode: "", productName: "", quantity: "", slot: "", note: "",
  });
  const [editingItemId, setEditingItemId] = useState(null);

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

  const itemsByArea = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      if (!map[it.area_id]) map[it.area_id] = [];
      map[it.area_id].push(it);
    });
    return map;
  }, [items]);

  const filteredAreas = useMemo(() => {
    return areas
      .filter((a) => !filterType || a.area_type === filterType)
      .map((a) => {
        const matchesSearch = !search.trim() || (() => {
          const q = search.trim().toLowerCase();
          if (a.code.toLowerCase().includes(q)) return true;
          if (a.label.toLowerCase().includes(q)) return true;
          const areaItems = itemsByArea[a.id] || [];
          return areaItems.some(
            (i) =>
              i.product_code.toLowerCase().includes(q) ||
              (i.product_name || "").toLowerCase().includes(q)
          );
        })();
        return { ...a, matchesSearch };
      });
  }, [areas, itemsByArea, search, filterType]);

  // ---------- Áreas: salvar / excluir ----------

  function openNewArea() {
    setAreaForm({
      code: "", label: "", areaType: "rua",
      x: 5, y: 5, width: 15, height: 15,
      capacity: "", category: "",
    });
    setAreaModal({ mode: "new" });
  }

  function openEditArea(a) {
    setAreaForm({
      code: a.code,
      label: a.label,
      areaType: a.area_type,
      x: Number(a.x),
      y: Number(a.y),
      width: Number(a.width),
      height: Number(a.height),
      capacity: a.meta?.capacidade ?? "",
      category: a.meta?.categoria ?? "",
    });
    setAreaModal({ mode: "edit", id: a.id });
  }

  async function saveArea() {
    const code = areaForm.code.trim().toUpperCase();
    const label = areaForm.label.trim();
    if (!code) return setError("Digite o código da área.");
    if (!label) return setError("Digite o rótulo da área.");

    const payload = {
      code,
      label,
      area_type: areaForm.areaType,
      x: Number(areaForm.x) || 0,
      y: Number(areaForm.y) || 0,
      width: Number(areaForm.width) || 5,
      height: Number(areaForm.height) || 5,
      color: colorForType(areaForm.areaType),
      meta: {
        capacidade: areaForm.capacity || null,
        categoria: areaForm.category || null,
      },
    };

    if (areaModal.mode === "new") {
      const { error: err } = await addMapArea(payload);
      if (err) return setError(err.message);
    } else {
      const { error: err } = await updateMapArea(areaModal.id, payload);
      if (err) return setError(err.message);
    }
    setAreaModal(null);
    await loadAll();
  }

  async function handleDeleteArea(a) {
    if (!window.confirm(`Remover a área "${a.label}"? Os itens dentro dela também serão removidos.`)) return;
    const { error: err } = await deleteMapArea(a.id);
    if (err) return setError(err.message);
    if (selectedArea?.id === a.id) setSelectedArea(null);
    await loadAll();
  }

  // ---------- Itens ----------

  function openNewItem() {
    setEditingItemId(null);
    setItemForm({ productCode: "", productName: "", quantity: "", slot: "", note: "" });
    setItemModal(true);
  }

  function openEditItem(it) {
    setEditingItemId(it.id);
    setItemForm({
      productCode: it.product_code,
      productName: it.product_name || "",
      quantity: String(it.quantity ?? ""),
      slot: it.slot || "",
      note: it.note || "",
    });
    setItemModal(true);
  }

  async function saveItem() {
    if (!selectedArea) return;
    const code = itemForm.productCode.trim();
    if (!code) return setError("Digite o código do produto.");

    const payload = {
      areaId: selectedArea.id,
      productCode: code,
      productName: itemForm.productName,
      quantity: Number(itemForm.quantity) || 0,
      slot: itemForm.slot,
      note: itemForm.note,
    };

    if (editingItemId) {
      const { error: err } = await updateMapItem(editingItemId, {
        product_code: code,
        product_name: itemForm.productName.trim() || null,
        quantity: Number(itemForm.quantity) || 0,
        slot: itemForm.slot.trim() || null,
        note: itemForm.note.trim() || null,
      });
      if (err) return setError(err.message);
    } else {
      const { error: err } = await addMapItem(payload);
      if (err) return setError(err.message);
    }
    setItemModal(false);
    await loadAll();
  }

  async function handleDeleteItem(it) {
    if (!window.confirm(`Remover ${it.product_code}?`)) return;
    const { error: err } = await deleteMapItem(it.id);
    if (err) return setError(err.message);
    await loadAll();
  }

  // ---------- Render ----------

  const selectedAreaItems = selectedArea ? (itemsByArea[selectedArea.id] || []) : [];

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Mapa do estoque</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Layout interativo do galpão — clique em qualquer área pra ver o que tem dentro
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-small" onClick={loadAll}>
            <IconRefresh size={14} /> Atualizar
          </button>
          {isAdmin && (
            <>
              <button
                className={`btn-small ${editMode ? "btn-excel" : ""}`}
                onClick={() => setEditMode((v) => !v)}
              >
                <IconEdit size={14} /> {editMode ? "Sair do modo edição" : "Modo edição"}
              </button>
              <button className="btn-small btn-excel" onClick={openNewArea}>
                <IconPlus size={14} /> Nova área
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          {error}
          <button className="btn-small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Fechar</button>
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", display: "flex" }}>
              <IconSearch size={15} />
            </span>
            <input
              className="field"
              style={{ paddingLeft: 38 }}
              placeholder="Buscar por código de área ou produto..."
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

      <div style={{ display: "grid", gridTemplateColumns: selectedArea ? "1fr 380px" : "1fr", gap: 20 }}>
        {/* Mapa */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            position: "relative",
            width: "100%",
            paddingBottom: "75%", // aspecto 4:3
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--border)",
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(var(--border) 1px, transparent 1px),
                linear-gradient(90deg, var(--border) 1px, transparent 1px)
              `,
              backgroundSize: "5% 5%",
              opacity: 0.4,
            }} />

            {loading ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="loading-spinner" />
              </div>
            ) : areas.length === 0 ? (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                color: "var(--text-muted)",
                padding: 20,
                textAlign: "center",
              }}>
                <IconMapPin size={48} strokeWidth={1} />
                <div style={{ fontWeight: 600, fontSize: 15 }}>Nenhuma área cadastrada</div>
                {isAdmin && (
                  <button className="btn-small btn-excel" onClick={openNewArea}>
                    <IconPlus size={14} /> Criar primeira área
                  </button>
                )}
              </div>
            ) : (
              filteredAreas.map((a) => {
                const hidden = search && !a.matchesSearch;
                const isSelected = selectedArea?.id === a.id;
                const isHovered = hoveredAreaId === a.id;
                const stats = summarizeArea(a, items);
                const baseColor = a.color || colorForType(a.area_type);

                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      if (editMode) { openEditArea(a); return; }
                      setSelectedArea(a);
                    }}
                    onMouseEnter={() => setHoveredAreaId(a.id)}
                    onMouseLeave={() => setHoveredAreaId(null)}
                    style={{
                      position: "absolute",
                      left: `${a.x}%`,
                      top: `${a.y}%`,
                      width: `${a.width}%`,
                      height: `${a.height}%`,
                      background: isSelected ? baseColor : `${baseColor}${hidden ? "0A" : isHovered ? "DD" : "AA"}`,
                      border: `2px solid ${isSelected ? "var(--accent)" : baseColor}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 150ms ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      padding: 4,
                      overflow: "hidden",
                      boxShadow: isSelected ? "0 4px 16px rgba(0,0,0,0.25)" : isHovered ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                      transform: isHovered && !isSelected ? "scale(1.015)" : "scale(1)",
                      opacity: hidden ? 0.25 : 1,
                    }}
                    title={`${a.label} · ${stats.skus} SKUs · ${stats.totalQty} un`}
                  >
                    <div style={{
                      fontSize: Math.max(10, Math.min(14, a.width * 0.8)),
                      fontWeight: 800,
                      color: "#fff",
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                    }}>
                      {a.code}
                    </div>
                    {a.width >= 10 && (
                      <div style={{
                        fontSize: Math.max(9, Math.min(11, a.width * 0.6)),
                        color: "rgba(255,255,255,0.9)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}>
                        {stats.skus} SKU{stats.skus !== 1 ? "s" : ""}
                      </div>
                    )}
                    {a.height >= 12 && (
                      <div style={{
                        fontSize: 9.5,
                        color: "rgba(255,255,255,0.75)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}>
                        {labelForType(a.area_type)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Legenda */}
          <div style={{
            padding: "12px 18px",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 11.5,
            color: "var(--text-muted)",
          }}>
            {AREA_TYPES.filter((t) => areas.some((a) => a.area_type === t.value)).map((t) => (
              <div key={t.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color, display: "inline-block" }} />
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Painel lateral da área selecionada */}
        {selectedArea && (
          <div className="card" style={{ position: "sticky", top: 20, alignSelf: "flex-start", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                  {labelForType(selectedArea.area_type)}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {selectedArea.code}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  {selectedArea.label}
                </div>
              </div>
              <button
                onClick={() => setSelectedArea(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  display: "flex",
                }}
                aria-label="Fechar"
              >
                <IconX size={16} />
              </button>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: "1px solid var(--border)",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>SKUs</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedAreaItems.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Qtd. total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
                  {selectedAreaItems.reduce((s, i) => s + (i.quantity || 0), 0)}
                </div>
              </div>
              {selectedArea.meta?.capacidade && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Capacidade</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedArea.meta.capacidade}</div>
                </div>
              )}
              {selectedArea.meta?.categoria && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Categoria</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedArea.meta.categoria}</div>
                </div>
              )}
            </div>

            {isAdmin && (
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                <button className="btn-small" style={{ flex: 1 }} onClick={() => openEditArea(selectedArea)}>
                  <IconEdit size={13} /> Editar área
                </button>
                <button className="btn-small" style={{ padding: "6px 10px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleDeleteArea(selectedArea)}>
                  <IconTrash size={13} />
                </button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <IconPackage size={14} /> Itens
              </div>
              {isAdmin && (
                <button className="btn-small btn-excel" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={openNewItem}>
                  <IconPlus size={12} /> Item
                </button>
              )}
            </div>

            {selectedAreaItems.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-faint)", textAlign: "center", padding: "20px 0" }}>
                Nenhum item cadastrado nesta área.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedAreaItems.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>
                          {it.product_code}
                        </div>
                        {it.product_name && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            {it.product_name}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                          {it.slot && <span>Slot {it.slot}</span>}
                          <span>{it.quantity} un</span>
                        </div>
                        {it.note && (
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
                            {it.note}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button className="btn-small" style={{ padding: "5px 8px" }} onClick={() => openEditItem(it)} title="Editar">
                            <IconEdit size={11} />
                          </button>
                          <button className="btn-small" style={{ padding: "5px 8px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleDeleteItem(it)} title="Remover">
                            <IconTrash size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal área */}
      {areaModal && (
        <div className="kiosk-modal-backdrop" onClick={() => setAreaModal(null)}>
          <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">
                  {areaModal.mode === "new" ? "Nova área" : "Editar área"}
                </div>
                <div className="kiosk-modal-sub">Posição e tamanho em % do mapa (0-100)</div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setAreaModal(null)}>
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body">
              <div className="schedule-modal-grid">
                <div>
                  <label className="schedule-modal-label">Código *</label>
                  <input className="schedule-modal-field" placeholder="Ex: RUA-A1" value={areaForm.code} onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Tipo *</label>
                  <select className="schedule-modal-field" value={areaForm.areaType} onChange={(e) => setAreaForm({ ...areaForm, areaType: e.target.value })}>
                    {AREA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Rótulo *</label>
                  <input className="schedule-modal-field" placeholder="Ex: Rua A · Corredor 1" value={areaForm.label} onChange={(e) => setAreaForm({ ...areaForm, label: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">X (%)</label>
                  <input type="number" min="0" max="99" className="schedule-modal-field" value={areaForm.x} onChange={(e) => setAreaForm({ ...areaForm, x: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Y (%)</label>
                  <input type="number" min="0" max="99" className="schedule-modal-field" value={areaForm.y} onChange={(e) => setAreaForm({ ...areaForm, y: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Largura (%)</label>
                  <input type="number" min="2" max="100" className="schedule-modal-field" value={areaForm.width} onChange={(e) => setAreaForm({ ...areaForm, width: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Altura (%)</label>
                  <input type="number" min="2" max="100" className="schedule-modal-field" value={areaForm.height} onChange={(e) => setAreaForm({ ...areaForm, height: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Capacidade (opc.)</label>
                  <input className="schedule-modal-field" placeholder="Ex: 40 pallets" value={areaForm.capacity} onChange={(e) => setAreaForm({ ...areaForm, capacity: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Categoria (opc.)</label>
                  <input className="schedule-modal-field" placeholder="Ex: hidráulica" value={areaForm.category} onChange={(e) => setAreaForm({ ...areaForm, category: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setAreaModal(null)}>Cancelar</button>
              <button className="kiosk-btn kiosk-btn-primary" onClick={saveArea}>
                <IconCheck size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal item */}
      {itemModal && selectedArea && (
        <div className="kiosk-modal-backdrop" onClick={() => setItemModal(false)}>
          <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">
                  {editingItemId ? "Editar item" : "Novo item"}
                </div>
                <div className="kiosk-modal-sub">{selectedArea.code} · {selectedArea.label}</div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setItemModal(false)}>
                <IconX size={18} />
              </button>
            </div>

            <div className="kiosk-modal-body">
              <div className="schedule-modal-grid">
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Código do produto *</label>
                  <input className="schedule-modal-field" style={{ fontFamily: "var(--font-mono)" }} placeholder="Ex: TRO-1234" value={itemForm.productCode} onChange={(e) => setItemForm({ ...itemForm, productCode: e.target.value })} autoFocus />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Nome do produto</label>
                  <input className="schedule-modal-field" placeholder="Opcional" value={itemForm.productName} onChange={(e) => setItemForm({ ...itemForm, productName: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Quantidade</label>
                  <input type="number" min="0" className="schedule-modal-field" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="schedule-modal-label">Slot</label>
                  <input className="schedule-modal-field" placeholder="Ex: A1-P2-N3" value={itemForm.slot} onChange={(e) => setItemForm({ ...itemForm, slot: e.target.value })} />
                </div>
                <div className="schedule-modal-full">
                  <label className="schedule-modal-label">Observação</label>
                  <textarea className="schedule-modal-field" rows={2} style={{ resize: "none" }} value={itemForm.note} onChange={(e) => setItemForm({ ...itemForm, note: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setItemModal(false)}>Cancelar</button>
              <button className="kiosk-btn kiosk-btn-primary" onClick={saveItem}>
                <IconCheck size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
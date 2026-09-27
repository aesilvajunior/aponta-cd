import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMapAreas,
  updateMapArea,
  deleteMapArea,
  fetchMapItems,
  deleteMapItem,
  AREA_TYPES,
  SIDES,
  colorForType,
  labelForType,
  labelForSide,
  groupItemsBySide,
  groupItemsByCategory,
  summarizeArea,
} from "../lib/stockMap";
import { supabase } from "../supabaseClient";
import StockMapItemPicker from "./StockMapItemPicker";
import {
  IconMapPin,
  IconEdit,
  IconTrash,
  IconX,
  IconSearch,
  IconRefresh,
  IconPackage,
  IconPlus,
  IconGrid,
  IconList,
} from "./Icons";

export default function StockMap({ isAdmin }) {
  const [areas, setAreas] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedArea, setSelectedArea] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Painel lateral: "lista" | "categoria"
  const [panelView, setPanelView] = useState("lista");

  // Picker de item (novo/editar)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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
    const q = search.trim().toLowerCase();
    return areas
      .filter((a) => !filterType || a.area_type === filterType)
      .map((a) => {
        let matches = true;
        if (q) {
          matches =
            a.code.toLowerCase().includes(q) ||
            a.label.toLowerCase().includes(q) ||
            (itemsByArea[a.id] || []).some(
              (i) =>
                i.product_code.toLowerCase().includes(q) ||
                (i.product_name || "").toLowerCase().includes(q) ||
                (i.category || "").toLowerCase().includes(q)
            );
        }
        return { ...a, matchesSearch: matches };
      });
  }, [areas, itemsByArea, search, filterType]);

  async function handleDeleteArea(a) {
    if (!window.confirm(`Remover a área "${a.label}"? Os itens dentro dela também serão removidos.`)) return;
    const { error: err } = await deleteMapArea(a.id);
    if (err) return setError(err.message);
    if (selectedArea?.id === a.id) setSelectedArea(null);
    await loadAll();
  }

  async function handleDeleteItem(it) {
    if (!window.confirm(`Remover ${it.product_code}?`)) return;
    const { error: err } = await deleteMapItem(it.id);
    if (err) return setError(err.message);
    await loadAll();
  }

  function openNewItem() {
    setEditingItem(null);
    setPickerOpen(true);
  }

  function openEditItem(it) {
    setEditingItem(it);
    setPickerOpen(true);
  }

  const selectedAreaItems = selectedArea ? (itemsByArea[selectedArea.id] || []) : [];
  const selectedAreaStats = selectedArea ? summarizeArea(selectedArea, items) : null;
  const bySide = selectedArea?.has_sides ? groupItemsBySide(selectedAreaItems) : null;
  const byCategory = selectedArea ? groupItemsByCategory(selectedAreaItems) : [];

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Mapa do estoque</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Layout do galpão térreo — clique em qualquer área pra ver o que tem dentro
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
            >
              <IconEdit size={14} /> {editMode ? "Sair do modo edição" : "Modo edição"}
            </button>
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
              placeholder="Buscar por área, código, nome ou categoria..."
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

      <div style={{ display: "grid", gridTemplateColumns: selectedArea ? "1fr 420px" : "1fr", gap: 20 }}>
        {/* Mapa */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            position: "relative",
            width: "100%",
            paddingBottom: "75%",
            background: "var(--surface-sunken)",
            borderBottom: "1px solid var(--border)",
          }}>
            {/* Norte */}
            <div style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              gap: 6,
              zIndex: 10,
            }}>
              <IconMapPin size={12} /> NORTE (fundo)
            </div>

            {/* Grid */}
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(var(--border) 1px, transparent 1px),
                linear-gradient(90deg, var(--border) 1px, transparent 1px)
              `,
              backgroundSize: "5% 5%",
              opacity: 0.3,
            }} />

            {/* Blocos */}
            {loading ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="loading-spinner" />
              </div>
            ) : filteredAreas.length === 0 ? (
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
                <div style={{ fontSize: 12.5 }}>
                  Rode o SQL de seed no Supabase pra pré-cadastrar o layout do galpão.
                </div>
              </div>
            ) : (
              filteredAreas.map((a) => {
                const hidden = search && !a.matchesSearch;
                const isSelected = selectedArea?.id === a.id;
                const isCorridor = a.code === "CORREDOR-CENTRAL";
                const stats = summarizeArea(a, items);
                const baseColor = a.color || colorForType(a.area_type);

                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      if (isCorridor && !editMode) return;
                      if (editMode) return; // edição só via botão no painel
                      setSelectedArea(a);
                    }}
                    style={{
                      position: "absolute",
                      left: `${a.x}%`,
                      top: `${a.y}%`,
                      width: `${a.width}%`,
                      height: `${a.height}%`,
                      background: isCorridor
                        ? "transparent"
                        : isSelected
                        ? baseColor
                        : `${baseColor}${hidden ? "0A" : "CC"}`,
                      border: isCorridor
                        ? `1px dashed ${baseColor}66`
                        : `1.5px solid ${isSelected ? "var(--accent)" : baseColor}`,
                      borderRadius: 6,
                      cursor: isCorridor ? "default" : "pointer",
                      transition: "all 150ms ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      padding: 2,
                      overflow: "hidden",
                      boxShadow: isSelected ? "0 4px 16px rgba(0,0,0,0.3)" : "none",
                      opacity: hidden ? 0.2 : 1,
                    }}
                    title={`${a.label}${stats.skus > 0 ? ` · ${stats.skus} SKUs · ${stats.totalQty} un` : ""}`}
                  >
                    {!isCorridor && (
                      <>
                        <div style={{
                          fontSize: Math.max(9, Math.min(13, a.width * 0.9)),
                          fontWeight: 800,
                          color: "#fff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                          lineHeight: 1.1,
                        }}>
                          {a.code}
                        </div>
                        {a.height >= 8 && stats.skus > 0 && (
                          <div style={{
                            fontSize: 9,
                            color: "rgba(255,255,255,0.9)",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}>
                            {stats.skus}
                          </div>
                        )}
                      </>
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

        {/* Painel lateral */}
        {selectedArea && (
          <div className="card" style={{ position: "sticky", top: 20, alignSelf: "flex-start", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
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

            {/* KPIs */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
              paddingBottom: 14,
              borderBottom: "1px solid var(--border)",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>SKUs</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedAreaStats.skus}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Qtd. total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{selectedAreaStats.totalQty}</div>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <button className="btn-small" style={{ flex: 1, color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => handleDeleteArea(selectedArea)}>
                  <IconTrash size={13} /> Remover área
                </button>
              </div>
            )}

            {/* Abas: lista / categoria */}
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
              <button className="btn-small btn-excel" style={{ width: "100%", marginBottom: 14 }} onClick={openNewItem}>
                <IconPlus size={14} /> Adicionar item
              </button>
            )}

            {selectedAreaItems.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-faint)", textAlign: "center", padding: "20px 0" }}>
                Nenhum item cadastrado nesta área.
              </div>
            ) : (
              <>
                {/* Vista: Lista (com PAR/ÍMPAR se tiver lados) */}
                {panelView === "lista" && (
                  <>
                    {selectedArea.has_sides && bySide ? (
                      <>
                        {/* PAR */}
                        <SideSection
                          title="PAR · lado direito"
                          items={bySide.par.filter((i) => i.side === "par")}
                          isAdmin={isAdmin}
                          onEdit={openEditItem}
                          onDelete={handleDeleteItem}
                        />

                        {/* ÍMPAR */}
                        <SideSection
                          title="ÍMPAR · lado esquerdo"
                          items={bySide.impar}
                          isAdmin={isAdmin}
                          onEdit={openEditItem}
                          onDelete={handleDeleteItem}
                        />
                      </>
                    ) : (
                      <SimpleItemList
                        items={selectedAreaItems}
                        isAdmin={isAdmin}
                        onEdit={openEditItem}
                        onDelete={handleDeleteItem}
                      />
                    )}
                  </>
                )}

                {/* Vista: Categoria */}
                {panelView === "categoria" && (
                  <>
                    {byCategory.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--text-faint)", textAlign: "center", padding: "20px 0" }}>
                        Nenhum item com categoria.
                      </div>
                    ) : (
                      byCategory.map((cat) => (
                        <div key={cat.category} style={{ marginBottom: 14 }}>
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 10px",
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            marginBottom: 8,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{cat.category}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              {cat.skus} SKU · {cat.totalQty} un
                            </div>
                          </div>
                          <SimpleItemList
                            items={cat.items}
                            isAdmin={isAdmin}
                            onEdit={openEditItem}
                            onDelete={handleDeleteItem}
                            compact
                          />
                        </div>
                      ))
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Picker de item */}
      {pickerOpen && selectedArea && (
        <StockMapItemPicker
          area={selectedArea}
          item={editingItem}
          onClose={() => setPickerOpen(false)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}

// Sub-componente: seção por lado (PAR / ÍMPAR)
function SideSection({ title, items, isAdmin, onEdit, onDelete }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 10px",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        borderRadius: 6,
        marginBottom: 8,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        {title}
        <span style={{ fontWeight: 600, fontSize: 11.5 }}>
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "8px 0 12px 0" }}>
          Nenhum item neste lado.
        </div>
      ) : (
        <SimpleItemList items={items} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

// Sub-componente: lista simples de itens
function SimpleItemList({ items, isAdmin, onEdit, onDelete, compact = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: compact ? "8px 10px" : "10px 12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700 }}>
                  {it.product_code}
                </span>
                {it.quantity > 0 && (
                  <span style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    padding: "1px 7px",
                    borderRadius: 4,
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}>
                    {it.quantity} un
                  </span>
                )}
              </div>
              {it.product_name && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  {it.product_name}
                </div>
              )}
              {it.slot && (
                <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>
                  Slot {it.slot}
                </div>
              )}
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button className="btn-small" style={{ padding: "4px 7px" }} onClick={() => onEdit(it)} title="Editar">
                  <IconEdit size={11} />
                </button>
                <button className="btn-small" style={{ padding: "4px 7px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => onDelete(it)} title="Remover">
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
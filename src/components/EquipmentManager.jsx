import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  fetchEquipment,
  addEquipment,
  updateEquipment,
  deleteEquipment,
  fetchEquipmentMaintenance,
  addEquipmentMaintenance,
  deleteEquipmentMaintenance,
} from "../lib/api";
import { fmtDate } from "../lib/format";
import {
  IconTruck,
  IconPlus,
  IconTrash,
  IconEdit,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconClock,
} from "./Icons";

const CATEGORIES = [
  { value: "empilhadeira", label: "Empilhadeira" },
  { value: "coletor", label: "Coletor" },
  { value: "transpaleteira", label: "Transpaleteira" },
  { value: "balanca", label: "Balança" },
  { value: "outro", label: "Outro" },
];

const STATUS = {
  ativo: { label: "Ativo", color: "var(--ok)" },
  manutencao: { label: "Em manutenção", color: "var(--warning)" },
  inativo: { label: "Inativo", color: "var(--text-muted)" },
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  return Math.round((d - new Date()) / (1000 * 60 * 60 * 24));
}

export default function EquipmentManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "outro",
    serialNumber: "",
    location: "",
    purchaseDate: "",
    lastMaintenance: "",
    nextMaintenance: "",
    maintenanceIntervalDays: 90,
    status: "ativo",
    note: "",
  });

  const [expandedId, setExpandedId] = useState(null);
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [newMaint, setNewMaint] = useState({
    maintenanceType: "preventiva",
    description: "",
    performedBy: "",
    cost: "",
    performedAt: new Date().toISOString().slice(0, 10),
    nextDueAt: "",
    note: "",
  });

  async function load() {
    setLoading(true);
    const { data } = await fetchEquipment();
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("equipment")
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) return setError("Código e nome são obrigatórios.");
    setBusy(true);
    setError("");
    if (editingId) {
      const { error: err } = await updateEquipment(editingId, {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category,
        serial_number: form.serialNumber.trim() || null,
        location: form.location.trim() || null,
        purchase_date: form.purchaseDate || null,
        last_maintenance: form.lastMaintenance || null,
        next_maintenance: form.nextMaintenance || null,
        maintenance_interval_days: Number(form.maintenanceIntervalDays) || 90,
        status: form.status,
        note: form.note.trim() || null,
      });
      setBusy(false);
      if (err) return setError(err.message);
    } else {
      const { error: err } = await addEquipment(form);
      setBusy(false);
      if (err) return setError(err.message);
    }
    setShowForm(false);
    setEditingId(null);
    resetForm();
    await load();
  }

  function resetForm() {
    setForm({
      code: "", name: "", category: "outro", serialNumber: "", location: "",
      purchaseDate: "", lastMaintenance: "", nextMaintenance: "",
      maintenanceIntervalDays: 90, status: "ativo", note: "",
    });
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      code: item.code, name: item.name, category: item.category || "outro",
      serialNumber: item.serial_number || "", location: item.location || "",
      purchaseDate: item.purchase_date || "",
      lastMaintenance: item.last_maintenance || "",
      nextMaintenance: item.next_maintenance || "",
      maintenanceIntervalDays: item.maintenance_interval_days || 90,
      status: item.status || "ativo", note: item.note || "",
    });
    setShowForm(true);
  }

  async function remove(item) {
    if (!window.confirm(`Desativar "${item.name}"?`)) return;
    await deleteEquipment(item.id);
    await load();
  }

  async function openMaintenance(item) {
    if (expandedId === item.id) { setExpandedId(null); return; }
    setExpandedId(item.id);
    const { data } = await fetchEquipmentMaintenance(item.id);
    setMaintenanceList(data || []);
  }

  async function saveMaintenance(equipmentId) {
    setBusy(true);
    const { error: err } = await addEquipmentMaintenance({
      equipmentId,
      maintenanceType: newMaint.maintenanceType,
      description: newMaint.description,
      performedBy: newMaint.performedBy,
      cost: newMaint.cost ? Number(newMaint.cost) : null,
      performedAt: newMaint.performedAt ? new Date(newMaint.performedAt).toISOString() : undefined,
      nextDueAt: newMaint.nextDueAt || null,
      note: newMaint.note,
    });
    // Atualiza last_maintenance e next_maintenance do equipamento
    if (!err) {
      await updateEquipment(equipmentId, {
        last_maintenance: newMaint.performedAt || new Date().toISOString().slice(0, 10),
        next_maintenance: newMaint.nextDueAt || null,
      });
    }
    setBusy(false);
    if (err) return setError(err.message);
    setNewMaint({
      maintenanceType: "preventiva",
      description: "",
      performedBy: "",
      cost: "",
      performedAt: new Date().toISOString().slice(0, 10),
      nextDueAt: "",
      note: "",
    });
    const { data } = await fetchEquipmentMaintenance(equipmentId);
    setMaintenanceList(data || []);
    await load();
  }

  async function removeMaintenance(id, equipmentId) {
    if (!window.confirm("Remover este registro de manutenção?")) return;
    await deleteEquipmentMaintenance(id);
    const { data } = await fetchEquipmentMaintenance(equipmentId);
    setMaintenanceList(data || []);
  }

  const alerts = useMemo(() => {
    return items.filter((i) => {
      const d = daysUntil(i.next_maintenance);
      return d !== null && d <= 7;
    });
  }, [items]);

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Equipamentos</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Manutenção preventiva e corretiva
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-small" onClick={load}><IconRefresh size={14} /> Atualizar</button>
          <button className="btn-small btn-excel" onClick={() => { setEditingId(null); resetForm(); setShowForm(true); }}>
            <IconPlus size={14} /> Novo
          </button>
        </div>
      </div>

      {error && <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      {alerts.length > 0 && (
        <div className="alert-card alert-warning" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertTriangle size={16} />
            <strong>{alerts.length} equipamento(s) precisam de manutenção nos próximos 7 dias</strong>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">{editingId ? "Editar equipamento" : "Novo equipamento"}</div>
          <div className="schedule-modal-grid">
            <div>
              <label className="schedule-modal-label">Código *</label>
              <input className="schedule-modal-field" value={form.code} onChange={(e) => set("code", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Nome *</label>
              <input className="schedule-modal-field" value={form.name} onChange={(e) => set("name", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Categoria</label>
              <select className="schedule-modal-field" value={form.category} onChange={(e) => set("category", e.target.value)} disabled={busy}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="schedule-modal-label">Nº série</label>
              <input className="schedule-modal-field" value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Localização</label>
              <input className="schedule-modal-field" value={form.location} onChange={(e) => set("location", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Última manutenção</label>
              <input type="date" className="schedule-modal-field" value={form.lastMaintenance} onChange={(e) => set("lastMaintenance", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Próxima manutenção</label>
              <input type="date" className="schedule-modal-field" value={form.nextMaintenance} onChange={(e) => set("nextMaintenance", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Intervalo (dias)</label>
              <input type="number" min="1" className="schedule-modal-field" value={form.maintenanceIntervalDays} onChange={(e) => set("maintenanceIntervalDays", e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="schedule-modal-label">Status</label>
              <select className="schedule-modal-field" value={form.status} onChange={(e) => set("status", e.target.value)} disabled={busy}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="schedule-modal-full">
              <label className="schedule-modal-label">Observação</label>
              <input className="schedule-modal-field" value={form.note} onChange={(e) => set("note", e.target.value)} disabled={busy} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-small btn-excel" onClick={save} disabled={busy}>
              <IconCheck size={14} /> {busy ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn-small" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="schedule-empty">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="schedule-empty">
            <div className="schedule-empty-icon"><IconTruck size={36} /></div>
            <div>Nenhum equipamento cadastrado.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => {
            const st = STATUS[item.status] || STATUS.ativo;
            const du = daysUntil(item.next_maintenance);
            const duColor = du === null ? "var(--text-muted)" : du < 0 ? "var(--danger)" : du <= 7 ? "var(--warning)" : "var(--ok)";
            const isOpen = expandedId === item.id;
            return (
              <div key={item.id} className="card" style={{ borderLeft: `4px solid ${st.color}` }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{item.code}</span>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{item.name}</span>
                      <span style={{ background: "var(--surface-raised)", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>
                      {item.category}{item.location && ` · ${item.location}`}{item.serial_number && ` · ${item.serial_number}`}
                    </div>
                    {item.next_maintenance && (
                      <div style={{ fontSize: 12, marginTop: 4, color: duColor, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        <IconClock size={12} />
                        {du < 0
                          ? `Manutenção atrasada há ${Math.abs(du)} dia(s)`
                          : du === 0
                          ? "Manutenção hoje"
                          : `Manutenção em ${du} dia(s) (${fmtDate(item.next_maintenance + "T12:00:00")})`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-small" onClick={() => openMaintenance(item)} style={{ padding: "6px 10px" }}>
                      Histórico
                    </button>
                    <button className="btn-small" onClick={() => startEdit(item)} style={{ padding: "6px 10px" }}>
                      <IconEdit size={12} />
                    </button>
                    <button className="btn-small" onClick={() => remove(item)} style={{ padding: "6px 10px", color: "var(--danger)", borderColor: "var(--danger)" }}>
                      <IconTrash size={12} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Registrar manutenção</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                      <div>
                        <label className="schedule-modal-label">Tipo</label>
                        <select className="schedule-modal-field" value={newMaint.maintenanceType} onChange={(e) => setNewMaint((m) => ({ ...m, maintenanceType: e.target.value }))}>
                          <option value="preventiva">Preventiva</option>
                          <option value="corretiva">Corretiva</option>
                          <option value="inspecao">Inspeção</option>
                        </select>
                      </div>
                      <div>
                        <label className="schedule-modal-label">Data</label>
                        <input type="date" className="schedule-modal-field" value={newMaint.performedAt} onChange={(e) => setNewMaint((m) => ({ ...m, performedAt: e.target.value }))} />
                      </div>
                      <div>
                        <label className="schedule-modal-label">Responsável</label>
                        <input className="schedule-modal-field" value={newMaint.performedBy} onChange={(e) => setNewMaint((m) => ({ ...m, performedBy: e.target.value }))} />
                      </div>
                      <div>
                        <label className="schedule-modal-label">Custo (R$)</label>
                        <input type="number" className="schedule-modal-field" value={newMaint.cost} onChange={(e) => setNewMaint((m) => ({ ...m, cost: e.target.value }))} />
                      </div>
                      <div>
                        <label className="schedule-modal-label">Próxima</label>
                        <input type="date" className="schedule-modal-field" value={newMaint.nextDueAt} onChange={(e) => setNewMaint((m) => ({ ...m, nextDueAt: e.target.value }))} />
                      </div>
                      <div className="schedule-modal-full">
                        <label className="schedule-modal-label">Descrição</label>
                        <input className="schedule-modal-field" value={newMaint.description} onChange={(e) => setNewMaint((m) => ({ ...m, description: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button className="btn-small btn-excel" onClick={() => saveMaintenance(item.id)} disabled={busy}>
                        <IconPlus size={14} /> Adicionar manutenção
                      </button>
                    </div>

                    {maintenanceList.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Histórico ({maintenanceList.length})</div>
                        {maintenanceList.map((m) => (
                          <div key={m.id} style={{ display: "flex", gap: 10, padding: "8px 10px", background: "var(--surface-raised)", borderRadius: 8, marginBottom: 6 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.maintenance_type} · {fmtDate(m.performed_at)}</div>
                              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.description || "—"}{m.performed_by && ` · ${m.performed_by}`}{m.cost && ` · R$ ${m.cost}`}</div>
                            </div>
                            <button className="btn-small" style={{ padding: "4px 8px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => removeMaintenance(m.id, item.id)}>
                              <IconTrash size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
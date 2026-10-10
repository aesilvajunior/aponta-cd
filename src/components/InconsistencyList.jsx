import React, { useCallback, useEffect, useState } from "react";
import {
  fetchInconsistencies, createInconsistency, updateInconsistency, deleteInconsistency,
} from "../lib/api";

export default function InconsistencyList({ currentOperator }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("todas");
  const [form, setForm] = useState({ location: "", description: "", action_taken: "", responsible: "" });
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await fetchInconsistencies({ status: filter });
    setItems(data ?? []);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!form.location || !form.description) return;
    await createInconsistency({
      ...form,
      created_by: currentOperator?.code,
      created_name: currentOperator?.name,
    });
    setForm({ location: "", description: "", action_taken: "", responsible: "" });
    setOpen(false);
    load();
  }

  async function changeStatus(item, status) {
    const patch = { status };
    if (status === "resolvida") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = currentOperator?.code;
      patch.resolved_name = currentOperator?.name;
    }
    await updateInconsistency(item.id, patch);
    load();
  }

  async function remove(id) {
    if (!confirm("Excluir esta inconsistência?")) return;
    await deleteInconsistency(id);
    load();
  }

  return (
    <div className="inc-wrap">
      <div className="inc-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="aberta">Abertas</option>
          <option value="em_andamento">Em andamento</option>
          <option value="resolvida">Resolvidas</option>
        </select>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancelar" : "+ Nova"}
        </button>
      </div>

      {open && (
        <form className="inc-form" onSubmit={submit}>
          <input placeholder="Local (ex: Ruas)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
          <textarea placeholder="Descrição da inconsistência" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={2} />
          <input placeholder="Ação tomada (opcional)" value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} />
          <input placeholder="Responsável pela ação (opcional)" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          <button className="btn btn-primary" type="submit">Registrar</button>
        </form>
      )}

      <ul className="inc-list">
        {items.length === 0 && <li className="inc-empty">Nenhuma inconsistência {filter !== "todas" ? `(${filter})` : ""}.</li>}
        {items.map((it) => (
          <li key={it.id} className={`inc-item st-${it.status}`}>
            <div className="inc-head">
              <strong>{it.location}</strong>
              <span className={`inc-badge ${it.status}`}>{it.status.replace("_", " ")}</span>
            </div>
            <p>{it.description}</p>
            {it.action_taken && <small><b>Ação:</b> {it.action_taken} {it.responsible && `— ${it.responsible}`}</small>}
            <small className="inc-meta">
              {new Date(it.created_at).toLocaleString("pt-BR")}
              {it.created_name && ` • por ${it.created_name}`}
            </small>
            <div className="inc-actions">
              {it.status !== "em_andamento" && it.status !== "resolvida" && (
                <button onClick={() => changeStatus(it, "em_andamento")}>Em andamento</button>
              )}
              {it.status !== "resolvida" && (
                <button onClick={() => changeStatus(it, "resolvida")}>✓ Resolver</button>
              )}
              {it.status === "resolvida" && (
                <button onClick={() => changeStatus(it, "aberta")}>Reabrir</button>
              )}
              <button className="danger" onClick={() => remove(it.id)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
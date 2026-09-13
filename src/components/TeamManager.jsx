import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function TeamManager({ operators, activities, adminPin, refreshConfig }) {
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  async function addOperator() {
    if (!newOpName.trim()) return;
    const maxCode = operators.reduce((m, o) => Math.max(m, parseInt(o.code, 10) || 0), 100);
    const code = String(maxCode + 1);
    await supabase.from("operators").insert({ code, name: newOpName.trim(), role: newOpRole.trim() || "-" });
    setNewOpName("");
    setNewOpRole("");
    refreshConfig();
  }

  async function removeOperator(code) {
    await supabase.from("operators").delete().eq("code", code);
    refreshConfig();
  }

  async function addActivity() {
    const name = newActivity.trim();
    if (!name || activities.some((a) => a.name === name)) return;
    await supabase.from("activities").insert({ name, active: true });
    setNewActivity("");
    refreshConfig();
  }

  async function removeActivity(name) {
    await supabase.from("activities").delete().eq("name", name);
    refreshConfig();
  }

  async function changePin() {
    if (newPin.trim().length < 4) return;
    setSavingPin(true);
    await supabase.from("admin_config").update({ pin: newPin.trim() }).eq("id", 1);
    setNewPin("");
    setSavingPin(false);
    refreshConfig();
  }

  return (
    <div>
      <h1 className="page-title">Equipe e atividades</h1>
      <p className="page-sub">
        Gerencie os operadores e a lista de atividades disponíveis no quiosque. Como as atividades mudam
        mês a mês (rodízio para todo mundo aprender todas as tarefas), atualize a lista aqui sempre que
        trocar — os registros antigos ficam preservados no histórico com o nome da atividade da época.
      </p>

      <div className="card" style={{ maxWidth: 360, marginBottom: 20 }}>
        <div className="card-title">PIN de administrador</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="field"
            style={{ flex: 1 }}
            placeholder="Novo PIN (mín. 4 dígitos)"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
          <button className="btn-small" onClick={changePin} disabled={savingPin}>
            Alterar
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8, marginBottom: 0 }}>
          PIN atual: {adminPin}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-title">Operadores</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="field" style={{ flex: 1 }} placeholder="Nome" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} />
            <input className="field" style={{ width: 130 }} placeholder="Função" value={newOpRole} onChange={(e) => setNewOpRole(e.target.value)} />
            <button className="btn-small" onClick={addOperator}>Adicionar</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Função</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {operators.map((o) => (
                <tr key={o.code}>
                  <td>{o.code}</td>
                  <td>{o.name}</td>
                  <td>{o.role}</td>
                  <td>
                    <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeOperator(o.code)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Atividades do mês</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="field" style={{ flex: 1 }} placeholder="Nova atividade" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} />
            <button className="btn-small" onClick={addActivity}>Adicionar</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Atividade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td>
                    <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeActivity(a.name)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

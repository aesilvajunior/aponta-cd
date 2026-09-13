import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function TeamManager({ operators, activities, adminPin, refreshConfig }) {
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState("");
  const [newOpCode, setNewOpCode] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [formError, setFormError] = useState("");

  const [editingCode, setEditingCode] = useState(null);
  const [editValues, setEditValues] = useState({ code: "", name: "", role: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [editingActivity, setEditingActivity] = useState(null);
  const [editActivityValue, setEditActivityValue] = useState("");
  const [savingActivityEdit, setSavingActivityEdit] = useState(false);

  function nextFreeCode() {
    const maxCode = operators.reduce((m, o) => Math.max(m, parseInt(o.code, 10) || 0), 100);
    return String(maxCode + 1);
  }

  async function addOperator() {
    setFormError("");
    const name = newOpName.trim();
    if (!name) return setFormError("Digite o nome do operador.");
    const code = newOpCode.trim() || nextFreeCode();
    if (!/^\d{1,4}$/.test(code)) return setFormError("O código deve conter só números (até 4 dígitos).");
    if (operators.some((o) => o.code === code)) return setFormError(`Já existe um operador com o código ${code}.`);
    const { error } = await supabase.from("operators").insert({ code, name, role: newOpRole.trim() || "-" });
    if (error) return setFormError("Erro ao salvar. Tente novamente.");
    setNewOpName("");
    setNewOpRole("");
    setNewOpCode("");
    refreshConfig();
  }

  async function removeOperator(code) {
    if (!window.confirm("Remover este operador? Os registros antigos dele continuam no histórico.")) return;
    await supabase.from("operators").delete().eq("code", code);
    refreshConfig();
  }

  function startEdit(op) {
    setEditingCode(op.code);
    setEditValues({ code: op.code, name: op.name, role: op.role || "" });
    setFormError("");
  }

  function cancelEdit() {
    setEditingCode(null);
  }

  async function saveEdit(originalCode) {
    setFormError("");
    const code = editValues.code.trim();
    const name = editValues.name.trim();
    if (!name) return setFormError("O nome não pode ficar em branco.");
    if (!/^\d{1,4}$/.test(code)) return setFormError("O código deve conter só números (até 4 dígitos).");
    if (code !== originalCode && operators.some((o) => o.code === code)) {
      return setFormError(`Já existe um operador com o código ${code}.`);
    }
    setSavingEdit(true);
    if (code !== originalCode) {
      const { error: insertErr } = await supabase.from("operators").insert({ code, name, role: editValues.role.trim() || "-" });
      if (!insertErr) {
        await supabase.from("operators").delete().eq("code", originalCode);
      } else {
        setFormError("Erro ao salvar (código pode já estar em uso).");
        setSavingEdit(false);
        return;
      }
    } else {
      await supabase.from("operators").update({ name, role: editValues.role.trim() || "-" }).eq("code", originalCode);
    }
    setSavingEdit(false);
    setEditingCode(null);
    refreshConfig();
  }

  async function addActivity() {
    const name = newActivity.trim();
    if (!name) return;
    if (activities.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`A atividade "${name}" já existe.`);
    }
    setFormError("");
    await supabase.from("activities").insert({ name, active: true });
    setNewActivity("");
    refreshConfig();
  }

  async function removeActivity(name) {
    if (!window.confirm(`Remover a atividade "${name}" da lista deste mês?`)) return;
    await supabase.from("activities").delete().eq("name", name);
    refreshConfig();
  }

  function startEditActivity(act) {
    setEditingActivity(act.name);
    setEditActivityValue(act.name);
    setFormError("");
  }

  function cancelEditActivity() {
    setEditingActivity(null);
  }

  async function saveEditActivity(originalName) {
    const name = editActivityValue.trim();
    if (!name) return setFormError("O nome da atividade não pode ficar em branco.");
    if (name.toLowerCase() !== originalName.toLowerCase() && activities.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`Já existe uma atividade chamada "${name}".`);
    }
    setFormError("");
    setSavingActivityEdit(true);
    if (name !== originalName) {
      const { error: insertErr } = await supabase.from("activities").insert({ name, active: true });
      if (!insertErr) {
        await supabase.from("activities").delete().eq("name", originalName);
      } else {
        setFormError("Erro ao renomear (nome pode já estar em uso).");
        setSavingActivityEdit(false);
        return;
      }
    }
    setSavingActivityEdit(false);
    setEditingActivity(null);
    refreshConfig();
  }

  async function changePin() {
    const pin = newPin.trim();
    if (pin.length < 4) return setFormError("O PIN precisa ter pelo menos 4 dígitos.");
    setFormError("");
    setSavingPin(true);
    await supabase.from("admin_config").update({ pin }).eq("id", 1);
    setNewPin("");
    setSavingPin(false);
    refreshConfig();
  }

  return (
    <div>
      <h1 className="page-title">Equipe e atividades</h1>
      <p className="page-sub">
        As atividades mudam mês a mês pelo rodízio — atualize a lista aqui sempre que trocar. Registros
        antigos ficam preservados no histórico com o nome da atividade da época.
      </p>

      {formError && (
        <div className="confirm-box" style={{ marginBottom: 18, maxWidth: 560, padding: "10px 14px" }}>
          <span style={{ color: "var(--danger)", fontSize: 13 }}>{formError}</span>
        </div>
      )}

      <div className="card" style={{ maxWidth: 340, marginBottom: 20 }}>
        <div className="card-title">PIN de administrador</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="field"
            style={{ flex: 1 }}
            placeholder="Novo PIN"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn-small" onClick={changePin} disabled={savingPin}>
            {savingPin ? "Salvando..." : "Alterar"}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8, marginBottom: 0 }}>PIN atual: {adminPin}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-title">Operadores</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input className="field" style={{ width: 64 }} placeholder="Cód." value={newOpCode} onChange={(e) => setNewOpCode(e.target.value.replace(/\D/g, ""))} />
            <input className="field" style={{ flex: 1, minWidth: 100 }} placeholder="Nome" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} />
            <input className="field" style={{ width: 140 }} placeholder="Função" value={newOpRole} onChange={(e) => setNewOpRole(e.target.value)} />
            <button className="btn-small" onClick={addOperator}>Adicionar</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Cód.</th><th>Nome</th><th>Função</th><th></th></tr></thead>
            <tbody>
              {operators.map((o) => {
                const isEditing = editingCode === o.code;
                return (
                  <tr key={o.code}>
                    {isEditing ? (
                      <>
                        <td><input className="field" style={{ width: 52, padding: "4px 6px" }} value={editValues.code} onChange={(e) => setEditValues((v) => ({ ...v, code: e.target.value.replace(/\D/g, "") }))} /></td>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editValues.name} onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))} /></td>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editValues.role} onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEdit(o.code)} disabled={savingEdit}>Salvar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEdit}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{o.code}</td>
                        <td style={{ fontFamily: "var(--font-display)" }}>{o.name}</td>
                        <td>{o.role}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEdit(o)}>Editar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeOperator(o.code)}>Remover</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {operators.length === 0 && <tr><td colSpan={4}>Nenhum operador cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Atividades do mês</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input className="field" style={{ flex: 1 }} placeholder="Nova atividade" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} />
            <button className="btn-small" onClick={addActivity}>Adicionar</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Atividade</th><th></th></tr></thead>
            <tbody>
              {activities.map((a) => {
                const isEditing = editingActivity === a.name;
                return (
                  <tr key={a.name}>
                    {isEditing ? (
                      <>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editActivityValue} onChange={(e) => setEditActivityValue(e.target.value)} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEditActivity(a.name)} disabled={savingActivityEdit}>Salvar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEditActivity}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{a.name}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEditActivity(a)}>Editar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeActivity(a.name)}>Remover</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {activities.length === 0 && <tr><td colSpan={2}>Nenhuma atividade cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

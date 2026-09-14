import React, { useState } from "react";
import {
  insertOperator,
  deleteOperator,
  renameOperatorCode,
  updateOperator,
  insertActivity,
  deleteActivity,
  renameActivity,
} from "../lib/api";
import { createAdminAccount } from "../lib/auth";

export default function TeamManager({ operators, activities, adminEmail, refreshConfig }) {
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState("");
  const [newOpCode, setNewOpCode] = useState("");
  const [savingNewOp, setSavingNewOp] = useState(false);
  const [newActivity, setNewActivity] = useState("");
  const [savingNewActivity, setSavingNewActivity] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");
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
    // Trava o botão enquanto salva: antes, um clique duplo (ou o dedo
    // escorregando na tela do quiosque/painel) disparava duas inserções
    // com o mesmo código gerado automaticamente, e a segunda falhava por
    // violar a chave primária — aparecendo como "erro ao salvar".
    if (savingNewOp) return;
    setFormError("");
    const name = newOpName.trim();
    if (!name) return setFormError("Digite o nome do operador.");
    const code = newOpCode.trim() || nextFreeCode();
    if (!/^\d{1,4}$/.test(code)) return setFormError("O código deve conter só números (até 4 dígitos).");
    if (operators.some((o) => o.code === code)) return setFormError(`Já existe um operador com o código ${code}.`);

    setSavingNewOp(true);
    const { error } = await insertOperator({ code, name, role: newOpRole.trim() });
    setSavingNewOp(false);
    if (error) return setFormError("Erro ao salvar. Tente novamente.");
    setNewOpName("");
    setNewOpRole("");
    setNewOpCode("");
    refreshConfig();
  }

  async function removeOperator(code) {
    if (!window.confirm("Remover este operador? Os registros antigos dele continuam no histórico.")) return;
    const { error } = await deleteOperator(code);
    if (error) return setFormError("Erro ao remover. Tente novamente.");
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
    const role = editValues.role.trim();
    const { error } =
      code !== originalCode
        ? await renameOperatorCode(originalCode, { code, name, role })
        : await updateOperator(originalCode, { name, role });
    setSavingEdit(false);
    if (error) {
      setFormError("Erro ao salvar (código pode já estar em uso).");
      return;
    }
    setEditingCode(null);
    refreshConfig();
  }

  async function addActivity() {
    if (savingNewActivity) return;
    const name = newActivity.trim();
    if (!name) return;
    if (activities.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`A atividade "${name}" já existe.`);
    }
    setFormError("");
    setSavingNewActivity(true);
    const { error } = await insertActivity(name);
    setSavingNewActivity(false);
    if (error) return setFormError("Erro ao salvar. Tente novamente.");
    setNewActivity("");
    refreshConfig();
  }

  async function removeActivity(name) {
    if (!window.confirm(`Remover a atividade "${name}" da lista deste mês?`)) return;
    const { error } = await deleteActivity(name);
    if (error) return setFormError("Erro ao remover. Tente novamente.");
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
    const { error } = await renameActivity(originalName, name);
    setSavingActivityEdit(false);
    if (error) {
      setFormError("Erro ao renomear (nome pode já estar em uso).");
      return;
    }
    setEditingActivity(null);
    refreshConfig();
  }

  async function addNewAdmin() {
    const email = newAdminEmail.trim();
    if (!email || newAdminPassword.length < 6) {
      return setFormError("Preencha o e-mail e uma senha com pelo menos 6 caracteres.");
    }
    setFormError("");
    setAdminMsg("");
    setSavingAdmin(true);
    const { error } = await createAdminAccount(email, newAdminPassword);
    setSavingAdmin(false);
    if (error) return setFormError("Erro ao criar a conta: " + error.message);
    setNewAdminEmail("");
    setNewAdminPassword("");
    setAdminMsg("Conta criada. Se a confirmação por e-mail estiver ativa no Supabase, peça para a pessoa confirmar o e-mail antes de entrar.");
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

      <div className="card" style={{ maxWidth: 420, marginBottom: 20 }}>
        <div className="card-title">Contas de administrador</div>
        <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "-6px 0 12px 0" }}>
          Logado como {adminEmail}. Crie uma conta por pessoa — melhor do que um PIN único compartilhado.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="field" style={{ flex: "1 1 180px" }} type="email" placeholder="E-mail do novo admin" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
          <input className="field" style={{ flex: "1 1 140px" }} type="password" placeholder="Senha (mín. 6)" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} />
          <button className="btn-small" onClick={addNewAdmin} disabled={savingAdmin}>
            {savingAdmin ? "Criando..." : "Criar conta"}
          </button>
        </div>
        {adminMsg && <p style={{ fontSize: 12, color: "var(--ok)", marginTop: 8, marginBottom: 0 }}>{adminMsg}</p>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-title">Operadores</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input className="field" style={{ width: 64 }} placeholder="Cód." value={newOpCode} onChange={(e) => setNewOpCode(e.target.value.replace(/\D/g, ""))} />
            <input className="field" style={{ flex: 1, minWidth: 100 }} placeholder="Nome" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} />
            <input className="field" style={{ width: 140 }} placeholder="Função" value={newOpRole} onChange={(e) => setNewOpRole(e.target.value)} />
            <button className="btn-small" onClick={addOperator} disabled={savingNewOp}>
              {savingNewOp ? "Salvando..." : "Adicionar"}
            </button>
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
            <button className="btn-small" onClick={addActivity} disabled={savingNewActivity}>
              {savingNewActivity ? "Salvando..." : "Adicionar"}
            </button>
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

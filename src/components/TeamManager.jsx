import React, { useEffect, useState } from "react";
import {
  addOperator as apiAddOperator,
  updateOperator,
  renameOperatorCode,
  deleteOperator,
  addActivity as apiAddActivity,
  renameActivity,
  updateActivityTarget,
  deleteActivity as apiDeleteActivity,
  addErrorType as apiAddErrorType,
  renameErrorType,
  deleteErrorType as apiDeleteErrorType,
  updateAdminPin,
} from "../lib/api";

function minutesToSeconds(minStr) {
  const n = parseInt(minStr, 10);
  return Number.isNaN(n) || n <= 0 ? null : n * 60;
}

function secondsToMinutesLabel(sec) {
  if (!sec) return "";
  return String(Math.round(sec / 60));
}

export default function TeamManager({ operators, activities, errorTypes, adminPin, refreshConfig }) {
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState("");
  const [newOpCode, setNewOpCode] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newActivityTarget, setNewActivityTarget] = useState("");
  const [newPin, setNewPin] = useState("");
  const [formError, setFormError] = useState("");
  // Trava a tela inteira enquanto uma operação está em andamento. Isso evita
  // o bug de "excluir e adicionar de novo dá erro": sem essa trava, era
  // possível clicar em Adicionar antes da lista terminar de atualizar depois
  // de uma exclusão, e a validação de duplicado comparava com dados velhos.
  const [busy, setBusy] = useState(false);

  const [editingCode, setEditingCode] = useState(null);
  const [editValues, setEditValues] = useState({ code: "", name: "", role: "" });

  const [editingActivity, setEditingActivity] = useState(null);
  const [editActivityValues, setEditActivityValues] = useState({ name: "", target: "" });

  const [newErrorType, setNewErrorType] = useState("");
  const [editingErrorType, setEditingErrorType] = useState(null);
  const [editErrorTypeValue, setEditErrorTypeValue] = useState("");

  // Se o operador/atividade em edição for removido por outra aba (agora
  // sincronizamos em tempo real), sai do modo de edição sozinho em vez de
  // deixar um formulário "fantasma" apontando para algo que não existe mais.
  useEffect(() => {
    if (editingCode && !operators.some((o) => o.code === editingCode)) {
      setEditingCode(null);
    }
  }, [operators, editingCode]);

  useEffect(() => {
    if (editingActivity && !activities.some((a) => a.name === editingActivity)) {
      setEditingActivity(null);
    }
  }, [activities, editingActivity]);

  useEffect(() => {
    if (editingErrorType && !errorTypes.some((t) => t.name === editingErrorType)) {
      setEditingErrorType(null);
    }
  }, [errorTypes, editingErrorType]);

  function nextFreeCode() {
    const maxCode = operators.reduce((m, o) => {
      const n = parseInt(o.code, 10);
      return Number.isNaN(n) ? m : Math.max(m, n);
    }, 100);
    return String(maxCode + 1);
  }

  // Executa uma ação de escrita, mostrando erro se falhar e sempre
  // atualizando a lista (via refreshConfig) só depois da ação confirmar,
  // nunca antes — é isso que fecha a condição de corrida.
  async function runAction(action, onSuccess) {
    setFormError("");
    setBusy(true);
    try {
      const { error } = await action();
      if (error) {
        setFormError(error.message || "Erro ao salvar. Tente novamente.");
        return false;
      }
      await refreshConfig();
      onSuccess?.();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function addOperator() {
    const name = newOpName.trim();
    if (!name) return setFormError("Digite o nome do operador.");
    const code = newOpCode.trim() || nextFreeCode();
    if (!/^\d{1,4}$/.test(code)) return setFormError("O código deve conter só números (até 4 dígitos).");
    if (operators.some((o) => o.code === code)) return setFormError(`Já existe um operador com o código ${code}.`);
    const role = newOpRole.trim() || "-";
    await runAction(
      () => apiAddOperator({ code, name, role }),
      () => {
        setNewOpName("");
        setNewOpRole("");
        setNewOpCode("");
      }
    );
  }

  async function removeOperator(code) {
    if (!window.confirm("Remover este operador? Os registros antigos dele continuam no histórico.")) return;
    await runAction(() => deleteOperator(code));
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
    const code = editValues.code.trim();
    const name = editValues.name.trim();
    if (!name) return setFormError("O nome não pode ficar em branco.");
    if (!/^\d{1,4}$/.test(code)) return setFormError("O código deve conter só números (até 4 dígitos).");
    if (code !== originalCode && operators.some((o) => o.code === code)) {
      return setFormError(`Já existe um operador com o código ${code}.`);
    }
    const fields = { name, role: editValues.role.trim() || "-" };
    const action =
      code !== originalCode
        ? () => renameOperatorCode(originalCode, code, fields)
        : () => updateOperator(originalCode, fields);
    await runAction(action, () => setEditingCode(null));
  }

  async function addActivity() {
    const name = newActivity.trim();
    if (!name) return;
    if (activities.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`A atividade "${name}" já existe.`);
    }
    const target = minutesToSeconds(newActivityTarget);
    await runAction(() => apiAddActivity(name, target), () => {
      setNewActivity("");
      setNewActivityTarget("");
    });
  }

  async function removeActivity(name) {
    if (!window.confirm(`Remover a atividade "${name}" da lista deste mês?`)) return;
    await runAction(() => apiDeleteActivity(name));
  }

  function startEditActivity(act) {
    setEditingActivity(act.name);
    setEditActivityValues({ name: act.name, target: secondsToMinutesLabel(act.target_seconds) });
    setFormError("");
  }

  function cancelEditActivity() {
    setEditingActivity(null);
  }

  async function saveEditActivity(original) {
    const name = editActivityValues.name.trim();
    if (!name) return setFormError("O nome da atividade não pode ficar em branco.");
    if (
      name.toLowerCase() !== original.name.toLowerCase() &&
      activities.some((a) => a.name.toLowerCase() === name.toLowerCase())
    ) {
      return setFormError(`Já existe uma atividade chamada "${name}".`);
    }
    const target = minutesToSeconds(editActivityValues.target);
    const nameChanged = name !== original.name;
    const targetChanged = target !== (original.target_seconds ?? null);
    if (!nameChanged && !targetChanged) {
      setEditingActivity(null);
      return;
    }
    const action = nameChanged
      ? () => renameActivity(original.name, name, target)
      : () => updateActivityTarget(original.name, target);
    await runAction(action, () => setEditingActivity(null));
  }

  async function addErrorType() {
    const name = newErrorType.trim();
    if (!name) return;
    if (errorTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`O tipo de erro "${name}" já existe.`);
    }
    await runAction(() => apiAddErrorType(name), () => setNewErrorType(""));
  }

  async function removeErrorType(name) {
    if (!window.confirm(`Remover o tipo de erro "${name}"?`)) return;
    await runAction(() => apiDeleteErrorType(name));
  }

  function startEditErrorType(t) {
    setEditingErrorType(t.name);
    setEditErrorTypeValue(t.name);
    setFormError("");
  }

  function cancelEditErrorType() {
    setEditingErrorType(null);
  }

  async function saveEditErrorType(originalName) {
    const name = editErrorTypeValue.trim();
    if (!name) return setFormError("O nome do tipo de erro não pode ficar em branco.");
    if (
      name.toLowerCase() !== originalName.toLowerCase() &&
      errorTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())
    ) {
      return setFormError(`Já existe um tipo de erro chamado "${name}".`);
    }
    if (name === originalName) {
      setEditingErrorType(null);
      return;
    }
    await runAction(() => renameErrorType(originalName, name), () => setEditingErrorType(null));
  }

  async function changePin() {
    const pin = newPin.trim();
    if (pin.length < 4) return setFormError("O PIN precisa ter pelo menos 4 dígitos.");
    await runAction(() => updateAdminPin(pin), () => setNewPin(""));
  }

  return (
    <div>
      <h1 className="page-title">Equipe e atividades</h1>
      <p className="page-sub">
        As atividades mudam mês a mês pelo rodízio — atualize a lista aqui sempre que trocar. A meta de
        tempo é opcional e aparece no Painel comparando com o desempenho real. Registros antigos ficam
        preservados no histórico com o nome da atividade da época.
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
            disabled={busy}
          />
          <button className="btn-small" onClick={changePin} disabled={busy}>
            {busy ? "..." : "Alterar"}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8, marginBottom: 0 }}>PIN atual: {adminPin}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-title">Operadores</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input className="field" style={{ flex: 1, minWidth: 100 }} placeholder="Nome" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} disabled={busy} />
            <input className="field" style={{ width: 140 }} placeholder="Função" value={newOpRole} onChange={(e) => setNewOpRole(e.target.value)} disabled={busy} />
            <input className="field" style={{ width: 90 }} placeholder="Código (opc.)" value={newOpCode} onChange={(e) => setNewOpCode(e.target.value.replace(/\D/g, ""))} disabled={busy} />
            <button className="btn-small" onClick={addOperator} disabled={busy}>Adicionar</button>
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
                        <td><input className="field" style={{ width: 52, padding: "4px 6px" }} value={editValues.code} onChange={(e) => setEditValues((v) => ({ ...v, code: e.target.value.replace(/\D/g, "") }))} disabled={busy} /></td>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editValues.name} onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))} disabled={busy} /></td>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editValues.role} onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))} disabled={busy} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEdit(o.code)} disabled={busy}>Salvar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEdit} disabled={busy}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{o.code}</td>
                        <td style={{ fontFamily: "var(--font-display)" }}>{o.name}</td>
                        <td>{o.role}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEdit(o)} disabled={busy}>Editar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeOperator(o.code)} disabled={busy}>Remover</button>
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
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input className="field" style={{ flex: 1, minWidth: 100 }} placeholder="Nova atividade" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} disabled={busy} />
            <input className="field" style={{ width: 84 }} placeholder="Meta (min)" value={newActivityTarget} onChange={(e) => setNewActivityTarget(e.target.value.replace(/\D/g, ""))} disabled={busy} />
            <button className="btn-small" onClick={addActivity} disabled={busy}>Adicionar</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Atividade</th><th>Meta</th><th></th></tr></thead>
            <tbody>
              {activities.map((a) => {
                const isEditing = editingActivity === a.name;
                return (
                  <tr key={a.name}>
                    {isEditing ? (
                      <>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editActivityValues.name} onChange={(e) => setEditActivityValues((v) => ({ ...v, name: e.target.value }))} disabled={busy} /></td>
                        <td><input className="field" style={{ width: 56, padding: "4px 6px" }} placeholder="min" value={editActivityValues.target} onChange={(e) => setEditActivityValues((v) => ({ ...v, target: e.target.value.replace(/\D/g, "") }))} disabled={busy} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEditActivity(a)} disabled={busy}>Salvar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEditActivity} disabled={busy}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{a.name}</td>
                        <td style={{ color: "var(--text-muted)" }}>{a.target_seconds ? `${secondsToMinutesLabel(a.target_seconds)} min` : "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEditActivity(a)} disabled={busy}>Editar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeActivity(a.name)} disabled={busy}>Remover</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {activities.length === 0 && <tr><td colSpan={3}>Nenhuma atividade cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Tipos de erro</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input className="field" style={{ flex: 1 }} placeholder="Novo tipo" value={newErrorType} onChange={(e) => setNewErrorType(e.target.value)} disabled={busy} />
            <button className="btn-small" onClick={addErrorType} disabled={busy}>Adicionar</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Tipo de erro</th><th></th></tr></thead>
            <tbody>
              {errorTypes.map((t) => {
                const isEditing = editingErrorType === t.name;
                return (
                  <tr key={t.name}>
                    {isEditing ? (
                      <>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editErrorTypeValue} onChange={(e) => setEditErrorTypeValue(e.target.value)} disabled={busy} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEditErrorType(t.name)} disabled={busy}>Salvar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEditErrorType} disabled={busy}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{t.name}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEditErrorType(t)} disabled={busy}>Editar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeErrorType(t.name)} disabled={busy}>Remover</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {errorTypes.length === 0 && <tr><td colSpan={2}>Nenhum tipo cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

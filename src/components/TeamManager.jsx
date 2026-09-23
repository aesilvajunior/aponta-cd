import React, { useEffect, useState } from "react";
import {
  addOperator as apiAddOperator,
  updateOperator,
  renameOperatorCode,
  deleteOperator,
  addActivity as apiAddActivity,
  renameActivity,
  updateActivity,
  swapActivityOrder,
  deleteActivity as apiDeleteActivity,
  addErrorType as apiAddErrorType,
  renameErrorType,
  deleteErrorType as apiDeleteErrorType,
  addVehicle as apiAddVehicle,
  updateVehicle,
  deleteVehicle as apiDeleteVehicle,
  updateAdminPin,
  updateAlertThreshold,
  logAudit,
} from "../lib/api";

function minutesToSeconds(minStr) {
  const n = parseInt(minStr, 10);
  return Number.isNaN(n) || n <= 0 ? null : n * 60;
}

function secondsToMinutesLabel(sec) {
  if (!sec) return "";
  return String(Math.round(sec / 60));
}

export default function TeamManager({
  operators,
  activities,
  errorTypes,
  vehicles = [],
  adminPin,
  alertThreshold = 1800,
  refreshConfig,
}) {
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState("");
  const [newOpCode, setNewOpCode] = useState("");
  const [newOpCanSchedule, setNewOpCanSchedule] = useState(false);
  const [newOpCanConference, setNewOpCanConference] = useState(false);
  const [newActivity, setNewActivity] = useState("");
  const [newActivityTarget, setNewActivityTarget] = useState("");
  const [newPin, setNewPin] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingCode, setEditingCode] = useState(null);
  const [editValues, setEditValues] = useState({
    code: "",
    name: "",
    role: "",
    canScheduleDelivery: false,
    canConference: false,
  });

  const [editingActivity, setEditingActivity] = useState(null);
  const [editActivityValues, setEditActivityValues] = useState({
    name: "",
    target: "",
    requiresOrderInfo: false,
    extraFieldType: "pedido",
    asksShortage: null,
  });

  const [newErrorType, setNewErrorType] = useState("");
  const [editingErrorType, setEditingErrorType] = useState(null);
  const [editErrorTypeValue, setEditErrorTypeValue] = useState("");

  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [editingVehiclePlate, setEditingVehiclePlate] = useState(null);
  const [editVehicleValues, setEditVehicleValues] = useState({ plate: "", model: "" });

  const [thresholdInput, setThresholdInput] = useState(String(Math.round(alertThreshold / 60)));
  const [savingThreshold, setSavingThreshold] = useState(false);

  useEffect(() => {
    setThresholdInput(String(Math.round(alertThreshold / 60)));
  }, [alertThreshold]);

  useEffect(() => {
    if (editingCode && !operators.some((o) => o.code === editingCode)) setEditingCode(null);
  }, [operators, editingCode]);

  useEffect(() => {
    if (editingActivity && !activities.some((a) => a.name === editingActivity)) setEditingActivity(null);
  }, [activities, editingActivity]);

  useEffect(() => {
    if (editingErrorType && !errorTypes.some((t) => t.name === editingErrorType)) setEditingErrorType(null);
  }, [errorTypes, editingErrorType]);

  useEffect(() => {
    if (editingVehiclePlate && !vehicles.some((v) => v.plate === editingVehiclePlate)) setEditingVehiclePlate(null);
  }, [vehicles, editingVehiclePlate]);

  function nextFreeCode() {
    const maxCode = operators.reduce((m, o) => {
      const n = parseInt(o.code, 10);
      return Number.isNaN(n) ? m : Math.max(m, n);
    }, 100);
    return String(maxCode + 1);
  }

  async function audit({ action, entity, entityId, details, beforeData, afterData }) {
    try {
      await logAudit({
        actorCode: "admin",
        actorName: "Admin (PIN)",
        action,
        entity,
        entityId,
        details,
        beforeData,
        afterData,
      });
    } catch {}
  }

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

  async function saveThreshold() {
    const min = parseInt(thresholdInput, 10);
    if (Number.isNaN(min) || min < 1) {
      setFormError("O tempo mínimo precisa ser pelo menos 1 minuto.");
      return;
    }
    if (min > 480) {
      setFormError("O tempo mínimo não pode passar de 480 minutos (8 horas).");
      return;
    }
    setSavingThreshold(true);
    const before = alertThreshold;
    const after = min * 60;
    const { error } = await updateAlertThreshold(after);
    setSavingThreshold(false);
    if (error) {
      setFormError(error.message || "Erro ao salvar o tempo mínimo.");
      return;
    }
    await audit({
      action: "editar",
      entity: "admin_config",
      entityId: "alert_threshold",
      details: `Tempo mínimo para alerta`,
      beforeData: { valor: `${Math.round(before / 60)} min` },
      afterData: { valor: `${min} min` },
    });
    await refreshConfig();
  }

  // ---------- Operadores ----------

  async function addOperator() {
    const name = newOpName.trim();
    if (!name) return setFormError("Digite o nome do operador.");
    const code = newOpCode.trim() || nextFreeCode();
    if (!/^\d{1,4}$/.test(code)) return setFormError("O código deve conter só números (até 4 dígitos).");
    if (operators.some((o) => o.code === code)) return setFormError(`Já existe um operador com o código ${code}.`);
    const role = newOpRole.trim() || "-";

    await runAction(
      async () => {
        const res = await apiAddOperator({
          code,
          name,
          role,
          canScheduleDelivery: newOpCanSchedule,
          canConference: newOpCanConference,
        });
        if (!res.error) {
          await audit({
            action: "criar",
            entity: "operator",
            entityId: code,
            details: `Operador "${name}" criado`,
            afterData: {
              nome: name,
              função: role,
              código: code,
              pode_agendar: newOpCanSchedule ? "Sim" : "Não",
              pode_conferir: newOpCanConference ? "Sim" : "Não",
            },
          });
        }
        return res;
      },
      () => {
        setNewOpName("");
        setNewOpRole("");
        setNewOpCode("");
        setNewOpCanSchedule(false);
        setNewOpCanConference(false);
      }
    );
  }

  async function removeOperator(code) {
    if (!window.confirm("Remover este operador? Os registros antigos dele continuam no histórico.")) return;
    const op = operators.find((o) => o.code === code);
    await runAction(async () => {
      const res = await deleteOperator(code);
      if (!res.error && op) {
        await audit({
          action: "remover",
          entity: "operator",
          entityId: code,
          details: `Operador "${op.name}" removido`,
          beforeData: {
            nome: op.name,
            função: op.role,
            código: op.code,
            pode_agendar: op.can_schedule_delivery ? "Sim" : "Não",
            pode_conferir: op.can_conference ? "Sim" : "Não",
          },
        });
      }
      return res;
    });
  }

  function startEdit(op) {
    setEditingCode(op.code);
    setEditValues({
      code: op.code,
      name: op.name,
      role: op.role || "",
      canScheduleDelivery: !!op.can_schedule_delivery,
      canConference: !!op.can_conference,
    });
    setFormError("");
  }

  function cancelEdit() { setEditingCode(null); }

  async function saveEdit(originalCode) {
    const code = editValues.code.trim();
    const name = editValues.name.trim();
    if (!name) return setFormError("O nome não pode ficar em branco.");
    if (!/^\d{1,4}$/.test(code)) return setFormError("O código deve conter só números (até 4 dígitos).");
    if (code !== originalCode && operators.some((o) => o.code === code)) {
      return setFormError(`Já existe um operador com o código ${code}.`);
    }
    const fields = {
      name,
      role: editValues.role.trim() || "-",
      can_schedule_delivery: editValues.canScheduleDelivery,
      can_conference: editValues.canConference,
    };
    const original = operators.find((o) => o.code === originalCode);

    const action = code !== originalCode
      ? () => renameOperatorCode(originalCode, code, fields)
      : () => updateOperator(originalCode, fields);

    await runAction(async () => {
      const res = await action();
      if (!res.error && original) {
        await audit({
          action: "editar",
          entity: "operator",
          entityId: code,
          details: code !== originalCode
            ? `Operador renomeado de #${originalCode} para #${code}`
            : `Operador "${name}" editado`,
          beforeData: {
            nome: original.name,
            função: original.role,
            código: original.code,
            pode_agendar: original.can_schedule_delivery ? "Sim" : "Não",
            pode_conferir: original.can_conference ? "Sim" : "Não",
          },
          afterData: {
            nome: name,
            função: fields.role,
            código: code,
            pode_agendar: fields.can_schedule_delivery ? "Sim" : "Não",
            pode_conferir: fields.can_conference ? "Sim" : "Não",
          },
        });
      }
      return res;
    }, () => setEditingCode(null));
  }

  // ---------- Atividades ----------

  async function addActivity() {
    const name = newActivity.trim();
    if (!name) return;
    if (activities.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`A atividade "${name}" já existe.`);
    }
    const target = minutesToSeconds(newActivityTarget);
    await runAction(async () => {
      const res = await apiAddActivity(name, target, null);
      if (!res.error) {
        await audit({
          action: "criar",
          entity: "activity",
          entityId: name,
          details: `Atividade "${name}" criada`,
          afterData: { nome: name, meta: target ? `${Math.round(target / 60)} min` : "—" },
        });
      }
      return res;
    }, () => { setNewActivity(""); setNewActivityTarget(""); });
  }

  async function removeActivity(name) {
    if (!window.confirm(`Remover a atividade "${name}" da lista deste mês?`)) return;
    const act = activities.find((a) => a.name === name);
    await runAction(async () => {
      const res = await apiDeleteActivity(name);
      if (!res.error && act) {
        await audit({
          action: "remover",
          entity: "activity",
          entityId: name,
          details: `Atividade "${name}" removida`,
          beforeData: { nome: act.name, meta: act.target_seconds ? `${Math.round(act.target_seconds / 60)} min` : "—" },
        });
      }
      return res;
    });
  }

  function startEditActivity(act) {
    setEditingActivity(act.name);
    setEditActivityValues({
      name: act.name,
      target: secondsToMinutesLabel(act.target_seconds),
      requiresOrderInfo: !!act.requires_order_info,
      extraFieldType: act.extra_field_type || "pedido",
      asksShortage: act.asks_shortage ?? null,
    });
    setFormError("");
  }

  function cancelEditActivity() { setEditingActivity(null); }

  async function saveEditActivity(original) {
    const name = editActivityValues.name.trim();
    if (!name) return setFormError("O nome da atividade não pode ficar em branco.");
    if (name.toLowerCase() !== original.name.toLowerCase() && activities.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`Já existe uma atividade chamada "${name}".`);
    }
    const target = minutesToSeconds(editActivityValues.target);
    const requiresOrderInfo = editActivityValues.requiresOrderInfo;
    const extraFieldType = editActivityValues.extraFieldType;
    const asksShortage = editActivityValues.asksShortage;

    const nameChanged = name !== original.name;
    const targetChanged = target !== (original.target_seconds ?? null);
    const requiresChanged = requiresOrderInfo !== !!original.requires_order_info;
    const extraFieldTypeChanged = extraFieldType !== (original.extra_field_type || "pedido");
    const asksShortageChanged = asksShortage !== (original.asks_shortage ?? null);

    if (!nameChanged && !targetChanged && !requiresChanged && !extraFieldTypeChanged && !asksShortageChanged) {
      setEditingActivity(null);
      return;
    }

    const action = async () => {
      if (nameChanged) {
        const upd = await updateActivity(original.name, {
          target_seconds: target,
          requires_order_info: requiresOrderInfo,
          extra_field_type: extraFieldType,
          asks_shortage: asksShortage,
        });
        if (upd.error) return upd;
        return renameActivity(original.name, name);
      }
      return updateActivity(original.name, {
        target_seconds: target,
        requires_order_info: requiresOrderInfo,
        extra_field_type: extraFieldType,
        asks_shortage: asksShortage,
      });
    };

    await runAction(async () => {
      const res = await action();
      if (!res.error) {
        await audit({
          action: "editar",
          entity: "activity",
          entityId: name,
          details: nameChanged
            ? `Atividade renomeada de "${original.name}" para "${name}"`
            : `Atividade "${name}" editada`,
          beforeData: {
            nome: original.name,
            meta: original.target_seconds ? `${Math.round(original.target_seconds / 60)} min` : "—",
            pede_info: original.requires_order_info ? "Sim" : "Não",
            tipo_info: original.extra_field_type || "pedido",
            pergunta_falta: original.asks_shortage === true ? "Sempre" : original.asks_shortage === false ? "Nunca" : "Automático",
          },
          afterData: {
            nome: name,
            meta: target ? `${Math.round(target / 60)} min` : "—",
            pede_info: requiresOrderInfo ? "Sim" : "Não",
            tipo_info: extraFieldType,
            pergunta_falta: asksShortage === true ? "Sempre" : asksShortage === false ? "Nunca" : "Automático",
          },
        });
      }
      return res;
    }, () => setEditingActivity(null));
  }

  async function moveActivity(index, direction) {
    const target = activities[index + direction];
    const current = activities[index];
    if (!target || !current) return;
    await runAction(() => swapActivityOrder(current.name, current.sort_order, target.name, target.sort_order));
  }

  // ---------- Tipos de erro ----------

  async function addErrorType() {
    const name = newErrorType.trim();
    if (!name) return;
    if (errorTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`O tipo de erro "${name}" já existe.`);
    }
    await runAction(async () => {
      const res = await apiAddErrorType(name);
      if (!res.error) {
        await audit({
          action: "criar",
          entity: "error_type",
          entityId: name,
          details: `Tipo de erro "${name}" criado`,
          afterData: { nome: name },
        });
      }
      return res;
    }, () => setNewErrorType(""));
  }

  async function removeErrorType(name) {
    if (!window.confirm(`Remover o tipo de erro "${name}"?`)) return;
    await runAction(async () => {
      const res = await apiDeleteErrorType(name);
      if (!res.error) {
        await audit({
          action: "remover",
          entity: "error_type",
          entityId: name,
          details: `Tipo de erro "${name}" removido`,
          beforeData: { nome: name },
        });
      }
      return res;
    });
  }

  function startEditErrorType(t) {
    setEditingErrorType(t.name);
    setEditErrorTypeValue(t.name);
    setFormError("");
  }

  function cancelEditErrorType() { setEditingErrorType(null); }

  async function saveEditErrorType(originalName) {
    const name = editErrorTypeValue.trim();
    if (!name) return setFormError("O nome do tipo de erro não pode ficar em branco.");
    if (name.toLowerCase() !== originalName.toLowerCase() && errorTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return setFormError(`Já existe um tipo de erro chamado "${name}".`);
    }
    if (name === originalName) { setEditingErrorType(null); return; }
    await runAction(async () => {
      const res = await renameErrorType(originalName, name);
      if (!res.error) {
        await audit({
          action: "editar",
          entity: "error_type",
          entityId: name,
          details: `Tipo de erro renomeado de "${originalName}" para "${name}"`,
          beforeData: { nome: originalName },
          afterData: { nome: name },
        });
      }
      return res;
    }, () => setEditingErrorType(null));
  }

  // ---------- Veículos ----------

  async function addVehicle() {
    const plate = newVehiclePlate.trim().toUpperCase();
    const model = newVehicleModel.trim();
    if (!plate) return setFormError("Digite a placa do veículo.");
    if (!model) return setFormError("Digite o modelo do veículo.");
    if (vehicles.some((v) => v.plate.toUpperCase() === plate)) {
      return setFormError(`Já existe um veículo com a placa ${plate}.`);
    }
    await runAction(async () => {
      const res = await apiAddVehicle({ plate, model });
      if (!res.error) {
        await audit({
          action: "criar",
          entity: "vehicle",
          entityId: plate,
          details: `Veículo ${plate} (${model}) adicionado`,
          afterData: { placa: plate, modelo: model },
        });
      }
      return res;
    }, () => { setNewVehiclePlate(""); setNewVehicleModel(""); });
  }

  async function removeVehicle(plate) {
    if (!window.confirm(`Remover o veículo ${plate}?`)) return;
    const v = vehicles.find((x) => x.plate === plate);
    await runAction(async () => {
      const res = await apiDeleteVehicle(plate);
      if (!res.error && v) {
        await audit({
          action: "remover",
          entity: "vehicle",
          entityId: plate,
          details: `Veículo ${plate} (${v.model}) removido`,
          beforeData: { placa: plate, modelo: v.model },
        });
      }
      return res;
    });
  }

  function startEditVehicle(v) {
    setEditingVehiclePlate(v.plate);
    setEditVehicleValues({ plate: v.plate, model: v.model });
    setFormError("");
  }

  function cancelEditVehicle() { setEditingVehiclePlate(null); }

  async function saveEditVehicle(originalPlate) {
    const plate = editVehicleValues.plate.trim().toUpperCase();
    const model = editVehicleValues.model.trim();
    if (!plate) return setFormError("A placa não pode ficar em branco.");
    if (!model) return setFormError("O modelo não pode ficar em branco.");
    if (plate !== originalPlate && vehicles.some((v) => v.plate.toUpperCase() === plate)) {
      return setFormError(`Já existe um veículo com a placa ${plate}.`);
    }
    const original = vehicles.find((v) => v.plate === originalPlate);
    if (plate === originalPlate && model === original?.model) {
      setEditingVehiclePlate(null);
      return;
    }
    await runAction(async () => {
      const res = await updateVehicle(originalPlate, { plate, model });
      if (!res.error && original) {
        await audit({
          action: "editar",
          entity: "vehicle",
          entityId: plate,
          details: `Veículo ${originalPlate} editado`,
          beforeData: { placa: original.plate, modelo: original.model },
          afterData: { placa: plate, modelo: model },
        });
      }
      return res;
    }, () => setEditingVehiclePlate(null));
  }

  // ---------- PIN ----------

  async function changePin() {
    const pin = newPin.trim();
    if (pin.length < 4) return setFormError("O PIN precisa ter pelo menos 4 dígitos.");
    await runAction(async () => {
      const res = await updateAdminPin(pin);
      if (!res.error) {
        await audit({
          action: "editar",
          entity: "admin_config",
          entityId: "pin",
          details: "PIN de administrador alterado",
          beforeData: { valor: "****" },
          afterData: { valor: "****" },
        });
      }
      return res;
    }, () => setNewPin(""));
  }

  return (
    <div>
      <h1 className="page-title">Equipe e atividades</h1>
      <p className="page-sub">
        As atividades mudam mês a mês pelo rodízio. Marque quem pode agendar recebimento e/ou conferir pedidos.
      </p>

      {formError && (
        <div className="confirm-box" style={{ marginBottom: 18, maxWidth: 560, padding: "10px 14px" }}>
          <span style={{ color: "var(--danger)", fontSize: 13 }}>{formError}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20, maxWidth: 720 }}>
        <div className="card">
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

        <div className="card">
          <div className="card-title">⏱ Tempo mínimo para alerta</div>
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: -8, marginBottom: 10 }}>
            Atividades com meta própria usam a meta. As outras usam esse tempo.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="field"
              style={{ width: 90, fontFamily: "var(--font-mono)", textAlign: "center" }}
              type="number"
              min="1"
              max="480"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value.replace(/\D/g, ""))}
              disabled={savingThreshold}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>minutos</span>
            <button className="btn-small" onClick={saveThreshold} disabled={savingThreshold} style={{ marginLeft: "auto" }}>
              {savingThreshold ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* OPERADORES */}
        <div className="card">
          <div className="card-title">Operadores</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <input className="field" style={{ flex: 1, minWidth: 100 }} placeholder="Nome" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} disabled={busy} />
            <input className="field" style={{ width: 120 }} placeholder="Função" value={newOpRole} onChange={(e) => setNewOpRole(e.target.value)} disabled={busy} />
            <input className="field" style={{ width: 80 }} placeholder="Cód. (opc.)" value={newOpCode} onChange={(e) => setNewOpCode(e.target.value.replace(/\D/g, ""))} disabled={busy} />
            <button className="btn-small" onClick={addOperator} disabled={busy}>Adicionar</button>
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={newOpCanSchedule}
                onChange={(e) => setNewOpCanSchedule(e.target.checked)}
                disabled={busy}
              />
              Pode agendar recebimento
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={newOpCanConference}
                onChange={(e) => setNewOpCanConference(e.target.checked)}
                disabled={busy}
              />
              Pode conferir
            </label>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Nome</th>
                <th>Função</th>
                <th title="Pode agendar recebimento">📅</th>
                <th title="Pode conferir">✅</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {operators.map((o) => {
                const isEditing = editingCode === o.code;
                return (
                  <tr key={o.code}>
                    {isEditing ? (
                      <>
                        <td><input className="field" style={{ width: 48, padding: "4px 6px" }} value={editValues.code} onChange={(e) => setEditValues((v) => ({ ...v, code: e.target.value.replace(/\D/g, "") }))} disabled={busy} /></td>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editValues.name} onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))} disabled={busy} /></td>
                        <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editValues.role} onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))} disabled={busy} /></td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editValues.canScheduleDelivery}
                            onChange={(e) => setEditValues((v) => ({ ...v, canScheduleDelivery: e.target.checked }))}
                            disabled={busy}
                            title="Pode agendar recebimento"
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editValues.canConference}
                            onChange={(e) => setEditValues((v) => ({ ...v, canConference: e.target.checked }))}
                            disabled={busy}
                            title="Pode conferir"
                          />
                        </td>
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
                        <td style={{ textAlign: "center" }}>
                          {o.can_schedule_delivery ? (
                            <span title="Pode agendar recebimento" style={{ color: "var(--ok)", fontWeight: 700 }}>✓</span>
                          ) : (
                            <span style={{ color: "var(--text-faint)" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {o.can_conference ? (
                            <span title="Pode conferir" style={{ color: "var(--ok)", fontWeight: 700 }}>✓</span>
                          ) : (
                            <span style={{ color: "var(--text-faint)" }}>—</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEdit(o)} disabled={busy}>Editar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeOperator(o.code)} disabled={busy}>Remover</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {operators.length === 0 && <tr><td colSpan={6}>Nenhum operador cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* ATIVIDADES */}
        <div className="card">
          <div className="card-title">Atividades do mês</div>
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: -8, marginBottom: 12 }}>
            A ordem aqui é a mesma que aparece no quiosque — use ↑/↓ para reorganizar.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input className="field" style={{ flex: 1, minWidth: 100 }} placeholder="Nova atividade" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} disabled={busy} />
            <input className="field" style={{ width: 84 }} placeholder="Meta (min)" value={newActivityTarget} onChange={(e) => setNewActivityTarget(e.target.value.replace(/\D/g, ""))} disabled={busy} />
            <button className="btn-small" onClick={addActivity} disabled={busy}>Adicionar</button>
          </div>
          <table className="data-table">
            <thead><tr><th></th><th>Atividade</th><th>Meta</th><th></th></tr></thead>
            <tbody>
              {activities.map((a, index) => {
                const isEditing = editingActivity === a.name;
                return (
                  <tr key={a.name}>
                    {isEditing ? (
                      <>
                        <td></td>
                        <td>
                          <input className="field" style={{ width: "100%", padding: "4px 6px", marginBottom: 6 }} value={editActivityValues.name} onChange={(e) => setEditActivityValues((v) => ({ ...v, name: e.target.value }))} disabled={busy} />
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>
                            <input
                              type="checkbox"
                              checked={editActivityValues.requiresOrderInfo}
                              onChange={(e) => setEditActivityValues((v) => ({ ...v, requiresOrderInfo: e.target.checked }))}
                              disabled={busy}
                            />
                            Pede informação extra ao iniciar
                          </label>
                          {editActivityValues.requiresOrderInfo && (
                            <select
                              className="field"
                              style={{ width: "100%", fontSize: 11.5, padding: "4px 6px", marginBottom: 6 }}
                              value={editActivityValues.extraFieldType}
                              onChange={(e) => setEditActivityValues((v) => ({ ...v, extraFieldType: e.target.value }))}
                              disabled={busy}
                            >
                              <option value="pedido">Pedido / Encaixe / Transferência</option>
                              <option value="veiculo">Veículo + Placa (frota)</option>
                              <option value="fornecedor">Fornecedor + Nota Fiscal</option>
                            </select>
                          )}
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>
                            Pergunta sobre falta ao finalizar:
                          </div>
                          <select
                            className="field"
                            style={{ width: "100%", fontSize: 11.5, padding: "4px 6px" }}
                            value={editActivityValues.asksShortage === null ? "auto" : editActivityValues.asksShortage ? "yes" : "no"}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditActivityValues((prev) => ({
                                ...prev,
                                asksShortage: v === "auto" ? null : v === "yes",
                              }));
                            }}
                            disabled={busy}
                          >
                            <option value="auto">Automático (se pediu pedido/cliente)</option>
                            <option value="yes">Sempre pergunta</option>
                            <option value="no">Nunca pergunta</option>
                          </select>
                        </td>
                        <td><input className="field" style={{ width: 56, padding: "4px 6px" }} placeholder="min" value={editActivityValues.target} onChange={(e) => setEditActivityValues((v) => ({ ...v, target: e.target.value.replace(/\D/g, "") }))} disabled={busy} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEditActivity(a)} disabled={busy}>Salvar</button>
                          <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEditActivity} disabled={busy}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-small" style={{ padding: "2px 6px", marginRight: 2 }} onClick={() => moveActivity(index, -1)} disabled={busy || index === 0}>↑</button>
                          <button className="btn-small" style={{ padding: "2px 6px" }} onClick={() => moveActivity(index, 1)} disabled={busy || index === activities.length - 1}>↓</button>
                        </td>
                        <td>
                          {a.name}
                          {a.requires_order_info && (
                            <span style={{ marginLeft: 6, fontSize: 10.5, color: "var(--accent)" }}>
                              {a.extra_field_type === "veiculo" ? "🚚" : a.extra_field_type === "fornecedor" ? "📥" : "📦"}
                            </span>
                          )}
                          {a.asks_shortage === true && (
                            <span style={{ marginLeft: 6, fontSize: 10.5, color: "var(--danger)" }} title="Sempre pergunta sobre falta">
                              ⚠
                            </span>
                          )}
                          {a.asks_shortage === false && (
                            <span style={{ marginLeft: 6, fontSize: 10.5, color: "var(--text-faint)" }} title="Nunca pergunta sobre falta">
                              🚫
                            </span>
                          )}
                        </td>
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
              {activities.length === 0 && <tr><td colSpan={4}>Nenhuma atividade cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* TIPOS DE ERRO */}
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

      {/* VEÍCULOS */}
      <div className="card">
        <div className="card-title">Veículos (frota)</div>
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: -8, marginBottom: 12 }}>
          Cadastre aqui os caminhões/veículos. Eles aparecem como botões clicáveis no quiosque quando
          a atividade é do tipo "Veículo + Placa".
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            className="field"
            style={{ width: 140, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
            placeholder="Placa (ex: ABC-1234)"
            value={newVehiclePlate}
            onChange={(e) => setNewVehiclePlate(e.target.value.toUpperCase())}
            disabled={busy}
          />
          <input
            className="field"
            style={{ flex: 1, minWidth: 150 }}
            placeholder="Modelo (ex: Volkswagen)"
            value={newVehicleModel}
            onChange={(e) => setNewVehicleModel(e.target.value)}
            disabled={busy}
          />
          <button className="btn-small" onClick={addVehicle} disabled={busy}>Adicionar</button>
        </div>
        <table className="data-table">
          <thead><tr><th>Placa</th><th>Modelo</th><th></th></tr></thead>
          <tbody>
            {vehicles.map((v) => {
              const isEditing = editingVehiclePlate === v.plate;
              return (
                <tr key={v.plate}>
                  {isEditing ? (
                    <>
                      <td><input className="field" style={{ width: 130, padding: "4px 6px", fontFamily: "var(--font-mono)", textTransform: "uppercase" }} value={editVehicleValues.plate} onChange={(e) => setEditVehicleValues((s) => ({ ...s, plate: e.target.value.toUpperCase() }))} disabled={busy} /></td>
                      <td><input className="field" style={{ width: "100%", padding: "4px 6px" }} value={editVehicleValues.model} onChange={(e) => setEditVehicleValues((s) => ({ ...s, model: e.target.value }))} disabled={busy} /></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEditVehicle(v.plate)} disabled={busy}>Salvar</button>
                        <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEditVehicle} disabled={busy}>Cancelar</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{v.plate}</td>
                      <td>{v.model}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEditVehicle(v)} disabled={busy}>Editar</button>
                        <button className="btn-small" style={{ padding: "4px 8px" }} onClick={() => removeVehicle(v.plate)} disabled={busy}>Remover</button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {vehicles.length === 0 && <tr><td colSpan={3}>Nenhum veículo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
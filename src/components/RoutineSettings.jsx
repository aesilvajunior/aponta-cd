import React, { useCallback, useEffect, useState } from "react";
import { fetchRoutineConfig, updateRoutineStep, fetchTelegramSubscribers, upsertTelegramSubscriber, deleteTelegramSubscriber } from "../lib/api";

export default function RoutineSettings() {
  const [steps, setSteps] = useState([]);
  const [subs, setSubs] = useState([]);
  const [newSub, setNewSub] = useState({ chat_id: "", label: "" });

  const load = useCallback(async () => {
    const [{ data: s }, { data: t }] = await Promise.all([
      fetchRoutineConfig(),
      fetchTelegramSubscribers(),
    ]);
    setSteps(s ?? []);
    setSubs(t ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveStep(step) {
    await updateRoutineStep(step.step_key, {
      label: step.label,
      description: step.description,
      deadline_time: step.deadline_time,
      alert_after_min: step.alert_after_min,
      repeat_every_min: step.repeat_every_min,
      active: step.active,
    });
  }

  async function addSub(e) {
    e.preventDefault();
    if (!newSub.chat_id) return;
    await upsertTelegramSubscriber({ ...newSub, active: true });
    setNewSub({ chat_id: "", label: "" });
    load();
  }

  return (
    <div className="rs-wrap">
      <h2>Configurações da Rotina</h2>

      <h3>Etapas e horários</h3>
      {steps.map((s, i) => (
        <div key={s.step_key} className="rs-step">
          <input value={s.label} onChange={(e) => setSteps((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <input value={s.description ?? ""} onChange={(e) => setSteps((p) => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Descrição" />
          <label>Prazo <input type="time" value={s.deadline_time} onChange={(e) => setSteps((p) => p.map((x, j) => j === i ? { ...x, deadline_time: e.target.value } : x))} /></label>
          <label>1º alerta após <input type="number" min="0" value={s.alert_after_min} onChange={(e) => setSteps((p) => p.map((x, j) => j === i ? { ...x, alert_after_min: +e.target.value } : x))} /> min</label>
          <label>Repetir a cada <input type="number" min="1" value={s.repeat_every_min} onChange={(e) => setSteps((p) => p.map((x, j) => j === i ? { ...x, repeat_every_min: +e.target.value } : x))} /> min</label>
          <label><input type="checkbox" checked={s.active} onChange={(e) => setSteps((p) => p.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} /> Ativa</label>
          <button className="btn btn-secondary btn-sm" onClick={() => saveStep(s)}>Salvar</button>
        </div>
      ))}

      <h3>Notificações Telegram</h3>
      <form className="rs-sub-form" onSubmit={addSub}>
        <input placeholder="chat_id (ex: 123456789)" value={newSub.chat_id} onChange={(e) => setNewSub({ ...newSub, chat_id: e.target.value })} required />
        <input placeholder="Rótulo (ex: Grupo Logística)" value={newSub.label} onChange={(e) => setNewSub({ ...newSub, label: e.target.value })} />
        <button className="btn btn-primary btn-sm" type="submit">Adicionar</button>
      </form>
      <ul className="rs-subs">
        {subs.map((s) => (
          <li key={s.id}>
            <b>{s.label || "—"}</b> <code>{s.chat_id}</code>
            <button onClick={async () => { await deleteTelegramSubscriber(s.id); load(); }}>Remover</button>
          </li>
        ))}
      </ul>
      <p className="rs-hint">
        💡 Para descobrir o <code>chat_id</code>: mande uma mensagem para o bot no Telegram e acesse
        <code> https://api.telegram.org/bot&lt;SEU_TOKEN&gt;/getUpdates</code>
      </p>
    </div>
  );
}
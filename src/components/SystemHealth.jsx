import React, { useCallback, useEffect, useState } from "react";
import { fetchClientErrors, fetchSystemStatus, pingDatabase } from "../lib/api";
import { getQueueState, subscribeQueue, retryFailed, syncQueue } from "../lib/offlineSync";
import { BUILD_INFO } from "../lib/buildInfo";
import { fmtDate, fmtClock } from "../lib/format";
import { IconRefresh } from "./Icons";

function ago(iso) {
  if (!iso) return "nunca";
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 90) return `há ${sec}s`;
  if (sec < 5400) return `há ${Math.round(sec / 60)} min`;
  if (sec < 172800) return `há ${Math.round(sec / 3600)} h`;
  return `há ${Math.round(sec / 86400)} dias`;
}

function Dot({ ok }) {
  return <span className={`health-dot ${ok === true ? "ok" : ok === false ? "bad" : "unknown"}`} aria-hidden="true" />;
}

export default function SystemHealth({ realtimeStatus, entriesCount = 0, updateReady }) {
  const [ping, setPing] = useState(null);
  const [errors, setErrors] = useState([]);
  const [errorsMissing, setErrorsMissing] = useState(false);
  const [status, setStatus] = useState({});
  const [queue, setQueue] = useState(getQueueState());
  const [swState, setSwState] = useState("verificando");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, errs, st] = await Promise.all([pingDatabase(), fetchClientErrors({ limit: 50 }), fetchSystemStatus()]);
    setPing(p);
    if (errs.error) {
      setErrorsMissing(true);
      setErrors([]);
    } else {
      setErrorsMissing(false);
      setErrors(errs.data || []);
    }
    const map = {};
    (st.data || []).forEach((r) => { map[r.key] = r; });
    setStatus(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeQueue(setQueue);
    const iv = setInterval(load, 60000);
    return () => { unsub(); clearInterval(iv); };
  }, [load]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) { setSwState("não suportado"); return; }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) setSwState("não instalado");
      else if (reg.waiting) setSwState("atualização esperando");
      else if (reg.active) setSwState("ativo");
      else setSwState("instalando");
    });
  }, []);

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const dbOk = ping ? !ping.error : null;
  const tv = status.tv_heartbeat;
  const tvAgeMin = tv ? (Date.now() - new Date(tv.updated_at).getTime()) / 60000 : null;
  const recentErrors = errors.filter((e) => Date.now() - new Date(e.created_at).getTime() < 3600000).length;

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Saúde do sistema</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Conexão, fila de envio deste aparelho, versão do app, painel da TV e erros dos tablets.
          </p>
        </div>
        <button className="btn-small" onClick={load} disabled={loading}>
          <IconRefresh size={14} /> {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="health-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Conexão</div>
          <p className="health-line"><Dot ok={online} /> Internet: {online ? "conectado" : "sem conexão"}</p>
          <p className="health-line"><Dot ok={realtimeStatus === "online" ? true : realtimeStatus === "offline" ? false : null} /> Tempo real: {realtimeStatus || "-"}</p>
          <p className="health-line">
            <Dot ok={dbOk} /> Banco de dados: {ping ? (ping.error ? `erro (${ping.error.message})` : `${ping.ms} ms`) : "..."}
          </p>
        </div>

        <div className="card">
          <div className="card-title">Fila de envio (este aparelho)</div>
          <p className="health-line"><Dot ok={queue.pending === 0} /> Aguardando envio: <strong>{queue.pending}</strong></p>
          <p className="health-line"><Dot ok={queue.failed === 0} /> Falharam: <strong>{queue.failed}</strong></p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn-small" onClick={() => syncQueue()} disabled={queue.pending === 0}>Enviar agora</button>
            <button className="btn-small" onClick={() => { retryFailed(); syncQueue(); }} disabled={queue.failed === 0}>Tentar os que falharam</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Aplicativo</div>
          <p className="health-line">Versão: <code>{BUILD_INFO.commit}</code></p>
          <p className="health-line">
            Publicada em: {BUILD_INFO.builtAt ? `${fmtDate(BUILD_INFO.builtAt)} ${fmtClock(BUILD_INFO.builtAt)}` : "desenvolvimento"}
          </p>
          <p className="health-line"><Dot ok={updateReady ? false : true} /> Atualização: {updateReady ? "nova versão disponível" : "em dia"}</p>
          <p className="health-line">Cache offline: {swState}</p>
          <p className="health-line">Lançamentos carregados: {entriesCount}</p>
        </div>

        <div className="card">
          <div className="card-title">Painel da TV</div>
          <p className="health-line">
            <Dot ok={tv ? tvAgeMin < 15 : null} /> Último sinal: {tv ? ago(tv.updated_at) : "sem registro"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "6px 0 0 0" }}>
            A TV avisa a cada 5 minutos. Sem sinal por mais de 15 min pode indicar TV desligada, travada ou sem internet.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Erros dos tablets e da TV {recentErrors > 0 && <span className="badge">{recentErrors} na última hora</span>}
        </div>
        {errorsMissing && (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Registro de erros ainda não ativado. Rode <code>supabase/migrations/2026-10-10_hardening.sql</code>.
          </p>
        )}
        {!errorsMissing && errors.length === 0 && <p style={{ color: "var(--text-muted)", margin: 0 }}>Nenhum erro registrado.</p>}
        {errors.length > 0 && (
          <table className="data-table">
            <thead><tr><th>Quando</th><th>Estação</th><th>Erro</th><th>Tela</th></tr></thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.created_at)} {fmtClock(e.created_at)}</td>
                  <td>{e.station || "-"}</td>
                  <td style={{ maxWidth: 360, wordBreak: "break-word" }}>{e.message}</td>
                  <td>{(e.url || "").replace(/^https?:\/\/[^/]+/, "") || "/"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

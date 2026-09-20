import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchActiveSessions } from "../lib/api";
import { fmtClock, fmtDate } from "../lib/format";
import logo from "../assets/logo.png";

// Painel só de exibição — pensado para ficar aberto numa TV ou monitor
// separado (tipo painel de hospital ou retirada de loja), sem nenhum
// menu ou interação. Mostra só o que está ATIVO agora: quando o
// operador finaliza no computador, o card desaparece sozinho daqui.
// Lançamentos retroativos nunca aparecem aqui porque eles nunca passam
// por active_sessions — vão direto pro histórico.
export default function TvBoard() {
  const [sessions, setSessions] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  async function load() {
    const { data, error } = await fetchActiveSessions();
    if (!error && data) setSessions(data);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("tv-board-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const sorted = [...sessions].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e1013",
        color: "#f4f5f6",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        padding: "36px 44px",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, borderBottom: "3px solid #ffb020", paddingBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={logo} alt="" style={{ width: 56, height: 56, borderRadius: "50%" }} />
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>Atividades em andamento</div>
            <div style={{ color: "#8d95a0", fontSize: 14, marginTop: 2 }}>Hidráulica Tropeiro · Aponta CD</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 32, fontWeight: 600 }}>{fmtClock(now)}</div>
          <div style={{ color: "#8d95a0", fontSize: 13, textTransform: "capitalize", marginTop: 2 }}>{fmtDate(now)}</div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 140, color: "#565d66", fontSize: 22 }}>
          Nenhuma atividade em andamento no momento
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18, marginTop: 26 }}>
          {sorted.map((s) => (
            <div
              key={s.operator_code}
              style={{ background: "#16191d", border: "1px solid #262b31", borderRadius: 16, padding: "22px 24px" }}
            >
              <div style={{ fontSize: 21, fontWeight: 700 }}>{s.operator_name}</div>
              <div style={{ color: "#ffb020", fontSize: 17, fontWeight: 600, marginTop: 5 }}>{s.activity}</div>
              {s.station && (
                <div style={{ fontSize: 11.5, color: "#565d66", marginTop: 2 }}>📍 {s.station}</div>
              )}
              {(s.transfer_type || s.customer_name || s.order_number || s.vehicle) && (
                <div style={{ marginTop: 12, fontSize: 14.5, color: "#c7ccd1", display: "flex", flexDirection: "column", gap: 3 }}>
                  {s.transfer_type && <div>Tipo: {s.transfer_type}</div>}
                  {s.customer_name && <div>Cliente: {s.customer_name}</div>}
                  {s.order_number && <div>Número: {s.order_number}</div>}
                  {s.vehicle && <div>Veículo: {s.vehicle}</div>}
                  {s.plate && <div>Placa: {s.plate}</div>}
                </div>
              )}
              <div style={{ marginTop: 14, fontFamily: "'IBM Plex Mono', monospace", color: "#8d95a0", fontSize: 13.5 }}>
                início: {fmtClock(s.start_time)}h
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={goFullscreen}
        style={{
          position: "fixed", bottom: 22, right: 22, background: "#22262a", color: "#8d95a0",
          border: "1px solid #343b42", borderRadius: 8, padding: "9px 16px", fontSize: 12.5, cursor: "pointer",
        }}
      >
        Tela cheia
      </button>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Sidebar from "./components/Sidebar";
import Kiosk from "./components/Kiosk";
import AdminGate from "./components/AdminGate";
import Panel from "./components/Panel";
import TeamManager from "./components/TeamManager";
import logo from "./assets/logo.png";

const DEFAULT_OPERATORS = [
  { code: "101", name: "Adeildo Junior", role: "Líder" },
  { code: "102", name: "Matheus", role: "Analista" },
  { code: "103", name: "Juliana", role: "Auxiliar" },
  { code: "104", name: "Alex Sander", role: "Recebimento" },
  { code: "105", name: "Gustavo", role: "Recebimento" },
  { code: "106", name: "César", role: "Conferência" },
  { code: "107", name: "Davi", role: "Conferência" },
  { code: "108", name: "Bryan", role: "Separação/Conferência (manhã)" },
  { code: "109", name: "Lucca", role: "Separação/Conferência (tarde)" },
  { code: "110", name: "Cauã", role: "Separação (manhã)" },
  { code: "111", name: "Felipe", role: "Separação (tarde)" },
  { code: "112", name: "Kauã", role: "Separação (manhã)" },
  { code: "113", name: "Pedro Paulo", role: "Separação (tarde)" },
  { code: "114", name: "Lucas", role: "Separação" },
  { code: "115", name: "João Victor", role: "Separação" },
  { code: "116", name: "Breno", role: "Separação" },
  { code: "117", name: "Klévio", role: "Separação" },
  { code: "118", name: "Leandro", role: "Separação" },
  { code: "119", name: "Lo-Ami", role: "Híbrido" },
];

const DEFAULT_ACTIVITIES = [
  "Recebimento", "Conferência", "Separação", "Embalagem",
  "Expedição", "Reposição", "Inventário", "Outros",
].map((name) => ({ name, active: true }));

export default function App() {
  const [tab, setTab] = useState("kiosk");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const [operators, setOperators] = useState(DEFAULT_OPERATORS);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [adminPin, setAdminPin] = useState("2026");
  const [entries, setEntries] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);

  const loadConfig = useCallback(async () => {
    const { data: ops, error: opsErr } = await supabase.from("operators").select("*").order("code");
    const { data: acts, error: actsErr } = await supabase.from("activities").select("*").eq("active", true).order("name");
    const { data: cfg, error: cfgErr } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();

    if (opsErr || actsErr || cfgErr) {
      const firstError = opsErr || actsErr || cfgErr;
      setConnectionError(firstError?.message || "Erro desconhecido ao conectar com o banco.");
      return;
    }
    setConnectionError(null);
    if (ops && ops.length) setOperators(ops);
    if (acts && acts.length) setActivities(acts);
    if (cfg) setAdminPin(cfg.pin);
  }, []);

  const loadEntries = useCallback(async () => {
    const { data } = await supabase.from("entries").select("*").order("start_time", { ascending: false }).limit(2000);
    if (data) setEntries(data);
  }, []);

  const loadActiveSessions = useCallback(async () => {
    const { data } = await supabase.from("active_sessions").select("*");
    if (data) setActiveSessions(data);
  }, []);

  const resetEntries = useCallback(async () => {
    await supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    (async () => {
      await Promise.all([loadConfig(), loadEntries(), loadActiveSessions()]);
      setLoaded(true);
    })();

    const entriesChannel = supabase
      .channel("entries-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, () => loadEntries())
      .subscribe();
    const sessionsChannel = supabase
      .channel("sessions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, () => loadActiveSessions())
      .subscribe();

    return () => {
      supabase.removeChannel(entriesChannel);
      supabase.removeChannel(sessionsChannel);
    };
  }, [loadConfig, loadEntries, loadActiveSessions]);

  function lockAdmin() {
    setIsAdmin(false);
    setTab("kiosk");
  }

  if (!loaded) {
    return <div className="loading-screen">Carregando...</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar tab={tab} setTab={setTab} isAdmin={isAdmin} onLock={lockAdmin} />

      <main className="main">
        <div className="topbar-accent" />

        {connectionError && (
          <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 20 }}>
            <strong style={{ color: "var(--danger)" }}>Sem conexão com o banco de dados.</strong>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 10px 0" }}>
              Detalhe técnico: <code>{connectionError}</code>
              <br />
              Causas comuns: o script <code>supabase/schema.sql</code> ainda não foi rodado no Supabase,
              ou as variáveis <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> estão
              erradas na hospedagem. Exibindo dados padrão por enquanto.
            </p>
            <button className="btn-small" onClick={() => { loadConfig(); loadEntries(); loadActiveSessions(); }}>
              Tentar novamente
            </button>
          </div>
        )}

        {tab === "kiosk" && (
          <Kiosk operators={operators} activities={activities} refreshEntries={loadEntries} />
        )}

        {(tab === "panel" || tab === "team") && !isAdmin && (
          <AdminGate correctPin={adminPin} onUnlock={() => setIsAdmin(true)} />
        )}

        {tab === "panel" && isAdmin && (
          <Panel
            entries={entries}
            activities={activities}
            operators={operators}
            activeSessions={activeSessions}
            onResetEntries={resetEntries}
          />
        )}

        {tab === "team" && isAdmin && (
          <TeamManager
            operators={operators}
            activities={activities}
            adminPin={adminPin}
            refreshConfig={loadConfig}
          />
        )}

        <div className="footer-note">
          <img src={logo} alt="" width={14} height={14} style={{ verticalAlign: "middle", marginRight: 6, borderRadius: "50%" }} />
          Hidráulica Tropeiro · Aponta CD
        </div>
      </main>
    </div>
  );
}

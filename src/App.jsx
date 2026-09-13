import React, { useCallback, useEffect, useState } from "react";
import {
  fetchOperators,
  fetchActivities,
  fetchAdminConfig,
  fetchEntries,
  fetchActiveSessions,
  resetAllEntries,
  subscribeToTables,
} from "./lib/api";
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
  "Limpeza", "Organização", "Carregamento de Caminhão",
  "Reabastecimento de gavetas", "Bater praças", "Conferência de entregas futuras",
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
    const [{ data: ops, error: opsErr }, { data: acts, error: actsErr }, { data: cfg, error: cfgErr }] =
      await Promise.all([fetchOperators(), fetchActivities(), fetchAdminConfig()]);

    if (opsErr || actsErr || cfgErr) {
      const firstError = opsErr || actsErr || cfgErr;
      setConnectionError(firstError?.message || "Erro desconhecido ao conectar com o banco.");
      return;
    }
    setConnectionError(null);
    // Aceita listas vazias também — se todos os operadores/atividades
    // forem removidos, a tela deve refletir isso, não travar no cache antigo.
    setOperators(ops ?? []);
    setActivities(acts ?? []);
    if (cfg) setAdminPin(cfg.pin);
  }, []);

  const loadEntries = useCallback(async () => {
    const { data } = await fetchEntries();
    if (data) setEntries(data);
  }, []);

  const loadActiveSessions = useCallback(async () => {
    const { data } = await fetchActiveSessions();
    if (data) setActiveSessions(data);
  }, []);

  const resetEntries = useCallback(async () => {
    await resetAllEntries();
    await loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    (async () => {
      await Promise.all([loadConfig(), loadEntries(), loadActiveSessions()]);
      setLoaded(true);
    })();

    // Apontamentos e sessões em andamento mudam a cada batida de ponto.
    const unsubscribeActivity = subscribeToTables(["entries", "active_sessions"], () => {
      loadEntries();
      loadActiveSessions();
    });

    // Equipe, atividades do mês e PIN também precisam sincronizar entre
    // abas/dispositivos — antes só entries/sessões tinham isso, então uma
    // tela do quiosque podia ficar com a lista de operadores desatualizada
    // depois de uma alteração feita no painel em outra aba.
    const unsubscribeConfig = subscribeToTables(
      ["operators", "activities", "admin_config"],
      () => loadConfig()
    );

    return () => {
      unsubscribeActivity();
      unsubscribeConfig();
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

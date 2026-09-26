import React, { useCallback, useEffect, useState } from "react";
import { supabase, missingConfig } from "./supabaseClient";
import { useAuth } from "./context/AuthContext";
import {
  fetchOperators,
  fetchActivities,
  fetchAdminConfig,
  fetchEntries,
  fetchActiveSessions,
  fetchSeparationErrors,
  fetchErrorTypes,
  fetchVehicles,
  fetchShortages,
  deleteAllEntries,
  deleteAllSeparationErrors,
  deleteAllShortages,
} from "./lib/api";
import Sidebar from "./components/Sidebar";
import Kiosk from "./components/Kiosk";
import ErrorKiosk from "./components/ErrorKiosk";
import AdminGate from "./components/AdminGate";
import Panel from "./components/Panel";
import TeamManager from "./components/TeamManager";
import ManualEntry from "./components/ManualEntry";
import AuditLog from "./components/AuditLog";
import CommandPalette from "./components/CommandPalette";
import ExecutiveView from "./components/ExecutiveView";
import ScheduleManager from "./components/ScheduleManager";
import SalesTeamQuery from "./components/SalesTeamQuery";
import SalesTeamManager from "./components/SalesTeamManager";
import ShortagePanel from "./components/ShortagePanel";
import ConferenceTable from "./components/ConferenceTable";
import AdminMaster from "./components/AdminMaster";
import LoginScreen from "./components/LoginScreen";
import logo from "./assets/logo.png";
import {
  DEFAULT_OPERATORS,
  DEFAULT_ACTIVITIES,
  DEFAULT_ERROR_TYPES,
} from "./constants/defaults";

const DEFAULT_ALERT_THRESHOLD = 1800;

export default function App() {
  const { session, loading: authLoading } = useAuth();

  const [tab, setTab] = useState("kiosk");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [usingDefaults, setUsingDefaults] = useState(false);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState(null);
  const [profileOperator, setProfileOperator] = useState(null);

  const [operators, setOperators] = useState(DEFAULT_OPERATORS);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [errorTypes, setErrorTypes] = useState(DEFAULT_ERROR_TYPES);
  const [vehicles, setVehicles] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [adminPin, setAdminPin] = useState("2026");
  const [alertThreshold, setAlertThreshold] = useState(DEFAULT_ALERT_THRESHOLD);
  const [entries, setEntries] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [separationErrors, setSeparationErrors] = useState([]);

  const loadOperators = useCallback(async () => {
    const { data, error } = await fetchOperators();
    if (error) return error;
    setOperators(data && data.length ? data : DEFAULT_OPERATORS);
    return null;
  }, []);

  const loadActivities = useCallback(async () => {
    const { data, error } = await fetchActivities();
    if (error) return error;
    setActivities(data && data.length ? data : DEFAULT_ACTIVITIES);
    return null;
  }, []);

  const loadErrorTypes = useCallback(async () => {
    const { data, error } = await fetchErrorTypes();
    if (error) return error;
    setErrorTypes(data && data.length ? data : DEFAULT_ERROR_TYPES);
    return null;
  }, []);

  const loadVehicles = useCallback(async () => {
    const { data, error } = await fetchVehicles();
    if (error) return error;
    setVehicles(data || []);
    return null;
  }, []);

  const loadAdminConfig = useCallback(async () => {
    const { data, error } = await fetchAdminConfig();
    if (error) return error;
    if (data) {
      setAdminPin(data.pin);
      if (data.alert_threshold_seconds) setAlertThreshold(data.alert_threshold_seconds);
    }
    return null;
  }, []);

  const loadEntries = useCallback(async () => {
    const { data, error } = await fetchEntries();
    if (!error && data) setEntries(data);
  }, []);

  const loadActiveSessions = useCallback(async () => {
    const { data, error } = await fetchActiveSessions();
    if (!error && data) setActiveSessions(data);
  }, []);

  const loadSeparationErrors = useCallback(async () => {
    const { data, error } = await fetchSeparationErrors();
    if (!error && data) setSeparationErrors(data);
  }, []);

  const loadShortages = useCallback(async () => {
    const { data, error } = await fetchShortages();
    if (!error && data) setShortages(data);
  }, []);

  const loadAll = useCallback(async () => {
    const results = await Promise.all([
      loadOperators(), loadActivities(), loadErrorTypes(), loadVehicles(), loadAdminConfig(),
    ]);
    const firstError = results.find((e) => e);
    if (firstError) {
      setConnectionError(firstError.message || "Erro desconhecido ao conectar com o banco.");
      setUsingDefaults(true);
    } else {
      setConnectionError(null);
      setUsingDefaults(false);
    }
    await Promise.all([loadEntries(), loadActiveSessions(), loadSeparationErrors(), loadShortages()]);
  }, [loadOperators, loadActivities, loadErrorTypes, loadVehicles, loadAdminConfig, loadEntries, loadActiveSessions, loadSeparationErrors, loadShortages]);

  const resetEntries = useCallback(async () => {
    const { error } = await deleteAllEntries();
    if (error) { setActionError("Não foi possível apagar o histórico. Tente novamente."); return { error }; }
    setActionError(null);
    await Promise.all([loadEntries(), loadShortages()]);
    return { error: null };
  }, [loadEntries, loadShortages]);

  const resetSeparationErrors = useCallback(async () => {
    const { error } = await deleteAllSeparationErrors();
    if (error) { setActionError("Não foi possível apagar os erros de separação. Tente novamente."); return { error }; }
    setActionError(null);
    await loadSeparationErrors();
    return { error: null };
  }, [loadSeparationErrors]);

  const resetShortages = useCallback(async () => {
    const { error } = await deleteAllShortages();
    if (error) { setActionError("Não foi possível apagar as faltas. Tente novamente."); return { error }; }
    setActionError(null);
    await loadShortages();
    return { error: null };
  }, [loadShortages]);

  useEffect(() => {
    if (!session) return;

    (async () => {
      try { await loadAll(); }
      catch (err) { setConnectionError(err?.message || "Erro inesperado ao carregar o aplicativo."); }
      finally { setLoaded(true); }
    })();

    const debounced = (fn, ms = 250) => {
      let t = null;
      return () => { if (t) clearTimeout(t); t = setTimeout(fn, ms); };
    };

    const reloadOperators = debounced(loadOperators);
    const reloadActivities = debounced(loadActivities);
    const reloadErrorTypes = debounced(loadErrorTypes);
    const reloadVehicles = debounced(loadVehicles);
    const reloadAdminConfig = debounced(loadAdminConfig);
    const reloadEntries = debounced(loadEntries);
    const reloadSessions = debounced(loadActiveSessions);
    const reloadSepErrors = debounced(loadSeparationErrors);
    const reloadShortages = debounced(loadShortages);

    const channels = [
      supabase.channel("entries-changes").on("postgres_changes", { event: "*", schema: "public", table: "entries" }, () => { reloadEntries(); reloadShortages(); }).subscribe(),
      supabase.channel("sessions-changes").on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, reloadSessions).subscribe(),
      supabase.channel("operators-changes").on("postgres_changes", { event: "*", schema: "public", table: "operators" }, reloadOperators).subscribe(),
      supabase.channel("activities-changes").on("postgres_changes", { event: "*", schema: "public", table: "activities" }, reloadActivities).subscribe(),
      supabase.channel("error-types-changes").on("postgres_changes", { event: "*", schema: "public", table: "error_types" }, reloadErrorTypes).subscribe(),
      supabase.channel("vehicles-changes").on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, reloadVehicles).subscribe(),
      supabase.channel("admin-config-changes").on("postgres_changes", { event: "*", schema: "public", table: "admin_config" }, reloadAdminConfig).subscribe(),
      supabase.channel("separation-errors-changes").on("postgres_changes", { event: "*", schema: "public", table: "separation_errors" }, reloadSepErrors).subscribe(),
      supabase.channel("shortages-changes").on("postgres_changes", { event: "*", schema: "public", table: "entry_shortages" }, reloadShortages).subscribe(),
    ];

    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [session, loadOperators, loadActivities, loadErrorTypes, loadVehicles, loadAdminConfig, loadEntries, loadActiveSessions, loadSeparationErrors, loadShortages, loadAll]);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function lockAdmin() { setIsAdmin(false); setTab("kiosk"); }
  function handleViewOperator(op) { setProfileOperator(op); setTab("panel"); }
  function handleApplyFilter({ type, value }) { setGlobalFilter({ type, value, ts: Date.now() }); }
  function handleOpenAdminMaster(payload) {
    setIsAdmin(true);
    setTab("admin-master");
    // O AdminMaster pode receber `initialTab` e `initialId` no futuro
    // Nesta versão simplificada, só abre o Admin Master.
    void payload;
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div>Verificando sessão…</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (!loaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div>Carregando…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {missingConfig && (
        <div className="global-banner">
          ⚠️ Supabase NÃO está configurado — nenhum dado está sendo salvo.
        </div>
      )}

      <Sidebar tab={tab} setTab={setTab} isAdmin={isAdmin} onLock={lockAdmin} />

      <main className="main">
        {connectionError && (
          <div className="alert-card alert-danger">
            <strong>Sem conexão com o banco de dados.</strong>
            <p className="alert-detail">
              Detalhe técnico: <code>{connectionError}</code>
            </p>
            <button className="btn btn-secondary btn-sm" onClick={loadAll}>Tentar novamente</button>
          </div>
        )}

        {usingDefaults && !connectionError && (
          <div className="alert-card alert-warning">
            ⚠️ Exibindo dados padrão — o banco está vazio.
          </div>
        )}

        {actionError && <div className="alert-card alert-danger">{actionError}</div>}

        <div key={tab}>
          {tab === "kiosk" && (
            <Kiosk operators={operators} activities={activities} vehicles={vehicles} refreshEntries={loadEntries} />
          )}
          {tab === "errors-kiosk" && (
            <ErrorKiosk operators={operators} errorTypes={errorTypes} />
          )}
          {tab === "schedules" && (
            <ScheduleManager operators={operators} isAdmin={isAdmin} />
          )}
          {tab === "conference" && (
            <ConferenceTable operators={operators} isAdmin={isAdmin} />
          )}
          {tab === "shortages" && (
            <ShortagePanel />
          )}
          {tab === "sales-query" && (
            <SalesTeamQuery />
          )}

          {(tab === "executive" || tab === "panel" || tab === "team" || tab === "manual" || tab === "audit" || tab === "sales-team" || tab === "admin-master") && !isAdmin && (
            <AdminGate correctPin={adminPin} onUnlock={() => setIsAdmin(true)} />
          )}
          {tab === "executive" && isAdmin && (
            <ExecutiveView entries={entries} activities={activities} operators={operators} activeSessions={activeSessions} separationErrors={separationErrors} shortages={shortages} onViewOperator={handleViewOperator} />
          )}
          {tab === "panel" && isAdmin && (
            <Panel
              entries={entries}
              activities={activities}
              operators={operators}
              activeSessions={activeSessions}
              separationErrors={separationErrors}
              shortages={shortages}
              alertThreshold={alertThreshold}
              onResetEntries={resetEntries}
              onResetSeparationErrors={resetSeparationErrors}
              onResetShortages={resetShortages}
              externalProfileOperator={profileOperator}
              onExternalProfileHandled={() => setProfileOperator(null)}
              externalFilter={globalFilter}
              onExternalFilterHandled={() => setGlobalFilter(null)}
              onOpenAdminMaster={handleOpenAdminMaster}
            />
          )}
          {tab === "manual" && isAdmin && (
            <ManualEntry operators={operators} activities={activities} refreshEntries={loadEntries} />
          )}
          {tab === "admin-master" && isAdmin && (
            <AdminMaster operators={operators} adminPin={adminPin} />
          )}
          {tab === "team" && isAdmin && (
            <TeamManager operators={operators} activities={activities} errorTypes={errorTypes} vehicles={vehicles} adminPin={adminPin} alertThreshold={alertThreshold} refreshConfig={loadAll} />
          )}
          {tab === "audit" && isAdmin && (
            <AuditLog />
          )}
          {tab === "sales-team" && isAdmin && (
            <SalesTeamManager />
          )}
        </div>

        <div className="footer-note">
          <img src={logo} alt="" width={14} height={14} style={{ verticalAlign: "middle", marginRight: 6, borderRadius: "50%" }} />
          Hidráulica Tropeiro · Aponta CD
        </div>
      </main>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        operators={operators}
        entries={entries}
        activities={activities}
        onNavigate={setTab}
        onViewOperator={handleViewOperator}
        onApplyFilter={handleApplyFilter}
      />
    </div>
  );
}
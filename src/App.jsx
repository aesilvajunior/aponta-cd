import React, { useCallback, useEffect, useRef, useState } from "react";
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
import {
  isPushEnabled,
  notifyNewConferenceItem,
  notifyLateActivity,
} from "./lib/pushNotifications";
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
import RotationManager from "./components/RotationManager";
import GoalsManager from "./components/GoalsManager";
import GoalsDashboard from "./components/GoalsDashboard";
import CsvImport from "./components/CsvImport";
import FraudPanel from "./components/FraudPanel";
import ReportsScheduler from "./components/ReportsScheduler";
import StockMap from "./components/StockMap";
import PushSetup from "./components/PushSetup";
import LoginScreen from "./components/LoginScreen";
import CdChecklist from "./components/CdChecklist";
import TurnComparison from "./components/TurnComparison";
import SupplierShortages from "./components/SupplierShortages";
import SoundSettings from "./components/SoundSettings";
import AlertSettings from "./components/AlertSettings";
import TeamGoals from "./components/TeamGoals";
import Achievements from "./components/Achievements";
import EquipmentManager from "./components/EquipmentManager";
import StockMapHistory from "./components/StockMapHistory";
import MonthlyReport from "./components/MonthlyReport";
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

  const alertedRef = useRef(new Set());

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

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

    const confChannel = supabase
      .channel("notify-conference")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conference_queue" }, (payload) => {
        if (!isPushEnabled()) return;
        if (payload.new) notifyNewConferenceItem(payload.new);
      })
      .subscribe();

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
      supabase.removeChannel(confChannel);
    };
  }, [session, loadOperators, loadActivities, loadErrorTypes, loadVehicles, loadAdminConfig, loadEntries, loadActiveSessions, loadSeparationErrors, loadShortages, loadAll]);

  useEffect(() => {
    if (!isPushEnabled()) return;
    const iv = setInterval(() => {
      const now = Date.now();
      activeSessions.forEach((s) => {
        const pausedSecs = s.total_paused_seconds || 0;
        const elapsed = Math.max(0, Math.round((now - new Date(s.start_time).getTime()) / 1000) - pausedSecs);
        const cfg = activities.find((a) => a.name === s.activity);
        const threshold = cfg?.target_seconds || alertThreshold || DEFAULT_ALERT_THRESHOLD;
        if (elapsed > threshold && !alertedRef.current.has(s.operator_code)) {
          alertedRef.current.add(s.operator_code);
          notifyLateActivity(s, elapsed);
        }
        if (elapsed <= threshold && alertedRef.current.has(s.operator_code)) {
          alertedRef.current.delete(s.operator_code);
        }
      });
    }, 60 * 1000);
    return () => clearInterval(iv);
  }, [activeSessions, activities, alertThreshold]);

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
    void payload;
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div>Verificando sessão...</div>
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
        <div>Carregando...</div>
      </div>
    );
  }

  const adminTabs = [
    "executive", "panel", "team", "manual", "audit", "sales-team",
    "admin-master", "goals", "csv-import", "fraud", "reports-scheduler",
    "stock-map-edit", "turn-comparison", "supplier-shortages", "sound-settings",
    "alert-settings", "team-goals", "achievements", "equipment",
    "stock-map-history", "monthly-report",
  ];

  const shortagesByEntry = (() => {
    const m = {};
    (shortages || []).forEach((s) => {
      if (!m[s.entry_id]) m[s.entry_id] = [];
      m[s.entry_id].push(s);
    });
    return m;
  })();

  return (
    <div className="app-shell">
      {missingConfig && (
        <div className="global-banner">
          Supabase NÃO está configurado — nenhum dado está sendo salvo.
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
            Exibindo dados padrão — o banco está vazio.
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
          {tab === "checklist" && (
            <CdChecklist operators={operators} isAdmin={isAdmin} />
          )}
          {tab === "equipment" && (
            <EquipmentManager />
          )}
          {tab === "sales-query" && (
            <SalesTeamQuery />
          )}
          {tab === "rotation" && (
            <RotationManager operators={operators} isAdmin={isAdmin} />
          )}
          {tab === "goals-dashboard" && (
            <GoalsDashboard />
          )}
          {tab === "stock-map" && (
            <StockMap isAdmin={isAdmin} />
          )}

          {adminTabs.includes(tab) && !isAdmin && (
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
          {tab === "turn-comparison" && isAdmin && (
            <TurnComparison
              entries={entries}
              activities={activities}
              separationErrors={separationErrors}
              shortagesByEntry={shortagesByEntry}
            />
          )}
          {tab === "supplier-shortages" && isAdmin && (
            <SupplierShortages />
          )}
          {tab === "team-goals" && isAdmin && (
            <TeamGoals />
          )}
          {tab === "achievements" && isAdmin && (
            <Achievements operators={operators} />
          )}
          {tab === "stock-map-history" && isAdmin && (
            <StockMapHistory />
          )}
          {tab === "monthly-report" && isAdmin && (
            <MonthlyReport />
          )}
          {tab === "alert-settings" && isAdmin && (
            <AlertSettings />
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
          {tab === "sound-settings" && isAdmin && (
            <SoundSettings />
          )}
          {tab === "audit" && isAdmin && (
            <AuditLog />
          )}
          {tab === "sales-team" && isAdmin && (
            <SalesTeamManager />
          )}
          {tab === "goals" && isAdmin && (
            <GoalsManager operators={operators} isAdmin={isAdmin} />
          )}
          {tab === "csv-import" && isAdmin && (
            <CsvImport />
          )}
          {tab === "fraud" && isAdmin && (
            <FraudPanel operators={operators} />
          )}
          {tab === "reports-scheduler" && isAdmin && (
            <ReportsScheduler />
          )}
        </div>

        <div className="footer-note">
          Aponta CD
        </div>
      </main>

      <PushSetup />

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
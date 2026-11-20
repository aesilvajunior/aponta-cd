import React, { Suspense, useEffect, useRef, useState } from "react";
import { missingConfig } from "./supabaseClient";
import { useAuth } from "./context/AuthContext";
import { isPushEnabled, notifyLateActivity } from "./lib/pushNotifications";
import { useAppData, DEFAULT_ALERT_THRESHOLD } from "./hooks/useAppData";
import { startAutoSync } from "./lib/offlineSync";
import { checkAdminSession, lockAdminSession } from "./lib/api";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { registerServiceWorker } from "./lib/registerSW";
import { useMediaQuery, MOBILE_QUERY } from "./hooks/useMediaQuery";

// Telas que todo mundo usa logo ao abrir: carregam junto com o app.
import Sidebar from "./components/Sidebar";
import Kiosk from "./components/Kiosk";
import AdminGate from "./components/AdminGate";
import CommandPalette from "./components/CommandPalette";
import PushSetup from "./components/PushSetup";
import LoginScreen from "./components/LoginScreen";
import StatusBar from "./components/StatusBar";

// Todas as outras telas só são baixadas quando alguém abre a aba.
// (O operador no kiosk não precisa baixar Painel, Mapa de Estoque, etc.)
const ErrorKiosk = lazyWithRetry(() => import("./components/ErrorKiosk"));
const Panel = lazyWithRetry(() => import("./components/Panel"));
const TeamManager = lazyWithRetry(() => import("./components/TeamManager"));
const ManualEntry = lazyWithRetry(() => import("./components/ManualEntry"));
const AuditLog = lazyWithRetry(() => import("./components/AuditLog"));
const ExecutiveView = lazyWithRetry(() => import("./components/ExecutiveView"));
const ScheduleManager = lazyWithRetry(() => import("./components/ScheduleManager"));
const SalesTeamQuery = lazyWithRetry(() => import("./components/SalesTeamQuery"));
const SalesTeamManager = lazyWithRetry(() => import("./components/SalesTeamManager"));
const ShortagePanel = lazyWithRetry(() => import("./components/ShortagePanel"));
const ConferenceTable = lazyWithRetry(() => import("./components/ConferenceTable"));
const AdminMaster = lazyWithRetry(() => import("./components/AdminMaster"));
const RotationManager = lazyWithRetry(() => import("./components/RotationManager"));
const GoalsManager = lazyWithRetry(() => import("./components/GoalsManager"));
const GoalsDashboard = lazyWithRetry(() => import("./components/GoalsDashboard"));
const CsvImport = lazyWithRetry(() => import("./components/CsvImport"));
const FraudPanel = lazyWithRetry(() => import("./components/FraudPanel"));
const ReportsScheduler = lazyWithRetry(() => import("./components/ReportsScheduler"));
const StockMap = lazyWithRetry(() => import("./components/StockMap"));
const CdChecklist = lazyWithRetry(() => import("./components/CdChecklist"));
const TurnComparison = lazyWithRetry(() => import("./components/TurnComparison"));
const SupplierShortages = lazyWithRetry(() => import("./components/SupplierShortages"));
const SoundSettings = lazyWithRetry(() => import("./components/SoundSettings"));
const AlertSettings = lazyWithRetry(() => import("./components/AlertSettings"));
const TeamGoals = lazyWithRetry(() => import("./components/TeamGoals"));
const Achievements = lazyWithRetry(() => import("./components/Achievements"));
const EquipmentManager = lazyWithRetry(() => import("./components/EquipmentManager"));
const StockMapHistory = lazyWithRetry(() => import("./components/StockMapHistory"));
const MonthlyReport = lazyWithRetry(() => import("./components/MonthlyReport"));
const DailyRoutine = lazyWithRetry(() => import("./components/DailyRoutine"));
const RoutineSettings = lazyWithRetry(() => import("./components/RoutineSettings"));
const Workload = lazyWithRetry(() => import("./components/Workload"));
const PauseReasons = lazyWithRetry(() => import("./components/PauseReasons"));
const SystemHealth = lazyWithRetry(() => import("./components/SystemHealth"));
const BadgePrinter = lazyWithRetry(() => import("./components/BadgePrinter"));
const StockScan = lazyWithRetry(() => import("./components/StockScan"));
const StockMap3D = lazyWithRetry(() => import("./components/StockMap3D"));
const AddressLabels = lazyWithRetry(() => import("./components/AddressLabels"));

function ScreenFallback() {
  return (
    <div className="screen-fallback" role="status" aria-live="polite">
      <div className="loading-spinner" />
      <div>Carregando tela...</div>
    </div>
  );
}

export default function App() {
  const { session, loading: authLoading } = useAuth();

  const [tab, setTab] = useState("kiosk");
  const [isAdmin, setIsAdmin] = useState(false);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [mapFocusAreaId, setMapFocusAreaId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [globalFilter, setGlobalFilter] = useState(null);
  const [profileOperator, setProfileOperator] = useState(null);

  const {
    loaded, connectionError, actionError, usingDefaults, realtimeStatus,
    operators, activities, errorTypes, vehicles, shortages, alertThreshold,
    entries, activeSessions, separationErrors,
    loadAll, loadEntries, resetEntries, resetSeparationErrors, resetShortages,
  } = useAppData(session);

  // Operador logado (para checar role: 'operator' | 'lider' | 'admin')
  const [currentOperator, setCurrentOperator] = useState(null);

  // Líder OU admin pode acessar a Rotina do Líder
  const isLeader = currentOperator?.role === "lider" || isAdmin;

  const alertedRef = useRef(new Set());

  const [updateReady, setUpdateReady] = useState(null);
  useEffect(() => registerServiceWorker({ onUpdateReady: setUpdateReady }), []);

  // Girou a tela / redimensionou para largura de desktop: fecha a gaveta
  // (senão o fundo escuro ficaria cobrindo a tela).
  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  // Gaveta aberta: Esc fecha (e devolve o foco ao botão) e o fundo não rola.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  // Admin: trava sozinho depois de 30 min sem uso e confere no servidor se a
  // sessão de admin (aberta pelo PIN) ainda vale. Se expirou, volta ao PIN.
  const lastActivityRef = useRef(Date.now());
  useEffect(() => {
    if (!isAdmin) return undefined;
    const IDLE_MS = 30 * 60 * 1000;
    lastActivityRef.current = Date.now();
    const touch = () => { lastActivityRef.current = Date.now(); };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));

    const iv = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > IDLE_MS) {
        setIsAdmin(false);
        setTab("kiosk");
        lockAdminSession();
        return;
      }
      const stillValid = await checkAdminSession();
      if (stillValid === false) {
        setIsAdmin(false);
        setTab("kiosk");
      }
    }, 60 * 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, touch));
      clearInterval(iv);
    };
  }, [isAdmin]);

  // Reenvia o que ficou guardado offline (iniciar/finalizar atividade)
  useEffect(() => {
    if (!session) return undefined;
    return startAutoSync(() => { loadEntries(); });
  }, [session, loadEntries]);

  // Carrega operador logado do sessionStorage (o Kiosk guarda ao logar)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("aponta_schedule_operator");
      if (raw) {
        const parsed = JSON.parse(raw);
        const found = operators.find((o) => o.code === parsed.code);
        if (found) setCurrentOperator(found);
      }
    } catch { /* sessionStorage indisponível */ }
  }, [operators]);

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

  // Atalhos entre o mapa 2D, o mapa 3D, inventário cíclico e a coleta por código de barras
  function goScanArea(area) {
    try { sessionStorage.setItem("aponta_scan_prefill", JSON.stringify({ areaId: area.id })); } catch { /* ignora */ }
    setTab("stock-scan");
  }
  function goScanTask(task) {
    try {
      if (task?.id) {
        sessionStorage.setItem("aponta_scan_prefill", JSON.stringify({ cyclicTaskId: task.id, areaId: task.area_id }));
      }
    } catch { /* ignora */ }
    setTab("stock-scan");
  }
  function goMapArea(area) {
    setMapFocusAreaId(area.id);
    setTab("stock-map");
  }

  function lockAdmin() {
    setIsAdmin(false);
    setTab("kiosk");
    lockAdminSession(); // encerra também a sessão de admin no servidor
  }
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
    "stock-map-history", "monthly-report", "workload", "pauses", "health", "badges", "address-labels",
    // ↓↓↓ NOVO: Configuração da Rotina ↓↓↓
    "routine-settings",
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

      {/* ↓↓↓ NOVO: Sidebar recebe currentOperator para filtrar itens ↓↓↓ */}
      {/* Botão hambúrguer: só aparece no celular (via CSS) */}
      <button
        ref={menuButtonRef}
        className="mobile-menu-btn"
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={mobileMenuOpen}
        aria-controls="app-sidebar"
      >
        ☰
      </button>

      {/* Fundo escuro atrás da gaveta; tocar nele fecha o menu */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop visible"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        id="app-sidebar"
        tab={tab}
        setTab={(t) => {
          setTab(t);
          setMobileMenuOpen(false);
        }}
        isAdmin={isAdmin}
        onLock={lockAdmin}
        currentOperator={currentOperator}
        mobileOpen={mobileMenuOpen}
      />

      <main className="main">
        {import.meta.env.VITE_APP_ENV && import.meta.env.VITE_APP_ENV !== "production" && (
          <div className="env-banner" role="note">AMBIENTE DE {String(import.meta.env.VITE_APP_ENV).toUpperCase()}: os dados daqui não são os reais</div>
        )}
        <StatusBar realtimeStatus={realtimeStatus} updateReady={updateReady} />
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

        <Suspense fallback={<ScreenFallback />}>
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
            <ShortagePanel onOpenScanTask={goScanTask} />
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
            <RotationManager
              operators={operators}
              isAdmin={isAdmin}
              currentOperator={currentOperator}
            />
          )}
          {tab === "goals-dashboard" && (
            <GoalsDashboard />
          )}
          {tab === "stock-map" && (
            <StockMap isAdmin={isAdmin} onScanArea={goScanArea} focusAreaId={mapFocusAreaId} entries={entries} shortages={shortages} />
          )}

          {/* ↓↓↓ NOVO: Rotina do Líder (líder ou admin) ↓↓↓ */}
          {tab === "daily-routine" && (isLeader || isAdmin) && (
            <DailyRoutine currentOperator={currentOperator} onOpenScanTask={goScanTask} />
          )}

          {adminTabs.includes(tab) && !isAdmin && (
            <AdminGate onUnlock={() => setIsAdmin(true)} />
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
            <AdminMaster operators={operators} />
          )}
          {tab === "team" && isAdmin && (
            <TeamManager operators={operators} activities={activities} errorTypes={errorTypes} vehicles={vehicles} alertThreshold={alertThreshold} refreshConfig={loadAll} />
          )}
          {tab === "sound-settings" && isAdmin && (
            <SoundSettings />
          )}
          {tab === "stock-map-3d" && <StockMap3D isAdmin={isAdmin} onScanArea={goScanArea} onOpenMap={goMapArea} entries={entries} shortages={shortages} />}
          {tab === "stock-scan" && <StockScan operators={operators} currentOperator={currentOperator} onOpenMap={goMapArea} />}
          {tab === "address-labels" && isAdmin && <AddressLabels />}
          {tab === "workload" && isAdmin && <Workload entries={entries} activeSessions={activeSessions} onNavigate={setTab} />}
          {tab === "pauses" && isAdmin && <PauseReasons activeSessions={activeSessions} />}
          {tab === "health" && isAdmin && (
            <SystemHealth realtimeStatus={realtimeStatus} entriesCount={entries.length} updateReady={updateReady} />
          )}
          {tab === "badges" && isAdmin && <BadgePrinter operators={operators} />}
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
          {/* ↓↓↓ NOVO: Config. Rotina (só admin) ↓↓↓ */}
          {tab === "routine-settings" && isAdmin && (
            <RoutineSettings />
          )}
        </div>
        </Suspense>

        <div className="footer-note">
          Aponta CD
        </div>
      </main>

      <PushSetup
        activeSessions={activeSessions}
        entries={entries}
        isLeader={isLeader}
        onNavigate={setTab}
      />

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
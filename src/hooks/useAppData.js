import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
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
  ENTRIES_WINDOW_DAYS,
} from "../lib/api";
import { isPushEnabled, notifyNewConferenceItem } from "../lib/pushNotifications";
import { DEFAULT_OPERATORS, DEFAULT_ACTIVITIES, DEFAULT_ERROR_TYPES } from "../constants/defaults";
import { useRealtimeSync, applyRealtimeChange } from "./useRealtimeSync";

export const DEFAULT_ALERT_THRESHOLD = 1800;

const byStartDesc = (a, b) => new Date(b.start_time) - new Date(a.start_time);

// Carrega e mantém sincronizados os dados globais do app.
// Em vez de recarregar tabelas inteiras a cada evento, entries e
// active_sessions são atualizadas de forma incremental.
export function useAppData(session) {
  const [loaded, setLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [usingDefaults, setUsingDefaults] = useState(false);

  const [operators, setOperators] = useState(DEFAULT_OPERATORS);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [errorTypes, setErrorTypes] = useState(DEFAULT_ERROR_TYPES);
  const [vehicles, setVehicles] = useState([]);
  const [shortages, setShortages] = useState([]);
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
    if (data?.alert_threshold_seconds) setAlertThreshold(data.alert_threshold_seconds);
    return null;
  }, []);

  const loadEntries = useCallback(async () => {
    const { data, error } = await fetchEntries({ days: ENTRIES_WINDOW_DAYS });
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

  // Carga inicial
  useEffect(() => {
    if (!session) return;
    (async () => {
      try { await loadAll(); }
      catch (err) { setConnectionError(err?.message || "Erro inesperado ao carregar o aplicativo."); }
      finally { setLoaded(true); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Atualizações de tabelas "pequenas": recarrega com debounce
  const debounceTimers = useRef({});
  const debounced = useCallback((name, fn, ms = 250) => () => {
    clearTimeout(debounceTimers.current[name]);
    debounceTimers.current[name] = setTimeout(fn, ms);
  }, []);
  useEffect(() => () => Object.values(debounceTimers.current).forEach(clearTimeout), []);

  const windowStartRef = useRef(0);
  windowStartRef.current = Date.now() - ENTRIES_WINDOW_DAYS * 86400000;

  const handlers = {
    entries: (payload) => {
      setEntries((prev) =>
        applyRealtimeChange(prev, payload, {
          key: "id",
          compare: byStartDesc,
          accept: (row) => new Date(row.start_time).getTime() >= windowStartRef.current,
        })
      );
      debounced("shortages", loadShortages)();
    },
    active_sessions: (payload) =>
      setActiveSessions((prev) => applyRealtimeChange(prev, payload, { key: "operator_code" })),
    operators: debounced("operators", loadOperators),
    activities: debounced("activities", loadActivities),
    error_types: debounced("error_types", loadErrorTypes),
    vehicles: debounced("vehicles", loadVehicles),
    admin_config: debounced("admin_config", loadAdminConfig),
    separation_errors: debounced("separation_errors", loadSeparationErrors),
    entry_shortages: debounced("entry_shortages", loadShortages),
  };

  const realtimeStatus = useRealtimeSync({
    channelName: "app-data",
    enabled: !!session,
    handlers,
    onResync: loadAll,
  });

  // Notificação push de novo item na fila de conferência
  useEffect(() => {
    if (!session) return undefined;
    const confChannel = supabase
      .channel("notify-conference")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conference_queue" }, (payload) => {
        if (!isPushEnabled()) return;
        if (payload.new) notifyNewConferenceItem(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(confChannel); };
  }, [session]);

  return {
    loaded, connectionError, actionError, usingDefaults, realtimeStatus,
    operators, activities, errorTypes, vehicles, shortages, alertThreshold,
    entries, activeSessions, separationErrors,
    loadAll, loadEntries, resetEntries, resetSeparationErrors, resetShortages,
  };
}

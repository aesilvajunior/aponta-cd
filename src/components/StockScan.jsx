import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMapAreas, DEFAULT_CATEGORIES, SIDES } from "../lib/stockMap";
import { classifyScan } from "../lib/barcode";
import { loadCatalog, lookupCatalog, undoScan } from "../lib/mapScan";
import { buildOptimizedScanRoute, nextRouteStop } from "../lib/mapScanPlan";
import {
  fetchCyclicCountTasks,
  completeCyclicCountTask,
  cancelCyclicCountTask,
} from "../lib/cyclicInventory";
import { recordScanSafe, saveCatalogEntrySafe, removeByEntryId } from "../lib/offlineSync";
import { supabase } from "../supabaseClient";
import { getStationName } from "../lib/station";
import { cameraSupported } from "../lib/scanner";
import { beepOk, beepNew, beepError } from "../lib/beep";
import CameraScanner from "./scan/CameraScanner";
import { IconBox, IconMapPin } from "./Icons";

const OPERATOR_KEY = "aponta_schedule_operator";
const PREFILL_KEY = "aponta_scan_prefill";

function readStoredOperator(operators) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(OPERATOR_KEY) || "null");
    return operators.find((o) => o.code === parsed?.code) || null;
  } catch {
    return null;
  }
}

const ACTION_TEXT = {
  adicionou: "Adicionado ao endereço",
  ja_existia: "Já estava neste endereço",
  contou: "+1 unidade",
  pendente: "Guardado (sem internet)",
  ja_processado: "Já registrado",
};

const TRIGGER_LABELS = {
  falta: "Falta na separação",
  conferencia: "Divergência na conferência",
  inconsistencia: "Inconsistência do CD",
  manual: "Contagem manual",
};

export default function StockScan({ operators, currentOperator, onOpenMap }) {
  const [areas, setAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const [operator, setOperator] = useState(currentOperator || null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  const [areaId, setAreaId] = useState("");
  const [side, setSide] = useState("par");
  const [slot, setSlot] = useState("");
  const [level, setLevel] = useState("");
  const [mode, setMode] = useState("registrar");

  const [cameraOn, setCameraOn] = useState(false);
  const [typing, setTyping] = useState(false);
  const [field, setField] = useState("");
  const fieldRef = useRef(null);

  const [flash, setFlash] = useState(null); // { kind: ok|new|error|info, text }
  const [history, setHistory] = useState([]); // últimos bips da sessão
  const [pendingUnknown, setPendingUnknown] = useState(null); // { barcode }
  const [unknownForm, setUnknownForm] = useState({ name: "", code: "", category: "" });
  const [catalogCount, setCatalogCount] = useState(0);
  const busyRef = useRef(false);

  // ---------- Inventário Cíclico (Contagem Cega) ----------
  const [cyclicTasks, setCyclicTasks] = useState([]);
  const [activeCyclicTask, setActiveCyclicTask] = useState(null);
  const [blindCountQty, setBlindCountQty] = useState(0);
  const [blindUpdateMap, setBlindUpdateMap] = useState(true);
  const [lastBlindResult, setLastBlindResult] = useState(null);

  // ---------- Roteirização de Escaneamento / Picking ----------
  const [routeState, setRouteState] = useState(null); // resultado de buildOptimizedScanRoute
  const [routeCompleted, setRouteCompleted] = useState(() => new Set());
  const [routeAreaIds, setRouteAreaIds] = useState([]);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [routeBusy, setRouteBusy] = useState(false);

  const area = useMemo(() => areas.find((a) => String(a.id) === String(areaId)) || null, [areas, areaId]);

  const loadCyclicTasks = useCallback(async () => {
    const { data } = await fetchCyclicCountTasks({ status: "pendente", limit: 100 });
    setCyclicTasks(data || []);
    return data || [];
  }, []);

  const applyStopAddress = useCallback((stop, areaList = areas) => {
    if (!stop) return;
    const matchedArea =
      areaList.find((a) => String(a.id) === String(stop.area_id)) ||
      areaList.find((a) => String(a.code).toUpperCase() === String(stop.area_code || "").toUpperCase());
    if (matchedArea) setAreaId(String(matchedArea.id));
    if (stop.side) setSide(stop.side);
    setSlot(stop.slot || "");
    setLevel(stop.level || "");
  }, [areas]);

  const startBlindTask = useCallback((task, areaList = areas) => {
    setActiveCyclicTask(task);
    setBlindCountQty(0);
    setLastBlindResult(null);
    setMode("contar");
    applyStopAddress(task, areaList);
  }, [areas, applyStopAddress]);

  // ---------- carga inicial ----------
  useEffect(() => {
    (async () => {
      const [{ data }, cat, tasks] = await Promise.all([
        fetchMapAreas(),
        loadCatalog(),
        loadCyclicTasks(),
      ]);
      const validAreas = (data || []).filter(
        (a) => a.area_type === "prateleira" || a.area_type === "outro" || a.area_type === "recebimento"
      );
      setAreas(validAreas);
      setLoadingAreas(false);
      setCatalogCount(cat.count);
      if (cat.tableMissing) setTableMissing(true);

      // veio do botão "Coletar aqui" do mapa OU de uma tarefa de contagem cega
      try {
        const pre = JSON.parse(sessionStorage.getItem(PREFILL_KEY) || "null");
        if (pre) {
          if (pre.cyclicTaskId) {
            const foundTask = tasks.find((t) => String(t.id) === String(pre.cyclicTaskId));
            if (foundTask) startBlindTask(foundTask, validAreas);
          } else if (pre.areaId) {
            setAreaId(String(pre.areaId));
            if (pre.side) setSide(pre.side);
            if (pre.slot) setSlot(pre.slot);
            if (pre.level) setLevel(pre.level);
          }
          sessionStorage.removeItem(PREFILL_KEY);
        }
      } catch { /* ignora */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentOperator) setOperator(currentOperator);
    else setOperator((o) => o || readStoredOperator(operators));
  }, [currentOperator, operators]);

  useEffect(() => {
    if (!typing && !cameraOn) fieldRef.current?.focus();
  }, [typing, cameraOn, areaId, operator, pendingUnknown]);

  // ---------- identificação rápida ----------
  function loginWithCode() {
    const op = operators.find((o) => o.code === codeInput.trim());
    if (!op) { setCodeError("Código não encontrado."); beepError(); return; }
    try { sessionStorage.setItem(OPERATOR_KEY, JSON.stringify({ code: op.code })); } catch { /* ignora */ }
    setOperator(op);
    setCodeError("");
    setCodeInput("");
  }

  const say = useCallback((kind, text) => setFlash({ kind, text, at: Date.now() }), []);

  // ---------- gravar um bip ----------
  const commitScan = useCallback(async (barcode, catalog) => {
    if (!area || !operator) return;
    const res = await recordScanSafe({
      area,
      side: area.has_sides ? side : null,
      slot: slot.trim(),
      level: level.trim(),
      barcode,
      catalog,
      mode,
      operator: { code: operator.code, name: operator.name },
      station: getStationName() || null,
    });
    if (res.error) {
      beepError();
      say("error", `Não foi possível gravar: ${res.error.message || "tente de novo"}`);
      return;
    }
    // Se estiver em contagem cega ativa, acumula automaticamente na contagem
    if (activeCyclicTask) {
      setBlindCountQty((q) => q + 1);
    }
    const name = catalog?.product_name || catalog?.product_code || barcode;
    const isNew = res.action === "adicionou";
    isNew ? beepNew() : beepOk();
    say(isNew ? "new" : "ok", `${ACTION_TEXT[res.action] || "Registrado"}: ${name}`);
    setHistory((h) => [{ ...res, barcode, name, areaCode: area.code, side, slot: slot.trim(), level: level.trim(), mode, at: new Date() }, ...h].slice(0, 30));
  }, [area, operator, side, slot, level, mode, say, activeCyclicTask]);

  // ---------- tratar o que foi lido (câmera, leitor USB ou digitado) ----------
  const handleScan = useCallback(async (raw) => {
    const c = classifyScan(raw);
    if (c.kind === "empty") return;
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (c.kind === "badge") {
        const op = operators.find((o) => o.code === c.code);
        if (op) { setOperator(op); beepOk(); say("info", `Olá, ${op.name}`); }
        return;
      }

      if (c.kind === "address") {
        const a = areas.find((x) => String(x.code).toUpperCase() === c.areaCode);
        if (!a) { beepError(); say("error", `Endereço ${c.areaCode} não existe no mapa.`); return; }
        setAreaId(String(a.id));
        if (c.side) setSide(c.side);
        setSlot(c.slot);
        setLevel(c.level);
        beepOk();
        say("info", `Endereço: ${a.code}${c.side ? ` · ${c.side === "par" ? "PAR" : "ÍMPAR"}` : ""}${c.slot ? ` · pos. ${c.slot}` : ""}${c.level ? ` · nível ${c.level}` : ""}`);
        return;
      }

      // produto
      if (!operator) { beepError(); say("error", "Digite seu código antes de bipar."); return; }
      if (!area) { beepError(); say("error", "Escolha o endereço (ou bipe a etiqueta dele) antes dos produtos."); return; }
      if (c.suspicious) { beepError(); say("error", "Leitura duvidosa (dígito verificador não confere). Bipe de novo."); return; }

      const catalog = lookupCatalog(c.barcode);
      if (!catalog && !tableMissing) {
        // produto novo: pergunta o nome uma vez, e a próxima vez já sai reconhecido
        beepNew();
        setUnknownForm({ name: "", code: "", category: "" });
        setPendingUnknown({ barcode: c.barcode });
        return;
      }
      await commitScan(c.barcode, catalog);
    } finally {
      busyRef.current = false;
    }
  }, [areas, area, operator, operators, tableMissing, commitScan, say]);

  function submitField(e) {
    e.preventDefault();
    const value = field;
    setField("");
    handleScan(value);
  }

  // ---------- produto novo ----------
  async function saveUnknown(skip = false) {
    const barcode = pendingUnknown.barcode;
    let catalog = null;
    if (!skip && (unknownForm.name.trim() || unknownForm.code.trim())) {
      const { entry } = await saveCatalogEntrySafe({
        barcode,
        productCode: unknownForm.code,
        productName: unknownForm.name,
        category: unknownForm.category,
        createdBy: operator?.code,
      });
      catalog = entry;
      setCatalogCount((n) => n + 1);
    }
    setPendingUnknown(null);
    await commitScan(barcode, catalog);
  }

  // ---------- desfazer ----------
  async function undo(entry) {
    if (entry.queued) removeByEntryId(entry.scanId);
    else {
      const { error } = await undoScan(entry);
      if (error) { beepError(); say("error", `Não foi possível desfazer: ${error.message}`); return; }
    }
    setHistory((h) => h.filter((x) => x.scanId !== entry.scanId));
    say("info", "Bip desfeito.");
  }

  // ---------- concluir / cancelar contagem cega ----------
  async function finishBlindCount() {
    if (!activeCyclicTask) return;
    const { evaluation, error } = await completeCyclicCountTask(activeCyclicTask, {
      countedQuantity: Number(blindCountQty) || 0,
      operator,
      updateStockMap: blindUpdateMap,
    });
    if (error) {
      beepError();
      say("error", `Erro ao concluir contagem: ${error.message}`);
      return;
    }
    beepOk();
    setLastBlindResult({
      areaCode: activeCyclicTask.area_code,
      productCode: activeCyclicTask.product_code,
      ...evaluation,
    });
    if (routeState) {
      const matchStop = routeState.orderedStops.find((s) => String(s.id) === String(activeCyclicTask.id));
      if (matchStop) {
        const nextSet = new Set(routeCompleted);
        nextSet.add(matchStop.routeKey);
        setRouteCompleted(nextSet);
        const nxt = nextRouteStop(routeState, nextSet);
        if (nxt) applyStopAddress(nxt);
      }
    }
    setActiveCyclicTask(null);
    await loadCyclicTasks();
    say("ok", evaluation.summary);
  }

  async function dismissCyclicTask(taskId) {
    await cancelCyclicCountTask(taskId);
    if (activeCyclicTask?.id === taskId) setActiveCyclicTask(null);
    await loadCyclicTasks();
  }

  // ---------- roteirização otimizada (serpentina corredor/nível) ----------
  function buildRouteFromCyclicTasks() {
    if (cyclicTasks.length === 0) return;
    const r = buildOptimizedScanRoute(cyclicTasks, areas, { serpentine: true, levelDirection: "asc" });
    setRouteState({ ...r, sourceLabel: "Tarefas de inventário cíclico" });
    setRouteCompleted(new Set());
    if (r.orderedStops[0]) {
      startBlindTask(r.orderedStops[0]);
    }
    say("info", `Rota otimizada criada: ${r.orderedStops.length} parada(s)${r.savedPct > 0 ? ` (-${r.savedPct}% deslocamento)` : ""}.`);
  }

  async function buildRouteFromSelectedAreas() {
    if (routeAreaIds.length === 0) return;
    setRouteBusy(true);
    try {
      let stops = [];
      if (supabase?.from) {
        const { data } = await supabase
          .from("stock_map_items")
          .select("*")
          .in("area_id", routeAreaIds);
        stops = (data || []).map((it) => {
          const a = areas.find((x) => String(x.id) === String(it.area_id));
          return {
            id: `item-${it.id}`,
            area_id: it.area_id,
            area_code: a?.code || "",
            side: it.side || null,
            slot: it.slot || null,
            level: it.level || null,
            product_code: it.product_code,
            product_name: it.product_name,
          };
        });
      }
      // Se as áreas ainda estiverem vazias, cria 1 parada por área selecionada
      if (stops.length === 0) {
        stops = routeAreaIds.map((id) => {
          const a = areas.find((x) => String(x.id) === String(id));
          return { id: `area-${id}`, area_id: id, area_code: a?.code || "", side: a?.has_sides ? "impar" : null, slot: "01", level: "1" };
        });
      }
      const r = buildOptimizedScanRoute(stops, areas, { serpentine: true, levelDirection: "asc" });
      setRouteState({ ...r, sourceLabel: `${routeAreaIds.length} corredor(es) selecionado(s)` });
      setRouteCompleted(new Set());
      setRoutePickerOpen(false);
      if (r.orderedStops[0]) applyStopAddress(r.orderedStops[0]);
      say("info", `Rota de escaneamento pronta: ${r.orderedStops.length} endereço(s) em serpentina.`);
    } finally {
      setRouteBusy(false);
    }
  }

  const currentRouteStop = useMemo(
    () => (routeState ? nextRouteStop(routeState, routeCompleted) : null),
    [routeState, routeCompleted]
  );

  function markCurrentStopDone() {
    if (!currentRouteStop || !routeState) return;
    const nextDone = new Set(routeCompleted);
    nextDone.add(currentRouteStop.routeKey);
    setRouteCompleted(nextDone);
    const next = nextRouteStop(routeState, nextDone);
    if (next) {
      applyStopAddress(next);
      beepOk();
      say("info", `Próximo endereço: ${next.area_code}${next.slot ? ` · pos. ${next.slot}` : ""}${next.level ? ` · n${next.level}` : ""}`);
    } else {
      beepNew();
      say("ok", "Rota concluída! Todos os endereços foram percorridos sem vai-e-volta.");
    }
  }

  // ---------- tela ----------
  const grouped = useMemo(() => {
    const by = {};
    areas.forEach((a) => { (by[a.floor || "terreo"] ||= []).push(a); });
    return Object.entries(by).map(([floor, list]) => [floor, [...list].sort((a, b) => String(a.code).localeCompare(String(b.code), "pt-BR", { numeric: true }))]);
  }, [areas]);

  const counters = useMemo(() => ({
    total: history.length,
    novos: history.filter((h) => h.action === "adicionou").length,
  }), [history]);

  if (!operator) {
    return (
      <div>
        <h1 className="page-title">Coleta de endereços</h1>
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="card-title">Quem está bipando?</div>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 0 }}>Digite seu código de operador ou bipe o crachá.</p>
          <form onSubmit={(e) => { e.preventDefault(); loginWithCode(); }}>
            <input
              className="field" inputMode="numeric" autoComplete="off" autoFocus placeholder="Código"
              value={codeInput} onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))} aria-label="Código do operador"
            />
            {codeError && <p role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>{codeError}</p>}
            <button className="btn btn-primary" type="submit" style={{ marginTop: 10 }} disabled={!codeInput}>Entrar</button>
          </form>
          <input
            ref={fieldRef} className="scan-hidden-input" aria-label="Leitor de crachá"
            value={field} onChange={(e) => setField(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = field; setField(""); handleScan(v); } }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Coleta de endereços</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Escolha (ou bipe) o endereço e depois bipe os produtos. Eles aparecem no mapa na hora.
            {" "}Operador: <strong>{operator.name}</strong> · {catalogCount} códigos conhecidos
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-small"
            onClick={() => setRoutePickerOpen((v) => !v)}
          >
            🧭 Roteirizar corredores
          </button>
          {cyclicTasks.length > 0 && (
            <button
              type="button"
              className="btn-small btn-excel"
              onClick={buildRouteFromCyclicTasks}
            >
              Roteirizar {cyclicTasks.length} contagem(ns) cega(s)
            </button>
          )}
        </div>
      </div>

      {tableMissing && (
        <div className="alert-card alert-danger" style={{ marginBottom: 16 }}>
          <strong>Falta ativar o banco para a coleta.</strong>
          <p className="alert-detail">Rode <code>supabase/migrations/2026-10-12_map_scan.sql</code> no SQL Editor do Supabase. Enquanto isso, produtos novos entram só com o código de barras.</p>
        </div>
      )}

      {/* Seletor de corredores para roteirização em serpentina */}
      {routePickerOpen && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Gerar rota otimizada (serpentina por corredor e nível)</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
            Selecione os corredores/prateleiras para percorrer na sequência mais curta (ida/volta sem retornar no mesmo corredor).
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {areas.map((a) => {
              const checked = routeAreaIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`scan-chip ${checked ? "active" : ""}`}
                  onClick={() =>
                    setRouteAreaIds((prev) =>
                      prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                    )
                  }
                >
                  {a.code}{a.label ? ` · ${a.label}` : ""}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-small btn-excel"
              disabled={routeAreaIds.length === 0 || routeBusy}
              onClick={buildRouteFromSelectedAreas}
            >
              {routeBusy ? "Calculando rota..." : `Iniciar rota (${routeAreaIds.length} áreas)`}
            </button>
            <button type="button" className="btn-small" onClick={() => setRoutePickerOpen(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Painel de Rota Guiada Ativa */}
      {routeState && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--accent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>
                🧭 Rota Guiada · {routeState.sourceLabel}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {routeCompleted.size} de {routeState.orderedStops.length} parada(s) concluída(s)
                {routeState.savedPct > 0 && (
                  <> · <strong style={{ color: "var(--ok)" }}>-{routeState.savedPct}% deslocamento</strong></>
                )}
                {routeState.backtracksAvoided > 0 && ` · ${routeState.backtracksAvoided} vai-e-volta(s) evitado(s)`}
              </div>
            </div>
            <button type="button" className="btn-small" onClick={() => setRouteState(null)}>Encerrar rota</button>
          </div>

          {currentRouteStop ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 14px", background: "var(--accent-soft)", borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--accent)" }}>
                  Parada #{currentRouteStop.stepIndex} · Corredor {currentRouteStop.corridorKey} ({currentRouteStop.direction === "ida" ? "Ida →" : "← Volta"})
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                  {currentRouteStop.area_code}
                  {currentRouteStop.side ? ` · ${currentRouteStop.side === "par" ? "PAR" : "ÍMPAR"}` : ""}
                  {currentRouteStop.slot ? ` · Pos. ${currentRouteStop.slot}` : ""}
                  {currentRouteStop.level ? ` · Nível ${currentRouteStop.level}` : ""}
                </div>
                {currentRouteStop.product_code && (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Produto: <strong>{currentRouteStop.product_code}</strong> {currentRouteStop.product_name ? `— ${currentRouteStop.product_name}` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-small" onClick={() => applyStopAddress(currentRouteStop)}>
                  Preencher endereço
                </button>
                <button type="button" className="btn-small btn-excel" onClick={markCurrentStopDone}>
                  ✓ Concluir e avançar →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--ok)", fontWeight: 600, fontSize: 13 }}>
              ✓ Todas as paradas desta rota foram concluídas!
            </div>
          )}
        </div>
      )}

      {/* Resultado da última contagem cega concluída */}
      {lastBlindResult && (
        <div
          className="alert-card"
          style={{
            marginBottom: 16,
            background: lastBlindResult.status === "ok" ? "var(--ok-soft)" : "var(--warning-soft)",
            borderColor: lastBlindResult.status === "ok" ? "var(--ok)" : "var(--warning)",
            color: "var(--text)",
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong>Resultado da contagem cega ({lastBlindResult.areaCode}{lastBlindResult.productCode ? ` · ${lastBlindResult.productCode}` : ""}):</strong>{" "}
            {lastBlindResult.summary}
          </div>
          <button type="button" className="btn-small" onClick={() => setLastBlindResult(null)}>Fechar</button>
        </div>
      )}

      {/* Contagem cega ativa */}
      {activeCyclicTask && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--warning)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>
                🔒 Contagem Cega em Andamento · {activeCyclicTask.area_code}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Gatilho: <strong>{TRIGGER_LABELS[activeCyclicTask.trigger_source] || activeCyclicTask.trigger_source}</strong> · {activeCyclicTask.reason}
              </div>
              <div style={{ fontSize: 12, color: "var(--warning)", fontWeight: 600, marginTop: 4 }}>
                Saldo do sistema oculto (modo cego). Bipe cada unidade ou informe o total físico contado abaixo.
              </div>
            </div>
            <button type="button" className="btn-small" onClick={() => setActiveCyclicTask(null)}>Pausar tarefa</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span>Qtd. física contada:</span>
              <input
                type="number"
                min="0"
                className="field"
                style={{ width: 100, fontFamily: "var(--font-mono)", fontWeight: 700 }}
                value={blindCountQty}
                onChange={(e) => setBlindCountQty(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
              <input type="checkbox" checked={blindUpdateMap} onChange={(e) => setBlindUpdateMap(e.target.checked)} />
              Atualizar saldo no mapa ao concluir
            </label>
            <button type="button" className="btn-small btn-excel" onClick={finishBlindCount}>
              ✓ Finalizar contagem cega
            </button>
          </div>
        </div>
      )}

      {/* Fila de tarefas de inventário cíclico geradas automaticamente */}
      {cyclicTasks.length > 0 && !activeCyclicTask && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              Inventário cíclico pendente ({cyclicTasks.length})
            </div>
            <button type="button" className="btn-small" onClick={buildRouteFromCyclicTasks}>
              🧭 Ordenar em rota serpentina
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
            {cyclicTasks.slice(0, 12).map((task) => (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 200, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{task.area_code}</span>
                    {task.product_code && <span className="badge">{task.product_code}</span>}
                    <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 700 }}>
                      {TRIGGER_LABELS[task.trigger_source] || task.trigger_source}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{task.reason}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn-small btn-excel" onClick={() => startBlindTask(task)}>
                    Iniciar contagem cega
                  </button>
                  <button type="button" className="btn-small" onClick={() => dismissCyclicTask(task.id)} title="Dispensar tarefa">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="scan-grid">
        <div className="card">
          <div className="card-title"><IconMapPin size={16} /> 1. Endereço</div>
          {loadingAreas ? <p style={{ color: "var(--text-muted)" }}>Carregando mapa...</p> : (
            <>
              <label className="scan-label" htmlFor="scan-area">Rua / área</label>
              <select id="scan-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">Escolha...</option>
                {grouped.map(([floor, list]) => (
                  <optgroup key={floor} label={`Andar: ${floor}`}>
                    {list.map((a) => <option key={a.id} value={a.id}>{a.code}{a.label ? ` · ${a.label}` : ""}</option>)}
                  </optgroup>
                ))}
              </select>

              {area?.has_sides && (
                <div className="scan-chips" role="group" aria-label="Lado">
                  {SIDES.map((s) => (
                    <button key={s.value} type="button" className={`scan-chip ${side === s.value ? "active" : ""}`} aria-pressed={side === s.value} onClick={() => setSide(s.value)}>{s.short}</button>
                  ))}
                </div>
              )}

              <div className="scan-row">
                <div>
                  <label className="scan-label" htmlFor="scan-slot">Posição</label>
                  <input id="scan-slot" className="field" placeholder="ex.: 03" value={slot} onChange={(e) => setSlot(e.target.value)} />
                </div>
                <div>
                  <label className="scan-label" htmlFor="scan-level">Nível</label>
                  <input id="scan-level" className="field" placeholder="ex.: 2" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
                </div>
              </div>
              {area && (
                <button type="button" className="btn-small" style={{ marginTop: 10 }} onClick={() => onOpenMap?.(area)}>Ver {area.code} no mapa</button>
              )}
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title"><IconBox size={16} /> 2. Bipar produtos</div>

          <div className="scan-chips" role="group" aria-label="Modo">
            <button type="button" className={`scan-chip ${mode === "registrar" ? "active" : ""}`} aria-pressed={mode === "registrar"} onClick={() => setMode("registrar")}>Registrar endereço</button>
            <button type="button" className={`scan-chip ${mode === "contar" ? "active" : ""}`} aria-pressed={mode === "contar"} onClick={() => setMode("contar")}>Contar (+1 por bip)</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "6px 0 10px" }}>
            {mode === "registrar" ? "Cada produto entra uma vez no endereço. Bipar de novo não duplica." : "Cada bip soma uma unidade no endereço."}
          </p>

          <form onSubmit={submitField} className="scan-field-row">
            <input
              ref={fieldRef} className="field scan-field" aria-label="Campo de leitura"
              placeholder={typing ? "Digite o código e Enter" : "Bipe com o leitor ou use a câmera"}
              inputMode={typing ? "text" : "none"} autoComplete="off" autoCapitalize="off" spellCheck={false}
              value={field} onChange={(e) => setField(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!field.trim()}>OK</button>
          </form>

          <div className="scan-actions">
            {cameraSupported() && (
              <button type="button" className="btn-small" onClick={() => setCameraOn((v) => !v)}>{cameraOn ? "Fechar câmera" : "Usar câmera"}</button>
            )}
            <button type="button" className="btn-small" onClick={() => setTyping((v) => !v)}>{typing ? "Esconder teclado" : "Digitar código"}</button>
          </div>

          {cameraOn && <CameraScanner onCode={handleScan} onClose={() => setCameraOn(false)} />}

          {flash && (
            <div className={`scan-flash scan-flash-${flash.kind}`} role={flash.kind === "error" ? "alert" : "status"} aria-live="polite" key={flash.at}>
              {flash.text}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-title">Bipados nesta sessão ({counters.total}, {counters.novos} novos)</div>
        {history.length === 0 && <p style={{ color: "var(--text-muted)", margin: 0 }}>Nada bipado ainda.</p>}
        {history.length > 0 && (
          <table className="data-table">
            <thead><tr><th>Produto</th><th>Endereço</th><th>Resultado</th><th></th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.scanId}>
                  <td>{h.name}<div style={{ fontSize: 11, color: "var(--text-faint)" }}>{h.barcode}</div></td>
                  <td>{h.areaCode}{h.side ? ` ${h.side === "par" ? "PAR" : "ÍMPAR"}` : ""}{h.slot ? ` · ${h.slot}` : ""}{h.level ? ` · n${h.level}` : ""}</td>
                  <td>{ACTION_TEXT[h.action] || h.action}</td>
                  <td><button type="button" className="btn-small" onClick={() => undo(h)}>Desfazer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pendingUnknown && (
        <div className="kiosk-modal-backdrop" onClick={() => setPendingUnknown(null)}>
          <div className="kiosk-modal" role="dialog" aria-modal="true" aria-labelledby="scan-unknown-title" onClick={(e) => e.stopPropagation()}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title" id="scan-unknown-title">Produto novo</div>
                <div className="kiosk-modal-sub">Código <strong>{pendingUnknown.barcode}</strong> ainda não está no catálogo. Informe uma vez e ele será reconhecido nas próximas.</div>
              </div>
              <button type="button" className="kiosk-modal-close" onClick={() => setPendingUnknown(null)} aria-label="Cancelar">×</button>
            </div>
            <div className="kiosk-modal-body">
              <label className="scan-label" htmlFor="unk-name">Nome do produto</label>
              <input id="unk-name" className="field" autoFocus value={unknownForm.name} onChange={(e) => setUnknownForm((f) => ({ ...f, name: e.target.value }))} placeholder="ex.: Joelho soldável 25mm" />
              <div className="scan-row">
                <div>
                  <label className="scan-label" htmlFor="unk-code">Código interno (opcional)</label>
                  <input id="unk-code" className="field" value={unknownForm.code} onChange={(e) => setUnknownForm((f) => ({ ...f, code: e.target.value }))} />
                </div>
                <div>
                  <label className="scan-label" htmlFor="unk-cat">Categoria</label>
                  <input id="unk-cat" className="field" list="scan-categories" value={unknownForm.category} onChange={(e) => setUnknownForm((f) => ({ ...f, category: e.target.value }))} />
                  <datalist id="scan-categories">{DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" className="btn btn-primary" onClick={() => saveUnknown(false)}>Salvar e registrar</button>
                <button type="button" className="btn btn-secondary" onClick={() => saveUnknown(true)}>Registrar sem nome</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

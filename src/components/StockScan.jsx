import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMapAreas, DEFAULT_CATEGORIES, SIDES } from "../lib/stockMap";
import { classifyScan } from "../lib/barcode";
import { loadCatalog, lookupCatalog, undoScan } from "../lib/mapScan";
import { recordScanSafe, saveCatalogEntrySafe, removeByEntryId } from "../lib/offlineSync";
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

  const area = useMemo(() => areas.find((a) => String(a.id) === String(areaId)) || null, [areas, areaId]);

  // ---------- carga inicial ----------
  useEffect(() => {
    (async () => {
      const [{ data }, cat] = await Promise.all([fetchMapAreas(), loadCatalog()]);
      setAreas(data.filter((a) => a.area_type === "prateleira" || a.area_type === "outro" || a.area_type === "recebimento"));
      setLoadingAreas(false);
      setCatalogCount(cat.count);
      if (cat.tableMissing) setTableMissing(true);

      // veio do botão "Coletar aqui" do mapa
      try {
        const pre = JSON.parse(sessionStorage.getItem(PREFILL_KEY) || "null");
        if (pre?.areaId) {
          setAreaId(String(pre.areaId));
          if (pre.side) setSide(pre.side);
          sessionStorage.removeItem(PREFILL_KEY);
        }
      } catch { /* ignora */ }
    })();
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
    const name = catalog?.product_name || catalog?.product_code || barcode;
    const isNew = res.action === "adicionou";
    isNew ? beepNew() : beepOk();
    say(isNew ? "new" : "ok", `${ACTION_TEXT[res.action] || "Registrado"}: ${name}`);
    setHistory((h) => [{ ...res, barcode, name, areaCode: area.code, side, slot: slot.trim(), level: level.trim(), mode, at: new Date() }, ...h].slice(0, 30));
  }, [area, operator, side, slot, level, mode, say]);

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
      </div>

      {tableMissing && (
        <div className="alert-card alert-danger" style={{ marginBottom: 16 }}>
          <strong>Falta ativar o banco para a coleta.</strong>
          <p className="alert-detail">Rode <code>supabase/migrations/2026-10-12_map_scan.sql</code> no SQL Editor do Supabase. Enquanto isso, produtos novos entram só com o código de barras.</p>
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


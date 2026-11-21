import React, { useEffect, useMemo, useState } from "react";
import { fetchMapAreas } from "../lib/stockMap";
import { addressLabelPayload } from "../lib/barcode";

const MAX_LABELS = 600; // evita gerar milhares de etiquetas por engano

function parsePositiveInt(str, max) {
  const clean = String(str ?? "").replace(/\D/g, "");
  if (!clean) return 0;
  return Math.min(max, Math.max(0, Number(clean)));
}

// Gera etiquetas com QR de endereço para colar nas estantes.
// Suporta o padrão compacto do CD (ex.: 1C1105EA) e o modo por área do mapa.
// Regra do CD: Lado PAR = Direito · Lado ÍMPAR = Esquerdo.
export default function AddressLabels() {
  const [mode, setMode] = useState("cd"); // "cd" (padrão 1C1105EA) | "mapa"
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState("");

  // Inputs como string (corrige o bug em que o campo ficava preso com "0" na frente!)
  const [slotsInput, setSlotsInput] = useState("");
  const [levelsInput, setLevelsInput] = useState("");

  // Padrão CD (ex.: 1C1105EA -> Rua 1C, Posição 11, Nível 05, Sufixo EA)
  const [cdCorridor, setCdCorridor] = useState("1C");
  const [cdPosStart, setCdPosStart] = useState("11");
  const [cdPosEnd, setCdPosEnd] = useState("12");
  const [cdSideFilter, setCdSideFilter] = useState("ambos"); // "ambos" | "par" | "impar"
  const [cdLevelStart, setCdLevelStart] = useState("01");
  const [cdLevelEnd, setCdLevelEnd] = useState("05");
  const [cdSuffixes, setCdSuffixes] = useState("EA");

  const [qrs, setQrs] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMapAreas().then(({ data }) => setAreas((data || []).filter((a) => a.area_type === "prateleira")));
  }, []);

  const area = areas.find((a) => String(a.id) === String(areaId)) || null;

  const labels = useMemo(() => {
    if (mode === "cd") {
      const corridor = cdCorridor.trim().toUpperCase();
      if (!corridor) return [];
      const pStart = parsePositiveInt(cdPosStart, 999);
      const pEnd = Math.max(pStart, parsePositiveInt(cdPosEnd || cdPosStart, 999));
      const lStart = parsePositiveInt(cdLevelStart, 99);
      const lEnd = Math.max(lStart, parsePositiveInt(cdLevelEnd || cdLevelStart, 99));
      const suffixes = cdSuffixes
        .split(/[,;\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const sufList = suffixes.length > 0 ? suffixes : [""];

      if (pStart === 0) return [];
      const out = [];
      for (let p = pStart; p <= pEnd; p++) {
        const side = p % 2 === 0 ? "par" : "impar";
        if (cdSideFilter === "par" && side !== "par") continue;
        if (cdSideFilter === "impar" && side !== "impar") continue;
        const posStr = String(p).padStart(2, "0");

        const levelRange = lStart > 0 ? Array.from({ length: lEnd - lStart + 1 }, (_, i) => String(lStart + i).padStart(2, "0")) : [""];
        for (const lvl of levelRange) {
          for (const suf of sufList) {
            const fullCode = `${corridor}${posStr}${lvl}${suf}`;
            out.push({
              displayCode: fullCode,
              areaCode: corridor,
              side,
              slot: posStr,
              level: `${lvl}${suf}`,
              payload: fullCode,
            });
          }
        }
      }
      return out;
    }

    if (!area) return [];
    const slots = parsePositiveInt(slotsInput, 99);
    const levels = parsePositiveInt(levelsInput, 20);
    const sides = area.has_sides ? ["par", "impar"] : [null];
    const slotList = slots > 0 ? Array.from({ length: slots }, (_, i) => String(i + 1).padStart(2, "0")) : [""];
    const levelList = levels > 0 ? Array.from({ length: levels }, (_, i) => String(i + 1).padStart(2, "0")) : [""];
    const out = [];
    for (const side of sides) {
      for (const slot of slotList) {
        for (const level of levelList) {
          out.push({
            displayCode: area.code,
            areaCode: area.code,
            side,
            slot,
            level,
            payload: addressLabelPayload({ areaCode: area.code, side, slot, level }),
          });
        }
      }
    }
    return out;
  }, [mode, cdCorridor, cdPosStart, cdPosEnd, cdSideFilter, cdLevelStart, cdLevelEnd, cdSuffixes, area, slotsInput, levelsInput]);

  const tooMany = labels.length > MAX_LABELS;
  const shown = useMemo(() => (tooMany ? [] : labels), [tooMany, labels]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (shown.length === 0) { setQrs({}); return; }
      setLoading(true);
      const QR = await import("qrcode");
      const next = {};
      for (const l of shown) {
        next[l.payload] = await QR.toDataURL(l.payload, { margin: 1, width: 220, errorCorrectionLevel: "M" });
      }
      if (!cancelled) { setQrs(next); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [shown]);

  return (
    <div className="anim-fade-up">
      <div className="page-header-row no-print" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Etiquetas de endereço</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Imprima e cole nas estantes. Padrão do corredor: <strong>PAR = lado direito</strong> · <strong>ÍMPAR = lado esquerdo</strong>.
          </p>
        </div>
        <button className="btn-small btn-excel" onClick={() => window.print()} disabled={loading || shown.length === 0}>
          Imprimir ({shown.length})
        </button>
      </div>

      <div className="quick-filters no-print" style={{ marginBottom: 16 }}>
        <span className="quick-filters-label">Formato:</span>
        <button type="button" className={`quick-filter-btn ${mode === "cd" ? "active" : ""}`} onClick={() => setMode("cd")}>
          Padrão CD (ex.: 1C1105EA)
        </button>
        <button type="button" className={`quick-filter-btn ${mode === "mapa" ? "active" : ""}`} onClick={() => setMode("mapa")}>
          Por Área do Mapa
        </button>
      </div>

      <div className="card no-print" style={{ marginBottom: 16 }}>
        {mode === "cd" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <div>
                <label className="scan-label" htmlFor="cd-corr">Corredor / Rua</label>
                <input
                  id="cd-corr"
                  className="field"
                  placeholder="ex.: 1C"
                  value={cdCorridor}
                  onChange={(e) => setCdCorridor(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                />
              </div>
              <div>
                <label className="scan-label" htmlFor="cd-p1">Posição inicial</label>
                <input
                  id="cd-p1"
                  className="field"
                  inputMode="numeric"
                  placeholder="ex.: 11"
                  value={cdPosStart}
                  onChange={(e) => setCdPosStart(e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
              </div>
              <div>
                <label className="scan-label" htmlFor="cd-p2">Posição final</label>
                <input
                  id="cd-p2"
                  className="field"
                  inputMode="numeric"
                  placeholder="ex.: 12"
                  value={cdPosEnd}
                  onChange={(e) => setCdPosEnd(e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
              </div>
              <div>
                <label className="scan-label" htmlFor="cd-l1">Nível inicial</label>
                <input
                  id="cd-l1"
                  className="field"
                  inputMode="numeric"
                  placeholder="ex.: 01"
                  value={cdLevelStart}
                  onChange={(e) => setCdLevelStart(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
              <div>
                <label className="scan-label" htmlFor="cd-l2">Nível final</label>
                <input
                  id="cd-l2"
                  className="field"
                  inputMode="numeric"
                  placeholder="ex.: 05"
                  value={cdLevelEnd}
                  onChange={(e) => setCdLevelEnd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
              <div>
                <label className="scan-label" htmlFor="cd-suf">Sufixo (vírgula p/ vários)</label>
                <input
                  id="cd-suf"
                  className="field"
                  placeholder="ex.: EA, EB"
                  value={cdSuffixes}
                  onChange={(e) => setCdSuffixes(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="scan-label" htmlFor="cd-side">Lado do corredor</label>
                <select id="cd-side" className="field" value={cdSideFilter} onChange={(e) => setCdSideFilter(e.target.value)}>
                  <option value="ambos">Ambos (Par + Ímpar)</option>
                  <option value="par">Só PAR (Direito)</option>
                  <option value="impar">Só ÍMPAR (Esquerdo)</option>
                </select>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 0, marginTop: 12 }}>
              <strong>{labels.length}</strong> etiqueta(s) pronta(s)
              {labels[0] && (
                <> · Exemplo: <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{labels[0].displayCode}</code> ({labels[0].side === "par" ? "PAR · Direito" : "ÍMPAR · Esquerdo"})</>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="scan-row" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
              <div>
                <label className="scan-label" htmlFor="lbl-area">Rua / estante</label>
                <select id="lbl-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  <option value="">Escolha...</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.code}{a.label ? ` · ${a.label}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="scan-label" htmlFor="lbl-slots">Posições (vazio = só rua)</label>
                <input
                  id="lbl-slots"
                  className="field"
                  inputMode="numeric"
                  placeholder="ex.: 10"
                  value={slotsInput}
                  onChange={(e) => setSlotsInput(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
              <div>
                <label className="scan-label" htmlFor="lbl-levels">Níveis (vazio = sem nível)</label>
                <input
                  id="lbl-levels"
                  className="field"
                  inputMode="numeric"
                  placeholder="ex.: 4"
                  value={levelsInput}
                  onChange={(e) => setLevelsInput(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
            </div>
            {area && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 0 }}>
                {labels.length} etiqueta(s){area.has_sides ? " (PAR = direito · ÍMPAR = esquerdo)" : ""}.
              </p>
            )}
          </>
        )}
        {tooMany && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, marginBottom: 0 }}>São mais de {MAX_LABELS} etiquetas. Reduza o intervalo de posições ou níveis.</p>}
      </div>

      {loading && <p className="no-print" style={{ color: "var(--text-muted)" }}>Gerando QR codes...</p>}

      <div className="label-sheet">
        {shown.map((l) => (
          <div className="label-card" key={l.payload}>
            {qrs[l.payload] && <img src={qrs[l.payload]} alt={`QR do endereço ${l.displayCode}`} width={110} height={110} />}
            <div className="label-code">{l.displayCode}</div>
            <div className="label-sub">
              {[
                l.side ? (l.side === "par" ? "PAR · DIR" : "ÍMPAR · ESQ") : null,
                mode === "mapa" && l.slot ? `Pos ${l.slot}` : null,
                mode === "mapa" && l.level ? `Nível ${l.level}` : null,
              ].filter(Boolean).join(" · ") || "Rua"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

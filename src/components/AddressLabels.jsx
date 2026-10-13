import React, { useEffect, useMemo, useState } from "react";
import { fetchMapAreas } from "../lib/stockMap";
import { addressLabelPayload } from "../lib/barcode";

const MAX_LABELS = 600; // evita gerar milhares de etiquetas por engano

// Gera etiquetas com QR de endereço (rua / lado / posição / nível) para colar nas estantes.
// No Coleta de endereços, bipar a etiqueta já escolhe o endereço.
export default function AddressLabels() {
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState("");
  const [slots, setSlots] = useState(0);
  const [levels, setLevels] = useState(0);
  const [qrs, setQrs] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMapAreas().then(({ data }) => setAreas(data.filter((a) => a.area_type === "prateleira")));
  }, []);

  const area = areas.find((a) => String(a.id) === String(areaId)) || null;

  const labels = useMemo(() => {
    if (!area) return [];
    const sides = area.has_sides ? ["par", "impar"] : [null];
    const slotList = slots > 0 ? Array.from({ length: slots }, (_, i) => String(i + 1).padStart(2, "0")) : [""];
    const levelList = levels > 0 ? Array.from({ length: levels }, (_, i) => String(i + 1)) : [""];
    const out = [];
    for (const side of sides) for (const slot of slotList) for (const level of levelList) {
      out.push({ areaCode: area.code, side, slot, level, payload: addressLabelPayload({ areaCode: area.code, side, slot, level }) });
    }
    return out;
  }, [area, slots, levels]);

  const tooMany = labels.length > MAX_LABELS;
  const shown = tooMany ? [] : labels;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (shown.length === 0) { setQrs({}); return; }
      setLoading(true);
      const QR = await import("qrcode"); // só baixa quando esta tela abre
      const next = {};
      for (const l of shown) next[l.payload] = await QR.toDataURL(l.payload, { margin: 1, width: 220, errorCorrectionLevel: "M" });
      if (!cancelled) { setQrs(next); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [shown]);

  return (
    <div>
      <div className="page-header-row no-print" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Etiquetas de endereço</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Imprima e cole nas estantes. Na tela <strong>Coleta de endereços</strong>, bipar a etiqueta já escolhe rua, lado,
            posição e nível; depois é só bipar os produtos.
          </p>
        </div>
        <button className="btn-small" onClick={() => window.print()} disabled={loading || shown.length === 0}>Imprimir</button>
      </div>

      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="scan-row" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
          <div>
            <label className="scan-label" htmlFor="lbl-area">Rua / estante</label>
            <select id="lbl-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Escolha...</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.code}{a.label ? ` · ${a.label}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="scan-label" htmlFor="lbl-slots">Posições (0 = só a rua)</label>
            <input id="lbl-slots" className="field" type="number" min="0" max="99" value={slots} onChange={(e) => setSlots(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div>
            <label className="scan-label" htmlFor="lbl-levels">Níveis (0 = sem nível)</label>
            <input id="lbl-levels" className="field" type="number" min="0" max="10" value={levels} onChange={(e) => setLevels(Math.max(0, Number(e.target.value) || 0))} />
          </div>
        </div>
        {area && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 0 }}>{labels.length} etiqueta(s){area.has_sides ? " (lados par e ímpar)" : ""}.</p>}
        {tooMany && <p role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>São mais de {MAX_LABELS} etiquetas. Reduza posições ou níveis.</p>}
      </div>

      {loading && <p className="no-print" style={{ color: "var(--text-muted)" }}>Gerando QR codes...</p>}

      <div className="label-sheet">
        {shown.map((l) => (
          <div className="label-card" key={l.payload}>
            {qrs[l.payload] && <img src={qrs[l.payload]} alt={`QR do endereço ${l.areaCode}`} width={110} height={110} />}
            <div className="label-code">{l.areaCode}</div>
            <div className="label-sub">
              {[l.side ? (l.side === "par" ? "PAR" : "ÍMPAR") : null, l.slot ? `Pos ${l.slot}` : null, l.level ? `Nível ${l.level}` : null].filter(Boolean).join(" · ") || "Rua"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

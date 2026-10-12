import React, { useEffect, useMemo, useState } from "react";
import { badgePayload } from "../lib/badge";

// Gera crachás com QR code para imprimir (um por operador).
export default function BadgePrinter({ operators }) {
  const [qrs, setQrs] = useState({});
  const [loading, setLoading] = useState(true);
  const [onlyRole, setOnlyRole] = useState("");

  const list = useMemo(
    () => operators.filter((o) => !onlyRole || (o.role || "operator") === onlyRole),
    [operators, onlyRole]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const QR = await import("qrcode"); // só baixa quando esta tela abre
      const next = {};
      for (const o of operators) {
        next[o.code] = await QR.toDataURL(badgePayload(o.code), { margin: 1, width: 260, errorCorrectionLevel: "M" });
      }
      if (!cancelled) {
        setQrs(next);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [operators]);

  return (
    <div>
      <div className="page-header-row no-print" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Crachás</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Imprima e entregue aos operadores. No Kiosk, o login pode ser feito lendo o QR com a câmera
            (Chrome/Edge) ou com um leitor de código de barras USB.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="field" style={{ width: "auto" }} value={onlyRole} onChange={(e) => setOnlyRole(e.target.value)} aria-label="Filtrar por função">
            <option value="">Todos</option>
            <option value="operator">Operadores</option>
            <option value="lider">Líderes</option>
            <option value="admin">Admins</option>
          </select>
          <button className="btn-small" onClick={() => window.print()} disabled={loading}>Imprimir</button>
        </div>
      </div>

      {loading && <p className="no-print" style={{ color: "var(--text-muted)" }}>Gerando QR codes...</p>}

      <div className="badge-sheet">
        {list.map((o) => (
          <div key={o.code} className="badge-card">
            <div className="badge-brand">Aponta CD</div>
            {qrs[o.code] && <img src={qrs[o.code]} alt={`QR do operador ${o.name}`} width={130} height={130} />}
            <div className="badge-name">{o.name}</div>
            <div className="badge-code">{o.code}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

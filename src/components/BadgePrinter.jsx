import React, { useEffect, useMemo, useState } from "react";
import { badgePayload } from "../lib/badge";
import { IconDownload, IconPlus, IconUsers } from "./Icons";

// Gera crachás com QR code para imprimir ou exportar em PDF.
// Funcionários comuns visualizam apenas o próprio crachá; Admin visualiza todos e cadastra novos.
export default function BadgePrinter({
  operators = [],
  currentOperator = null,
  isAdmin = false,
  onManageOperators,
}) {
  const [qrs, setQrs] = useState({});
  const [loading, setLoading] = useState(true);
  const [onlyRole, setOnlyRole] = useState("");
  const [search, setSearch] = useState("");

  const visibleOperators = useMemo(() => {
    if (!isAdmin) {
      if (!currentOperator) return [];
      const match = operators.find((o) => String(o.code) === String(currentOperator.code));
      return [match || currentOperator];
    }
    const q = search.trim().toLowerCase();
    return operators.filter((o) => {
      if (onlyRole && (o.role || "operator") !== onlyRole) return false;
      if (q && !`${o.name || ""} ${o.code || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [operators, currentOperator, isAdmin, onlyRole, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const QR = await import("qrcode");
      const next = {};
      for (const o of visibleOperators) {
        if (!o?.code) continue;
        next[o.code] = await QR.toDataURL(badgePayload(o.code), {
          margin: 1,
          width: 260,
          errorCorrectionLevel: "M",
        });
      }
      if (!cancelled) {
        setQrs(next);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visibleOperators]);

  return (
    <div>
      <div className="page-header-row no-print" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">{isAdmin ? "Crachás da Equipe" : "Meu Crachá"}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {isAdmin
              ? "Gerencie, imprima ou exporte em PDF os crachás dos operadores."
              : "Visualize seu crachá individual e utilize as opções abaixo para imprimir ou salvar como PDF."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isAdmin && (
            <>
              <input
                type="search"
                className="field"
                style={{ width: 190 }}
                placeholder="Buscar nome ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="field"
                style={{ width: "auto" }}
                value={onlyRole}
                onChange={(e) => setOnlyRole(e.target.value)}
                aria-label="Filtrar por função"
              >
                <option value="">Todas as funções</option>
                <option value="operator">Operadores</option>
                <option value="lider">Líderes / Gestores</option>
                <option value="admin">Admins</option>
              </select>
              {onManageOperators && (
                <button type="button" className="btn-small btn-excel" onClick={onManageOperators}>
                  <IconPlus size={14} /> Cadastrar / Novo crachá
                </button>
              )}
            </>
          )}
          <button type="button" className="btn-small" onClick={() => window.print()} disabled={loading}>
            Imprimir
          </button>
          <button
            type="button"
            className="btn-small btn-excel"
            onClick={() => window.print()}
            disabled={loading}
            title="Na janela de impressão, escolha 'Salvar como PDF'"
          >
            <IconDownload size={14} /> Exportar para PDF
          </button>
        </div>
      </div>

      {loading && <p className="no-print" style={{ color: "var(--text-muted)" }}>Gerando QR code...</p>}

      {!loading && visibleOperators.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
          <IconUsers size={28} />
          <div style={{ marginTop: 8 }}>Nenhum crachá encontrado.</div>
        </div>
      ) : (
        <div className="badge-sheet">
          {visibleOperators.map((o) => (
            <div key={o.code} className="badge-card">
              <div className="badge-brand">Aponta CD</div>
              {qrs[o.code] && <img src={qrs[o.code]} alt={`QR do operador ${o.name}`} width={140} height={140} />}
              <div className="badge-name">{o.name}</div>
              <div className="badge-code">{o.code}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

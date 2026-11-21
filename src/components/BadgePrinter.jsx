import React, { useEffect, useMemo, useState } from "react";
import { badgePayload } from "../lib/badge";
import { updateOperator, renameOperatorCode } from "../lib/api";
import { getOperatorProfileCustom, getProfileTheme } from "../lib/operatorProfileCustom";
import { IconDownload, IconPlus, IconUsers, IconEdit, IconX, IconCheck } from "./Icons";

// Gera crachás com QR code para imprimir ou exportar em PDF.
// Funcionários comuns visualizam apenas o próprio crachá; Admin visualiza todos, edita e cadastra novos.
export default function BadgePrinter({
  operators = [],
  currentOperator = null,
  isAdmin = false,
  onManageOperators,
  onRefreshOperators,
  onBack,
}) {
  const [qrs, setQrs] = useState({});
  const [loading, setLoading] = useState(true);
  const [onlyRole, setOnlyRole] = useState("");
  const [search, setSearch] = useState("");

  // Edição de crachá pelo Admin
  const [editingOp, setEditingOp] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

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

  function openEditBadge(op) {
    if (!isAdmin) return;
    setEditingOp(op);
    setEditForm({
      name: op.name || "",
      code: String(op.code || ""),
      role: op.role || "",
    });
    setEditError("");
  }

  async function saveEditBadge(e) {
    e.preventDefault();
    if (!editingOp || saving) return;
    const cleanName = editForm.name.trim();
    const cleanCode = editForm.code.trim();
    const cleanRole = editForm.role.trim() || "-";
    if (!cleanName) return setEditError("O nome do funcionário é obrigatório.");
    if (!/^\d{1,4}$/.test(cleanCode)) return setEditError("O código deve conter apenas números (até 4 dígitos).");
    if (cleanCode !== String(editingOp.code) && operators.some((o) => String(o.code) === cleanCode)) {
      return setEditError(`Já existe um operador com o código ${cleanCode}.`);
    }

    setSaving(true);
    setEditError("");
    const fields = { name: cleanName, role: cleanRole };
    const res =
      cleanCode !== String(editingOp.code)
        ? await renameOperatorCode(editingOp.code, cleanCode, fields)
        : await updateOperator(editingOp.code, fields);
    setSaving(false);

    if (res?.error) {
      setEditError(res.error.message || "Erro ao atualizar crachá.");
      return;
    }

    setEditingOp(null);
    setEditSuccess(`Crachá de ${cleanName} (#${cleanCode}) atualizado!`);
    setTimeout(() => setEditSuccess(""), 3000);
    await onRefreshOperators?.();
  }

  return (
    <div>
      <div className="page-header-row no-print" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">{isAdmin ? "Crachás da Equipe" : "Meu Crachá"}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {isAdmin
              ? "Gerencie, edite, imprima ou exporte em PDF os crachás dos operadores."
              : "Visualize seu crachá individual e utilize as opções abaixo para imprimir ou salvar como PDF."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onBack && (
            <button type="button" className="btn-small" onClick={onBack}>
              ← Voltar
            </button>
          )}
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

      {editSuccess && (
        <div
          className="alert-card no-print"
          style={{
            marginBottom: 16,
            background: "var(--ok-soft)",
            borderColor: "var(--ok)",
            color: "var(--ok)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconCheck size={15} /> {editSuccess}
        </div>
      )}

      {loading && <p className="no-print" style={{ color: "var(--text-muted)" }}>Gerando QR code...</p>}

      {!loading && visibleOperators.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
          <IconUsers size={28} />
          <div style={{ marginTop: 8 }}>Nenhum crachá encontrado.</div>
        </div>
      ) : (
        <div className="badge-sheet">
          {visibleOperators.map((o) => {
            const custom = getOperatorProfileCustom(o.code);
            const theme = getProfileTheme(custom.themeId);
            return (
              <div key={o.code} className="badge-card" style={{ position: "relative" }}>
                <div className="badge-brand" style={{ color: theme.accent }}>Aponta CD</div>
                {custom.avatarDataUrl && (
                  <img
                    src={custom.avatarDataUrl}
                    alt={o.name}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: `2px solid ${theme.accent}`,
                      imageRendering: "auto",
                    }}
                  />
                )}
                {qrs[o.code] && <img src={qrs[o.code]} alt={`QR do operador ${o.name}`} width={140} height={140} />}
                <div className="badge-name">{o.name}</div>
                {o.role && o.role !== "-" && (
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{o.role}</div>
                )}
                <div className="badge-code">{o.code}</div>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-small no-print"
                    style={{ marginTop: 6, padding: "4px 10px", fontSize: 11.5 }}
                    onClick={() => openEditBadge(o)}
                  >
                    <IconEdit size={12} /> Editar crachá
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && editingOp && (
        <div className="kiosk-modal-backdrop no-print" onClick={() => !saving && setEditingOp(null)}>
          <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">Editar crachá</div>
                <div className="kiosk-modal-sub">Atualize nome, função ou código do operador</div>
              </div>
              <button
                type="button"
                className="kiosk-modal-close"
                onClick={() => !saving && setEditingOp(null)}
                aria-label="Fechar"
              >
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={saveEditBadge}>
              <div className="kiosk-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="schedule-modal-label">Nome no crachá *</label>
                  <input
                    className="schedule-modal-field"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    disabled={saving}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="schedule-modal-label">Código do crachá *</label>
                  <input
                    className="schedule-modal-field"
                    style={{ fontFamily: "var(--font-mono)" }}
                    value={editForm.code}
                    onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="schedule-modal-label">Função / Cargo</label>
                  <input
                    className="schedule-modal-field"
                    placeholder="Ex.: Separação, Conferência, Líder"
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    disabled={saving}
                  />
                </div>
                {editError && <div className="login-error" style={{ margin: 0 }}>{editError}</div>}
              </div>
              <div className="kiosk-modal-footer">
                <button type="button" className="kiosk-btn kiosk-btn-secondary" onClick={() => setEditingOp(null)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="kiosk-btn kiosk-btn-primary" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar crachá"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

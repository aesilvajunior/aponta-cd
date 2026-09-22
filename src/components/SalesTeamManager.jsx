import React, { useEffect, useState } from "react";
import {
  fetchSalesLeaders,
  fetchSalesMembers,
  addSalesLeader,
  updateSalesLeader,
  deleteSalesLeader,
  addSalesMember,
  updateSalesMember,
  deleteSalesMember,
  promoteMemberToLeader,
  demoteLeaderToMember,
  logAudit,
} from "../lib/api";
import { supabase } from "../supabaseClient";

// ============================================================
// Gerenciamento da equipe de vendas
// ============================================================

const DEFAULT_ROLES = ["Vendedor", "Auxiliar", "Coordenador", "Supervisor"];

export default function SalesTeamManager() {
  const [leaders, setLeaders] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ----- Cadastro de líder -----
  const [newLeaderName, setNewLeaderName] = useState("");
  const [newLeaderTeam, setNewLeaderTeam] = useState("");

  // ----- Cadastro de vendedor -----
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Vendedor");
  const [newMemberLeader, setNewMemberLeader] = useState("");

  // ----- Edições -----
  const [editingLeader, setEditingLeader] = useState(null);
  const [editLeaderValues, setEditLeaderValues] = useState({ name: "", team_name: "" });

  const [editingMember, setEditingMember] = useState(null);
  const [editMemberValues, setEditMemberValues] = useState({ name: "", role: "", leader_code: "" });

  // ----- Promover -----
  const [promotingMember, setPromotingMember] = useState(null);
  const [promoteCode, setPromoteCode] = useState("");
  const [promoteTeam, setPromoteTeam] = useState("");

  // ============================================================
  // Carregar
  // ============================================================
  async function load() {
    setLoading(true);
    const [{ data: l, error: err1 }, { data: m, error: err2 }] = await Promise.all([
      fetchSalesLeaders(),
      fetchSalesMembers(),
    ]);
    if (err1 || err2) {
      setError((err1 || err2).message);
      setLoading(false);
      return;
    }
    setLeaders(l || []);
    setMembers(m || []);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("sales-team-manager-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_leaders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_members" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // ============================================================
  // Helpers
  // ============================================================
  function nextLeaderCode() {
    const nums = leaders
      .map((l) => parseInt(l.code.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `L${String(max + 1).padStart(3, "0")}`;
  }

  function nextMemberCode() {
    const nums = members
      .map((m) => parseInt(m.code, 10))
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 5000;
    return String(max + 1);
  }

  async function audit({ action, entity, entityId, details, beforeData, afterData }) {
    try {
      await logAudit({
        actorCode: "admin",
        actorName: "Admin",
        action,
        entity,
        entityId,
        details,
        beforeData,
        afterData,
      });
    } catch {}
  }

  async function runAction(action, onSuccess) {
    setError("");
    setBusy(true);
    try {
      const { error } = await action();
      if (error) {
        setError(error.message || "Erro ao salvar.");
        return false;
      }
      await load();
      onSuccess?.();
      return true;
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // Líderes
  // ============================================================
  async function addLeader() {
    const name = newLeaderName.trim();
    const team = newLeaderTeam.trim();
    if (!name) return setError("Digite o nome do líder.");
    if (!team) return setError("Digite o nome da equipe (ex: SDR, Engenharia, AP).");
    const code = nextLeaderCode();
    await runAction(async () => {
      const res = await addSalesLeader({ code, name, teamName: team });
      if (!res.error) {
        await audit({
          action: "criar",
          entity: "sales_leader",
          entityId: code,
          details: `Líder "${name}" criado (equipe ${team})`,
          afterData: { nome: name, equipe: team, código: code },
        });
      }
      return res;
    }, () => { setNewLeaderName(""); setNewLeaderTeam(""); });
  }

  function startEditLeader(l) {
    setEditingLeader(l.code);
    setEditLeaderValues({ name: l.name, team_name: l.team_name });
  }

  function cancelEditLeader() { setEditingLeader(null); }

  async function saveEditLeader(originalCode) {
    const name = editLeaderValues.name.trim();
    const team = editLeaderValues.team_name.trim();
    if (!name) return setError("O nome não pode ficar em branco.");
    if (!team) return setError("O nome da equipe não pode ficar em branco.");
    const original = leaders.find((l) => l.code === originalCode);
    await runAction(async () => {
      const res = await updateSalesLeader(originalCode, { name, team_name: team });
      if (!res.error && original) {
        await audit({
          action: "editar",
          entity: "sales_leader",
          entityId: originalCode,
          details: `Líder "${name}" editado`,
          beforeData: { nome: original.name, equipe: original.team_name },
          afterData: { nome: name, equipe: team },
        });
      }
      return res;
    }, () => setEditingLeader(null));
  }

  async function removeLeader(code) {
    const l = leaders.find((x) => x.code === code);
    if (!l) return;
    const count = members.filter((m) => m.leader_code === code).length;
    const msg = count > 0
      ? `Remover o líder "${l.name}"?\n\n${count} vendedor(es) vão ficar SEM líder.`
      : `Remover o líder "${l.name}"?`;
    if (!window.confirm(msg)) return;
    await runAction(async () => {
      const res = await deleteSalesLeader(code);
      if (!res.error) {
        await audit({
          action: "remover",
          entity: "sales_leader",
          entityId: code,
          details: `Líder "${l.name}" removido`,
          beforeData: { nome: l.name, equipe: l.team_name },
        });
      }
      return res;
    });
  }

  // ============================================================
  // Vendedores
  // ============================================================
  async function addMember() {
    const name = newMemberName.trim();
    const role = newMemberRole.trim() || "Vendedor";
    if (!name) return setError("Digite o nome do vendedor.");
    const code = nextMemberCode();
    await runAction(async () => {
      const res = await addSalesMember({ code, name, role, leaderCode: newMemberLeader || null });
      if (!res.error) {
        const leaderName = leaders.find((l) => l.code === newMemberLeader)?.name || "(sem líder)";
        await audit({
          action: "criar",
          entity: "sales_member",
          entityId: code,
          details: `Vendedor "${name}" criado`,
          afterData: { nome: name, função: role, líder: leaderName, código: code },
        });
      }
      return res;
    }, () => { setNewMemberName(""); setNewMemberRole("Vendedor"); setNewMemberLeader(""); });
  }

  function startEditMember(m) {
    setEditingMember(m.code);
    setEditMemberValues({ name: m.name, role: m.role || "", leader_code: m.leader_code || "" });
  }

  function cancelEditMember() { setEditingMember(null); }

  async function saveEditMember(originalCode) {
    const name = editMemberValues.name.trim();
    const role = editMemberValues.role.trim() || "Vendedor";
    if (!name) return setError("O nome não pode ficar em branco.");
    const original = members.find((m) => m.code === originalCode);
    await runAction(async () => {
      const res = await updateSalesMember(originalCode, {
        name,
        role,
        leader_code: editMemberValues.leader_code || null,
      });
      if (!res.error && original) {
        await audit({
          action: "editar",
          entity: "sales_member",
          entityId: originalCode,
          details: `Vendedor "${name}" editado`,
          beforeData: { nome: original.name, função: original.role, líder: original.leader_code },
          afterData: { nome: name, função: role, líder: editMemberValues.leader_code || null },
        });
      }
      return res;
    }, () => setEditingMember(null));
  }

  async function removeMember(code) {
    const m = members.find((x) => x.code === code);
    if (!m) return;
    if (!window.confirm(`Remover "${m.name}"?`)) return;
    await runAction(async () => {
      const res = await deleteSalesMember(code);
      if (!res.error) {
        await audit({
          action: "remover",
          entity: "sales_member",
          entityId: code,
          details: `Vendedor "${m.name}" removido`,
          beforeData: { nome: m.name, função: m.role },
        });
      }
      return res;
    });
  }

  // ============================================================
  // Promover vendedor a líder
  // ============================================================
  function openPromote(m) {
    setPromotingMember(m);
    setPromoteCode(nextLeaderCode());
    setPromoteTeam("");
  }

  async function confirmPromote() {
    if (!promotingMember) return;
    const code = promoteCode.trim();
    const team = promoteTeam.trim();
    if (!code) return setError("Digite o código do novo líder.");
    if (!team) return setError("Digite o nome da equipe (ex: SDR, Engenharia, AP).");
    if (leaders.some((l) => l.code === code)) {
      return setError(`Já existe um líder com o código ${code}.`);
    }
    await runAction(async () => {
      const res = await promoteMemberToLeader(promotingMember.code, { leaderCode: code, teamName: team });
      if (!res.error) {
        await audit({
          action: "editar",
          entity: "sales_member",
          entityId: promotingMember.code,
          details: `"${promotingMember.name}" promovido a líder da equipe ${team}`,
          beforeData: { tipo: "Vendedor" },
          afterData: { tipo: "Líder", código_líder: code, equipe: team },
        });
      }
      return res;
    }, () => setPromotingMember(null));
  }

  // ============================================================
  // Rebaixar líder
  // ============================================================
  async function demoteLeader(leader) {
    const count = members.filter((m) => m.leader_code === leader.code).length;
    const msg = count > 0
      ? `Rebaixar "${leader.name}" de líder?\n\n${count} vendedor(es) vão ficar SEM líder.`
      : `Rebaixar "${leader.name}" de líder?`;
    if (!window.confirm(msg)) return;
    await runAction(async () => {
      const res = await demoteLeaderToMember(leader.code);
      if (!res.error) {
        await audit({
          action: "editar",
          entity: "sales_leader",
          entityId: leader.code,
          details: `"${leader.name}" rebaixado de líder`,
          beforeData: { tipo: "Líder", equipe: leader.team_name },
          afterData: { tipo: "Removido" },
        });
      }
      return res;
    });
  }

  // ============================================================
  // Render
  // ============================================================
  if (loading) {
    return <div className="schedule-empty">Carregando…</div>;
  }

  return (
    <div>
      <h1 className="page-title">Equipe de vendas</h1>
      <p className="page-sub">
        Cadastre líderes e vendedores, vincule cada vendedor ao seu líder, e promova/rebaixe líderes quando necessário.
      </p>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      {/* ============ LÍDERES ============ */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">👑 Líderes</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            className="field"
            style={{ flex: 1, minWidth: 140 }}
            placeholder="Nome do líder"
            value={newLeaderName}
            onChange={(e) => setNewLeaderName(e.target.value)}
            disabled={busy}
          />
          <input
            className="field"
            style={{ width: 160 }}
            placeholder="Equipe (ex: SDR)"
            value={newLeaderTeam}
            onChange={(e) => setNewLeaderTeam(e.target.value)}
            disabled={busy}
          />
          <button className="btn-small" onClick={addLeader} disabled={busy}>
            + Adicionar líder
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Equipe</th>
              <th>Vendedores</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((l) => {
              const isEditing = editingLeader === l.code;
              const count = members.filter((m) => m.leader_code === l.code).length;
              return (
                <tr key={l.code}>
                  {isEditing ? (
                    <>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{l.code}</td>
                      <td>
                        <input
                          className="field"
                          style={{ width: "100%", padding: "4px 6px" }}
                          value={editLeaderValues.name}
                          onChange={(e) => setEditLeaderValues((v) => ({ ...v, name: e.target.value }))}
                          disabled={busy}
                        />
                      </td>
                      <td>
                        <input
                          className="field"
                          style={{ width: "100%", padding: "4px 6px" }}
                          value={editLeaderValues.team_name}
                          onChange={(e) => setEditLeaderValues((v) => ({ ...v, team_name: e.target.value }))}
                          disabled={busy}
                        />
                      </td>
                      <td>{count}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEditLeader(l.code)} disabled={busy}>
                          Salvar
                        </button>
                        <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEditLeader} disabled={busy}>
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{l.code}</td>
                      <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                        👑 {l.name}
                      </td>
                      <td>
                        <span className="badge">{l.team_name}</span>
                      </td>
                      <td>{count}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEditLeader(l)} disabled={busy}>
                          Editar
                        </button>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => demoteLeader(l)} disabled={busy} title="Rebaixar líder (remove da lista de líderes)">
                          Rebaixar
                        </button>
                        <button className="btn-small" style={{ padding: "4px 8px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => removeLeader(l.code)} disabled={busy}>
                          Remover
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {leaders.length === 0 && (
              <tr><td colSpan={5}>Nenhum líder cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============ VENDEDORES ============ */}
      <div className="card">
        <div className="card-title">👥 Vendedores e auxiliares</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            className="field"
            style={{ flex: 1, minWidth: 140 }}
            placeholder="Nome"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            disabled={busy}
          />
          <select
            className="field"
            style={{ width: 140 }}
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value)}
            disabled={busy}
          >
            {DEFAULT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            className="field"
            style={{ width: 220 }}
            value={newMemberLeader}
            onChange={(e) => setNewMemberLeader(e.target.value)}
            disabled={busy}
          >
            <option value="">— Sem líder —</option>
            {leaders.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.team_name})
              </option>
            ))}
          </select>
          <button className="btn-small" onClick={addMember} disabled={busy}>
            + Adicionar
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Função</th>
              <th>Líder</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isEditing = editingMember === m.code;
              const leader = leaders.find((l) => l.code === m.leader_code);
              return (
                <tr key={m.code}>
                  {isEditing ? (
                    <>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{m.code}</td>
                      <td>
                        <input
                          className="field"
                          style={{ width: "100%", padding: "4px 6px" }}
                          value={editMemberValues.name}
                          onChange={(e) => setEditMemberValues((v) => ({ ...v, name: e.target.value }))}
                          disabled={busy}
                        />
                      </td>
                      <td>
                        <input
                          className="field"
                          style={{ width: "100%", padding: "4px 6px" }}
                          value={editMemberValues.role}
                          onChange={(e) => setEditMemberValues((v) => ({ ...v, role: e.target.value }))}
                          disabled={busy}
                        />
                      </td>
                      <td>
                        <select
                          className="field"
                          style={{ width: "100%", padding: "4px 6px" }}
                          value={editMemberValues.leader_code}
                          onChange={(e) => setEditMemberValues((v) => ({ ...v, leader_code: e.target.value }))}
                          disabled={busy}
                        >
                          <option value="">— Sem líder —</option>
                          {leaders.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.name} ({l.team_name})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => saveEditMember(m.code)} disabled={busy}>
                          Salvar
                        </button>
                        <button className="btn-small" style={{ padding: "4px 8px" }} onClick={cancelEditMember} disabled={busy}>
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{m.code}</td>
                      <td style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{m.name}</td>
                      <td>{m.role}</td>
                      <td>
                        {leader ? (
                          <span>👑 {leader.name} <span style={{ color: "var(--text-faint)" }}>({leader.team_name})</span></span>
                        ) : (
                          <span style={{ color: "var(--warning)" }}>⚠ Sem líder</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => startEditMember(m)} disabled={busy}>
                          Editar
                        </button>
                        <button className="btn-small" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => openPromote(m)} disabled={busy} title="Promover a líder">
                          👑 Promover
                        </button>
                        <button className="btn-small" style={{ padding: "4px 8px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => removeMember(m.code)} disabled={busy}>
                          Remover
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={5}>Nenhum vendedor cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============ MODAL: PROMOVER ============ */}
      {promotingMember && (
        <div className="kiosk-modal-backdrop" onClick={() => setPromotingMember(null)}>
          <div className="kiosk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="kiosk-modal-header">
              <div>
                <div className="kiosk-modal-title">👑 Promover a líder</div>
                <div className="kiosk-modal-sub">{promotingMember.name} · #{promotingMember.code}</div>
              </div>
              <button className="kiosk-modal-close" onClick={() => setPromotingMember(null)}>✕</button>
            </div>

            <div className="kiosk-modal-body">
              <div style={{ marginBottom: 14 }}>
                <label className="schedule-modal-label">Código do novo líder</label>
                <input
                  className="schedule-modal-field"
                  value={promoteCode}
                  onChange={(e) => setPromoteCode(e.target.value.toUpperCase())}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="schedule-modal-label">Nome da equipe</label>
                <input
                  className="schedule-modal-field"
                  placeholder="Ex: SDR, Engenharia, AP, ZN"
                  value={promoteTeam}
                  onChange={(e) => setPromoteTeam(e.target.value)}
                  disabled={busy}
                />
              </div>
              {error && (
                <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 12, marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </div>

            <div className="kiosk-modal-footer">
              <button className="kiosk-btn kiosk-btn-secondary" onClick={() => setPromotingMember(null)} disabled={busy}>
                Cancelar
              </button>
              <button className="kiosk-btn kiosk-btn-primary" onClick={confirmPromote} disabled={busy}>
                {busy ? "Promovendo..." : "Promover a líder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
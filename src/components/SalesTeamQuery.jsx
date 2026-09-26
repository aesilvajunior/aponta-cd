import React, { useEffect, useMemo, useState } from "react";
import { fetchSalesLeaders, fetchSalesMembers } from "../lib/api";
import { supabase } from "../supabaseClient";
import {
  IconSearch,
  IconCrown,
  IconUsers,
  IconAlertTriangle,
  IconX,
} from "./Icons";

export default function SalesTeamQuery() {
  const [leaders, setLeaders] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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
      .channel("sales-team-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_leaders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_members" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return null;

    const foundLeaders = leaders.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.team_name.toLowerCase().includes(q)
    );

    const foundMembers = members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.role || "").toLowerCase().includes(q)
    );

    return { leaders: foundLeaders, members: foundMembers };
  }, [q, leaders, members]);

  function leaderByCode(code) {
    return leaders.find((l) => l.code === code) || null;
  }

  function membersOfLeader(leaderCode) {
    return members.filter((m) => m.leader_code === leaderCode);
  }

  const leadersByTeam = useMemo(() => {
    const map = {};
    leaders.forEach((l) => {
      if (!map[l.team_name]) map[l.team_name] = [];
      map[l.team_name].push(l);
    });
    return map;
  }, [leaders]);

  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Líder da equipe</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Busque por nome, código ou nome da equipe para ver o vínculo entre líder e vendedores.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro ao carregar: <code>{error}</code>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", display: "flex" }}>
            <IconSearch size={18} />
          </span>
          <input
            className="field"
            style={{
              width: "100%",
              fontSize: 16,
              padding: "16px 18px 16px 48px",
              fontFamily: "var(--font-display)",
            }}
            placeholder="Digite o nome, código ou equipe..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text-faint)",
                cursor: "pointer",
                padding: 8,
                borderRadius: 6,
                display: "flex",
              }}
              title="Limpar"
            >
              <IconX size={16} />
            </button>
          )}
        </div>
      </div>

      {!query && (
        <>
          {loading ? (
            <div className="schedule-empty">Carregando...</div>
          ) : (
            <>
              <div className="stat-strip" style={{ marginBottom: 20 }}>
                <div className="stat-cell">
                  <div className="stat-num accent">{leaders.length}</div>
                  <div className="stat-label">Líderes</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num">{members.length}</div>
                  <div className="stat-label">Vendedores / Auxiliares</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num">{Object.keys(leadersByTeam).length}</div>
                  <div className="stat-label">Equipes</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num danger">
                    {members.filter((m) => !m.leader_code).length}
                  </div>
                  <div className="stat-label">Sem líder</div>
                </div>
              </div>

              {leaders.map((leader) => {
                const team = membersOfLeader(leader.code);
                return (
                  <div key={leader.code} className="card" style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 12,
                        marginBottom: team.length > 0 ? 16 : 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            background: "var(--accent)",
                            color: "var(--accent-ink)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconCrown size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em" }}>
                            {leader.name}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                            Líder · Equipe <strong style={{ color: "var(--accent)" }}>{leader.team_name}</strong> · #{leader.code}
                          </div>
                        </div>
                      </div>
                      <div className="badge">
                        {team.length} {team.length === 1 ? "pessoa" : "pessoas"}
                      </div>
                    </div>

                    {team.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0 }}>
                        Nenhum vendedor vinculado ainda.
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                          gap: 10,
                        }}
                      >
                        {team.map((m) => (
                          <div
                            key={m.code}
                            style={{
                              background: "var(--surface-raised)",
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              padding: "12px 14px",
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "var(--accent-soft)",
                                color: "var(--accent)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 13,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {m.name}
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                                {m.role} · #{m.code}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {members.filter((m) => !m.leader_code).length > 0 && (
                <div className="card" style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "var(--warning-soft)",
                        color: "var(--warning)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconAlertTriangle size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>Sem líder</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                        Esses vendedores ainda não têm líder vinculado
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {members
                      .filter((m) => !m.leader_code)
                      .map((m) => (
                        <div
                          key={m.code}
                          style={{
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: "12px 14px",
                          }}
                        >
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            {m.role} · #{m.code}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {query && results && (
        <>
          {results.leaders.length === 0 && results.members.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ color: "var(--text-faint)", marginBottom: 14, display: "flex", justifyContent: "center" }}>
                <IconSearch size={40} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                Nada encontrado para "{query}"
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Tente buscar por nome, código ou nome da equipe.
              </div>
            </div>
          ) : (
            <>
              {results.leaders.map((leader) => {
                const team = membersOfLeader(leader.code);
                return (
                  <div key={leader.code} className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          color: "var(--accent-ink)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconCrown size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{leader.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                          Líder da equipe <strong style={{ color: "var(--accent)" }}>{leader.team_name}</strong> · #{leader.code}
                        </div>
                      </div>
                    </div>
                    {team.length > 0 ? (
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
                        <strong style={{ color: "var(--text)" }}>{team.length}</strong> {team.length === 1 ? "vendedor" : "vendedores"} na equipe:
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--text-faint)" }}>
                        Nenhum vendedor vinculado ainda.
                      </div>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {team.map((m) => (
                        <div
                          key={m.code}
                          style={{
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: "12px 14px",
                          }}
                        >
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            {m.role} · #{m.code}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {results.members.map((m) => {
                const leader = m.leader_code ? leaderByCode(m.leader_code) : null;
                return (
                  <div key={m.code} className="card" style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "var(--surface-raised)",
                          color: "var(--text)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          fontWeight: 700,
                          flexShrink: 0,
                          border: "1px solid var(--border-strong)",
                        }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
                          {m.role} · #{m.code}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {leader ? (
                          <>
                            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Líder
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", marginTop: 3, display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <IconCrown size={14} /> {leader.name}
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                              Equipe {leader.team_name}
                            </div>
                          </>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--warning)",
                              fontWeight: 600,
                              background: "var(--warning-soft)",
                              padding: "5px 12px",
                              borderRadius: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <IconAlertTriangle size={12} /> Sem líder
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
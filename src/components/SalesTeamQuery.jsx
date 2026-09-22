import React, { useEffect, useMemo, useState } from "react";
import { fetchSalesLeaders, fetchSalesMembers } from "../lib/api";
import { supabase } from "../supabaseClient";

// ============================================================
// Consulta de líder da equipe de vendas
// Busca por nome ou código — mostra o vínculo entre vendedor e líder
// ============================================================

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

  // ============================================================
  // Busca
  // ============================================================
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

  // ============================================================
  // Helpers
  // ============================================================
  function leaderByCode(code) {
    return leaders.find((l) => l.code === code) || null;
  }

  function membersOfLeader(leaderCode) {
    return members.filter((m) => m.leader_code === leaderCode);
  }

  // Agrupa todos os líderes por equipe (quando ninguém buscou nada)
  const leadersByTeam = useMemo(() => {
    const map = {};
    leaders.forEach((l) => {
      if (!map[l.team_name]) map[l.team_name] = [];
      map[l.team_name].push(l);
    });
    return map;
  }, [leaders]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div>
      <div className="page-header-row" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Consulta — Líder da equipe</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Busque por nome, código ou nome da equipe pra ver o vínculo entre líder e vendedores.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-card alert-danger" style={{ marginBottom: 20 }}>
          Erro ao carregar: <code>{error}</code>
        </div>
      )}

      {/* Campo de busca */}
      <div className="card" style={{ marginBottom: 20 }}>
        <input
          className="field"
          style={{
            width: "100%",
            fontSize: 16,
            padding: "14px 16px",
            fontFamily: "var(--font-display)",
          }}
          placeholder="🔍 Digite o nome, código ou equipe..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0 0" }}>
            Buscando por: <strong>{query}</strong> · Limpar
            <button
              className="btn-small"
              style={{ marginLeft: 10, padding: "2px 10px", fontSize: 11 }}
              onClick={() => setQuery("")}
            >
              ✕
            </button>
          </p>
        )}
      </div>

      {/* Sem busca: mostra a estrutura completa */}
      {!query && (
        <>
          {loading ? (
            <div className="schedule-empty">Carregando…</div>
          ) : (
            <>
              {/* Resumo */}
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

              {/* Lista de líderes com suas equipes */}
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
                        marginBottom: team.length > 0 ? 14 : 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: "50%",
                            background: "var(--accent)",
                            color: "var(--accent-ink)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          👑
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
                            {leader.name}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
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
                          gap: 8,
                        }}
                      >
                        {team.map((m) => (
                          <div
                            key={m.code}
                            style={{
                              background: "var(--surface-raised)",
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              padding: "10px 14px",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
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

              {/* Vendedores sem líder */}
              {members.filter((m) => !m.leader_code).length > 0 && (
                <div className="card" style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        background: "var(--warning-soft)",
                        color: "var(--warning)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      ⚠
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>Sem líder</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                        Esses vendedores ainda não têm líder vinculado
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 8,
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
                            padding: "10px 14px",
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

      {/* Com busca: mostra só os resultados */}
      {query && results && (
        <>
          {results.leaders.length === 0 && results.members.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                Nada encontrado para "{query}"
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Tente buscar por nome, código ou nome da equipe.
              </div>
            </div>
          ) : (
            <>
              {/* Líderes encontrados */}
              {results.leaders.map((leader) => {
                const team = membersOfLeader(leader.code);
                return (
                  <div key={leader.code} className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          color: "var(--accent-ink)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        👑
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{leader.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                          Líder da equipe <strong style={{ color: "var(--accent)" }}>{leader.team_name}</strong> · #{leader.code}
                        </div>
                      </div>
                    </div>
                    {team.length > 0 ? (
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
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
                        gap: 8,
                      }}
                    >
                      {team.map((m) => (
                        <div
                          key={m.code}
                          style={{
                            background: "var(--surface-raised)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: "10px 14px",
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

              {/* Vendedores encontrados */}
              {results.members.map((m) => {
                const leader = m.leader_code ? leaderByCode(m.leader_code) : null;
                return (
                  <div key={m.code} className="card" style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
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
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                          {m.role} · #{m.code}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {leader ? (
                          <>
                            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Líder
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>
                              👑 {leader.name}
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
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
                              padding: "4px 10px",
                              borderRadius: 6,
                            }}
                          >
                            ⚠ Sem líder
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
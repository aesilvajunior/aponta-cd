import React, { useCallback, useEffect, useState } from "react";
import { fetchPhysicalChecklist, upsertPhysicalChecklist } from "../lib/api";

const AREAS = [
  "Ruas", "Térreo", "Primeiro andar", "Mezanino",
  "Contêineres", "Estoque de caixa d'água / cisterna / tanques",
  "Demais áreas do CD",
];

const todayISO = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function PhysicalChecklist({ currentOperator }) {
  const date = todayISO();
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await fetchPhysicalChecklist(date);
    const map = {};
    AREAS.forEach((a) => {
      const found = (data ?? []).find((r) => r.area === a);
      map[a] = found || {
        check_date: date, area: a,
        organization_ok: true, identification_ok: true, other_ok: true, notes: "",
      };
    });
    setRows(map);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function save(area) {
    setSaving(true);
    const row = rows[area];
    await upsertPhysicalChecklist({
      ...row,
      checked_by: currentOperator?.code,
      checked_name: currentOperator?.name,
    });
    setSaving(false);
  }

  function toggle(area, field) {
    setRows((r) => ({ ...r, [area]: { ...r[area], [field]: !r[area][field] } }));
  }

  return (
    <div className="pc-wrap">
      <p className="pc-hint">
        Marque ✅ quando estiver OK. Se desmarcar, registre uma inconsistência na aba ao lado.
      </p>
      {AREAS.map((area) => {
        const row = rows[area];
        if (!row) return null;
        return (
          <div key={area} className="pc-card">
            <h3>{area}</h3>
            <div className="pc-checks">
              <label><input type="checkbox" checked={row.organization_ok} onChange={() => toggle(area, "organization_ok")} /> Organização</label>
              <label><input type="checkbox" checked={row.identification_ok} onChange={() => toggle(area, "identification_ok")} /> Identificação</label>
              <label><input type="checkbox" checked={row.other_ok} onChange={() => toggle(area, "other_ok")} /> Outros OK</label>
            </div>
            <textarea
              placeholder="Observações (opcional)"
              value={row.notes ?? ""}
              onChange={(e) => setRows((r) => ({ ...r, [area]: { ...r[area], notes: e.target.value } }))}
              onBlur={() => save(area)}
              rows={2}
            />
          </div>
        );
      })}
      {saving && <small className="pc-saving">Salvando…</small>}
    </div>
  );
}
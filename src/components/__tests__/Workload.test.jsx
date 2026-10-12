import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import Workload from "../Workload";

const e = (code, name, start, end, dur, activity = "Separação") => ({
  operator_code: code, operator_name: name, activity, start_time: start, end_time: end, duration_seconds: dur,
});

describe("Workload", () => {
  it("renderiza vazio sem quebrar", () => {
    expect(renderToString(<Workload entries={[]} />)).toContain("Sem lançamentos no período");
  });

  it("mostra mapa de calor, previsão, ranking e ocupação", () => {
    const now = Date.now();
    const iso = (offsetMin) => new Date(now - offsetMin * 60000).toISOString();
    const entries = [];
    for (let i = 0; i < 6; i++) {
      entries.push(e("1", "Ana", iso(600 + i * 30), iso(595 + i * 30), 300));
      entries.push(e("2", "Bia", iso(610 + i * 30), iso(600 + i * 30), 600));
    }
    const html = renderToString(<Workload entries={entries} />);
    expect(html).toContain("Mapa de calor");
    expect(html).toContain("Previsão para os próximos 7 dias");
    expect(html).toContain("Ranking justo");
    expect(html).toContain("Ocupação");
    expect(html).toContain("Ana");
  });
});

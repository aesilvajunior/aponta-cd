import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";

let mobile = false;
vi.mock("../../hooks/useMediaQuery", () => ({
  useMediaQuery: () => mobile,
  MOBILE_QUERY: "(max-width: 720px)",
}));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ session: { user: { email: "ana@tropeiro.com" } }, signOut: () => {} }),
}));
vi.mock("../ThemeToggle", () => ({ default: () => null }));

import Sidebar from "../Sidebar";

const render = (props = {}) =>
  renderToString(<Sidebar id="app-sidebar" tab="kiosk" setTab={() => {}} isAdmin={false} onLock={() => {}} {...props} />);

beforeEach(() => {
  localStorage.clear();
  mobile = false;
});

describe("Sidebar: menu recolhido salvo no aparelho", () => {
  it("no desktop respeita a preferência e mostra só ícones", () => {
    localStorage.setItem("aponta_sidebar_collapsed", "1");
    const html = render();
    expect(html).toContain("sidebar-collapsed");
    expect(html).not.toContain("nav-item-label");
  });

  it("no celular a gaveta SEMPRE mostra os textos, mesmo com o menu salvo como recolhido (bug do print)", () => {
    localStorage.setItem("aponta_sidebar_collapsed", "1");
    mobile = true;
    const html = render();
    expect(html).not.toContain("sidebar-collapsed");
    expect(html).toContain("nav-item-label");
    expect(html).toContain("brand-wordmark");
    expect(html).not.toContain("sidebar-toggle"); // sem botão de recolher no celular
  });
});

describe("Sidebar: gaveta e acessibilidade", () => {
  it("marca a gaveta aberta", () => {
    expect(render({ mobileOpen: true })).toContain("sidebar-open");
    expect(render({ mobileOpen: false })).not.toContain("sidebar-open");
  });

  it("itens do menu funcionam com teclado e o ativo é anunciado", () => {
    const html = render({ tab: "kiosk" });
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Menu principal"');
    expect(html).toContain('id="app-sidebar"');
  });
});

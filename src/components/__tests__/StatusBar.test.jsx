import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";

vi.mock("../../lib/offlineSync", () => ({
  getQueueState: () => ({ pending: 2, failed: 0 }),
  subscribeQueue: () => () => {},
  retryFailed: () => 0,
  syncQueue: async () => ({ sent: 0, remaining: 2 }),
}));

import StatusBar from "../StatusBar";

describe("StatusBar", () => {
  it("mostra pendências offline", () => {
    const html = renderToString(<StatusBar realtimeStatus="online" updateReady={null} />).replace(/<!-- -->/g, "");
    expect(html).toContain("2 apontamento(s) aguardando envio");
  });

  it("mostra o botão de atualização quando há versão nova", () => {
    const html = renderToString(<StatusBar realtimeStatus="online" updateReady={() => {}} />);
    expect(html).toContain("Nova versão do Aponta CD disponível");
    expect(html).toContain("Atualizar agora");
  });

  it("avisa quando o realtime caiu", () => {
    const html = renderToString(<StatusBar realtimeStatus="offline" updateReady={null} />);
    expect(html).toContain("Sem conexão");
  });
});

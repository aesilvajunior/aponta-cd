import { test, expect } from "@playwright/test";
import { loginFake } from "./helpers";

test.describe("Menu lateral", () => {
  test("celular: abre como gaveta, mostra os textos mesmo com menu salvo como recolhido, fecha com Esc", async ({ page, isMobile }) => {
    test.skip(!isMobile, "só no projeto celular");
    // Reproduz o bug do print: preferência "recolhido" salva do desktop
    await loginFake(page, { localStorage: { aponta_sidebar_collapsed: "1" } });
    await page.goto("/");

    const botao = page.getByRole("button", { name: "Abrir menu" });
    await expect(botao).toBeVisible();

    const menu = page.locator("#app-sidebar");
    await expect(menu).toBeHidden(); // fechado: fora da tela e sem foco

    await botao.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Apontar atividade")).toBeVisible(); // texto presente (não só ícones)

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("desktop: sem botão hambúrguer e menu sempre visível", async ({ page, isMobile }) => {
    test.skip(isMobile, "só no projeto desktop");
    await loginFake(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
    await expect(page.locator("#app-sidebar")).toBeVisible();
  });
});

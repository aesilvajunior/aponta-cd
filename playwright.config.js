import { defineConfig, devices } from "@playwright/test";

// Testes de tela (navegador de verdade). Rodam no GitHub Actions; localmente:
//   npx playwright install chromium   (uma vez)
//   npm run test:e2e
// Usam o app compilado e um Supabase "de mentira" (rede interceptada em e2e/helpers.js).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: {
      VITE_SUPABASE_URL: "https://placeholder.supabase.co",
      VITE_SUPABASE_ANON_KEY: "placeholder-anon-key",
    },
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { viewport: { width: 1366, height: 768 } } },
  ],
});

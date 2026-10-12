import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Separa as bibliotecas pesadas em arquivos próprios. Assim o navegador
// guarda cada uma em cache e só baixa quando a tela que usa é aberta.
function manualChunks(id) {
  if (!id.includes("node_modules")) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
  if (id.includes("@supabase")) return "vendor-supabase";
  if (/node_modules\/(recharts|d3-|victory-vendor|recharts-scale)/.test(id)) return "vendor-recharts";
  if (/node_modules\/(konva|react-konva)\//.test(id)) return "vendor-konva";
  if (/node_modules\/(xlsx|papaparse)\//.test(id)) return "vendor-data-files";
  return undefined;
}

// Identificação da versão publicada (aparece em "Saúde do sistema")
const BUILD_INFO = {
  builtAt: new Date().toISOString(),
  commit: (process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "local").slice(0, 7),
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_INFO),
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
    setupFiles: ["./src/test/setup.js"],
  },
});

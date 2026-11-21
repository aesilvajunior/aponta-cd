import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { lazyWithRetry } from "./lib/lazyWithRetry.js";
import { installErrorReporting } from "./lib/errorReporter.js";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./styles/01-base.css";
import "./styles/02-layout.css";
import "./styles/03-components.css";
import "./styles/04-kiosk.css";
import "./styles/05-schedules.css";
import "./styles/06-screens.css";
import "./styles/07-utilities.css";
import "./styles/08-stock-map.css";
import "./styles/09-routine-checklist.css";
import "./styles/10-responsive.css";
import "./styles/11-status-a11y.css";
import "./styles/12-landing-ui.css";

// Roteamento bem simples, sem biblioteca: /tv abre só o painel de
// exibição (pensado pra TV/monitor externo), sem menu nem navegação.
// A tela /tv NÃO exige login (é só exibição pública de atividades ativas).
// A tela da TV só é baixada em /tv; o app normal não carrega esse código.
const TvBoard = lazyWithRetry(() => import("./components/TvBoard.jsx"));

installErrorReporting();

const isTvRoute = window.location.pathname.replace(/\/+$/, "") === "/tv";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        {isTvRoute ? (
          <Suspense fallback={<div className="loading-screen"><div className="loading-spinner" /></div>}>
            <TvBoard />
          </Suspense>
        ) : (
          <AuthProvider>
            <App />
          </AuthProvider>
        )}
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import TvBoard from "./components/TvBoard.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./styles.css";

// Roteamento bem simples, sem biblioteca: /tv abre só o painel de
// exibição (pensado pra TV/monitor externo), sem menu nem navegação.
// A tela /tv NÃO exige login (é só exibição pública de atividades ativas).
const isTvRoute = window.location.pathname.replace(/\/+$/, "") === "/tv";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        {isTvRoute ? (
          <TvBoard />
        ) : (
          <AuthProvider>
            <App />
          </AuthProvider>
        )}
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
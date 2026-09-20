import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import TvBoard from "./components/TvBoard.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import "./styles.css";

// Roteamento bem simples, sem biblioteca: /tv abre só o painel de
// exibição (pensado pra TV/monitor externo), sem menu nem navegação.
const isTvRoute = window.location.pathname.replace(/\/+$/, "") === "/tv";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        {isTvRoute ? <TvBoard /> : <App />}
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Erro desconhecido." };
  }

  componentDidCatch(error, info) {
    console.error("Erro não tratado no Aponta CD:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0e1013",
            color: "#f4f5f6",
            fontFamily: "system-ui, sans-serif",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px 0" }}>Algo deu errado</h2>
            <p style={{ color: "#8d95a0", fontSize: 13.5, lineHeight: 1.5 }}>
              O Aponta CD encontrou um erro inesperado. Recarregue a página — se o problema continuar,
              avise o administrador.
            </p>
            <p style={{ color: "#565d66", fontSize: 11, marginTop: 14, fontFamily: "monospace" }}>
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 14,
                background: "#ffb020",
                color: "#1a1305",
                border: "none",
                borderRadius: 6,
                padding: "10px 20px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

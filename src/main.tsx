import React, { Component, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// If anything throws during render/mount, show the error instead of a silent blank page.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("App crashed:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "#fff", background: "#1d1d1d", minHeight: "100vh", direction: "rtl" }}>
          <h1 style={{ fontSize: 18 }}>⛔ اپلیکیشن کرش کرد</h1>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, fontSize: 13, direction: "ltr", textAlign: "left" }}>
            {String(this.state.error?.stack ?? this.state.error)}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: 0, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Missing #root element in index.html — app cannot mount.');
}

ReactDOM.createRoot(rootEl).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

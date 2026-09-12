// Root React application shell coordinating surface selection, live ad spec resolution, and layout inspection panels.

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { mobilePortrait } from "../core/surfaces";
import { type SurfaceProfile } from "../core/types";
import { resolveWithDiagnostics } from "../core/resolver";
import { RenderedAd } from "../renderers/render-dom";
import { defaultDemoAdSpec } from "./adSpec";
import { SurfacePicker } from "./SurfacePicker";

/**
 * Root Application component providing the live demo experience for multi-surface ad adaptation.
 */
export const App: React.FC = () => {
  const [selectedSurface, setSelectedSurface] = useState<SurfaceProfile>(mobilePortrait);

  // Re-resolve layout whenever selected surface changes
  const { layout, diagnostics } = useMemo(() => {
    return resolveWithDiagnostics(defaultDemoAdSpec, selectedSurface);
  }, [selectedSurface]);

  // Viewport scale factor so large surfaces (e.g. 1920px wide or 1080px tall) fit comfortably on screen
  const maxViewportWidth = 850;
  const maxViewportHeight = 520;
  const scale = useMemo(() => {
    const scaleX = Math.min(1, maxViewportWidth / selectedSurface.width);
    const scaleY = Math.min(1, maxViewportHeight / selectedSurface.height);
    return Math.min(scaleX, scaleY);
  }, [selectedSurface.width, selectedSurface.height]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#060911",
        color: "#f8fafc",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 20px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <header
        style={{
          width: "100%",
          maxWidth: "1000px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Adaptive Layout Engine
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#94a3b8" }}>
              Single declarative ad spec adapted dynamically across multi-surface constraints
            </p>
          </div>
          <div
            style={{
              padding: "6px 14px",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "20px",
              fontSize: "12px",
              color: "#60a5fa",
              fontWeight: 600,
            }}
          >
            Archetype: {layout.metrics.archetype ?? "Standard"} • {layout.metrics.durationMs}ms
          </div>
        </div>

        {/* Surface Picker Tabs */}
        <SurfacePicker
          selectedSurfaceId={selectedSurface.id}
          onSelectSurface={(surface) => setSelectedSurface(surface)}
          onSelectCustom={() => alert("Custom Surface Editor will be activated in Phase 8!")}
        />
      </header>

      {/* Main Surface Preview Canvas */}
      <main
        style={{
          width: "100%",
          maxWidth: "1000px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b101d",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "32px 20px",
          minHeight: "560px",
          boxSizing: "border-box",
          position: "relative",
          overflow: "auto",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            overflow: "hidden",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <RenderedAd layout={layout} surface={selectedSurface} spec={defaultDemoAdSpec} />
        </div>

        {/* Live Surface Metadata Footer */}
        <footer
          style={{
            position: "absolute",
            bottom: "12px",
            display: "flex",
            gap: "16px",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          <span>
            Surface: <strong style={{ color: "#cbd5e1" }}>{selectedSurface.name}</strong>
          </span>
          <span>
            Native:{" "}
            <strong style={{ color: "#cbd5e1" }}>
              {selectedSurface.width}×{selectedSurface.height}px
            </strong>
          </span>
          <span>
            Visible Elements:{" "}
            <strong style={{ color: "#cbd5e1" }}>
              {diagnostics.summary.elementsResolved}/{diagnostics.summary.elementsTotal}
            </strong>
          </span>
          <span>
            Constraint Violations:{" "}
            <strong style={{ color: layout.metrics.hardViolations === 0 ? "#10b981" : "#ef4444" }}>
              {layout.metrics.hardViolations}
            </strong>
          </span>
        </footer>
      </main>
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

export default App;

// Root React application shell coordinating surface selection, live ad spec resolution, and layout inspection panels.

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { mobilePortrait } from "../core/surfaces";
import { type SurfaceProfile } from "../core/types";
import { resolveWithDiagnostics } from "../core/resolver";
import { RenderedAd } from "../renderers/render-dom";
import { defaultDemoAdSpec } from "./adSpec";
import { SurfacePicker, DEMO_SURFACES } from "./SurfacePicker";
import { ConstraintInspector } from "./ConstraintInspector";
import { ResolutionTrace } from "./ResolutionTrace";
import { CustomSurfaceEditor } from "./CustomSurfaceEditor";
import { domTextMeasurer } from "../measurement/dom-measurer";

/**
 * Root Application component providing the live demo experience for multi-surface ad adaptation.
 */
export const App: React.FC = () => {
  const [customSurfaces, setCustomSurfaces] = useState<SurfaceProfile[]>([]);
  const [selectedSurface, setSelectedSurface] = useState<SurfaceProfile>(mobilePortrait);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState<boolean>(false);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // Combine static presets and user-created custom surfaces dynamically
  const allSurfaces = useMemo(() => {
    return [...DEMO_SURFACES, ...customSurfaces];
  }, [customSurfaces]);

  const handleSaveCustomSurface = (newSurface: SurfaceProfile) => {
    setCustomSurfaces((prev) => [...prev.filter((s) => s.id !== newSurface.id), newSurface]);
    setSelectedSurface(newSurface);
    setIsCustomEditorOpen(false);
  };

  // Re-resolve layout whenever selected surface changes using real DOM text measurement
  const { layout, diagnostics } = useMemo(() => {
    return resolveWithDiagnostics(defaultDemoAdSpec, selectedSurface, {
      textMeasurer: domTextMeasurer,
    });
  }, [selectedSurface]);

  // Viewport scale factor so large surfaces fit comfortably on screen
  const maxViewportWidth = 620;
  const maxViewportHeight = 440;
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
        padding: "24px 24px 48px",
        boxSizing: "border-box",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          width: "100%",
          maxWidth: "1400px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Adaptive Layout Engine
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#94a3b8" }}>
              Constraint-based ad layout engine resolving single specs deterministically across multi-surface topologies
            </p>
          </div>

          {/* Prominent Resolution Performance & Metric Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "24px",
                fontSize: "13px",
                color: "#34d399",
                fontWeight: 700,
                boxShadow: "0 2px 10px rgba(16, 185, 129, 0.15)",
              }}
            >
              <span style={{ fontSize: "14px" }}>⚡</span>
              <span>Resolution: {diagnostics.summary.durationMs.toFixed(2)}ms</span>
            </div>

            {selectedSurface.id === "stressTest" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "24px",
                  fontSize: "12px",
                  color: "#f87171",
                  fontWeight: 700,
                  boxShadow: "0 2px 10px rgba(239, 68, 68, 0.2)",
                }}
              >
                <span>🔥</span>
                <span>Spatial Starvation Active</span>
              </div>
            )}

            <div
              style={{
                padding: "8px 14px",
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "24px",
                fontSize: "12px",
                color: "#60a5fa",
                fontWeight: 600,
              }}
            >
              Archetype: {layout.metrics.archetype ?? "Standard"}
            </div>
          </div>
        </div>

        {/* Surface Selection Tabs */}
        <SurfacePicker
          selectedSurfaceId={selectedSurface.id}
          surfaces={allSurfaces}
          isCustomEditorOpen={isCustomEditorOpen}
          onSelectSurface={(surface) => {
            setSelectedSurface(surface);
            setIsCustomEditorOpen(false);
          }}
          onSelectCustom={() => setIsCustomEditorOpen((prev) => !prev)}
        />

        {/* Custom Surface Editor Drawer / Modal */}
        {isCustomEditorOpen && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "8px",
            }}
          >
            <CustomSurfaceEditor
              onSave={handleSaveCustomSurface}
              onCancel={() => setIsCustomEditorOpen(false)}
            />
          </div>
        )}
      </header>

      {/* Main Content: 2-Column Responsive Workspace */}
      <div
        style={{
          width: "100%",
          maxWidth: "1400px",
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Rendered Ad Preview */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 4px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#cbd5e1" }}>
              Live Surface Preview ({selectedSurface.name})
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Scale: {(scale * 100).toFixed(0)}% • Native: {selectedSurface.width}×{selectedSurface.height}px
            </span>
          </div>

          <main
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0b101d",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "32px 16px",
              minHeight: "520px",
              boxSizing: "border-box",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(selectedSurface.width * scale)}px`,
                height: `${Math.round(selectedSurface.height * scale)}px`,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  transformOrigin: "center center",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <RenderedAd
                  layout={layout}
                  surface={selectedSurface}
                  spec={defaultDemoAdSpec}
                  hoveredElementId={hoveredElementId}
                  onHoverElement={setHoveredElementId}
                />
              </div>
            </div>

            {/* Quick Stats Strip */}
            <div
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
                Resolved: <strong style={{ color: "#cbd5e1" }}>{diagnostics.summary.elementsResolved}/{diagnostics.summary.elementsTotal}</strong>
              </span>
              <span>
                Collisions: <strong style={{ color: diagnostics.summary.overlaps === 0 ? "#10b981" : "#ef4444" }}>{diagnostics.summary.overlaps}</strong>
              </span>
              <span>
                Clipping: <strong style={{ color: diagnostics.summary.clipping === 0 ? "#10b981" : "#ef4444" }}>{diagnostics.summary.clipping}</strong>
              </span>
            </div>
          </main>
        </div>

        {/* Right Column: R&D Tooling (Constraint Inspector & Resolution Trace) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Constraint Inspector Panel */}
          <ConstraintInspector
            surface={selectedSurface}
            layout={layout}
            diagnostics={diagnostics}
            spec={defaultDemoAdSpec}
            hoveredElementId={hoveredElementId}
            onHoverElement={setHoveredElementId}
          />

          {/* Step-by-Step Resolution Trace Panel */}
          <ResolutionTrace
            diagnostics={diagnostics}
            hoveredElementId={hoveredElementId}
            onHoverElement={setHoveredElementId}
          />
        </div>
      </div>
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

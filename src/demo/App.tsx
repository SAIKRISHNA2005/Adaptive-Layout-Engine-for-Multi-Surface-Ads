// Root React application shell coordinating surface selection, live ad spec resolution, and layout inspection panels.

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { mobilePortrait } from "../core/surfaces";
import { type SurfaceProfile } from "../core/types";
import { resolveWithDiagnostics } from "../core/resolver";
import { RenderedAd } from "../renderers/render-dom";
import { CanvasAd } from "../renderers/CanvasAd";
import { defaultDemoAdSpec } from "./adSpec";
import { SurfacePicker, DEMO_SURFACES } from "./SurfacePicker";
import { ConstraintInspector } from "./ConstraintInspector";
import { ResolutionTrace } from "./ResolutionTrace";
import { CustomSurfaceEditor } from "./CustomSurfaceEditor";
import { domTextMeasurer } from "../measurement/dom-measurer";
import "./demo.css";

/**
 * Root Application component providing the live demo experience for multi-surface ad adaptation.
 * Features a developer-tool layout with top navigation bar, surface picker tab strip,
 * device frame canvas preview, real-time constraint inspector, and collapsible resolution trace.
 */
export const App: React.FC = () => {
  const [customSurfaces, setCustomSurfaces] = useState<SurfaceProfile[]>([]);
  const [selectedSurface, setSelectedSurface] = useState<SurfaceProfile>(mobilePortrait);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState<boolean>(false);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [rendererMode, setRendererMode] = useState<"dom" | "canvas">("dom");

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
  const maxViewportWidth = 640;
  const maxViewportHeight = 440;
  const scale = useMemo(() => {
    const scaleX = Math.min(1, maxViewportWidth / selectedSurface.width);
    const scaleY = Math.min(1, maxViewportHeight / selectedSurface.height);
    return Math.min(scaleX, scaleY);
  }, [selectedSurface.width, selectedSurface.height]);

  const isPortrait = selectedSurface.height > selectedSurface.width;
  const scaledWidth = Math.round(selectedSurface.width * scale);
  const scaledHeight = Math.round(selectedSurface.height * scale);

  return (
    <div className="app-container">
      {/* 1. Top App Navigation & Benchmark Bar */}
      <header className="app-topbar">
        <div className="brand-section">
          <div className="brand-badge">⚡</div>
          <div>
            <h1 className="brand-title">
              Adaptive Layout Engine
              <span className="engine-pill">R&D Demo</span>
            </h1>
            <p className="brand-subtitle">
              Constraint-based deterministic layout resolution across multi-surface topologies
            </p>
          </div>
        </div>

        {/* Telemetry Strip & Renderer Controls */}
        <div className="telemetry-strip">
          <div className="telemetry-pill latency">
            <span>⚡</span>
            <span>Resolution: {diagnostics.summary.durationMs.toFixed(2)}ms</span>
          </div>

          {selectedSurface.id === "stressTest" && (
            <div className="telemetry-pill starvation">
              <span>🔥</span>
              <span>Spatial Starvation Active</span>
            </div>
          )}

          <div className="telemetry-pill archetype">
            <span>Archetype: {layout.metrics.archetype ?? "Standard"}</span>
          </div>

          {/* DOM vs Canvas Renderer Toggle (proves renderer independence) */}
          <div className="renderer-toggle">
            <button
              type="button"
              data-testid="toggle-dom-renderer"
              role="button"
              aria-pressed={rendererMode === "dom"}
              onClick={() => setRendererMode("dom")}
              className={`toggle-btn ${rendererMode === "dom" ? "active" : ""}`}
            >
              HTML / DOM
            </button>
            <button
              type="button"
              data-testid="toggle-canvas-renderer"
              role="button"
              aria-pressed={rendererMode === "canvas"}
              onClick={() => setRendererMode("canvas")}
              className={`toggle-btn ${rendererMode === "canvas" ? "active" : ""}`}
            >
              HTML5 Canvas
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main 3-Column Workspace */}
      <main className="workspace-grid">
        {/* Left Column: Surface Picker Tab Strip */}
        <aside className="sidebar-surfaces">
          <div className="section-header">
            <h2 className="section-title">Target Surfaces</h2>
            <span className="count-badge">{allSurfaces.length} Surfaces</span>
          </div>
          <SurfacePicker
            selectedSurfaceId={selectedSurface.id}
            surfaces={allSurfaces}
            isCustomEditorOpen={isCustomEditorOpen}
            onSelectSurface={(surface) => {
              setSelectedSurface(surface);
              setIsCustomEditorOpen(false);
            }}
            onSelectCustom={() => setIsCustomEditorOpen((prev) => !prev)}
            orientation="vertical"
          />
        </aside>

        {/* Center Column: Device Frame Preview Workspace */}
        <section className="workspace-center">
          {/* Preview Toolbar */}
          <div className="preview-toolbar">
            <div className="device-title-info">
              <span>{isPortrait ? "📱" : "🖥️"}</span>
              <span>{selectedSurface.name}</span>
              <span className="device-badge-spec">
                {selectedSurface.width}×{selectedSurface.height}px
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                Fit Scale: {(scale * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Canvas / Device Stage */}
          <div className="device-stage">
            {/* Realistic Device / Frame Outline */}
            <div
              className={`device-frame ${isPortrait ? "portrait" : "landscape"}`}
              style={{
                width: `${scaledWidth + 16}px`,
                height: `${scaledHeight + 16}px`,
                padding: "8px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: "14px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    transformOrigin: "center center",
                    width: `${selectedSurface.width}px`,
                    height: `${selectedSurface.height}px`,
                  }}
                >
                  {rendererMode === "dom" ? (
                    <RenderedAd
                      layout={layout}
                      surface={selectedSurface}
                      spec={defaultDemoAdSpec}
                      hoveredElementId={hoveredElementId}
                      onHoverElement={setHoveredElementId}
                    />
                  ) : (
                    <CanvasAd
                      layout={layout}
                      surface={selectedSurface}
                      spec={defaultDemoAdSpec}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics Badge Bar */}
            <div className="stage-metrics-bar">
              <span>
                Resolved: <strong style={{ color: "#f1f5f9" }}>{diagnostics.summary.elementsResolved}/{diagnostics.summary.elementsTotal}</strong>
              </span>
              <span>•</span>
              <span>
                Collisions:{" "}
                <strong style={{ color: diagnostics.summary.overlaps === 0 ? "var(--success)" : "var(--danger)" }}>
                  {diagnostics.summary.overlaps}
                </strong>
              </span>
              <span>•</span>
              <span>
                Clipping:{" "}
                <strong style={{ color: diagnostics.summary.clipping === 0 ? "var(--success)" : "var(--danger)" }}>
                  {diagnostics.summary.clipping}
                </strong>
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Constraint Inspector */}
        <aside className="sidebar-inspector">
          <ConstraintInspector
            surface={selectedSurface}
            layout={layout}
            diagnostics={diagnostics}
            spec={defaultDemoAdSpec}
            hoveredElementId={hoveredElementId}
            onHoverElement={setHoveredElementId}
          />
        </aside>
      </main>

      {/* 3. Bottom Dock: Collapsible Resolution Trace Panel */}
      <footer className="trace-dock-container">
        <ResolutionTrace
          diagnostics={diagnostics}
          hoveredElementId={hoveredElementId}
          onHoverElement={setHoveredElementId}
        />
      </footer>

      {/* Custom Surface Creation Modal */}
      {isCustomEditorOpen && (
        <div className="modal-backdrop" onClick={() => setIsCustomEditorOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CustomSurfaceEditor
              onSave={handleSaveCustomSurface}
              onCancel={() => setIsCustomEditorOpen(false)}
            />
          </div>
        </div>
      )}
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

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
import {
  IconEngine,
  IconPhonePortrait,
  IconPhoneLandscape,
  IconPulse,
  IconFlame,
  IconTerminal,
  IconSplit,
  IconExpand,
  IconMinimize,
} from "./Icons";
import "./demo.css";

/**
 * Root Application component providing the live demo experience for multi-surface ad adaptation.
 * Features a developer-tool layout fitted strictly within 100vh with zero outer page scroll,
 * multi-theme switcher (Studio / Obsidian / Nebula), independent scrollable sidebars,
 * and a collapsible bottom resolution trace console.
 */
export const App: React.FC = () => {
  const [theme, setTheme] = useState<"studio" | "obsidian" | "nebula">("studio");
  const [customSurfaces, setCustomSurfaces] = useState<SurfaceProfile[]>([]);
  const [selectedSurface, setSelectedSurface] = useState<SurfaceProfile>(mobilePortrait);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState<boolean>(false);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [rendererMode, setRendererMode] = useState<"dom" | "canvas">("dom");
  const [zoomMode, setZoomMode] = useState<"fit" | "50" | "75" | "100">("fit");
  const [traceViewMode, setTraceViewMode] = useState<"half" | "expanded" | "collapsed">("half");
  const [mobileTab, setMobileTab] = useState<"preview" | "surfaces" | "inspector">("preview");
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Viewport scale factor so surfaces fit comfortably within the top half across any device width
  const isMobile = windowWidth <= 860;
  const maxViewportWidth = isMobile ? Math.max(280, Math.min(windowWidth - 32, 580)) : 580;
  const maxViewportHeight = traceViewMode === "half" ? (isMobile ? 260 : 295) : traceViewMode === "expanded" ? 160 : 490;

  const scale = useMemo(() => {
    if (zoomMode === "50") return 0.5;
    if (zoomMode === "75") return 0.75;
    if (zoomMode === "100") return 1.0;
    const scaleX = Math.min(1, maxViewportWidth / selectedSurface.width);
    const scaleY = Math.min(1, maxViewportHeight / selectedSurface.height);
    return Math.min(scaleX, scaleY);
  }, [selectedSurface.width, selectedSurface.height, zoomMode, traceViewMode, maxViewportWidth, maxViewportHeight]);

  const isPortrait = selectedSurface.height > selectedSurface.width;
  const scaledWidth = Math.round(selectedSurface.width * scale);
  const scaledHeight = Math.round(selectedSurface.height * scale);

  return (
    <div className="app-container" data-theme={theme}>
      {/* 1. Top App Navigation & Benchmark Bar */}
      <header className="app-topbar">
        <div className="brand-section">
          <div className="brand-badge">
            <IconEngine size={20} color="var(--accent-secondary)" />
          </div>
          <div>
            <h1 className="brand-title">
              Adaptive Layout Engine
              <span className="engine-pill">R&D Studio</span>
            </h1>
          </div>
        </div>

        {/* Telemetry Strip & Renderer Controls */}
        <div className="telemetry-strip">
          <div className="telemetry-pill latency">
            <IconPulse size={13} color="#34d399" />
            <span>Resolution: {diagnostics.summary.durationMs.toFixed(2)}ms</span>
          </div>

          {(diagnostics.trace.some((t) => t.stage === "degrade") || layout.elements.some((e) => e.status === "dropped")) && (
            <div className="telemetry-pill starvation">
              <IconFlame size={13} color="#f87171" />
              <span>Spatial Starvation Active</span>
            </div>
          )}

          <div className="telemetry-pill archetype">
            <span>Archetype: {layout.metrics.archetype ?? "Standard"}</span>
          </div>

          {/* Theme Switcher with tactile precision swatches */}
          <div className="theme-switcher" role="radiogroup" aria-label="Color Theme">
            <button
              type="button"
              className={`theme-btn ${theme === "studio" ? "active" : ""}`}
              onClick={() => setTheme("studio")}
              title="Studio Dark Theme"
            >
              <span className="theme-swatch studio" />
              <span>Studio</span>
            </button>
            <button
              type="button"
              className={`theme-btn ${theme === "obsidian" ? "active" : ""}`}
              onClick={() => setTheme("obsidian")}
              title="Obsidian Minimal Theme"
            >
              <span className="theme-swatch obsidian" />
              <span>Obsidian</span>
            </button>
            <button
              type="button"
              className={`theme-btn ${theme === "nebula" ? "active" : ""}`}
              onClick={() => setTheme("nebula")}
              title="Cyber Nebula Theme"
            >
              <span className="theme-swatch nebula" />
              <span>Nebula</span>
            </button>
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

      {/* Mobile / Tablet Studio Navigation Switcher (Displayed on <= 860px) */}
      <nav className="mobile-studio-tabs" aria-label="Studio Views">
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === "preview" ? "active" : ""}`}
          onClick={() => setMobileTab("preview")}
        >
          <IconEngine size={14} />
          <span>Preview & Trace</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === "surfaces" ? "active" : ""}`}
          onClick={() => setMobileTab("surfaces")}
        >
          <IconPhonePortrait size={14} />
          <span>Surfaces ({allSurfaces.length})</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === "inspector" ? "active" : ""}`}
          onClick={() => setMobileTab("inspector")}
        >
          <IconPulse size={14} />
          <span>Inspector</span>
        </button>
      </nav>

      {/* 2. Main Studio Docked Workspace (Fills remaining window height strictly without page scroll) */}
      <main className="workspace-grid" data-mobile-tab={mobileTab}>
        {/* Left Column: Surface Picker Sidebar */}
        <aside className={`sidebar-surfaces ${mobileTab === "surfaces" ? "mobile-active" : ""}`}>
          <div className="sidebar-surfaces-header">
            <h2 className="section-title">Target Surfaces</h2>
            <span className="count-badge">{allSurfaces.length} Profiles</span>
          </div>
          <div className="sidebar-surfaces-content custom-scrollbar">
            <SurfacePicker
              selectedSurfaceId={selectedSurface.id}
              surfaces={allSurfaces}
              isCustomEditorOpen={isCustomEditorOpen}
              onSelectSurface={(surface) => {
                setSelectedSurface(surface);
                setIsCustomEditorOpen(false);
                if (isMobile) setMobileTab("preview");
              }}
              onSelectCustom={() => setIsCustomEditorOpen((prev) => !prev)}
              orientation="vertical"
            />
          </div>
        </aside>

        {/* Center Column: 50/50 Vertical Split (Top Half: Demo Stage, Bottom Half: Resolution Trace) */}
        <section className={`workspace-center ${mobileTab === "preview" ? "mobile-active" : ""}`}>
          {/* Middle Top Half: Demo Stage (Toolbar & Device Canvas) */}
          <div
            className="workspace-center-top"
            style={{
              flex: traceViewMode === "half" ? "1 1 50%" : traceViewMode === "expanded" ? "0 0 25%" : "1 1 100%",
              height: traceViewMode === "half" ? "50%" : traceViewMode === "expanded" ? "25%" : "calc(100% - 36px)",
            }}
          >
            {/* Preview Toolbar */}
            <div className="preview-toolbar">
              <div className="device-title-info">
                <span style={{ display: "flex", alignItems: "center", color: "var(--accent-secondary)" }}>
                  {isPortrait ? <IconPhonePortrait size={16} /> : <IconPhoneLandscape size={16} />}
                </span>
                <span>{selectedSurface.name}</span>
                <span className="device-badge-spec">
                  {selectedSurface.width}×{selectedSurface.height}px
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Scale: {(scale * 100).toFixed(0)}%
                </span>
                <div className="renderer-toggle" style={{ marginLeft: "4px" }}>
                  {(["fit", "50", "75", "100"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`toggle-btn ${zoomMode === mode ? "active" : ""}`}
                      onClick={() => setZoomMode(mode)}
                      style={{ padding: "2px 7px", fontSize: "10px" }}
                    >
                      {mode === "fit" ? "Fit" : `${mode}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas / Device Stage */}
            <div className="device-stage">
              {/* Realistic Device / Frame Outline */}
              <div
                className={`device-frame ${isPortrait ? "portrait" : "landscape"}`}
                style={{
                  width: `${scaledWidth + 14}px`,
                  height: `${scaledHeight + 14}px`,
                  padding: "7px",
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

              {/* Quick Metrics Floating Pill Bar */}
              <div className="stage-metrics-bar">
                <span>
                  Resolved: <strong style={{ color: "var(--text-primary)" }}>{diagnostics.summary.elementsResolved}/{diagnostics.summary.elementsTotal}</strong>
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
          </div>

          {/* Middle Bottom Half: Resolution Trace Component */}
          <div
            className={`workspace-center-bottom trace-dock-drawer ${traceViewMode}`}
            style={{
              flex: traceViewMode === "half" ? "1 1 50%" : traceViewMode === "expanded" ? "0 0 75%" : "0 0 36px",
              height: traceViewMode === "half" ? "50%" : traceViewMode === "expanded" ? "75%" : "36px",
            }}
          >
            <div
              className="trace-dock-header"
              onClick={() =>
                setTraceViewMode((prev) =>
                  prev === "collapsed" ? "half" : prev === "half" ? "expanded" : "half",
                )
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <IconTerminal size={15} color="var(--accent-secondary)" />
                <span style={{ fontWeight: 700 }}>Resolution Trace</span>
                <span className="count-badge">
                  {diagnostics.trace.length} steps • {diagnostics.summary.durationMs.toFixed(2)}ms
                </span>
                {traceViewMode === "half" && (
                  <span className="trace-peek-badge">
                    Middle Bottom Half • Scrollable ↓
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  className={`trace-mode-btn ${traceViewMode === "half" ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTraceViewMode("half");
                  }}
                  title="50/50 Middle Split (Default)"
                >
                  <IconSplit size={12} style={{ marginRight: "4px" }} />
                  50/50 Split
                </button>
                <button
                  type="button"
                  className={`trace-mode-btn ${traceViewMode === "expanded" ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTraceViewMode("expanded");
                  }}
                  title="Expand Trace to 75%"
                >
                  <IconExpand size={12} style={{ marginRight: "4px" }} />
                  Expand ⤢
                </button>
                <button
                  type="button"
                  className={`trace-mode-btn ${traceViewMode === "collapsed" ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTraceViewMode("collapsed");
                  }}
                  title="Minimize Trace to Bottom Bar"
                >
                  <IconMinimize size={12} style={{ marginRight: "4px" }} />
                  Minimize ▼
                </button>
              </div>
            </div>
            {traceViewMode !== "collapsed" && (
              <>
                <div className="trace-dock-content custom-scrollbar">
                  <ResolutionTrace
                    diagnostics={diagnostics}
                    hoveredElementId={hoveredElementId}
                    onHoverElement={setHoveredElementId}
                    embedded={true}
                  />
                </div>
                {traceViewMode === "half" && (
                  <div className="trace-scroll-affordance">
                    <span>Scroll inside for full trace ({diagnostics.trace.length} steps) ↓</span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Right Column: Constraint Inspector */}
        <aside className={`sidebar-inspector ${mobileTab === "inspector" ? "mobile-active" : ""}`}>
          <div className="sidebar-inspector-header">
            <h2 className="section-title">Constraint Inspector</h2>
            <span className="count-badge" style={{ fontFamily: "ui-monospace, monospace" }}>
              {selectedSurface.id}
            </span>
          </div>
          <div className="sidebar-inspector-content custom-scrollbar">
            <ConstraintInspector
              surface={selectedSurface}
              layout={layout}
              diagnostics={diagnostics}
              spec={defaultDemoAdSpec}
              hoveredElementId={hoveredElementId}
              onHoverElement={setHoveredElementId}
            />
          </div>
        </aside>
      </main>

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

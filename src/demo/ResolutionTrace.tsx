// Step-by-step resolution trace visualizer displaying the deterministic layout pipeline execution stages.

import React, { useMemo, useState } from "react";
import { type ResolutionDiagnostics, type ResolutionTraceStep } from "../core/diagnostics";

/** Props for the ResolutionTrace component. */
export interface ResolutionTraceProps {
  /** Structured resolution diagnostics report containing pipeline steps and timing metrics. */
  readonly diagnostics: ResolutionDiagnostics;
  /** Currently hovered element ID for cross-component highlighting. */
  readonly hoveredElementId?: string | null;
  /** Callback fired when hovering over an element-associated trace step or tag. */
  readonly onHoverElement?: (elementId: string | null) => void;
}

/** Stage badge styling colors. */
const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  normalize: { bg: "rgba(100, 116, 139, 0.15)", text: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" },
  measure: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
  place: { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", border: "rgba(16, 185, 129, 0.3)" },
  validate: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" },
  degrade: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.3)" },
};

/**
 * Collapsible, stage-grouped resolution trace inspection panel.
 * Shows every decision made by the layout engine with element hover synchronization.
 */
export const ResolutionTrace: React.FC<ResolutionTraceProps> = ({
  diagnostics,
  hoveredElementId,
  onHoverElement,
}) => {
  const { trace, summary } = diagnostics;

  // Group steps by pipeline stage
  const groupedStages = useMemo(() => {
    const groups: { stage: string; steps: ResolutionTraceStep[] }[] = [];
    const stageOrder: ("normalize" | "measure" | "place" | "validate" | "degrade")[] = [
      "normalize",
      "measure",
      "place",
      "validate",
      "degrade",
    ];

    for (const stage of stageOrder) {
      const steps = trace.filter((s) => s.stage === stage);
      if (steps.length > 0) {
        groups.push({ stage, steps });
      }
    }
    return groups;
  }, [trace]);

  // Track collapsed state per stage (default: all expanded)
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  const toggleStage = (stage: string) => {
    setCollapsedStages((prev) => ({
      ...prev,
      [stage]: !prev[stage],
    }));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        backgroundColor: "#0d1424",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "18px",
        color: "#f8fafc",
        fontSize: "13px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 700,
              color: "#93c5fd",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Resolution Trace
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            {trace.length} deterministic steps in {summary.durationMs.toFixed(2)}ms
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setCollapsedStages({})}
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() => {
              const all: Record<string, boolean> = {};
              for (const g of groupedStages) all[g.stage] = true;
              setCollapsedStages(all);
            }}
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Stage-Grouped List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxHeight: "480px",
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {groupedStages.map((group) => {
          const isCollapsed = Boolean(collapsedStages[group.stage]);
          const stageColor = STAGE_COLORS[group.stage] ?? {
            bg: "rgba(255, 255, 255, 0.05)",
            text: "#cbd5e1",
            border: "rgba(255, 255, 255, 0.1)",
          };

          const hasHoveredStep = group.steps.some(
            (s) => hoveredElementId && s.elementId === hoveredElementId,
          );

          return (
            <div
              key={group.stage}
              style={{
                backgroundColor: hasHoveredStep ? "rgba(56, 189, 248, 0.04)" : "rgba(255, 255, 255, 0.02)",
                border: hasHoveredStep
                  ? "1px solid rgba(56, 189, 248, 0.3)"
                  : "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "8px",
                overflow: "hidden",
                transition: "border-color 0.15s ease",
              }}
            >
              {/* Stage Group Header */}
              <button
                type="button"
                onClick={() => toggleStage(group.stage)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "none",
                  borderBottom: isCollapsed ? "none" : "1px solid rgba(255, 255, 255, 0.05)",
                  color: "#f8fafc",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      backgroundColor: stageColor.bg,
                      color: stageColor.text,
                      border: `1px solid ${stageColor.border}`,
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {group.stage}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>
                    {group.steps.length} {group.steps.length === 1 ? "step" : "steps"}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {isCollapsed ? "▶ Show" : "▼ Hide"}
                </span>
              </button>

              {/* Stage Step Rows */}
              {!isCollapsed && (
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 8px", gap: "4px" }}>
                  {group.steps.map((step) => {
                    const isStepHovered = hoveredElementId && step.elementId === hoveredElementId;

                    return (
                      <div
                        key={step.step}
                        onMouseEnter={() => {
                          if (step.elementId) onHoverElement?.(step.elementId);
                        }}
                        onMouseLeave={() => {
                          if (step.elementId) onHoverElement?.(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          backgroundColor: isStepHovered
                            ? "rgba(56, 189, 248, 0.15)"
                            : "rgba(255, 255, 255, 0.015)",
                          border: isStepHovered
                            ? "1px solid #38bdf8"
                            : "1px solid rgba(255, 255, 255, 0.03)",
                          cursor: step.elementId ? "pointer" : "default",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Step Number */}
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "11px",
                            color: "#64748b",
                            minWidth: "22px",
                            paddingTop: "1px",
                          }}
                        >
                          #{step.step}
                        </span>

                        {/* Step Message Content */}
                        <div style={{ flex: 1, fontSize: "12px", lineHeight: 1.4, color: "#e2e8f0" }}>
                          {step.message}
                        </div>

                        {/* Optional Element Tag */}
                        {step.elementId && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              fontWeight: 600,
                              backgroundColor: isStepHovered
                                ? "rgba(56, 189, 248, 0.3)"
                                : "rgba(255, 255, 255, 0.08)",
                              color: isStepHovered ? "#38bdf8" : "#94a3b8",
                              border: isStepHovered
                                ? "1px solid #38bdf8"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            @{step.elementId}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResolutionTrace;

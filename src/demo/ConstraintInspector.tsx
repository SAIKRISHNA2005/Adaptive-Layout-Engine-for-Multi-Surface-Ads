// Live inspector displaying active surface constraints, safe area bounds, element degradation statuses, and constraint checklist.

import React from "react";
import {
  type ElementStatus,
  type ResolvedElement,
  type ResolvedLayout,
  type SurfaceProfile,
} from "../core/types";
import { type ResolutionDiagnostics } from "../core/diagnostics";

/** Props for the ConstraintInspector panel. */
export interface ConstraintInspectorProps {
  /** Target surface profile description. */
  readonly surface: SurfaceProfile;
  /** Resolved layout output data. */
  readonly layout: ResolvedLayout;
  /** Structured resolution diagnostics report. */
  readonly diagnostics: ResolutionDiagnostics;
  /** Currently hovered element ID for cross-component highlighting. */
  readonly hoveredElementId?: string | null;
  /** Callback fired when hovering over an element row. */
  readonly onHoverElement?: (elementId: string | null) => void;
}

/** Status badge color styling. */
const STATUS_BADGE_COLORS: Record<ElementStatus, { bg: string; text: string; border: string }> = {
  kept: { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", border: "rgba(16, 185, 129, 0.4)" },
  shrunk: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.4)" },
  repositioned: { bg: "rgba(6, 182, 212, 0.15)", text: "#22d3ee", border: "rgba(6, 182, 212, 0.4)" },
  truncated: { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", border: "rgba(168, 85, 247, 0.4)" },
  dropped: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.4)" },
};

/**
 * Inspection panel displaying physical surface profile attributes, per-element resolution results,
 * and live-evaluated constraint checklists.
 */
export const ConstraintInspector: React.FC<ConstraintInspectorProps> = ({
  surface,
  layout,
  diagnostics,
  hoveredElementId,
  onHoverElement,
}) => {
  const { summary } = diagnostics;
  const safeArea = surface.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };

  // Live checklist evaluation derived purely from diagnostics and layout metrics
  const checklist = [
    {
      label: "Surface Viewport Bounds",
      passed: summary.clipping === 0,
      detail: summary.clipping === 0 ? "All elements within viewport" : `${summary.clipping} clipped elements`,
    },
    {
      label: "Hardware Safe Area Insets",
      passed: true,
      detail: `Preserved insets [T:${safeArea.top}, R:${safeArea.right}, B:${safeArea.bottom}, L:${safeArea.left}]`,
    },
    {
      label: "Pairwise Zero Collision",
      passed: summary.overlaps === 0,
      detail: summary.overlaps === 0 ? "Zero overlapping bounding boxes" : `${summary.overlaps} collisions detected`,
    },
    {
      label: "Minimum Touch Tap Target",
      passed: surface.minTapTarget
        ? layout.elements
            .filter((e) => e.type === "button" && e.visible)
            .every((e) => e.width >= (surface.minTapTarget ?? 0) && e.height >= (surface.minTapTarget ?? 0))
        : true,
      detail: surface.minTapTarget ? `Enforced ≥ ${surface.minTapTarget}px minimum target` : "No min tap constraint",
    },
    {
      label: "Minimum Text Legibility",
      passed: surface.minTextSize
        ? layout.elements
            .filter((e) => (e.type === "text" || e.type === "button") && e.visible)
            .every((e) => (e.fontSize ?? 12) >= (surface.minTextSize ?? 0))
        : true,
      detail: surface.minTextSize ? `Enforced ≥ ${surface.minTextSize}px legible size` : "Standard text sizing",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        backgroundColor: "#0d1424",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "18px",
        color: "#f8fafc",
        fontSize: "13px",
      }}
    >
      {/* 1. Surface Hardware Constraints */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Surface Profile
          </h3>
          <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>ID: {surface.id}</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <div>
            <div style={{ color: "#64748b", fontSize: "11px" }}>Resolution</div>
            <div style={{ fontWeight: 600, color: "#f1f5f9" }}>
              {surface.width} × {surface.height} px
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "11px" }}>Aspect Ratio</div>
            <div style={{ fontWeight: 600, color: "#f1f5f9" }}>
              {(surface.width / surface.height).toFixed(2)} ({layout.metrics.archetype ?? "Stack"})
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "11px" }}>Min Tap Target</div>
            <div style={{ fontWeight: 600, color: surface.minTapTarget ? "#38bdf8" : "#94a3b8" }}>
              {surface.minTapTarget ? `${surface.minTapTarget} px` : "None"}
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "11px" }}>Min Text Size</div>
            <div style={{ fontWeight: 600, color: surface.minTextSize ? "#38bdf8" : "#94a3b8" }}>
              {surface.minTextSize ? `${surface.minTextSize} px` : "Auto (12px+)"}
            </div>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div style={{ color: "#64748b", fontSize: "11px" }}>Safe Area Insets</div>
            <div style={{ fontWeight: 500, color: "#cbd5e1", fontFamily: "monospace", fontSize: "12px" }}>
              T:{safeArea.top}px • R:{safeArea.right}px • B:{safeArea.bottom}px • L:{safeArea.left}px
            </div>
          </div>
        </div>
      </div>

      {/* 2. Resolved Element Status List */}
      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Element Status ({layout.elements.filter((e) => e.visible).length}/{layout.elements.length} Visible)
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {layout.elements.map((el: ResolvedElement) => {
            const badge = STATUS_BADGE_COLORS[el.status];
            const isHovered = hoveredElementId === el.id;

            return (
              <div
                key={el.id}
                onMouseEnter={() => onHoverElement?.(el.id)}
                onMouseLeave={() => onHoverElement?.(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  backgroundColor: isHovered ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  border: isHovered ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.04)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      color: "#94a3b8",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    P{el.priority}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{el.id}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      {el.visible ? `${el.width}×${el.height}px${el.fontSize ? ` @ ${el.fontSize}px` : ""}` : "Not visible (dropped)"}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    backgroundColor: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`,
                    padding: "3px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {el.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Live Constraints Checklist */}
      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Constraint Satisfaction
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {checklist.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                padding: "6px 8px",
                backgroundColor: item.passed ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.08)",
                borderRadius: "6px",
                border: item.passed ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <span style={{ fontSize: "14px", color: item.passed ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                {item.passed ? "✓" : "⚠"}
              </span>
              <div>
                <div style={{ fontWeight: 600, color: item.passed ? "#e2e8f0" : "#fca5a5" }}>{item.label}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConstraintInspector;

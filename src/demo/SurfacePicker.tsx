// Interactive surface profile selector allowing seamless switching across mobile portrait, mobile landscape, kiosk, and broadcast profiles.

import React from "react";
import {
  broadcastLowerThird,
  mobileLandscape,
  mobilePortrait,
  retailKiosk,
  stressTestSurface,
} from "../core/surfaces";
import { type SurfaceProfile } from "../core/types";

/** Preset surfaces available in the demo surface picker. */
export const DEMO_SURFACES: readonly SurfaceProfile[] = [
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
  stressTestSurface,
];

/** Props for the SurfacePicker component. */
export interface SurfacePickerProps {
  /** Currently active surface profile identifier. */
  readonly selectedSurfaceId: string;
  /** Callback fired when a surface tab is selected. */
  readonly onSelectSurface: (surface: SurfaceProfile) => void;
  /** Callback fired when the Custom Surface tab is selected. */
  readonly onSelectCustom?: () => void;
  /** Optional custom surface list to display, defaults to DEMO_SURFACES. */
  readonly surfaces?: readonly SurfaceProfile[];
  /** Whether the custom surface editor modal/drawer is open. */
  readonly isCustomEditorOpen?: boolean;
  /** Layout orientation: vertical (for sidebar) or horizontal. Default is vertical. */
  readonly orientation?: "vertical" | "horizontal";
}

/**
 * Surface switcher component providing intuitive tabs for testing ad adaptation
 * across disparate screen aspect ratios and physical viewing environments.
 */
export const SurfacePicker: React.FC<SurfacePickerProps> = ({
  selectedSurfaceId,
  onSelectSurface,
  onSelectCustom,
  surfaces = DEMO_SURFACES,
  isCustomEditorOpen = false,
  orientation = "vertical",
}) => {
  const isVertical = orientation === "vertical";

  return (
    <div
      role="tablist"
      aria-label="Surface Profiles"
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        flexWrap: isVertical ? "nowrap" : "wrap",
        gap: "8px",
        width: "100%",
      }}
    >
      {surfaces.map((surface) => {
        const isSelected = surface.id === selectedSurfaceId;
        const aspectRatio = (surface.width / surface.height).toFixed(2);
        const isStress = surface.id === "stressTest";

        return (
          <button
            key={surface.id}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectSurface(surface)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "4px",
              padding: "10px 14px",
              backgroundColor: isSelected
                ? "rgba(59, 130, 246, 0.16)"
                : "rgba(255, 255, 255, 0.02)",
              color: isSelected ? "#ffffff" : "#94a3b8",
              border: isSelected
                ? "1px solid #3b82f6"
                : "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: isSelected ? "0 2px 12px rgba(59, 130, 246, 0.25)" : "none",
              position: "relative",
              textAlign: "left",
              width: "100%",
            }}
          >
            {isSelected && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "3px",
                  backgroundColor: isStress ? "#ef4444" : "#3b82f6",
                  borderRadius: "8px 0 0 8px",
                }}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 600, fontSize: "13px", color: isSelected ? "#ffffff" : "#cbd5e1" }}>
                {surface.name}
              </span>
              {isStress && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#f87171",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    padding: "1px 5px",
                    borderRadius: "4px",
                  }}
                >
                  STRESS
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                color: isSelected ? "#93c5fd" : "#64748b",
              }}
            >
              {surface.width}×{surface.height}px • AR {aspectRatio}
            </span>
          </button>
        );
      })}

      {/* Visually Distinct Custom Surface Creation Tab */}
      <button
        role="tab"
        aria-selected={isCustomEditorOpen || selectedSurfaceId.startsWith("custom")}
        onClick={onSelectCustom}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "4px",
          padding: "10px 14px",
          backgroundColor:
            isCustomEditorOpen || selectedSurfaceId.startsWith("custom")
              ? "rgba(147, 51, 234, 0.16)"
              : "rgba(255, 255, 255, 0.02)",
          color:
            isCustomEditorOpen || selectedSurfaceId.startsWith("custom")
              ? "#ffffff"
              : "#c084fc",
          border:
            isCustomEditorOpen || selectedSurfaceId.startsWith("custom")
              ? "1px solid #a855f7"
              : "1px dashed rgba(168, 85, 247, 0.35)",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "all 0.15s ease",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "13px" }}>✨ + Custom Surface</span>
        <span style={{ fontSize: "11px", opacity: 0.8 }}>Unseen 5th Profile</span>
      </button>
    </div>
  );
};

export default SurfacePicker;

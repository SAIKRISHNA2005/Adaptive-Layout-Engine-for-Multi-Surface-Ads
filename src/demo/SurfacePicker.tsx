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
}) => {
  return (
    <div
      role="tablist"
      aria-label="Surface Profiles"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        padding: "12px 16px",
        backgroundColor: "#131b2e",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      }}
    >
      {surfaces.map((surface) => {
        const isSelected = surface.id === selectedSurfaceId;
        const aspectRatio = (surface.width / surface.height).toFixed(2);

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
              padding: "10px 16px",
              backgroundColor: isSelected ? "#2563eb" : "rgba(255, 255, 255, 0.04)",
              color: isSelected ? "#ffffff" : "#cbd5e1",
              border: isSelected
                ? "1px solid #3b82f6"
                : "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: isSelected ? "0 2px 10px rgba(37, 99, 235, 0.4)" : "none",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{surface.name}</span>
            <span
              style={{
                fontSize: "12px",
                opacity: isSelected ? 0.9 : 0.6,
                fontFamily: "monospace",
              }}
            >
              {surface.width}×{surface.height}px (AR: {aspectRatio})
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
          padding: "10px 16px",
          backgroundColor:
            isCustomEditorOpen || selectedSurfaceId.startsWith("custom")
              ? "#9333ea"
              : "rgba(147, 51, 234, 0.08)",
          color:
            isCustomEditorOpen || selectedSurfaceId.startsWith("custom")
              ? "#ffffff"
              : "#c084fc",
          border:
            isCustomEditorOpen || selectedSurfaceId.startsWith("custom")
              ? "1px solid #a855f7"
              : "1px dashed rgba(168, 85, 247, 0.4)",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "14px" }}>✨ + Custom Surface</span>
        <span style={{ fontSize: "12px", opacity: 0.8 }}>Unseen 5th Profile</span>
      </button>
    </div>
  );
};

export default SurfacePicker;

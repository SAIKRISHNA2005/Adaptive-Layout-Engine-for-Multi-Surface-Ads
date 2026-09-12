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
import {
  IconPhonePortrait,
  IconPhoneLandscape,
  IconBroadcast,
  IconKiosk,
  IconStress,
  IconPlus,
} from "./Icons";

/** Preset surfaces available in the demo surface picker. */
export const DEMO_SURFACES: readonly SurfaceProfile[] = [
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
  stressTestSurface,
];

/** Returns bespoke vector icon matching surface form factor. */
const getSurfaceIcon = (id: string, isSelected: boolean) => {
  const color = isSelected ? "var(--accent-secondary)" : "var(--text-muted)";
  switch (id) {
    case "mobilePortrait":
      return <IconPhonePortrait size={16} color={color} />;
    case "mobileLandscape":
      return <IconPhoneLandscape size={16} color={color} />;
    case "broadcastLowerThird":
      return <IconBroadcast size={16} color={color} />;
    case "retailKiosk":
      return <IconKiosk size={16} color={color} />;
    case "stressTest":
      return <IconStress size={16} color={color} />;
    default:
      return <IconPhonePortrait size={16} color={color} />;
  }
};

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
              gap: "5px",
              padding: "10px 14px",
              backgroundColor: isSelected
                ? "rgba(59, 130, 246, 0.14)"
                : "rgba(255, 255, 255, 0.02)",
              color: isSelected ? "#ffffff" : "#94a3b8",
              border: isSelected
                ? "1px solid var(--accent-primary)"
                : "1px solid var(--border-subtle)",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: isSelected ? "0 2px 14px var(--accent-glow)" : "none",
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
                  backgroundColor: "var(--accent-secondary)",
                  borderRadius: "8px 0 0 8px",
                }}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
              <span style={{ display: "flex", alignItems: "center" }}>
                {getSurfaceIcon(surface.id, isSelected)}
              </span>
              <span style={{ fontWeight: 600, fontSize: "13px", color: isSelected ? "#ffffff" : "#cbd5e1" }}>
                {surface.name}
              </span>
            </div>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                color: isSelected ? "var(--accent-secondary)" : "var(--text-muted)",
                paddingLeft: "24px",
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
              ? "rgba(168, 85, 247, 0.14)"
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
          <IconPlus size={16} color={isCustomEditorOpen ? "#ffffff" : "#c084fc"} />
          <span style={{ fontWeight: 600, fontSize: "13px" }}>Custom Surface</span>
        </div>
        <span style={{ fontSize: "11px", opacity: 0.8, paddingLeft: "24px" }}>Unseen 5th Profile</span>
      </button>
    </div>
  );
};

export default SurfacePicker;

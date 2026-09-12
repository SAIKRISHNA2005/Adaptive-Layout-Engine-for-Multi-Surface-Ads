// React DOM renderer that transforms resolved layout coordinates and element specs into interactive HTML/CSS components.

import { useMemo, type CSSProperties, type FC } from "react";
import {
  type AdElement,
  type AdSpec,
  type ElementStatus,
  type ResolvedElement,
  type ResolvedLayout,
  type SurfaceProfile,
} from "../core/types";

/** Props for the RenderedAd React DOM layout renderer. */
export interface RenderedAdProps {
  /** The resolved layout intermediate representation containing absolute coordinates. */
  readonly layout: ResolvedLayout;
  /** The target surface profile providing physical dimensions and safe areas. */
  readonly surface: SurfaceProfile;
  /** The source declarative ad specification for element semantics and assets. */
  readonly spec: AdSpec;
  /** Whether to render subtle color-coded debug outlines reflecting element degradation status. */
  readonly debugOutlines?: boolean;
  /** Currently hovered element ID for cross-component inspection highlighting. */
  readonly hoveredElementId?: string | null;
  /** Callback fired when an element hover state changes. */
  readonly onHoverElement?: (elementId: string | null) => void;
  /** Optional custom CSS class name for the outer container. */
  readonly className?: string;
  /** Optional container style overrides. */
  readonly style?: CSSProperties;
}

/** Status-specific debug outline styling mapping. */
const STATUS_OUTLINE_STYLES: Record<ElementStatus, { border: string; badge: string; bg: string }> = {
  kept: {
    border: "1px solid rgba(59, 130, 246, 0.4)",
    badge: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.04)",
  },
  shrunk: {
    border: "1px dashed rgba(245, 158, 11, 0.8)",
    badge: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.08)",
  },
  repositioned: {
    border: "1px dashed rgba(6, 182, 212, 0.8)",
    badge: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.08)",
  },
  truncated: {
    border: "1px dashed rgba(168, 85, 247, 0.8)",
    badge: "#a855f7",
    bg: "rgba(168, 85, 247, 0.08)",
  },
  dropped: {
    border: "none",
    badge: "transparent",
    bg: "transparent",
  },
};

/**
 * Pure React DOM renderer that projects a ResolvedLayout onto absolute HTML/CSS elements.
 * Contains ZERO layout decision logic or media queries; consumes coordinates directly from layout IR.
 */
export const RenderedAd: FC<RenderedAdProps> = ({
  layout,
  surface,
  spec,
  debugOutlines = true,
  hoveredElementId,
  onHoverElement,
  className,
  style,
}) => {
  // Map spec elements by ID for rapid semantic lookup
  const specElementMap = useMemo(() => {
    const map = new Map<string, AdElement>();
    for (const elem of spec.elements) {
      map.set(elem.id, elem);
    }
    return map;
  }, [spec]);

  // Filter out dropped or invisible elements: they are NOT rendered in the DOM
  const activeElements = useMemo(() => {
    return layout.elements.filter((el: ResolvedElement) => el.visible && el.status !== "dropped");
  }, [layout.elements]);

  return (
    <div
      data-testid="rendered-ad-container"
      role="region"
      aria-label={`Rendered Ad on ${surface.name}`}
      className={className}
      style={{
        position: "relative",
        width: `${surface.width}px`,
        height: `${surface.height}px`,
        maxWidth: `${surface.width}px`,
        maxHeight: `${surface.height}px`,
        overflow: "hidden",
        backgroundColor: "#090d16",
        color: "#ffffff",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        boxSizing: "border-box",
        userSelect: "none",
        ...style,
      }}
    >
      {activeElements.map((resolved: ResolvedElement) => {
        const specElem = specElementMap.get(resolved.id);
        const isHovered = hoveredElementId === resolved.id;
        const debugStyle = debugOutlines ? STATUS_OUTLINE_STYLES[resolved.status] : undefined;

        const containerStyle: CSSProperties = {
          position: "absolute",
          left: `${resolved.x}px`,
          top: `${resolved.y}px`,
          width: `${resolved.width}px`,
          height: `${resolved.height}px`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: isHovered ? "2px solid #38bdf8" : debugStyle?.border,
          boxShadow: isHovered ? "0 0 16px rgba(56, 189, 248, 0.5)" : "none",
          zIndex: isHovered ? 10 : 1,
          backgroundColor: isHovered ? "rgba(56, 189, 248, 0.12)" : debugStyle?.bg,
          borderRadius: resolved.type === "button" ? "8px" : "4px",
          transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: "pointer",
        };

        return (
          <div
            key={resolved.id}
            data-testid={`rendered-element-${resolved.id}`}
            data-element-id={resolved.id}
            data-status={resolved.status}
            data-role={resolved.role}
            style={containerStyle}
            onMouseEnter={() => onHoverElement?.(resolved.id)}
            onMouseLeave={() => onHoverElement?.(null)}
          >
            {/* TEXT ELEMENT */}
            {resolved.type === "text" && (
              <p
                style={{
                  margin: 0,
                  padding: 0,
                  width: "100%",
                  height: "100%",
                  fontSize: `${resolved.fontSize ?? 16}px`,
                  fontWeight: resolved.role === "hero" || resolved.role === "primary" ? 700 : 500,
                  lineHeight: 1.25,
                  textAlign: "center",
                  color: resolved.role === "secondary" ? "#94a3b8" : "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  wordBreak: "break-word",
                  overflow: "hidden",
                }}
              >
                {resolved.content ?? (specElem?.type === "text" ? specElem.content : "")}
              </p>
            )}

            {/* IMAGE ELEMENT */}
            {resolved.type === "image" && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    resolved.role === "hero"
                      ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
                      : "rgba(30, 41, 59, 0.6)",
                  borderRadius: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  overflow: "hidden",
                  padding: "4px",
                  boxSizing: "border-box",
                }}
              >
                {resolved.src ? (
                  <img
                    src={resolved.src}
                    alt={specElem?.type === "image" && specElem.alt ? specElem.alt : resolved.id}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      color: "#94a3b8",
                      fontSize: `${Math.max(10, Math.min(14, Math.round(resolved.height * 0.15)))}px`,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <span style={{ fontSize: "1.4em" }}>{resolved.role === "hero" ? "🖼️" : "🏷️"}</span>
                    <span>{resolved.id}</span>
                  </div>
                )}
              </div>
            )}

            {/* BUTTON / CTA ELEMENT */}
            {resolved.type === "button" && (
              <button
                type="button"
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: isHovered ? "#1d4ed8" : "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: `${resolved.fontSize ?? 16}px`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                  transition: "background-color 0.15s ease",
                  padding: "0 16px",
                  boxSizing: "border-box",
                }}
              >
                {resolved.label ?? (specElem?.type === "button" ? specElem.label : "Click Here")}
              </button>
            )}

            {/* DEBUG BADGE INDICATOR */}
            {debugOutlines && resolved.status !== "kept" && (
              <span
                style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-4px",
                  backgroundColor: debugStyle?.badge,
                  color: "#ffffff",
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  pointerEvents: "none",
                }}
              >
                {resolved.status}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RenderedAd;

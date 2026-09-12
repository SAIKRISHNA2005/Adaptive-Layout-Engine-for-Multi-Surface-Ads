// React DOM renderer that transforms resolved layout coordinates and element specs into interactive HTML/CSS components.

import { useEffect, useMemo, useState, type CSSProperties, type FC } from "react";
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

/** Status-specific debug outline styling mapping (subtle developer-tool treatment). */
const STATUS_OUTLINE_STYLES: Record<ElementStatus, { border: string; badge: string; bg: string }> = {
  kept: {
    border: "1px solid rgba(255, 255, 255, 0.04)",
    badge: "#3b82f6",
    bg: "transparent",
  },
  shrunk: {
    border: "1px dashed rgba(245, 158, 11, 0.3)",
    badge: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.02)",
  },
  repositioned: {
    border: "1px dashed rgba(6, 182, 212, 0.3)",
    badge: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.02)",
  },
  truncated: {
    border: "1px dashed rgba(168, 85, 247, 0.3)",
    badge: "#a855f7",
    bg: "rgba(168, 85, 247, 0.02)",
  },
  dropped: {
    border: "none",
    badge: "transparent",
    bg: "transparent",
  },
};

interface DisplayElementEntry {
  readonly resolved: ResolvedElement;
  readonly isExiting: boolean;
}

/**
 * Pure React DOM renderer that projects a ResolvedLayout onto absolute HTML/CSS elements.
 * Contains ZERO layout decision logic or media queries; consumes coordinates directly from layout IR.
 * Features lightweight 250ms CSS-driven spatial transitions and fade-in/fade-out animations on surface switch.
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

  // Display elements state tracks active elements and briefly retains exiting elements for fade-out transitions
  const [displayMap, setDisplayMap] = useState<Map<string, DisplayElementEntry>>(() => {
    const map = new Map<string, DisplayElementEntry>();
    for (const el of layout.elements) {
      if (el.visible && el.status !== "dropped") {
        map.set(el.id, { resolved: el, isExiting: false });
      }
    }
    return map;
  });

  useEffect(() => {
    const activeElements = layout.elements.filter((el) => el.visible && el.status !== "dropped");
    const activeIds = new Set(activeElements.map((el) => el.id));

    setDisplayMap((prev) => {
      const next = new Map<string, DisplayElementEntry>();

      // 1. Add all newly active or updating elements
      for (const el of activeElements) {
        next.set(el.id, { resolved: el, isExiting: false });
      }

      // 2. Retain previously visible elements that were dropped in this layout for a graceful 250ms fade-out
      for (const [id, prevItem] of prev) {
        if (!activeIds.has(id)) {
          next.set(id, {
            resolved: {
              ...prevItem.resolved,
              status: "dropped",
              visible: false,
            },
            isExiting: true,
          });
        }
      }

      return next;
    });

    // Remove exited elements after transition finishes
    const timer = setTimeout(() => {
      setDisplayMap((current) => {
        const cleaned = new Map<string, DisplayElementEntry>();
        for (const [id, item] of current) {
          if (!item.isExiting) {
            cleaned.set(id, item);
          }
        }
        return cleaned;
      });
    }, 260);

    return () => clearTimeout(timer);
  }, [layout]);

  const displayList = Array.from(displayMap.values());

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
        transition:
          "width 250ms cubic-bezier(0.4, 0, 0.2, 1), height 250ms cubic-bezier(0.4, 0, 0.2, 1), max-width 250ms cubic-bezier(0.4, 0, 0.2, 1), max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        ...style,
      }}
    >
      {displayList.map(({ resolved, isExiting }) => {
        const specElem = specElementMap.get(resolved.id);
        const isHovered = hoveredElementId === resolved.id;
        const debugStyle = debugOutlines ? STATUS_OUTLINE_STYLES[resolved.status] : undefined;

        const containerStyle: CSSProperties = {
          position: "absolute",
          left: `${resolved.x}px`,
          top: `${resolved.y}px`,
          width: `${resolved.width}px`,
          height: `${resolved.height}px`,
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? "scale(0.88)" : "scale(1)",
          pointerEvents: isExiting ? "none" : "auto",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: isHovered ? "2px solid #38bdf8" : debugStyle?.border,
          boxShadow: isHovered ? "0 0 16px rgba(56, 189, 248, 0.5)" : "none",
          zIndex: isHovered ? 10 : isExiting ? 0 : 1,
          backgroundColor: isHovered ? "rgba(56, 189, 248, 0.12)" : debugStyle?.bg,
          borderRadius: resolved.type === "button" ? "8px" : "4px",
          transition:
            "left 250ms cubic-bezier(0.4, 0, 0.2, 1), top 250ms cubic-bezier(0.4, 0, 0.2, 1), width 250ms cubic-bezier(0.4, 0, 0.2, 1), height 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease, transform 250ms cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease, box-shadow 0.15s ease",
          cursor: isExiting ? "default" : "pointer",
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
                  transition: "font-size 250ms cubic-bezier(0.4, 0, 0.2, 1)",
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
                  transition: "background-color 0.15s ease, font-size 250ms cubic-bezier(0.4, 0, 0.2, 1)",
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
                  top: "-7px",
                  right: "-3px",
                  backgroundColor: debugStyle?.badge,
                  color: "#ffffff",
                  fontSize: "8px",
                  fontWeight: 700,
                  padding: "1px 4px",
                  borderRadius: "3px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                  opacity: isHovered ? 1 : 0.6,
                  transition: "opacity 0.15s ease",
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

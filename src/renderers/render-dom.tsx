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
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.22) 0%, #080c14 75%)",
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
          borderRadius: resolved.type === "button" ? "10px" : "4px",
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
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  wordBreak: "break-word",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  boxSizing: "border-box",
                  transition: "font-size 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {resolved.id === "price-tag" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "4px 14px",
                      borderRadius: "9999px",
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#34d399",
                      fontWeight: 600,
                      fontSize: `${Math.max(11, resolved.fontSize ?? 14)}px`,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.15)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        boxShadow: "0 0 6px #10b981",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {resolved.content ?? (specElem?.type === "text" ? specElem.content : "")}
                    </span>
                  </span>
                ) : (
                  <span
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: Math.max(1, Math.floor(resolved.height / ((resolved.fontSize ?? 16) * 1.25))),
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      letterSpacing: resolved.role === "primary" ? "-0.015em" : "normal",
                      maxWidth: "100%",
                    }}
                  >
                    {resolved.content ?? (specElem?.type === "text" ? specElem.content : "")}
                  </span>
                )}
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
                      ? "radial-gradient(ellipse at center, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)"
                      : "transparent",
                  borderRadius: resolved.role === "hero" ? "12px" : "6px",
                  border: resolved.role === "hero" ? "1px solid rgba(255, 255, 255, 0.08)" : "none",
                  overflow: "hidden",
                  padding: resolved.role === "hero" ? "6px" : "2px",
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
                ) : resolved.role === "branding" || resolved.id === "brand-logo" || resolved.id === "logo" ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                    }}
                  >
                    <svg
                      width={Math.min(22, Math.max(14, Math.round(resolved.height * 0.5)))}
                      height={Math.min(22, Math.max(14, Math.round(resolved.height * 0.5)))}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ flexShrink: 0 }}
                    >
                      <path
                        d="M3 10v4M7 6v12M11 3v18M15 7v10M19 11v2"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span
                      style={{
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        fontSize: `${Math.min(12, Math.max(9, Math.round(resolved.height * 0.34)))}px`,
                        color: "#f8fafc",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Aero<span style={{ color: "#38bdf8" }}>Tune</span>
                    </span>
                  </div>
                ) : (
                  <svg
                    viewBox="0 0 300 240"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      width: "100%",
                      height: "100%",
                      maxHeight: "100%",
                      filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.5))",
                    }}
                  >
                    <path
                      d="M60 140 C 60 40, 240 40, 240 140"
                      stroke="url(#headbandGrad)"
                      strokeWidth="16"
                      strokeLinecap="round"
                    />
                    <path
                      d="M72 135 C 72 58, 228 58, 228 135"
                      stroke="#1e293b"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <rect x="52" y="125" width="16" height="24" rx="4" fill="#94a3b8" />
                    <rect x="232" y="125" width="16" height="24" rx="4" fill="#94a3b8" />
                    <g transform="rotate(-10 55 160)">
                      <ellipse cx="55" cy="165" rx="34" ry="46" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                      <ellipse cx="55" cy="165" rx="26" ry="36" fill="#1e293b" />
                      <ellipse cx="55" cy="165" rx="16" ry="24" fill="#090d16" />
                      <circle cx="55" cy="165" r="8" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    </g>
                    <g transform="rotate(10 245 160)">
                      <ellipse cx="245" cy="165" rx="34" ry="46" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                      <ellipse cx="245" cy="165" rx="26" ry="36" fill="#1e293b" />
                      <ellipse cx="245" cy="165" rx="16" ry="24" fill="#090d16" />
                      <circle cx="245" cy="165" r="8" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    </g>
                    <circle cx="150" cy="150" r="70" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1.5" strokeDasharray="6 6" />
                    <circle cx="150" cy="150" r="95" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" strokeDasharray="4 8" />
                    <defs>
                      <linearGradient id="headbandGrad" x1="60" y1="40" x2="240" y2="40" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#334155" />
                        <stop offset="50%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#334155" />
                      </linearGradient>
                    </defs>
                  </svg>
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
                  background: isHovered
                    ? "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)"
                    : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: `${resolved.fontSize ?? 15}px`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: isHovered
                    ? "0 6px 20px rgba(37, 99, 235, 0.5), inset 0 1px 0 rgba(255,255,255,0.25)"
                    : "0 4px 14px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                  transform: isHovered ? "translateY(-1px)" : "none",
                  transition: "all 0.15s ease",
                  padding: "0 16px",
                  boxSizing: "border-box",
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {resolved.label ?? (specElem?.type === "button" ? specElem.label : "Click Here")}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    transition: "transform 0.15s ease",
                    transform: isHovered ? "translateX(2px)" : "none",
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
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

// React component wrapper for HTML5 Canvas ad rendering.
// Subscribes to layout changes and calls renderToCanvas inside a reactive useEffect hook.

import React, { useEffect, useRef, type CSSProperties } from "react";
import { type AdSpec, type ResolvedLayout, type SurfaceProfile } from "../core/types";
import { renderToCanvas } from "./render-canvas";

/** Props for CanvasAd React component. */
export interface CanvasAdProps {
  /** Resolved layout containing positioned elements. */
  readonly layout: ResolvedLayout;
  /** Surface profile defining canvas width and height. */
  readonly surface: SurfaceProfile;
  /** Ad specification containing text copy and assets. */
  readonly spec: AdSpec;
  /** Optional custom CSS class. */
  readonly className?: string;
  /** Optional canvas element style overrides. */
  readonly style?: CSSProperties;
}

/**
 * CanvasAd component that renders a native <canvas> element using the 2D canvas renderer.
 * Demonstrates renderer independence: takes the exact same layout IR as RenderedAd with zero resolver re-computation.
 */
export const CanvasAd: React.FC<CanvasAdProps> = ({
  layout,
  surface,
  spec,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      // In headless test environments like jsdom without the native canvas package, getContext throws
      return;
    }
    if (!ctx) return;

    renderToCanvas(ctx, layout, spec);
  }, [layout, spec]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas-ad-element"
      width={surface.width}
      height={surface.height}
      aria-label={`Canvas Rendered Ad on ${surface.name}`}
      className={className}
      style={{
        display: "block",
        width: `${surface.width}px`,
        height: `${surface.height}px`,
        maxWidth: `${surface.width}px`,
        maxHeight: `${surface.height}px`,
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "#090d16",
        boxSizing: "border-box",
        userSelect: "none",
        ...style,
      }}
    />
  );
};

export default CanvasAd;

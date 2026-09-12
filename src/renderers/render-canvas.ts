// Pure HTML5 Canvas 2D renderer projecting ResolvedLayout onto a canvas context.
// Proves renderer independence: consumes only ResolvedLayout and AdSpec with zero resolver dependencies.

import {
  type AdElement,
  type AdSpec,
  type ResolvedLayout,
} from "../core/types";

/**
 * Pure rendering function that draws a ResolvedLayout onto an HTML5 Canvas 2D context.
 * Does not import resolver.ts or perform any layout calculations.
 *
 * @param ctx - The target Canvas 2D rendering context.
 * @param layout - The resolved layout IR with absolute coordinates.
 * @param spec - The declarative ad specification for element copy and semantics.
 */
export function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  layout: ResolvedLayout,
  spec: AdSpec,
): void {
  // Clear canvas surface and draw dark canvas background
  const width = ctx.canvas ? ctx.canvas.width : 0;
  const height = ctx.canvas ? ctx.canvas.height : 0;

  if (width > 0 && height > 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);
  }

  // Create semantic element lookup map from spec
  const specElementMap = new Map<string, AdElement>();
  for (const elem of spec.elements) {
    specElementMap.set(elem.id, elem);
  }

  // Draw active elements in sequence, skipping dropped and invisible elements
  for (const resolved of layout.elements) {
    if (!resolved.visible || resolved.status === "dropped") {
      continue;
    }

    const specElem = specElementMap.get(resolved.id);

    ctx.save();

    if (resolved.type === "text") {
      const text = resolved.content ?? (specElem?.type === "text" ? specElem.content : "");
      const fontSize = resolved.fontSize ?? 16;
      const fontWeight = resolved.role === "hero" || resolved.role === "primary" ? "700" : "500";
      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = resolved.role === "secondary" ? "#94a3b8" : "#f8fafc";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Word wrapping logic for canvas
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth =
          typeof ctx.measureText === "function"
            ? ctx.measureText(testLine).width
            : testLine.length * fontSize * 0.58;

        if (testWidth <= resolved.width || !currentLine) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      if (lines.length <= 1) {
        ctx.fillText(text, resolved.x + resolved.width / 2, resolved.y + resolved.height / 2);
      } else {
        const lineHeight = fontSize * 1.25;
        const totalBlockHeight = lines.length * lineHeight;
        const startY = resolved.y + (resolved.height - totalBlockHeight) / 2 + lineHeight / 2;
        lines.forEach((line, index) => {
          ctx.fillText(line, resolved.x + resolved.width / 2, startY + index * lineHeight);
        });
      }
    } else if (resolved.type === "image") {
      // Draw image placeholder container
      ctx.fillStyle = resolved.role === "hero" ? "#1e293b" : "rgba(30, 41, 59, 0.6)";
      ctx.fillRect(resolved.x, resolved.y, resolved.width, resolved.height);

      // Subtle container border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(resolved.x, resolved.y, resolved.width, resolved.height);

      // Placeholder icon and ID label
      ctx.fillStyle = "#94a3b8";
      const labelFontSize = Math.max(10, Math.min(14, Math.round(resolved.height * 0.15)));
      ctx.font = `600 ${labelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = resolved.role === "hero" ? "🖼️ " : "🏷️ ";
      ctx.fillText(`${icon}${resolved.id}`, resolved.x + resolved.width / 2, resolved.y + resolved.height / 2);
    } else if (resolved.type === "button") {
      // Draw rounded button container
      const radius = 8;
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(resolved.x, resolved.y, resolved.width, resolved.height, radius);
      } else {
        ctx.rect(resolved.x, resolved.y, resolved.width, resolved.height);
      }
      ctx.fill();

      // Button label
      const label = resolved.label ?? (specElem?.type === "button" ? specElem.label : "Click Here");
      const fontSize = resolved.fontSize ?? 16;
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, resolved.x + resolved.width / 2, resolved.y + resolved.height / 2);
    }

    ctx.restore();
  }
}

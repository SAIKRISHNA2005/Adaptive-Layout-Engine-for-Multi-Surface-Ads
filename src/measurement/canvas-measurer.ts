// Canvas 2D text metric measurement engine using measureText() on an off-screen canvas.

import {
  type TextMeasurer,
  type TextMeasurementInput,
  type TextMeasurementResult,
  EstimateTextMeasurer,
} from "./text-measurer";

/**
 * Text measurer implementation utilizing HTML5 Canvas measureText() API.
 * Demonstrates the polymorphic pluggability of the TextMeasurer interface.
 */
export class CanvasTextMeasurer implements TextMeasurer {
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private readonly fallbackMeasurer: EstimateTextMeasurer;

  constructor() {
    this.fallbackMeasurer = new EstimateTextMeasurer();
  }

  /**
   * Lazily initializes and reuses an off-screen CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.
   */
  private getContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    if (this.ctx) {
      return this.ctx;
    }

    // Try OffscreenCanvas if available in modern browser/worker environments
    if (typeof OffscreenCanvas !== "undefined") {
      try {
        const offscreen = new OffscreenCanvas(400, 200);
        const ctx = offscreen.getContext("2d");
        if (ctx) {
          this.ctx = ctx;
          return this.ctx;
        }
      } catch {
        // Fall back to standard document canvas
      }
    }

    // Fall back to DOM canvas element
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 200;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          this.ctx = ctx;
          return this.ctx;
        }
      } catch {
        // Fall back to EstimateTextMeasurer
      }
    }

    return null;
  }

  /**
   * Measures precise text bounding metrics using ctx.measureText().
   *
   * @param input - The text, font size, and optional max width constraint.
   * @returns Computed width, height, and line count.
   */
  measure(input: TextMeasurementInput): TextMeasurementResult {
    const { text, fontSize, maxWidth } = input;

    if (!text || text.length === 0) {
      return { width: 0, height: 0, lines: 0 };
    }

    const ctx = this.getContext();
    if (!ctx || typeof ctx.measureText !== "function") {
      return this.fallbackMeasurer.measure(input);
    }

    // Configure standard font on canvas context
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    let metrics: TextMetrics;
    try {
      metrics = ctx.measureText(text);
    } catch {
      return this.fallbackMeasurer.measure(input);
    }

    // Headless / mock fallback check: if canvas returns 0 for non-empty text
    if (!metrics || (metrics.width === 0 && text.length > 0)) {
      return this.fallbackMeasurer.measure(input);
    }

    const singleLineWidth = Math.ceil(metrics.width);
    const lineHeight = Math.ceil(fontSize * 1.25);

    // No wrapping needed if width is unconstrained or text fits within maxWidth
    if (!maxWidth || maxWidth <= 0 || singleLineWidth <= maxWidth) {
      return {
        width: singleLineWidth,
        height: lineHeight,
        lines: 1,
      };
    }

    // Multi-line greedy word wrapping using measureText
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return { width: 0, height: lineHeight, lines: 1 };
    }

    let lineCount = 1;
    let currentLine = "";
    let maxLineWidth = 0;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= maxWidth) {
        currentLine = testLine;
        maxLineWidth = Math.max(maxLineWidth, testWidth);
      } else {
        if (currentLine) {
          lineCount++;
          currentLine = word;
          maxLineWidth = Math.max(maxLineWidth, ctx.measureText(word).width);
        } else {
          maxLineWidth = Math.max(maxLineWidth, testWidth);
          currentLine = word;
        }
      }
    }

    return {
      width: Math.min(maxWidth, Math.ceil(maxLineWidth)),
      height: Math.ceil(lineCount * lineHeight),
      lines: lineCount,
    };
  }
}

/** Global singleton instance for Canvas text measurement. */
export const canvasTextMeasurer = new CanvasTextMeasurer();

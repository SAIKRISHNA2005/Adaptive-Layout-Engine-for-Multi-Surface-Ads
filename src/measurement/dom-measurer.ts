// Real DOM-based text metric measurement using an off-screen container element.

import {
  type TextMeasurer,
  type TextMeasurementInput,
  type TextMeasurementResult,
  EstimateTextMeasurer,
} from "./text-measurer";

/**
 * DOM-based text measurement engine implementing the TextMeasurer interface.
 * Uses a single reused off-screen DOM element to measure actual browser typographic rendering,
 * word wrapping, and multi-line bounding heights via getBoundingClientRect().
 */
export class DOMTextMeasurer implements TextMeasurer {
  private measurerElement: HTMLElement | null = null;
  private readonly fallbackMeasurer: EstimateTextMeasurer;

  constructor() {
    this.fallbackMeasurer = new EstimateTextMeasurer();
  }

  /**
   * Lazily initializes and attaches the single reused off-screen measurement element.
   */
  private getOrCreateElement(): HTMLElement | null {
    if (this.measurerElement && this.measurerElement.isConnected) {
      return this.measurerElement;
    }

    if (typeof document === "undefined" || !document.body) {
      return null;
    }

    const el = document.createElement("div");
    el.setAttribute("data-testid", "dom-measurer-container");
    el.setAttribute("aria-hidden", "true");

    el.style.position = "absolute";
    el.style.visibility = "hidden";
    el.style.top = "-9999px";
    el.style.left = "-9999px";
    el.style.pointerEvents = "none";
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.border = "none";
    el.style.lineHeight = "1.25";
    el.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    el.style.boxSizing = "border-box";
    el.style.wordBreak = "break-word";
    el.style.overflowWrap = "break-word";

    document.body.appendChild(el);
    this.measurerElement = el;
    return el;
  }

  /**
   * Measures precise bounding dimensions and line wrapping for the given text copy.
   *
   * @param input - The text measurement parameters.
   * @returns Computed width, height, and line count.
   */
  measure(input: TextMeasurementInput): TextMeasurementResult {
    const { text, fontSize, maxWidth } = input;

    if (!text || text.length === 0) {
      return { width: 0, height: 0, lines: 0 };
    }

    const container = this.getOrCreateElement();
    if (!container) {
      return this.fallbackMeasurer.measure(input);
    }

    // Configure text and font sizing on the reused element
    container.textContent = text;
    container.style.fontSize = `${fontSize}px`;
    container.style.fontWeight = input.fontWeight ? String(input.fontWeight) : "400";
    container.style.lineHeight = "1.3";

    if (maxWidth && maxWidth > 0) {
      container.style.width = `${maxWidth}px`;
      container.style.maxWidth = `${maxWidth}px`;
      container.style.whiteSpace = "normal";
    } else {
      container.style.width = "auto";
      container.style.maxWidth = "none";
      container.style.whiteSpace = "nowrap";
    }

    // Measure live geometry via getBoundingClientRect()
    const rect = container.getBoundingClientRect();
    let width = Math.ceil(rect.width);
    let height = Math.ceil(rect.height);

    // Headless / jsdom layout engine fallback:
    // In pure jsdom without canvas/layout rendering, getBoundingClientRect returns 0x0.
    if (width === 0 && text.length > 0) {
      const charWidthRatio = 0.58;
      const charWidth = fontSize * charWidthRatio;
      const unwrappedWidth = Math.ceil(text.length * charWidth);

      if (maxWidth && maxWidth > 0 && unwrappedWidth > maxWidth) {
        const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
        const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
        width = Math.min(maxWidth, unwrappedWidth);
        height = Math.ceil(lines * fontSize * 1.25);
        return { width, height, lines };
      }

      const lines = 1;
      width = unwrappedWidth;
      height = Math.ceil(fontSize * 1.25);
      return { width, height, lines };
    }

    const singleLineHeight = fontSize * 1.25;
    const lines = Math.max(1, Math.round(height / singleLineHeight));

    return {
      width,
      height,
      lines,
    };
  }

  /** Removes the measurement container from the DOM if attached. */
  destroy(): void {
    if (this.measurerElement && this.measurerElement.parentNode) {
      this.measurerElement.parentNode.removeChild(this.measurerElement);
      this.measurerElement = null;
    }
  }
}

/** Global singleton instance for browser application consumption. */
export const domTextMeasurer = new DOMTextMeasurer();

// Precise text metric calculation and wrapping simulation for font size and bounding box estimation.

/** Input parameters for measuring text dimensions. */
export interface TextMeasurementInput {
  /** Text content string to measure. */
  readonly text: string;
  /** Font size in pixels. */
  readonly fontSize: number;
  /** Optional maximum container width to constrain line wrapping. */
  readonly maxWidth?: number;
  /** Optional font weight (e.g. 700 for bold, 400 for normal) affecting glyph advance widths. */
  readonly fontWeight?: string | number;
}

/** Result metrics computed from text measurement. */
export interface TextMeasurementResult {
  /** Computed width of the rendered text bounding box in pixels. */
  readonly width: number;
  /** Computed height of the rendered text bounding box in pixels. */
  readonly height: number;
  /** Number of wrapped lines. */
  readonly lines: number;
}

/** Framework-agnostic interface for calculating text metrics and line wrapping boundaries. */
export interface TextMeasurer {
  /**
   * Measures bounding dimensions and line wrapping for the provided text and font size.
   *
   * @param input - Text content, font size, and optional max container width.
   * @returns Computed width, height, and line count.
   */
  measure(input: TextMeasurementInput): TextMeasurementResult;
}

/**
 * Fast, deterministic text measurer using standard typographic glyph aspect ratios.
 * Suitable for headless environments, automated testing, and offline layout simulation.
 */
export class EstimateTextMeasurer implements TextMeasurer {
  /** Average glyph advance width ratio relative to font size (approx 0.58 for standard sans-serif). */
  private readonly avgCharWidthRatio: number;
  /** Standard line height multiplier relative to font size (default 1.3). */
  private readonly lineHeightMultiplier: number;

  constructor(avgCharWidthRatio = 0.58, lineHeightMultiplier = 1.3) {
    this.avgCharWidthRatio = avgCharWidthRatio;
    this.lineHeightMultiplier = lineHeightMultiplier;
  }

  /**
   * Computes estimated bounding box and word-wrapping for text.
   *
   * @param input - The text measurement parameters.
   * @returns Bounding box width, height, and total line count.
   */
  measure(input: TextMeasurementInput): TextMeasurementResult {
    const { text, fontSize, maxWidth } = input;
    if (!text || text.length === 0) {
      return { width: 0, height: 0, lines: 0 };
    }

    const singleLineHeight = Math.ceil(fontSize * this.lineHeightMultiplier);
    const isBold = input.fontWeight === 700 || input.fontWeight === "bold" || input.fontWeight === "700";
    const weightFactor = isBold ? 1.08 : 1.0;
    const avgCharWidth = fontSize * this.avgCharWidthRatio * weightFactor;

    // If no maxWidth is specified or maxWidth is infinite, treat as single line
    if (!maxWidth || maxWidth <= 0) {
      const singleLineWidth = Math.ceil(text.length * avgCharWidth);
      return {
        width: singleLineWidth,
        height: singleLineHeight,
        lines: 1,
      };
    }

    // Word-wrap simulation
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return { width: 0, height: singleLineHeight, lines: 1 };
    }

    let currentLineWidth = 0;
    let maxEncounteredWidth = 0;
    let lineCount = 1;
    const spaceWidth = avgCharWidth * 0.8;

    for (const word of words) {
      const wordWidth = word.length * avgCharWidth;

      if (currentLineWidth === 0) {
        currentLineWidth = wordWidth;
      } else if (currentLineWidth + spaceWidth + wordWidth <= maxWidth) {
        currentLineWidth += spaceWidth + wordWidth;
      } else {
        // Wrap to next line
        maxEncounteredWidth = Math.max(maxEncounteredWidth, currentLineWidth);
        lineCount++;
        currentLineWidth = wordWidth;
      }
    }

    maxEncounteredWidth = Math.min(maxWidth, Math.max(maxEncounteredWidth, currentLineWidth));
    const totalHeight = lineCount * singleLineHeight;

    return {
      width: Math.ceil(maxEncounteredWidth),
      height: Math.ceil(totalHeight),
      lines: lineCount,
    };
  }
}

/** Default shared instance of EstimateTextMeasurer. */
export const defaultTextMeasurer: TextMeasurer = new EstimateTextMeasurer();

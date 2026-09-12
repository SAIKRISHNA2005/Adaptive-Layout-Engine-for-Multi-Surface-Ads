// Hard and soft constraint evaluation rules including WCAG contrast ratios, safe area insets, and tap targets.

/**
 * Converts a hex color string (#rgb, #rrggbb, #rrggbbaa) or rgb(r, g, b) string into [r, g, b] in [0, 255].
 *
 * @param color - Raw CSS color string.
 * @returns Array of [red, green, blue] channels.
 */
export function parseColorToRgb(color: string): [number, number, number] {
  const trimmed = color.trim().toLowerCase();

  // Handle hex format (#fff or #ffffff)
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b];
    }
  }

  // Handle rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (
    rgbMatch &&
    rgbMatch[1] !== undefined &&
    rgbMatch[2] !== undefined &&
    rgbMatch[3] !== undefined
  ) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }

  // Default fallback (black)
  return [0, 0, 0];
}

/**
 * Converts an 8-bit sRGB color channel into linear RGB per WCAG 2.1 specifications.
 * Formula: val <= 0.04045 ? val / 12.92 : ((val + 0.055) / 1.055) ^ 2.4
 */
function sRgbToLinear(val: number): number {
  const s = val / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculates WCAG 2.1 relative luminance from RGB components in [0, 255].
 * Formula: L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
 *
 * @param r - Red channel [0, 255].
 * @param g - Green channel [0, 255].
 * @param b - Blue channel [0, 255].
 * @returns Relative luminance in [0, 1].
 */
export function calculateRelativeLuminance(r: number, g: number, b: number): number {
  const rLin = sRgbToLinear(r);
  const gLin = sRgbToLinear(g);
  const bLin = sRgbToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Computes the exact WCAG 2.1 contrast ratio between two colors using relative luminance.
 * Formula: (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter luminance and L2 is the darker.
 *
 * @param fg - Foreground color (e.g. text color "#ffffff").
 * @param bg - Background color (e.g. button background "#2563eb").
 * @returns Contrast ratio rounded to 2 decimal places (between 1.0 and 21.0).
 */
export function computeContrastRatio(fg: string, bg: string): number {
  const [r1, g1, b1] = parseColorToRgb(fg);
  const [r2, g2, b2] = parseColorToRgb(bg);

  const lum1 = calculateRelativeLuminance(r1, g1, b1);
  const lum2 = calculateRelativeLuminance(r2, g2, b2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

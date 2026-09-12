// Unit tests verifying accessibility constraints, relative luminance, and WCAG contrast ratio calculations.

import { describe, it, expect } from "vitest";
import {
  computeContrastRatio,
  calculateRelativeLuminance,
  parseColorToRgb,
} from "../src/core/constraints";
import { retailKiosk, mobilePortrait, broadcastLowerThird } from "../src/core/surfaces";

describe("Accessibility & Contrast Ratio Constraints (Phase 14)", () => {
  it("computes exact relative luminance according to WCAG 2.1 specs", () => {
    // Pure black has 0 luminance
    expect(calculateRelativeLuminance(0, 0, 0)).toBeCloseTo(0, 5);

    // Pure white has 1.0 luminance
    expect(calculateRelativeLuminance(255, 255, 255)).toBeCloseTo(1, 5);

    // Pure green contributes the highest human perceptual luminance (0.7152)
    const greenLum = calculateRelativeLuminance(0, 255, 0);
    expect(greenLum).toBeCloseTo(0.7152, 3);
  });

  it("correctly parses 3-digit and 6-digit hex codes and rgb strings", () => {
    expect(parseColorToRgb("#fff")).toEqual([255, 255, 255]);
    expect(parseColorToRgb("#000000")).toEqual([0, 0, 0]);
    expect(parseColorToRgb("#2563eb")).toEqual([37, 99, 235]);
    expect(parseColorToRgb("rgb(10, 20, 30)")).toEqual([10, 20, 30]);
  });

  it("computes WCAG contrast ratio accurately across color pairs", () => {
    // White on black is maximum 21.0:1
    expect(computeContrastRatio("#ffffff", "#000000")).toBe(21.0);
    expect(computeContrastRatio("#000000", "#ffffff")).toBe(21.0);

    // Identical colors have minimum 1.0:1 ratio
    expect(computeContrastRatio("#ffffff", "#ffffff")).toBe(1.0);
    expect(computeContrastRatio("#123456", "#123456")).toBe(1.0);

    // Primary CTA button: white text (#ffffff) on blue button (#2563eb)
    const ctaRatio = computeContrastRatio("#ffffff", "#2563eb");
    expect(ctaRatio).toBeGreaterThanOrEqual(4.5); // Satisfies WCAG AA normal text threshold
    expect(ctaRatio).toBeCloseTo(5.21, 1);
  });

  it("verifies retailKiosk surface contains first-class accessibility constraints matching assignment specs", () => {
    expect(retailKiosk.accessibility).toBeDefined();
    expect(retailKiosk.accessibility?.minTapTarget).toBe(60);
    expect(retailKiosk.accessibility?.touchOnly).toBe(true);
    expect(retailKiosk.accessibility?.minContrastRatio).toBe(4.5);

    // Backward compatibility mirrors also maintained
    expect(retailKiosk.minTapTarget).toBe(60);
    expect(retailKiosk.touchOnly).toBe(true);
  });

  it("verifies mobile and broadcast surfaces expose explicit accessibility constraints", () => {
    expect(mobilePortrait.accessibility?.minTapTarget).toBe(44);
    expect(mobilePortrait.accessibility?.touchOnly).toBe(true);
    expect(mobilePortrait.accessibility?.minContrastRatio).toBe(4.5);

    expect(broadcastLowerThird.accessibility?.touchOnly).toBe(false);
    expect(broadcastLowerThird.accessibility?.minContrastRatio).toBe(4.5);
  });
});

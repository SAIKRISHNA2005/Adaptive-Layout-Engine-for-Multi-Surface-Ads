// Unit and integration tests for core constraint-based spatial resolution across diverse aspect ratios.
import { describe, it, expect } from "vitest";
import { defineAd } from "../src/core/spec";
import {
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
} from "../src/core/surfaces";
import { resolve, resolveWithDiagnostics } from "../src/core/resolver";
import { computeOverlap, computeClipping, rectsOverlap } from "../src/core/scoring";
import { EstimateTextMeasurer, type TextMeasurer } from "../src/measurement/text-measurer";
import { type ResolvedElement, type ResolvedLayout } from "../src/core/types";

describe("Constraint Resolver (Phase 4a - Measurement & Happy-Path Placement)", () => {
  const sampleSpec = defineAd({
    id: "promo-banner",
    elements: [
      { id: "headline", type: "text", role: "primary", priority: 1, content: "Flash Summer Sale" },
      { id: "hero-img", type: "image", role: "hero", priority: 1, aspectRatio: 1.6, preferredWidth: 200, preferredHeight: 120 },
      { id: "cta-btn", type: "button", role: "action", priority: 2, label: "Shop Now", minTapTarget: 44 },
    ],
  });

  it("resolves elements within bounds and without overlap on mobilePortrait", () => {
    const layout = resolve(sampleSpec, mobilePortrait);

    expect(layout.surfaceId).toBe("mobilePortrait");
    expect(layout.elements).toHaveLength(3);
    expect(layout.metrics.overlapCount).toBe(0);
    expect(layout.metrics.clippingCount).toBe(0);
    expect(layout.metrics.hardViolations).toBe(0);

    for (const el of layout.elements) {
      expect(el.status).toBe("kept");
      expect(el.visible).toBe(true);
      expect(el.x).toBeGreaterThanOrEqual(mobilePortrait.safeArea?.left ?? 0);
      expect(el.y).toBeGreaterThanOrEqual(mobilePortrait.safeArea?.top ?? 0);
      expect(el.x + el.width).toBeLessThanOrEqual(mobilePortrait.width);
      expect(el.y + el.height).toBeLessThanOrEqual(mobilePortrait.height);
    }
  });

  it("resolves elements within bounds and without overlap on retailKiosk (1080x1080)", () => {
    const layout = resolve(sampleSpec, retailKiosk);

    expect(layout.surfaceId).toBe("retailKiosk");
    expect(layout.elements).toHaveLength(3);
    expect(layout.metrics.overlapCount).toBe(0);
    expect(layout.metrics.clippingCount).toBe(0);

    const cta = layout.elements.find((el) => el.id === "cta-btn");
    expect(cta).toBeDefined();
    expect(cta?.height).toBeGreaterThanOrEqual(retailKiosk.minTapTarget ?? 60);
  });

  it("resolves elements within bounds on mobileLandscape", () => {
    const layout = resolve(sampleSpec, mobileLandscape);

    expect(layout.surfaceId).toBe("mobileLandscape");
    expect(layout.elements).toHaveLength(3);
    expect(layout.metrics.overlapCount).toBe(0);
    expect(layout.metrics.clippingCount).toBe(0);
  });

  it("resolves elements and clamps text size on broadcastLowerThird", () => {
    const layout = resolve(sampleSpec, broadcastLowerThird);

    expect(layout.surfaceId).toBe("broadcastLowerThird");
    expect(layout.elements).toHaveLength(3);

    const headline = layout.elements.find((el) => el.id === "headline");
    expect(headline).toBeDefined();
    expect(headline?.fontSize).toBeGreaterThanOrEqual(broadcastLowerThird.minTextSize ?? 32);
  });

  it("accepts a custom TextMeasurer implementation", () => {
    const customMeasurer: TextMeasurer = {
      measure: () => ({ width: 150, height: 40, lines: 1 }),
    };

    const layout = resolve(sampleSpec, mobilePortrait, { textMeasurer: customMeasurer });
    const headline = layout.elements.find((el) => el.id === "headline");
    expect(headline?.width).toBe(150);
    expect(headline?.height).toBe(40);
  });
});

describe("Scoring Geometry Utilities", () => {
  it("rectsOverlap detects collisions accurately", () => {
    const a = { x: 10, y: 10, width: 50, height: 50 };
    const b = { x: 40, y: 40, width: 50, height: 50 }; // Overlaps [40..60] in x and y
    const c = { x: 100, y: 100, width: 50, height: 50 }; // Completely disjoint

    expect(rectsOverlap(a, b)).toBe(true);
    expect(rectsOverlap(a, c)).toBe(false);
    expect(rectsOverlap(b, c)).toBe(false);
  });

  it("computeOverlap counts pairwise overlapping elements in a layout", () => {
    const nonOverlappingElements: ResolvedElement[] = [
      { id: "e1", type: "text", role: "primary", priority: 1, x: 0, y: 0, width: 100, height: 30, status: "kept", decisions: [], visible: true },
      { id: "e2", type: "text", role: "secondary", priority: 2, x: 0, y: 40, width: 100, height: 30, status: "kept", decisions: [], visible: true },
    ];

    expect(computeOverlap(nonOverlappingElements)).toBe(0);

    const overlappingElements: ResolvedElement[] = [
      { id: "e1", type: "text", role: "primary", priority: 1, x: 0, y: 0, width: 100, height: 50, status: "kept", decisions: [], visible: true },
      { id: "e2", type: "text", role: "secondary", priority: 2, x: 0, y: 20, width: 100, height: 50, status: "kept", decisions: [], visible: true },
    ];

    expect(computeOverlap(overlappingElements)).toBe(1);
  });

  it("computeClipping detects out-of-boundary elements", () => {
    const surface = mobilePortrait; // 320 x 480

    const layoutInBounds: ResolvedLayout = {
      surfaceId: surface.id,
      dimensions: { width: 320, height: 480 },
      elements: [
        { id: "e1", type: "text", role: "primary", priority: 1, x: 20, y: 20, width: 280, height: 40, status: "kept", decisions: [], visible: true },
      ],
      metrics: { durationMs: 1, hardViolations: 0, overlapCount: 0, clippingCount: 0 },
    };

    expect(computeClipping(layoutInBounds, surface)).toBe(0);

    const layoutClipped: ResolvedLayout = {
      surfaceId: surface.id,
      dimensions: { width: 320, height: 480 },
      elements: [
        { id: "e1", type: "text", role: "primary", priority: 1, x: 200, y: 20, width: 200, height: 40, status: "kept", decisions: [], visible: true }, // x+w = 400 > 320
        { id: "e2", type: "text", role: "secondary", priority: 2, x: 20, y: 460, width: 100, height: 50, status: "kept", decisions: [], visible: true }, // y+h = 510 > 480
      ],
      metrics: { durationMs: 1, hardViolations: 2, overlapCount: 0, clippingCount: 2 },
    };

    expect(computeClipping(layoutClipped, surface)).toBe(2);
  });

  it("EstimateTextMeasurer simulates word-wrapping and line heights properly", () => {
    const measurer = new EstimateTextMeasurer(0.6, 1.25);
    const shortText = measurer.measure({ text: "Hello", fontSize: 20 });
    expect(shortText.lines).toBe(1);
    expect(shortText.height).toBe(25);
    expect(shortText.width).toBe(60);

    const wrappedText = measurer.measure({
      text: "The quick brown fox jumps over the lazy dog and runs away",
      fontSize: 20,
      maxWidth: 200,
    });
    expect(wrappedText.lines).toBeGreaterThan(1);
    expect(wrappedText.width).toBeLessThanOrEqual(200);
  });
});

describe("Adversarial Edge Cases (Phase 18 - Review Hunting)", () => {
  it("resolves two elements with identical preferred positions without overlap", () => {
    const identicalPosSpec = defineAd({
      id: "identical-pos-spec",
      elements: [
        { id: "heading-1", type: "text", role: "primary", priority: 1, content: "Primary Headline" },
        { id: "heading-2", type: "text", role: "primary", priority: 1, content: "Duplicate Priority Headline" },
      ],
    });

    const result = resolveWithDiagnostics(identicalPosSpec, mobilePortrait);
    expect(result.diagnostics.summary.overlaps).toBe(0);
    expect(result.diagnostics.summary.clipping).toBe(0);
    expect(result.layout.elements).toHaveLength(2);

    const [e1, e2] = result.layout.elements;
    expect(rectsOverlap(e1!, e2!)).toBe(false);
  });

  it("clamps an element with preferredWidth larger than the entire surface to safe bounds without clipping", () => {
    const oversizedSpec = defineAd({
      id: "oversized-spec",
      elements: [
        {
          id: "huge-image",
          type: "image",
          role: "hero",
          priority: 1,
          preferredWidth: 3200, // 10x larger than 320px mobile portrait
          preferredHeight: 1800,
          aspectRatio: 1.777,
        },
      ],
    });

    const result = resolveWithDiagnostics(oversizedSpec, mobilePortrait);
    expect(result.diagnostics.summary.clipping).toBe(0);
    const hero = result.layout.elements.find((e) => e.id === "huge-image");
    expect(hero).toBeDefined();
    expect(hero!.width).toBeLessThanOrEqual(mobilePortrait.width);
    expect(hero!.x + hero!.width).toBeLessThanOrEqual(mobilePortrait.width);
  });

  it("handles a spec with zero droppable elements under extreme spatial starvation without crashing", () => {
    const nonDroppableSpec = defineAd({
      id: "strict-spec",
      elements: [
        { id: "strict-1", type: "text", role: "primary", priority: 1, content: "Must Keep Title", canDrop: false },
        { id: "strict-2", type: "button", role: "action", priority: 1, label: "Must Keep Button", canDrop: false, minTapTarget: 44 },
      ],
    });

    // Tiny 40x40 surface where a 44px button physically cannot fit without violation
    const microSurface = {
      id: "micro-screen",
      name: "Micro Screen",
      width: 40,
      height: 40,
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    };

    const result = resolveWithDiagnostics(nonDroppableSpec, microSurface);
    // Does not crash, strictly honors canDrop: false
    expect(result.layout.elements.every((e) => e.visible)).toBe(true);
    expect(result.layout.elements.every((e) => e.status !== "dropped")).toBe(true);
    // Documents physical violation in diagnostics summary
    expect(result.diagnostics.summary.violations?.length).toBeGreaterThan(0);
  });
});


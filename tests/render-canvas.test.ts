// Unit tests verifying Canvas 2D renderer primitives, element filtering, and CanvasTextMeasurer.

import { describe, it, expect, vi } from "vitest";
import { renderToCanvas } from "../src/renderers/render-canvas";
import { CanvasTextMeasurer, canvasTextMeasurer } from "../src/measurement/canvas-measurer";
import { defaultDemoAdSpec } from "../src/demo/adSpec";
import { type ResolvedLayout, type ResolvedElement } from "../src/core/types";

/**
 * Creates a mocked HTML5 Canvas 2D rendering context with Vitest spies.
 */
function createMockCanvasContext(width = 800, height = 600): CanvasRenderingContext2D {
  return {
    canvas: { width, height } as HTMLCanvasElement,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 9 } as TextMetrics)),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textAlign: "start",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
}

describe("Canvas Renderer (Phase 13 - Proves Renderer Independence)", () => {
  const sampleElements: ResolvedElement[] = [
    {
      id: "headline",
      type: "text",
      role: "hero",
      x: 20,
      y: 20,
      width: 300,
      height: 60,
      fontSize: 22,
      content: "Sound Beyond Silence",
      status: "kept",
      visible: true,
      priority: 1,
      decisions: [],
    },
    {
      id: "productImage",
      type: "image",
      role: "hero",
      x: 20,
      y: 90,
      width: 300,
      height: 200,
      status: "kept",
      visible: true,
      priority: 2,
      decisions: [],
    },
    {
      id: "priceTag",
      type: "text",
      role: "secondary",
      x: 20,
      y: 300,
      width: 140,
      height: 30,
      fontSize: 16,
      content: "$299.99",
      status: "kept",
      visible: true,
      priority: 3,
      decisions: [],
    },
    {
      id: "ctaButton",
      type: "button",
      role: "primary",
      x: 170,
      y: 300,
      width: 150,
      height: 44,
      fontSize: 14,
      label: "Order Now",
      status: "kept",
      visible: true,
      priority: 4,
      decisions: [],
    },
    {
      id: "branding",
      type: "image",
      role: "branding",
      x: 20,
      y: 360,
      width: 100,
      height: 30,
      status: "dropped", // Intentionally dropped to verify filtering
      visible: false,
      priority: 5,
      decisions: [],
    },
  ];

  const mockLayout: ResolvedLayout = {
    surfaceId: "mockSurface",
    dimensions: {
      width: 640,
      height: 480,
    },
    elements: sampleElements,
    metrics: {
      durationMs: 1.2,
      hardViolations: 0,
      overlapCount: 0,
      clippingCount: 0,
      archetype: "Standard",
    },
  };

  it("calls canvas drawing primitives matching active elements and clears background", () => {
    const ctx = createMockCanvasContext(640, 480);
    renderToCanvas(ctx, mockLayout, defaultDemoAdSpec);

    // Verifies background clearance and initialization
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);

    // Text rendering: fillText should be called for text, image placeholder, and button
    expect(ctx.fillText).toHaveBeenCalled();
    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillTextCalls.length).toBeGreaterThanOrEqual(4);

    // Button rounded rectangle path was initiated and filled
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("strictly skips dropped and invisible elements during canvas rendering", () => {
    const ctx = createMockCanvasContext(640, 480);
    renderToCanvas(ctx, mockLayout, defaultDemoAdSpec);

    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const drawnTexts = fillTextCalls.map((call) => call[0]);

    // Active elements must be drawn
    expect(drawnTexts.some((txt: string) => txt.includes("Sound Beyond Silence"))).toBe(true);
    expect(drawnTexts.some((txt: string) => txt.includes("productImage"))).toBe(true);
    expect(drawnTexts.some((txt: string) => txt.includes("$299.99"))).toBe(true);
    expect(drawnTexts.some((txt: string) => txt.includes("Order Now"))).toBe(true);

    // Dropped element 'branding' must NEVER be drawn
    expect(drawnTexts.some((txt: string) => txt.includes("branding"))).toBe(false);
  });

  it("saves and restores context state around element rendering", () => {
    const ctx = createMockCanvasContext(640, 480);
    renderToCanvas(ctx, mockLayout, defaultDemoAdSpec);

    const activeCount = sampleElements.filter((el) => el.visible && el.status !== "dropped").length;
    expect(ctx.save).toHaveBeenCalledTimes(activeCount);
    expect(ctx.restore).toHaveBeenCalledTimes(activeCount);
  });
});

describe("CanvasTextMeasurer (Phase 13)", () => {
  it("implements TextMeasurer interface with valid measurements", () => {
    const measurer = new CanvasTextMeasurer();
    const shortResult = measurer.measure({ text: "Hi", fontSize: 16 });
    const longResult = measurer.measure({
      text: "A significantly longer piece of copy text for canvas measurement testing",
      fontSize: 16,
    });

    expect(shortResult.width).toBeGreaterThan(0);
    expect(longResult.width).toBeGreaterThan(shortResult.width);
  });

  it("simulates multi-line word wrapping on constrained maxWidth", () => {
    const measurer = new CanvasTextMeasurer();
    const text = "Ultra high fidelity wireless sound with adaptive transparency mode";
    const wideResult = measurer.measure({ text, fontSize: 16, maxWidth: 800 });
    const narrowResult = measurer.measure({ text, fontSize: 16, maxWidth: 100 });

    expect(narrowResult.lines).toBeGreaterThan(wideResult.lines);
    expect(narrowResult.height).toBeGreaterThan(wideResult.height);
  });

  it("returns zero metrics for empty strings", () => {
    const measurer = new CanvasTextMeasurer();
    expect(measurer.measure({ text: "", fontSize: 16 })).toEqual({ width: 0, height: 0, lines: 0 });
  });

  it("exports canvasTextMeasurer singleton", () => {
    expect(canvasTextMeasurer).toBeDefined();
    expect(canvasTextMeasurer.measure({ text: "Test", fontSize: 12 }).width).toBeGreaterThan(0);
  });
});

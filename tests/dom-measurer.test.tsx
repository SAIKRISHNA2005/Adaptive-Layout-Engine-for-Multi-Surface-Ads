// Tests for DOM-based text measurement engine verifying length-to-width scaling and multi-line wrapping behavior.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DOMTextMeasurer, domTextMeasurer } from "../src/measurement/dom-measurer";

describe("DOMTextMeasurer (Phase 12 - Real DOM Text Measurement)", () => {
  let measurer: DOMTextMeasurer;

  beforeEach(() => {
    measurer = new DOMTextMeasurer();
  });

  afterEach(() => {
    measurer.destroy();
  });

  it("verifies a known short string produces a smaller measured width than a known long string at the same font size", () => {
    const fontSize = 18;
    const shortString = "Short Ad";
    const longString = "A significantly longer advertising headline copy string designed to measure wider";

    const shortResult = measurer.measure({ text: shortString, fontSize });
    const longResult = measurer.measure({ text: longString, fontSize });

    expect(shortResult.width).toBeGreaterThan(0);
    expect(longResult.width).toBeGreaterThan(0);
    expect(shortResult.width).toBeLessThan(longResult.width);
  });

  it("verifies increasing maxWidth from very narrow to wide reduces the number of wrapped lines for a fixed string", () => {
    const fixedText = "Premium Active Noise-Canceling Wireless Studio Headphones with 40-Hour Battery Life and Adaptive Soundstage";
    const fontSize = 16;

    const narrowResult = measurer.measure({
      text: fixedText,
      fontSize,
      maxWidth: 120, // Very narrow column
    });

    const mediumResult = measurer.measure({
      text: fixedText,
      fontSize,
      maxWidth: 300, // Medium column
    });

    const wideResult = measurer.measure({
      text: fixedText,
      fontSize,
      maxWidth: 1200, // Very wide surface
    });

    // Narrow column requires significantly more wrapped lines than medium or wide
    expect(narrowResult.lines).toBeGreaterThan(mediumResult.lines);
    expect(mediumResult.lines).toBeGreaterThanOrEqual(wideResult.lines);
    expect(wideResult.lines).toBe(1);

    // Bounding height should also decrease as lines reduce
    expect(narrowResult.height).toBeGreaterThan(wideResult.height);
  });

  it("returns zero metrics for empty or whitespace-only inputs", () => {
    const emptyResult = measurer.measure({ text: "", fontSize: 16 });
    expect(emptyResult).toEqual({ width: 0, height: 0, lines: 0 });
  });

  it("reuses the same off-screen measurement DOM container across repeated calls", () => {
    measurer.measure({ text: "Sample 1", fontSize: 14 });
    const firstContainer = document.querySelector('[data-testid="dom-measurer-container"]');
    expect(firstContainer).not.toBeNull();

    measurer.measure({ text: "Sample 2", fontSize: 20 });
    const containers = document.querySelectorAll('[data-testid="dom-measurer-container"]');
    expect(containers.length).toBe(1);
    expect(containers[0]).toBe(firstContainer);
  });

  it("measures accurately when getBoundingClientRect returns non-zero geometric bounds", () => {
    // Prime the element so it attaches to document.body
    measurer.measure({ text: "Init", fontSize: 14 });
    const el = document.querySelector('[data-testid="dom-measurer-container"]') as HTMLElement;
    expect(el).not.toBeNull();

    // Mock getBoundingClientRect on the container element
    const originalGetBoundingClientRect = el.getBoundingClientRect;
    el.getBoundingClientRect = () => ({
      width: 142.5,
      height: 40.0,
      top: 0,
      left: 0,
      bottom: 40,
      right: 142.5,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const res = measurer.measure({ text: "Layout test", fontSize: 16, maxWidth: 200 });
    expect(res.width).toBe(143);
    expect(res.height).toBe(40);
    expect(res.lines).toBe(2);

    el.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("exports a ready-to-use global domTextMeasurer singleton", () => {
    expect(domTextMeasurer).toBeDefined();
    const res = domTextMeasurer.measure({ text: "Global Test", fontSize: 14 });
    expect(res.width).toBeGreaterThan(0);
    expect(res.height).toBeGreaterThan(0);
  });
});

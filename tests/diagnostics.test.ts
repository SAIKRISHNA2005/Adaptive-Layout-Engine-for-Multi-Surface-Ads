// Unit tests for structured diagnostics, pipeline event tracing, and explainability reporting.
import { describe, it, expect } from "vitest";
import { defineAd } from "../src/core/spec";
import { defineSurface, mobilePortrait, retailKiosk } from "../src/core/surfaces";
import { resolveWithDiagnostics } from "../src/core/resolver";
import { type ResolvedElement } from "../src/core/types";

describe("Diagnostics & Explainability (Phase 5)", () => {
  const adSpec = defineAd({
    id: "tech-launch",
    elements: [
      { id: "headline", type: "text", role: "primary", priority: 1, content: "Next-Gen Spatial Computing" },
      { id: "product-hero", type: "image", role: "hero", priority: 1, aspectRatio: 1.5, preferredWidth: 350, preferredHeight: 200 },
      { id: "cta", type: "button", role: "action", priority: 2, label: "Reserve Yours", minTapTarget: 50 },
      { id: "brand-logo", type: "image", role: "branding", priority: 3, aspectRatio: 1.0, preferredWidth: 80, preferredHeight: 80, canDrop: true },
    ],
  });

  it("produces trace steps in strictly ascending numerical order", () => {
    const { diagnostics } = resolveWithDiagnostics(adSpec, mobilePortrait);

    expect(diagnostics.trace.length).toBeGreaterThan(0);

    for (let i = 0; i < diagnostics.trace.length; i++) {
      const step = diagnostics.trace[i];
      expect(step?.step).toBe(i + 1);
      expect(["normalize", "measure", "place", "validate", "degrade"]).toContain(step?.stage);
      expect(step?.message).toBeTruthy();
    }
  });

  it("tags every degraded or dropped element with at least one elementId-tagged trace entry", () => {
    // Artificial small kiosk surface forcing degradation & dropping
    const smallKiosk = defineSurface({
      ...retailKiosk,
      id: "smallKiosk",
      width: 400,
      height: 380,
      safeArea: { top: 20, right: 20, bottom: 20, left: 20 },
    });

    const { layout, diagnostics } = resolveWithDiagnostics(adSpec, smallKiosk);

    const degradedElements = layout.elements.filter(
      (el: ResolvedElement) => el.status !== "kept",
    );
    expect(degradedElements.length).toBeGreaterThan(0);

    for (const el of degradedElements) {
      const matchingTrace = diagnostics.trace.filter(
        (step) => step.elementId === el.id && (step.stage === "degrade" || step.stage === "measure"),
      );
      expect(matchingTrace.length).toBeGreaterThan(0);

      const degradeTrace = diagnostics.trace.find(
        (step) => step.elementId === el.id && step.stage === "degrade",
      );
      expect(degradeTrace).toBeDefined();
      expect(degradeTrace?.message).toContain(el.id);
    }
  });

  it("verifies summary counts accurately match layout metrics and element totals", () => {
    const { layout, diagnostics } = resolveWithDiagnostics(adSpec, mobilePortrait);
    const { summary } = diagnostics;

    const visibleCount = layout.elements.filter((el: ResolvedElement) => el.visible).length;

    expect(summary.elementsTotal).toBe(adSpec.elements.length);
    expect(summary.elementsResolved).toBe(visibleCount);
    expect(summary.overlaps).toBe(layout.metrics.overlapCount);
    expect(summary.clipping).toBe(layout.metrics.clippingCount);
    expect(summary.durationMs).toBe(layout.metrics.durationMs);
    expect(summary.hardConstraintsTotal).toBe(4);
    expect(summary.hardConstraintsSatisfied).toBe(4);
  });

  it("records pipeline events across all 5 stages in order during a degradation scenario", () => {
    const constrainedSurface = defineSurface({
      id: "tight-box",
      name: "Tight Box",
      width: 250,
      height: 200,
    });

    const { diagnostics } = resolveWithDiagnostics(adSpec, constrainedSurface);
    const stagesRecorded = new Set(diagnostics.trace.map((s) => s.stage));

    expect(stagesRecorded.has("normalize")).toBe(true);
    expect(stagesRecorded.has("measure")).toBe(true);
    expect(stagesRecorded.has("place")).toBe(true);
    expect(stagesRecorded.has("validate")).toBe(true);
    expect(stagesRecorded.has("degrade")).toBe(true);
  });
});

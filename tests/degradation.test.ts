// Test suite verifying predictable priority degradation ordering and zero clipping/overflow under spatial starvation.
import { describe, it, expect } from "vitest";
import { defineAd } from "../src/core/spec";
import { defineSurface, retailKiosk, stressTestSurface } from "../src/core/surfaces";
import { resolve } from "../src/core/resolver";
import { defaultDemoAdSpec } from "../src/demo/adSpec";
import { type ResolvedElement, type ResolvedLayout } from "../src/core/types";

describe("Priority-Based Degradation Engine (Phase 4b)", () => {
  it("drops branding on an artificially shrunk kiosk surface while protecting headline and CTA intact", () => {
    // Standard spec with Headline (P1), Hero Image (P1), CTA (P2), and Branding Logo (P3)
    const adSpec = defineAd({
      id: "sneaker-drop",
      elements: [
        { id: "headline", type: "text", role: "primary", priority: 1, content: "Limited Edition Air Runner" },
        { id: "hero-image", type: "image", role: "hero", priority: 1, aspectRatio: 1.5, preferredWidth: 400, preferredHeight: 250 },
        { id: "cta", type: "button", role: "action", priority: 2, label: "Claim Offer Now", minTapTarget: 60 },
        { id: "branding-logo", type: "image", role: "branding", priority: 3, aspectRatio: 1.0, preferredWidth: 100, preferredHeight: 100, canDrop: true },
      ],
    });

    // Artificially constrained kiosk surface (400x380) where all 4 items cannot fit simultaneously
    const constrainedKiosk = defineSurface({
      ...retailKiosk,
      id: "shrunkKiosk",
      width: 400,
      height: 380,
      safeArea: { top: 20, right: 30, bottom: 20, left: 30 },
    });

    const layout = resolve(adSpec, constrainedKiosk);

    const headline = layout.elements.find((el: ResolvedElement) => el.id === "headline");
    const hero = layout.elements.find((el: ResolvedElement) => el.id === "hero-image");
    const cta = layout.elements.find((el: ResolvedElement) => el.id === "cta");
    const branding = layout.elements.find((el: ResolvedElement) => el.id === "branding-logo");

    // Branding (Priority 3) must be dropped
    expect(branding).toBeDefined();
    expect(branding?.visible).toBe(false);
    expect(branding?.status).toBe("dropped");
    expect(branding?.decisions.some((d: string) => d.includes("Dropped: priority 3"))).toBe(true);

    // Headline (P1) and Hero (P1) remain visible
    expect(headline?.visible).toBe(true);
    expect(hero?.visible).toBe(true);

    // CTA (P2) remains visible and meets minimum tap target
    expect(cta?.visible).toBe(true);
    expect(cta?.height).toBeGreaterThanOrEqual(constrainedKiosk.minTapTarget ?? 60);

    // Zero overlap or clipping violations
    expect(layout.metrics.overlapCount).toBe(0);
    expect(layout.metrics.clippingCount).toBe(0);
    expect(layout.metrics.hardViolations).toBe(0);
  });

  it("degrades long text on a tiny surface (240x320) through font shrinking, wrapping, and ellipsis truncation", () => {
    const longTextSpec = defineAd({
      id: "ultra-long-headline",
      elements: [
        {
          id: "epic-headline",
          type: "text",
          role: "primary",
          priority: 1,
          preferredFontSize: 32,
          minFontSize: 12,
          canTruncate: true,
          content: "Experience the ultimate next-generation revolutionary spatial computing platform with unmatched performance and style",
        },
        {
          id: "cta-btn",
          type: "button",
          role: "action",
          priority: 2,
          label: "Learn More",
          minTapTarget: 40,
        },
      ],
    });

    const tinySurface = defineSurface({
      id: "tiny-screen",
      name: "Tiny Screen",
      width: 240,
      height: 180,
      safeArea: { top: 10, right: 10, bottom: 10, left: 10 },
      minTapTarget: 40,
      touchOnly: true,
    });

    const layout = resolve(longTextSpec, tinySurface);
    const headline = layout.elements.find((el: ResolvedElement) => el.id === "epic-headline");

    expect(headline).toBeDefined();
    expect(headline?.visible).toBe(true);

    // Check decisions trace demonstrates font reduction and/or truncation
    expect(headline?.decisions.length).toBeGreaterThan(0);
    expect(
      headline?.decisions.some(
        (d: string) => d.includes("Reduced font size") || d.includes("Truncated text"),
      ),
    ).toBe(true);

    // Final layout fits within surface bounds
    expect(layout.metrics.clippingCount).toBe(0);
    expect(layout.metrics.overlapCount).toBe(0);
  });

  it("handles non-droppable, non-shrinkable elements gracefully by returning hardViolations > 0 without throwing", () => {
    const rigidSpec = defineAd({
      id: "rigid-giant-element",
      elements: [
        {
          id: "unshrinkable-block",
          type: "text",
          role: "primary",
          priority: 1,
          content: "Unshrinkable Massive Block That Cannot Fit On Screen At All",
          minFontSize: 40,
          preferredFontSize: 40,
          minHeight: 300,
          minWidth: 400,
          canShrink: false,
          canDrop: false,
          canTruncate: false,
        },
      ],
    });

    const microSurface = defineSurface({
      id: "micro-screen",
      name: "Micro Screen",
      width: 100,
      height: 100,
    });

    // Must return a layout with hardViolations > 0 rather than throwing an exception
    let layout: ResolvedLayout | undefined;
    expect(() => {
      layout = resolve(rigidSpec, microSurface);
    }).not.toThrow();

    expect(layout).toBeDefined();
    expect(layout!.metrics.hardViolations).toBeGreaterThan(0);
    expect(layout!.metrics.clippingCount).toBeGreaterThan(0);

    const block = layout!.elements.find((el: ResolvedElement) => el.id === "unshrinkable-block");
    expect(block?.decisions.some((d: string) => d.includes("canDrop=false"))).toBe(true);
  });

  it("strictly enforces invariant: CTA (P2) is protected over branding (P3)", () => {
    const mixedSpec = defineAd({
      id: "priority-invariance-spec",
      elements: [
        { id: "hero", type: "image", role: "hero", priority: 1, aspectRatio: 1.0, preferredWidth: 150, preferredHeight: 150 },
        { id: "cta", type: "button", role: "action", priority: 2, label: "Buy", minTapTarget: 50 },
        { id: "logo", type: "image", role: "branding", priority: 3, aspectRatio: 1.0, preferredWidth: 80, preferredHeight: 80, canDrop: true },
      ],
    });

    const tightSurface = defineSurface({
      id: "tight-surface",
      name: "Tight Surface",
      width: 200,
      height: 240,
      minTapTarget: 50,
      touchOnly: true,
    });

    const layout = resolve(mixedSpec, tightSurface);
    const cta = layout.elements.find((el: ResolvedElement) => el.id === "cta");
    const logo = layout.elements.find((el: ResolvedElement) => el.id === "logo");

    // CTA must remain visible and satisfy minTapTarget
    expect(cta?.visible).toBe(true);
    expect(cta?.height).toBeGreaterThanOrEqual(50);

    // Branding is dropped before CTA is compromised
    expect(logo?.visible).toBe(false);
    expect(logo?.status).toBe("dropped");
  });

  it("degrades gracefully under Phase 10 Stress Test surface (branding dropped, price truncated, headline/CTA intact)", () => {
    const layout = resolve(defaultDemoAdSpec, stressTestSurface);

    const headline = layout.elements.find((el) => el.id === "headline");
    const branding = layout.elements.find((el) => el.id === "brand-logo");
    const price = layout.elements.find((el) => el.id === "price-tag");
    const cta = layout.elements.find((el) => el.id === "cta-button");

    // headline.status is "kept" or "shrunk" (never "dropped")
    expect(headline).toBeDefined();
    expect(headline?.visible).toBe(true);
    expect(["kept", "shrunk"]).toContain(headline?.status);

    // branding's status is "dropped"
    expect(branding).toBeDefined();
    expect(branding?.visible).toBe(false);
    expect(branding?.status).toBe("dropped");

    // price is truncated
    expect(price).toBeDefined();
    expect(price?.visible).toBe(true);
    expect(price?.status).toBe("truncated");

    // cta's final height/width both >= surface.minTapTarget
    expect(cta).toBeDefined();
    expect(cta?.visible).toBe(true);
    expect(cta?.width).toBeGreaterThanOrEqual(stressTestSurface.minTapTarget ?? 44);
    expect(cta?.height).toBeGreaterThanOrEqual(stressTestSurface.minTapTarget ?? 44);
  });
});

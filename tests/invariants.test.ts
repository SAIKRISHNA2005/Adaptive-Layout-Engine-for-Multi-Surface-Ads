// Automated invariant test suite evaluating layout correctness across 7 surfaces × 3 specs (21 combinations).

import { describe, it, expect } from "vitest";
import { defineAd } from "../src/core/spec";
import {
  defineSurface,
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
} from "../src/core/surfaces";
import { resolveWithDiagnostics } from "../src/core/resolver";
import { defaultDemoAdSpec } from "../src/demo/adSpec";
import { type AdSpec, type SurfaceProfile } from "../src/core/types";
import {
  everyElementWithinBounds,
  everyKeptTapTargetMeetsMinimum,
  everyKeptTextMeetsMinimumSize,
} from "./helpers/invariant-checks";

/** 3 Synthetic Extreme Surface Profiles */
const syntheticExtremelySmall: Readonly<SurfaceProfile> = defineSurface({
  id: "syntheticExtremelySmall",
  name: "Synthetic Extremely Small (160x200)",
  width: 160,
  height: 200,
  safeArea: { top: 10, right: 8, bottom: 10, left: 8 },
  minTapTarget: 36,
  touchOnly: true,
  viewingDistance: "near",
});

const syntheticExtremelyWide: Readonly<SurfaceProfile> = defineSurface({
  id: "syntheticExtremelyWide",
  name: "Synthetic Extremely Wide (2400x150)",
  width: 2400,
  height: 150,
  safeArea: { top: 10, right: 40, bottom: 10, left: 40 },
  minTextSize: 20,
  touchOnly: false,
  viewingDistance: "far",
});

const syntheticExtremelyTall: Readonly<SurfaceProfile> = defineSurface({
  id: "syntheticExtremelyTall",
  name: "Synthetic Extremely Tall (300x1600)",
  width: 300,
  height: 1600,
  safeArea: { top: 50, right: 16, bottom: 50, left: 16 },
  minTapTarget: 44,
  touchOnly: true,
  viewingDistance: "near",
});

/** 3 Test Specification Variations */
const longHeadlineAdSpec: Readonly<AdSpec> = defineAd({
  id: "long-headline-spec",
  elements: [
    {
      id: "brand-logo",
      type: "image",
      role: "branding",
      priority: 3,
      aspectRatio: 2.2,
      preferredWidth: 120,
      preferredHeight: 45,
      canDrop: true,
      canShrink: true,
      alt: "AeroTune Audio",
    },
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content:
        "Experience the next revolution in spatial acoustics and computational high-fidelity audio engineering with groundbreaking real-time noise cancellation and ultra-low latency wireless connectivity.",
      preferredFontSize: 28,
      minFontSize: 12,
      canShrink: true,
      canTruncate: true,
    },
    {
      id: "hero-image",
      type: "image",
      role: "hero",
      priority: 1,
      aspectRatio: 1.33,
      preferredWidth: 360,
      preferredHeight: 270,
      canShrink: true,
      canDrop: false,
      alt: "AeroTune Pro Wireless ANC Headphones",
    },
    {
      id: "price-tag",
      type: "text",
      role: "secondary",
      priority: 2,
      content: "From $349 with complimentary bespoke engraved leather carrying case",
      preferredFontSize: 16,
      minFontSize: 11,
      canShrink: true,
      canTruncate: true,
    },
    {
      id: "cta-button",
      type: "button",
      role: "action",
      priority: 2,
      label: "Reserve Your Early Edition Now",
      minTapTarget: 44,
      canShrink: true,
      canDrop: false,
    },
  ],
});

const minimalTwoElementAdSpec: Readonly<AdSpec> = defineAd({
  id: "minimal-two-element-spec",
  elements: [
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content: "Pure Acoustic Precision.",
      preferredFontSize: 24,
      minFontSize: 12,
      canShrink: true,
      canTruncate: true,
    },
    {
      id: "cta-button",
      type: "button",
      role: "action",
      priority: 1,
      label: "Shop Now",
      minTapTarget: 44,
      canShrink: true,
      canDrop: false,
    },
  ],
});

/** Surfaces Test Matrix */
const SURFACES: readonly { name: string; profile: SurfaceProfile }[] = [
  { name: "Mobile Portrait (320x480)", profile: mobilePortrait },
  { name: "Mobile Landscape (640x360)", profile: mobileLandscape },
  { name: "Broadcast Lower-Third (1920x250)", profile: broadcastLowerThird },
  { name: "Retail Kiosk Square (1080x1080)", profile: retailKiosk },
  { name: "Synthetic Extremely Small (160x200)", profile: syntheticExtremelySmall },
  { name: "Synthetic Extremely Wide (2400x150)", profile: syntheticExtremelyWide },
  { name: "Synthetic Extremely Tall (300x1600)", profile: syntheticExtremelyTall },
];

/** Specs Test Matrix */
const SPECS: readonly { name: string; spec: AdSpec }[] = [
  { name: "Default Demo 5-Element Spec", spec: defaultDemoAdSpec },
  { name: "Long Headline Spec (150+ chars)", spec: longHeadlineAdSpec },
  { name: "Minimal 2-Element Spec (Headline + CTA)", spec: minimalTwoElementAdSpec },
];

describe("Automated Invariant Test Suite (Phase 9 - 7 Surfaces × 3 Specs = 21 Matrix Combinations)", () => {
  // Generate all 21 test cases using Cartesian product
  const testMatrix = SURFACES.flatMap((surfaceEntry) =>
    SPECS.map((specEntry) => ({
      surfaceName: surfaceEntry.name,
      surface: surfaceEntry.profile,
      specName: specEntry.name,
      spec: specEntry.spec,
    })),
  );

  it.each(testMatrix)(
    "satisfies 100% hard layout invariants on [$surfaceName] with [$specName]",
    ({ surface, spec }) => {
      const { layout, diagnostics } = resolveWithDiagnostics(spec, surface);

      // Invariant 1: Zero pairwise bounding box overlaps
      expect(diagnostics.summary.overlaps).toBe(0);

      // Invariant 2: Zero clipping outside surface/safe-area boundaries
      expect(diagnostics.summary.clipping).toBe(0);

      // Invariant 3: All visible elements are strictly within the surface coordinate bounds
      expect(everyElementWithinBounds(layout, surface)).toBe(true);

      // Invariant 4: All kept touch/action targets meet or exceed minimum tap target
      expect(everyKeptTapTargetMeetsMinimum(layout, spec, surface)).toBe(true);

      // Invariant 5: All kept text elements meet or exceed minimum legibility size
      expect(everyKeptTextMeetsMinimumSize(layout, spec, surface)).toBe(true);
    },
  );
});

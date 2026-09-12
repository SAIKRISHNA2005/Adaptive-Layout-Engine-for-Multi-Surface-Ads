// Property-based stress testing using fast-check to assert layout invariants across hundreds of randomized surfaces.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseSurfaceProfile } from "../src/core/validation";
import { resolveWithDiagnostics } from "../src/core/resolver";
import { defaultDemoAdSpec } from "../src/demo/adSpec";
import { type SurfaceProfile, type ViewingDistance } from "../src/core/types";
import {
  everyElementWithinBounds,
  everyKeptTapTargetMeetsMinimum,
  everyKeptTextMeetsMinimumSize,
} from "./helpers/invariant-checks";

describe("Property-Based / Randomized Stress Testing (Phase 15 - 200+ Iterations)", () => {
  it("maintains 100% layout correctness invariants across at least 200 randomized valid surfaces", () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 100, max: 2400 }),
          height: fc.integer({ min: 100, max: 2400 }),
          safeTop: fc.integer({ min: 0, max: 40 }),
          safeRight: fc.integer({ min: 0, max: 40 }),
          safeBottom: fc.integer({ min: 0, max: 40 }),
          safeLeft: fc.integer({ min: 0, max: 40 }),
          minTapTarget: fc.integer({ min: 0, max: 80 }),
          minTextSize: fc.integer({ min: 0, max: 48 }),
          viewingDistance: fc.constantFrom<ViewingDistance>("near", "medium", "far"),
          touchOnly: fc.boolean(),
        }),
        (raw) => {
          // Safe areas must leave at least 50% of width and height as content area
          fc.pre(raw.safeLeft + raw.safeRight <= raw.width * 0.5);
          fc.pre(raw.safeTop + raw.safeBottom <= raw.height * 0.5);

          // Candidate surface definition
          const candidate = {
            id: `random-${raw.width}x${raw.height}`,
            name: `Random Surface ${raw.width}x${raw.height}`,
            width: raw.width,
            height: raw.height,
            safeArea: {
              top: raw.safeTop,
              right: raw.safeRight,
              bottom: raw.safeBottom,
              left: raw.safeLeft,
            },
            accessibility: {
              minTapTarget: raw.minTapTarget > 0 ? raw.minTapTarget : undefined,
              touchOnly: raw.touchOnly,
              minContrastRatio: 4.5,
            },
            minTapTarget: raw.minTapTarget > 0 ? raw.minTapTarget : undefined,
            minTextSize: raw.minTextSize > 0 ? raw.minTextSize : undefined,
            viewingDistance: raw.viewingDistance,
            touchOnly: raw.touchOnly,
          };

          // Skip (fc.pre) any generated combination that fails validation
          let validSurface: SurfaceProfile;
          try {
            validSurface = parseSurfaceProfile(candidate);
          } catch {
            fc.pre(false);
            return;
          }

          // Invariant test: resolve against the default demo ad specification
          const { layout, diagnostics } = resolveWithDiagnostics(defaultDemoAdSpec, validSurface);

          // Invariant 1: Zero pairwise bounding box collisions
          expect(diagnostics.summary.overlaps).toBe(0);

          // Invariant 2: Zero clipping outside surface bounds
          expect(diagnostics.summary.clipping).toBe(0);

          // Invariant 3: All visible elements are strictly within the surface viewport bounds
          expect(everyElementWithinBounds(layout, validSurface)).toBe(true);

          // Invariant 4: All kept buttons meet or exceed the surface/element min tap target
          expect(everyKeptTapTargetMeetsMinimum(layout, defaultDemoAdSpec, validSurface)).toBe(true);

          // Invariant 5: All kept text elements meet or exceed legible font sizing
          expect(everyKeptTextMeetsMinimumSize(layout, defaultDemoAdSpec, validSurface)).toBe(true);
        },
      ),
      {
        numRuns: 500,
        verbose: true,
      },
    );
  });
});

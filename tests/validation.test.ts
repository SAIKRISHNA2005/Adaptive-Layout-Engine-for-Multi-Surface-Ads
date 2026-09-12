// Unit tests for Zod-backed runtime schema and constraint validation.
import { describe, it, expect } from "vitest";
import { parseAdSpec, parseSurfaceProfile } from "../src/core/validation";
import { DuplicateElementIdError, ValidationError } from "../src/core/types";

describe("Runtime Validation Layer", () => {
  describe("parseSurfaceProfile", () => {
    it("rejects negative or zero surface width", () => {
      expect(() => {
        parseSurfaceProfile({
          id: "neg-width",
          name: "Negative Width",
          width: -500,
          height: 800,
        });
      }).toThrowError(ValidationError);

      try {
        parseSurfaceProfile({
          id: "zero-width",
          name: "Zero Width",
          width: 0,
          height: 800,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const valErr = err as ValidationError;
        expect(valErr.issues.some((i) => i.includes("width"))).toBe(true);
      }
    });

    it("rejects minTapTarget larger than surface minimum dimension with a descriptive diagnostic message", () => {
      try {
        parseSurfaceProfile({
          id: "tiny-watch",
          name: "Tiny Watch Screen",
          width: 48,
          height: 48,
          minTapTarget: 60,
        });
        expect.unreachable("Should have thrown ValidationError");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const valErr = err as ValidationError;
        expect(
          valErr.issues.some((i) => i.includes("minTapTarget (60px) exceeds surface minimum dimension (48px)")),
        ).toBe(true);
      }
    });

    it("rejects safe area insets exceeding or equal to surface dimensions", () => {
      try {
        parseSurfaceProfile({
          id: "huge-safe-area",
          name: "Huge Safe Area",
          width: 320,
          height: 480,
          safeArea: { top: 250, right: 20, bottom: 250, left: 20 },
        });
        expect.unreachable("Should have thrown ValidationError");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const valErr = err as ValidationError;
        expect(valErr.issues.some((i) => i.includes("Safe area vertical insets"))).toBe(true);
      }
    });

    it("successfully validates valid surface profiles (Valid Input 1 & 2)", () => {
      const surface1 = parseSurfaceProfile({
        id: "ultraWide4k",
        name: "4K Ultra-Wide Billboard",
        width: 3840,
        height: 1080,
        safeArea: { top: 60, right: 120, bottom: 60, left: 120 },
        viewingDistance: "far",
        minTextSize: 48,
      });

      expect(surface1.width).toBe(3840);
      expect(surface1.height).toBe(1080);
      expect(surface1.viewingDistance).toBe("far");

      const surface2 = parseSurfaceProfile({
        id: "compactWearable",
        name: "Wearable Display",
        width: 280,
        height: 280,
        minTapTarget: 40,
        touchOnly: true,
      });

      expect(surface2.width).toBe(280);
      expect(surface2.touchOnly).toBe(true);
    });
  });

  describe("parseAdSpec", () => {
    it("rejects duplicate element IDs across the spec", () => {
      expect(() => {
        parseAdSpec({
          elements: [
            { id: "headline", type: "text", role: "primary", priority: 1, content: "Title" },
            { id: "cta", type: "button", role: "action", priority: 2, label: "Click" },
            { id: "headline", type: "text", role: "secondary", priority: 3, content: "Duplicate" },
          ],
        });
      }).toThrowError(DuplicateElementIdError);
    });

    it("rejects priority numbers out of the 1-5 range", () => {
      try {
        parseAdSpec({
          elements: [
            { id: "headline", type: "text", role: "primary", priority: 0, content: "Zero Priority" },
            { id: "cta", type: "button", role: "action", priority: 99, label: "Out of Range" },
          ],
        });
        expect.unreachable("Should have thrown ValidationError");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const valErr = err as ValidationError;
        expect(valErr.issues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("rejects empty elements array", () => {
      expect(() => {
        parseAdSpec({ elements: [] });
      }).toThrowError(ValidationError);
    });

    it("successfully validates realistic ad specifications (Valid Input 3 & 4)", () => {
      const spec = parseAdSpec({
        id: "summer-beverage-campaign",
        elements: [
          { id: "headline", type: "text", role: "primary", priority: 1, content: "Cold Refreshment" },
          { id: "product-hero", type: "image", role: "hero", priority: 1, src: "can.png", aspectRatio: 1.0 },
          { id: "cta-order", type: "button", role: "action", priority: 2, label: "Order Now", minTapTarget: 48 },
          { id: "price-tag", type: "text", role: "secondary", priority: 2, content: "$2.99" },
          { id: "brand-logo", type: "image", role: "branding", priority: 3, src: "logo.png" },
        ],
      });

      expect(spec.id).toBe("summer-beverage-campaign");
      expect(spec.elements).toHaveLength(5);
      expect(spec.elements[0]?.id).toBe("headline");

      const singleElementSpec = parseAdSpec({
        id: "breaking-alert",
        elements: [
          { id: "alert-text", type: "text", role: "primary", priority: 1, content: "Breaking News Update" },
        ],
      });

      expect(singleElementSpec.elements).toHaveLength(1);
    });
  });
});

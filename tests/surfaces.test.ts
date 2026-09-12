// Unit tests for defineSurface factory and standard surface profile definitions.
import { describe, it, expect } from "vitest";
import {
  defineSurface,
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
  surfaces,
} from "../src/core/surfaces";
import { InvalidSurfaceError } from "../src/core/types";

describe("defineSurface and Standard Profiles", () => {
  it("produces an immutable, deeply frozen SurfaceProfile", () => {
    const custom = defineSurface({
      id: "customDisplay",
      name: "Custom Screen",
      width: 800,
      height: 600,
      safeArea: { top: 10, right: 10, bottom: 10, left: 10 },
      minTapTarget: 48,
    });

    expect(Object.isFrozen(custom)).toBe(true);
    expect(Object.isFrozen(custom.safeArea)).toBe(true);
  });

  it("rejects invalid surface dimensions", () => {
    expect(() => {
      defineSurface({
        id: "zeroWidth",
        name: "Zero Width",
        width: 0,
        height: 600,
      });
    }).toThrowError(InvalidSurfaceError);

    expect(() => {
      defineSurface({
        id: "negativeHeight",
        name: "Negative Height",
        width: 800,
        height: -100,
      });
    }).toThrowError(InvalidSurfaceError);
  });

  it("rejects safe area insets that exceed surface dimensions", () => {
    expect(() => {
      defineSurface({
        id: "oversizedSafeArea",
        name: "Oversized Safe Area",
        width: 100,
        height: 100,
        safeArea: { top: 60, right: 10, bottom: 60, left: 10 },
      });
    }).toThrowError(InvalidSurfaceError);
  });

  it("verifies mobilePortrait matches assignment requirements", () => {
    expect(mobilePortrait.width).toBe(320);
    expect(mobilePortrait.height).toBe(480);
    expect(mobilePortrait.minTapTarget).toBe(44);
    expect(mobilePortrait.touchOnly).toBe(true);
    expect(mobilePortrait.safeArea).toBeDefined();
    expect(mobilePortrait.safeArea?.top).toBeGreaterThanOrEqual(40);
  });

  it("verifies broadcastLowerThird matches assignment requirements", () => {
    expect(broadcastLowerThird.width).toBe(1920);
    expect(broadcastLowerThird.height).toBe(250);
    expect(broadcastLowerThird.viewingDistance).toBe("far");
    expect(broadcastLowerThird.minTextSize).toBe(32);
  });

  it("verifies retailKiosk matches assignment requirements", () => {
    expect(retailKiosk.width).toBe(1080);
    expect(retailKiosk.height).toBe(1080);
    expect(retailKiosk.minTapTarget).toBe(60);
    expect(retailKiosk.touchOnly).toBe(true);
  });

  it("verifies mobileLandscape profile is configured properly", () => {
    expect(mobileLandscape.width).toBe(640);
    expect(mobileLandscape.height).toBe(360);
    expect(mobileLandscape.minTapTarget).toBe(44);
    expect(mobileLandscape.touchOnly).toBe(true);
  });

  it("verifies surfaces dictionary contains all standard profiles", () => {
    expect(surfaces.mobilePortrait).toBeDefined();
    expect(surfaces.mobileLandscape).toBeDefined();
    expect(surfaces.broadcastLowerThird).toBeDefined();
    expect(surfaces.retailKiosk).toBeDefined();
  });
});

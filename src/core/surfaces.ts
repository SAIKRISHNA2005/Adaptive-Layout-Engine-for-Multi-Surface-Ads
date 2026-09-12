// Standard surface profile definitions (mobile, kiosk, broadcast lower-third) and surface constraint schemas.

import { type SurfaceProfile } from "./types";
import { parseSurfaceProfile } from "./validation";

/** Input payload for defining a surface profile via defineSurface. */
export type SurfaceProfileInput = SurfaceProfile;

/** Recursively freezes an object and its nested properties to guarantee immutability. */
function deepFreeze<T>(object: T): Readonly<T> {
  if (object === null || typeof object !== "object") {
    return object;
  }
  Object.freeze(object);
  for (const key of Object.keys(object)) {
    const value = (object as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return object;
}

/**
 * Creates, validates, and returns an immutable, deeply frozen SurfaceProfile.
 * Validates through the central parseSurfaceProfile runtime validation engine.
 *
 * @param profile - The physical dimensions and hardware constraints for a target surface.
 * @returns A validated, deeply frozen SurfaceProfile object.
 * @throws {ValidationError} If the profile violates physical or dimensional constraints.
 */
export function defineSurface(profile: SurfaceProfileInput): Readonly<SurfaceProfile> {
  const validated = parseSurfaceProfile(profile);
  return deepFreeze(validated);
}

/** Mobile portrait interstitial surface profile (320x480, touch-enabled, 44px min tap target). */
export const mobilePortrait: Readonly<SurfaceProfile> = defineSurface({
  id: "mobilePortrait",
  name: "Mobile Interstitial (Portrait)",
  width: 320,
  height: 480,
  safeArea: { top: 40, right: 16, bottom: 34, left: 16 },
  minTapTarget: 44,
  touchOnly: true,
  viewingDistance: "near",
});

/** Alias for mobile portrait interstitial matching assignment naming. */
export const mobileInterstitial: Readonly<SurfaceProfile> = mobilePortrait;

/** Mobile landscape interstitial surface profile (640x360, touch-enabled, 44px min tap target). */
export const mobileLandscape: Readonly<SurfaceProfile> = defineSurface({
  id: "mobileLandscape",
  name: "Mobile Interstitial (Landscape)",
  width: 640,
  height: 360,
  safeArea: { top: 16, right: 40, bottom: 20, left: 40 },
  minTapTarget: 44,
  touchOnly: true,
  viewingDistance: "near",
});

/** Broadcast TV lower-third overlay surface profile (1920x250, far viewing distance, 32px min text size). */
export const broadcastLowerThird: Readonly<SurfaceProfile> = defineSurface({
  id: "broadcastLowerThird",
  name: "Broadcast Lower-Third",
  width: 1920,
  height: 250,
  safeArea: { top: 20, right: 60, bottom: 20, left: 60 },
  minTextSize: 32,
  viewingDistance: "far",
  touchOnly: false,
});

/** Retail interactive kiosk surface profile (1080x1080 square, touch-only, 60px min tap target). */
export const retailKiosk: Readonly<SurfaceProfile> = defineSurface({
  id: "retailKiosk",
  name: "Retail Kiosk Screen (Square)",
  width: 1080,
  height: 1080,
  safeArea: { top: 48, right: 48, bottom: 48, left: 48 },
  minTapTarget: 60,
  touchOnly: true,
  viewingDistance: "medium",
});

/** Standard library of preset multi-surface profiles. */
export const surfaces: Readonly<Record<string, Readonly<SurfaceProfile>>> = deepFreeze({
  mobilePortrait,
  mobileInterstitial,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
});

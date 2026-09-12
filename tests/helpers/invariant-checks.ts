// Reusable helper predicates for validating layout invariants in tests.

import {
  type AdElement,
  type AdSpec,
  type ResolvedElement,
  type ResolvedLayout,
  type SurfaceProfile,
} from "../../src/core/types";

const EPSILON = 0.5;

/**
 * Checks whether every visible element in the layout is strictly positioned within the surface bounds.
 *
 * @param layout - The resolved layout candidate.
 * @param surface - Target surface profile.
 * @returns true if all visible elements fit within [0, 0, surface.width, surface.height].
 */
export function everyElementWithinBounds(
  layout: ResolvedLayout,
  surface: SurfaceProfile,
): boolean {
  const visibleElements = layout.elements.filter((el: ResolvedElement) => el.visible);

  for (const el of visibleElements) {
    if (el.x < -EPSILON) return false;
    if (el.y < -EPSILON) return false;
    if (el.x + el.width > surface.width + EPSILON) return false;
    if (el.y + el.height > surface.height + EPSILON) return false;
  }

  return true;
}

/**
 * Checks whether every kept/visible touch target (button) meets or exceeds the minimum tap target.
 *
 * @param layout - The resolved layout candidate.
 * @param spec - The source ad specification.
 * @param surface - Target surface profile.
 * @returns true if all visible button elements satisfy min tap dimensions.
 */
export function everyKeptTapTargetMeetsMinimum(
  layout: ResolvedLayout,
  spec: AdSpec,
  surface: SurfaceProfile,
): boolean {
  const specElementMap = new Map<string, AdElement>();
  for (const elem of spec.elements) {
    specElementMap.set(elem.id, elem);
  }

  const visibleButtons = layout.elements.filter(
    (el: ResolvedElement) => el.visible && el.type === "button",
  );

  for (const el of visibleButtons) {
    const specElem = specElementMap.get(el.id);
    const minRequiredTap = Math.max(
      surface.minTapTarget ?? 0,
      (specElem && "minTapTarget" in specElem ? specElem.minTapTarget : undefined) ?? 0,
      surface.touchOnly ? 44 : 0,
    );

    if (minRequiredTap > 0) {
      if (el.width < minRequiredTap - EPSILON || el.height < minRequiredTap - EPSILON) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks whether every kept/visible text and button element meets or exceeds minimum font size constraints.
 *
 * @param layout - The resolved layout candidate.
 * @param spec - The source ad specification.
 * @param surface - Target surface profile.
 * @returns true if all visible text elements satisfy minimum font size.
 */
export function everyKeptTextMeetsMinimumSize(
  layout: ResolvedLayout,
  spec: AdSpec,
  surface: SurfaceProfile,
): boolean {
  const specElementMap = new Map<string, AdElement>();
  for (const elem of spec.elements) {
    specElementMap.set(elem.id, elem);
  }

  const visibleTextElements = layout.elements.filter(
    (el: ResolvedElement) => el.visible && (el.type === "text" || el.type === "button"),
  );

  for (const el of visibleTextElements) {
    if (typeof el.fontSize === "number") {
      const specElem = specElementMap.get(el.id);
      const minSpecFontSize =
        specElem && specElem.type === "text" && specElem.minFontSize
          ? specElem.minFontSize
          : 0;
      const minSurfaceFontSize = surface.minTextSize ?? 0;
      const minAllowed = Math.max(minSpecFontSize, minSurfaceFontSize);

      if (minAllowed > 0 && el.fontSize < minAllowed - EPSILON) {
        return false;
      }
    }
  }

  return true;
}

// Objective scoring functions to evaluate layout candidates, visual hierarchy balance, and constraint satisfaction.

import {
  type ResolvedElement,
  type ResolvedLayout,
  type SurfaceProfile,
} from "./types";

/** 2D axis-aligned bounding rectangle. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Checks whether two 2D axis-aligned bounding boxes intersect.
 * Allows a tiny epsilon tolerance (default 0.5px) to prevent false positives from floating point rounding.
 *
 * @param a - First bounding box.
 * @param b - Second bounding box.
 * @param epsilon - Epsilon tolerance in pixels.
 * @returns True if rectangles overlap by more than epsilon.
 */
export function rectsOverlap(a: Rect, b: Rect, epsilon = 0.5): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false;
  }

  const noOverlap =
    a.x + a.width <= b.x + epsilon ||
    b.x + b.width <= a.x + epsilon ||
    a.y + a.height <= b.y + epsilon ||
    b.y + b.height <= a.y + epsilon;

  return !noOverlap;
}

/**
 * Computes the total number of overlapping pairs among visible elements in a resolved layout.
 *
 * @param target - A ResolvedLayout or an array of ResolvedElement objects.
 * @returns Total count of pairwise element bounding box intersections.
 */
export function computeOverlap(target: ResolvedLayout | readonly ResolvedElement[]): number {
  const elements: readonly ResolvedElement[] =
    "elements" in target ? target.elements : target;
  const visibleElements = elements.filter((el: ResolvedElement) => el.visible);

  let overlapCount = 0;

  for (let i = 0; i < visibleElements.length; i++) {
    const elA = visibleElements[i];
    if (!elA) continue;

    for (let j = i + 1; j < visibleElements.length; j++) {
      const elB = visibleElements[j];
      if (!elB) continue;

      if (rectsOverlap(elA, elB)) {
        overlapCount++;
      }
    }
  }

  return overlapCount;
}

/**
 * Computes the number of visible elements that clip outside the surface's visible boundary.
 *
 * @param layout - The resolved layout containing positioned elements.
 * @param surface - The target surface profile with physical boundaries.
 * @returns Count of elements extending beyond the surface viewport.
 */
export function computeClipping(layout: ResolvedLayout, surface: SurfaceProfile): number {
  const visibleElements = layout.elements.filter((el: ResolvedElement) => el.visible);
  let clippingCount = 0;
  const epsilon = 0.5;

  for (const element of visibleElements) {
    const outOfBoundsLeft = element.x < -epsilon;
    const outOfBoundsTop = element.y < -epsilon;
    const outOfBoundsRight = element.x + element.width > surface.width + epsilon;
    const outOfBoundsBottom = element.y + element.height > surface.height + epsilon;

    if (outOfBoundsLeft || outOfBoundsTop || outOfBoundsRight || outOfBoundsBottom) {
      clippingCount++;
    }
  }

  return clippingCount;
}

// Core constraint-based layout resolution algorithm orchestrating multi-pass spatial partitioning and degradation.

import {
  type AdElement,
  type AdSpec,
  type ElementRole,
  type ResolvedElement,
  type ResolvedLayout,
  type SurfaceProfile,
} from "./types";
import { defaultTextMeasurer, type TextMeasurer } from "../measurement/text-measurer";
import { computeClipping, computeOverlap } from "./scoring";

/** Options to configure the constraint resolver execution. */
export interface ResolveOptions {
  /** Custom text measurement implementation (defaults to EstimateTextMeasurer). */
  readonly textMeasurer?: TextMeasurer;
}

/** Internal measured dimensions and properties for an element before coordinate placement. */
interface MeasuredElement {
  readonly element: AdElement;
  readonly width: number;
  readonly height: number;
  readonly fontSize?: number;
  readonly decisions: string[];
}

/** Determines default preferred font size based on element role. */
function getDefaultFontSizeForRole(role: ElementRole): number {
  switch (role) {
    case "hero":
    case "primary":
      return 24;
    case "action":
      return 16;
    case "secondary":
      return 15;
    case "branding":
      return 14;
  }
}

/**
 * Measures an individual ad element against surface constraints and available width.
 *
 * @param element - The declarative ad element to measure.
 * @param surface - Target surface profile containing physical bounds and min text sizes.
 * @param availableWidth - Available horizontal content width inside safe area.
 * @param availableHeight - Available vertical content height inside safe area.
 * @param measurer - Text measurement engine.
 * @returns Measured element dimensions and typography properties.
 */
function measureElement(
  element: AdElement,
  surface: SurfaceProfile,
  availableWidth: number,
  availableHeight: number,
  measurer: TextMeasurer,
): MeasuredElement {
  const decisions: string[] = [];

  switch (element.type) {
    case "text": {
      const minText = Math.max(surface.minTextSize ?? 12, element.minFontSize ?? 12);
      const preferred = element.preferredFontSize ?? getDefaultFontSizeForRole(element.role);
      const fontSize = Math.max(minText, preferred);

      if (surface.minTextSize && fontSize === surface.minTextSize) {
        decisions.push(`Clamped font size to surface.minTextSize (${surface.minTextSize}px) for legibility.`);
      }

      const measured = measurer.measure({
        text: element.content,
        fontSize,
        maxWidth: availableWidth,
      });

      const width = Math.max(element.minWidth ?? 0, Math.min(availableWidth, measured.width));
      const height = Math.max(element.minHeight ?? 0, measured.height);

      return {
        element,
        width,
        height,
        fontSize,
        decisions,
      };
    }

    case "image": {
      const aspectRatio = element.aspectRatio ?? (element.role === "hero" ? 1.5 : 1.0);

      // Default ideal dimension budgeting
      let targetWidth = element.preferredWidth;
      let targetHeight = element.preferredHeight;

      if (!targetWidth && !targetHeight) {
        if (element.role === "hero") {
          targetWidth = Math.min(availableWidth, Math.round(availableHeight * 0.4 * aspectRatio));
          targetHeight = Math.round(targetWidth / aspectRatio);
        } else {
          // Secondary / branding icon
          targetWidth = Math.min(availableWidth * 0.4, 80);
          targetHeight = Math.round(targetWidth / aspectRatio);
        }
      } else if (targetWidth && !targetHeight) {
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else if (!targetWidth && targetHeight) {
        targetWidth = Math.round(targetHeight * aspectRatio);
      }

      const width = Math.max(element.minWidth ?? 0, Math.min(availableWidth, targetWidth ?? 100));
      const height = Math.max(element.minHeight ?? 0, Math.min(availableHeight, targetHeight ?? 100));

      return {
        element,
        width,
        height,
        decisions,
      };
    }

    case "button": {
      const minTap = Math.max(surface.minTapTarget ?? 0, element.minTapTarget ?? 0, 40);
      const minText = surface.minTextSize ?? 14;
      const fontSize = Math.max(minText, 16);

      const labelMeasured = measurer.measure({
        text: element.label,
        fontSize,
        maxWidth: availableWidth - 32,
      });

      const horizontalPadding = 32;
      const verticalPadding = 16;
      const width = Math.max(
        minTap,
        element.minWidth ?? 0,
        Math.min(availableWidth, labelMeasured.width + horizontalPadding),
      );
      const height = Math.max(
        minTap,
        element.minHeight ?? 0,
        labelMeasured.height + verticalPadding,
      );

      if (surface.minTapTarget && height >= surface.minTapTarget) {
        decisions.push(`Ensured button meets surface.minTapTarget (${surface.minTapTarget}px).`);
      }

      return {
        element,
        width,
        height,
        fontSize,
        decisions,
      };
    }
  }
}

/**
 * Resolves a declarative AdSpec against a target SurfaceProfile to produce a concrete ResolvedLayout.
 * Executes normalization, element measurement, and priority-ordered spatial placement.
 *
 * @param spec - The declarative ad specification to lay out.
 * @param surface - Target surface profile with physical bounds and constraints.
 * @param options - Resolution options including custom text measurement engine.
 * @returns Fully computed, immutable ResolvedLayout.
 */
export function resolve(
  spec: AdSpec,
  surface: SurfaceProfile,
  options?: ResolveOptions,
): ResolvedLayout {
  const startTime = performance.now();
  const measurer = options?.textMeasurer ?? defaultTextMeasurer;

  // 1. Normalize content area by subtracting safeArea insets
  const safeArea = surface.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const contentX = safeArea.left;
  const contentY = safeArea.top;
  const availableWidth = Math.max(1, surface.width - (safeArea.left + safeArea.right));
  const availableHeight = Math.max(1, surface.height - (safeArea.top + safeArea.bottom));

  // 2. Sort elements by priority (1 is highest priority)
  const sortedElements = [...spec.elements].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Stable tie-breaker: role order
    const roleRank: Record<ElementRole, number> = {
      hero: 1,
      primary: 2,
      action: 3,
      secondary: 4,
      branding: 5,
    };
    return roleRank[a.role] - roleRank[b.role];
  });

  // 3. Measure elements
  const measuredList: MeasuredElement[] = sortedElements.map((elem) =>
    measureElement(elem, surface, availableWidth, availableHeight, measurer),
  );

  // 4. Place elements in stack/flow
  const gap = 12;
  let currentY = contentY;
  const resolvedElements: ResolvedElement[] = [];

  for (const item of measuredList) {
    const { element, width, height, fontSize, decisions } = item;
    const x = contentX + Math.max(0, Math.round((availableWidth - width) / 2));
    const y = currentY;

    resolvedElements.push({
      id: element.id,
      type: element.type,
      role: element.role,
      priority: element.priority,
      x,
      y,
      width,
      height,
      fontSize,
      status: "kept",
      decisions: [...decisions],
      content: element.type === "text" ? element.content : undefined,
      label: element.type === "button" ? element.label : undefined,
      src: element.type === "image" ? element.src : undefined,
      visible: true,
    });

    currentY += height + gap;
  }

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

  const layout: ResolvedLayout = {
    surfaceId: surface.id,
    dimensions: {
      width: surface.width,
      height: surface.height,
    },
    elements: resolvedElements,
    metrics: {
      durationMs,
      hardViolations: 0,
      overlapCount: 0,
      clippingCount: 0,
      archetype: "VerticalStack",
    },
  };

  const overlapCount = computeOverlap(layout);
  const clippingCount = computeClipping(layout, surface);
  const hardViolations = overlapCount + clippingCount;

  return {
    ...layout,
    metrics: {
      ...layout.metrics,
      hardViolations,
      overlapCount,
      clippingCount,
    },
  };
}

/** Alias for resolve() matching layout engine naming convention. */
export const resolveLayout = resolve;

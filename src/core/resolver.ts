// Core constraint-based layout resolution algorithm orchestrating multi-pass spatial partitioning and degradation.

import {
  type AdElement,
  type AdSpec,
  type ElementRole,
  type ElementStatus,
  type Priority,
  type ResolvedElement,
  type ResolvedLayout,
  type SurfaceProfile,
} from "./types";
import { defaultTextMeasurer, type TextMeasurer } from "../measurement/text-measurer";
import { computeClipping, computeOverlap } from "./scoring";
import { validateLayout } from "./validation";

/** Options to configure the constraint resolver execution. */
export interface ResolveOptions {
  /** Custom text measurement implementation (defaults to EstimateTextMeasurer). */
  readonly textMeasurer?: TextMeasurer;
}

/** Internal mutable state for an element during progressive degradation iterations. */
interface ElementWorkingState {
  readonly original: AdElement;
  readonly id: string;
  readonly type: AdElement["type"];
  readonly role: ElementRole;
  readonly priority: Priority;
  visible: boolean;
  status: ElementStatus;
  fontSize?: number;
  minFontSize: number;
  scale: number;
  displayText: string;
  isTruncated: boolean;
  isRepositioned: boolean;
  ladderStep: number;
  decisions: string[];
}

/** Default font size lookup by element role. */
function getDefaultFontSizeForRole(role: ElementRole): number {
  switch (role) {
    case "hero":
    case "primary":
      return 26;
    case "action":
      return 16;
    case "secondary":
      return 15;
    case "branding":
      return 14;
  }
}

/** Initializes the working state for all elements in an AdSpec. */
function initializeWorkingStates(
  spec: AdSpec,
  surface: SurfaceProfile,
): ElementWorkingState[] {
  return spec.elements.map((elem) => {
    let initialFontSize: number | undefined;
    let minFontSize = 12;

    if (elem.type === "text") {
      minFontSize = Math.max(surface.minTextSize ?? 12, elem.minFontSize ?? 12);
      initialFontSize = Math.max(
        minFontSize,
        elem.preferredFontSize ?? getDefaultFontSizeForRole(elem.role),
      );
    } else if (elem.type === "button") {
      minFontSize = surface.minTextSize ?? 14;
      initialFontSize = Math.max(minFontSize, 16);
    }

    const displayText = elem.type === "text" ? elem.content : elem.type === "button" ? elem.label : "";

    return {
      original: elem,
      id: elem.id,
      type: elem.type,
      role: elem.role,
      priority: elem.priority,
      visible: true,
      status: "kept",
      fontSize: initialFontSize,
      minFontSize,
      scale: 1.0,
      displayText,
      isTruncated: false,
      isRepositioned: false,
      ladderStep: 0,
      decisions: [],
    };
  });
}

/** Measures element dimensions based on current degradation state. */
function measureState(
  state: ElementWorkingState,
  surface: SurfaceProfile,
  availableWidth: number,
  availableHeight: number,
  measurer: TextMeasurer,
): { width: number; height: number; fontSize?: number } {
  const elem = state.original;

  switch (state.type) {
    case "text": {
      const fontSize = state.fontSize ?? 16;
      const measured = measurer.measure({
        text: state.displayText,
        fontSize,
        maxWidth: availableWidth,
      });

      const width = Math.max(elem.minWidth ?? 0, Math.min(availableWidth, measured.width));
      const height = Math.max(elem.minHeight ?? 0, measured.height);

      return { width, height, fontSize };
    }

    case "image": {
      const aspectRatio = elem.type === "image" && elem.aspectRatio ? elem.aspectRatio : elem.role === "hero" ? 1.5 : 1.0;

      let baseWidth: number;
      let baseHeight: number;

      if (elem.preferredWidth && elem.preferredHeight) {
        baseWidth = elem.preferredWidth;
        baseHeight = elem.preferredHeight;
      } else if (elem.role === "hero") {
        baseWidth = Math.min(availableWidth, Math.round(availableHeight * 0.45 * aspectRatio));
        baseHeight = Math.round(baseWidth / aspectRatio);
      } else {
        baseWidth = Math.min(availableWidth * 0.35, 75);
        baseHeight = Math.round(baseWidth / aspectRatio);
      }

      const minW = Math.max(elem.minWidth ?? 24, 24);
      const minH = Math.max(elem.minHeight ?? 24, Math.round(minW / aspectRatio));

      const width = Math.max(minW, Math.min(availableWidth, Math.round(baseWidth * state.scale)));
      const height = Math.max(minH, Math.min(availableHeight, Math.round(baseHeight * state.scale)));

      return { width, height };
    }

    case "button": {
      const minTap = Math.max(
        surface.minTapTarget ?? 0,
        (elem.type === "button" && elem.minTapTarget ? elem.minTapTarget : 0),
        surface.touchOnly ? 44 : 36,
      );

      const fontSize = state.fontSize ?? 16;
      const labelMeasured = measurer.measure({
        text: state.displayText,
        fontSize,
        maxWidth: availableWidth - 24,
      });

      const horizontalPadding = Math.round(28 * state.scale) + 8;
      const verticalPadding = Math.round(14 * state.scale) + 6;

      const width = Math.max(
        minTap,
        elem.minWidth ?? 0,
        Math.min(availableWidth, labelMeasured.width + horizontalPadding),
      );
      const height = Math.max(
        minTap,
        elem.minHeight ?? 0,
        labelMeasured.height + verticalPadding,
      );

      return { width, height, fontSize };
    }
  }
}

/** Generates a candidate ResolvedLayout from the current working state. */
function buildCandidateLayout(
  workingStates: ElementWorkingState[],
  surface: SurfaceProfile,
  measurer: TextMeasurer,
): ResolvedLayout {
  const safeArea = surface.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const contentX = safeArea.left;
  const contentY = safeArea.top;
  const availableWidth = Math.max(1, surface.width - (safeArea.left + safeArea.right));
  const availableHeight = Math.max(1, surface.height - (safeArea.top + safeArea.bottom));

  // Sort visible elements by priority for top-to-bottom layout
  const activeStates = workingStates.filter((s) => s.visible);
  const sortedStates = [...activeStates].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const roleRank: Record<ElementRole, number> = {
      hero: 1,
      primary: 2,
      action: 3,
      secondary: 4,
      branding: 5,
    };
    return roleRank[a.role] - roleRank[b.role];
  });

  const measuredItems = sortedStates.map((st) => ({
    state: st,
    measured: measureState(st, surface, availableWidth, availableHeight, measurer),
  }));

  // Dynamic vertical gap budgeting
  const totalMeasuredHeight = measuredItems.reduce((sum, item) => sum + item.measured.height, 0);
  const numItems = measuredItems.length;
  let gap = 12;

  if (numItems > 1) {
    const leftoverSpace = availableHeight - totalMeasuredHeight;
    if (leftoverSpace < (numItems - 1) * gap) {
      gap = Math.max(4, Math.floor(leftoverSpace / (numItems - 1)));
    }
  }

  let currentY = contentY;
  const resolvedElements: ResolvedElement[] = [];

  for (const item of measuredItems) {
    const { state, measured } = item;
    const x = contentX + Math.max(0, Math.round((availableWidth - measured.width) / 2));
    const y = currentY;

    resolvedElements.push({
      id: state.id,
      type: state.type,
      role: state.role,
      priority: state.priority,
      x,
      y,
      width: measured.width,
      height: measured.height,
      fontSize: measured.fontSize,
      status: state.status,
      decisions: [...state.decisions],
      content: state.type === "text" ? state.displayText : undefined,
      label: state.type === "button" ? state.displayText : undefined,
      src: state.type === "image" && state.original.type === "image" ? state.original.src : undefined,
      visible: true,
    });

    currentY += measured.height + gap;
  }

  // Include dropped elements as non-visible with 0 dimensions
  for (const st of workingStates) {
    if (!st.visible) {
      resolvedElements.push({
        id: st.id,
        type: st.type,
        role: st.role,
        priority: st.priority,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        status: "dropped",
        decisions: [...st.decisions],
        visible: false,
      });
    }
  }

  const layout: ResolvedLayout = {
    surfaceId: surface.id,
    dimensions: {
      width: surface.width,
      height: surface.height,
    },
    elements: resolvedElements,
    metrics: {
      durationMs: 0,
      hardViolations: 0,
      overlapCount: 0,
      clippingCount: 0,
      archetype: "VerticalStack",
    },
  };

  const overlapCount = computeOverlap(layout);
  const clippingCount = computeClipping(layout, surface);

  return {
    ...layout,
    metrics: {
      ...layout.metrics,
      overlapCount,
      clippingCount,
      hardViolations: overlapCount + clippingCount,
    },
  };
}

/**
 * Applies a single atomic degradation step to an element state according to its role and type ladder.
 * Returns true if a degradation step was applied, or false if the element's ladder is fully exhausted.
 */
function degradeElement(state: ElementWorkingState, surface: SurfaceProfile): boolean {
  state.ladderStep++;

  // 1. Droppable / Branding role elements: shrink -> reposition -> drop
  const isDroppable =
    state.original.canDrop === true ||
    (state.original.canDrop !== false && (state.role === "branding" || state.role === "secondary" || state.priority >= 3));

  if (state.role === "branding" || (state.priority >= 3 && isDroppable)) {
    if (state.ladderStep === 1) {
      if (state.scale > 0.6 && state.original.canShrink !== false) {
        state.scale = 0.6;
        state.status = "shrunk";
        state.decisions.push(`Shrunk branding/secondary element to 60% scale.`);
        return true;
      }
    } else if (state.ladderStep === 2) {
      if (!state.isRepositioned) {
        state.isRepositioned = true;
        state.status = "repositioned";
        state.decisions.push(`Repositioned to compact peripheral zone.`);
        return true;
      }
    } else if (state.ladderStep >= 3) {
      if (isDroppable && state.visible) {
        state.visible = false;
        state.status = "dropped";
        state.decisions.push(`Dropped: priority ${state.priority}, canDrop=true, insufficient space remaining.`);
        return true;
      }
    }
  }

  // Non-droppable element explicitly marked canDrop=false
  if (state.original.canDrop === false && state.ladderStep >= 3) {
    if (!state.decisions.some((d) => d.includes("canDrop=false"))) {
      state.decisions.push(`Cannot drop element (canDrop=false); remaining at minimum size despite constraint pressure.`);
    }
  }

  // 2. Text element ladder: shrink font -> wrap -> truncate
  if (state.type === "text") {
    if (state.original.canShrink !== false && state.fontSize && state.fontSize > state.minFontSize) {
      const stepDown = Math.max(state.minFontSize, state.fontSize - 4);
      const oldFont = state.fontSize;
      state.fontSize = stepDown;
      state.status = "shrunk";
      state.decisions.push(`Reduced font size ${oldFont}px -> ${stepDown}px to fit available height.`);
      return true;
    }

    if (!state.isTruncated && state.original.canTruncate !== false && state.displayText.length > 12) {
      const truncateLength = Math.max(8, Math.floor(state.displayText.length * 0.6));
      state.displayText = state.displayText.slice(0, truncateLength).trim() + "...";
      state.isTruncated = true;
      state.status = "truncated";
      state.decisions.push(`Truncated text copy with ellipsis to fit safe boundary.`);
      return true;
    }
  }

  // 3. Image element ladder: scale down -> crop
  if (state.type === "image") {
    if (state.original.canShrink !== false && state.scale > 0.5) {
      state.scale = Math.max(0.4, state.scale - 0.25);
      state.status = "shrunk";
      state.decisions.push(`Scaled image dimensions to ${Math.round(state.scale * 100)}% to fit available space.`);
      return true;
    }
  }

  // 4. Button element ladder: shrink padding (NEVER below minTapTarget)
  if (state.type === "button") {
    if (state.original.canShrink !== false && state.scale > 0.5) {
      state.scale = 0.5;
      state.status = "shrunk";
      state.decisions.push(
        `Reduced button internal padding to fit available space while maintaining minTapTarget (${surface.minTapTarget ?? 44}px).`,
      );
      return true;
    }
  }

  // Final check for non-droppable non-shrinkable elements
  if (state.original.canDrop === false || state.original.canShrink === false) {
    if (!state.decisions.some((d) => d.includes("canDrop=false"))) {
      state.decisions.push(`Cannot drop element (canDrop=false); remaining at minimum size despite constraint pressure.`);
    }
  }

  return false;
}

/**
 * Resolves a declarative AdSpec against a target SurfaceProfile to produce a concrete ResolvedLayout.
 * Orchestrates multi-pass measurement, placement, validation, and priority-ordered degradation.
 *
 * @param spec - The declarative ad specification to lay out.
 * @param surface - Target surface profile with physical bounds and constraints.
 * @param options - Resolution options including custom text measurement engine.
 * @returns Fully computed, immutable ResolvedLayout with complete metrics and trace logs.
 */
export function resolve(
  spec: AdSpec,
  surface: SurfaceProfile,
  options?: ResolveOptions,
): ResolvedLayout {
  const startTime = performance.now();
  const measurer = options?.textMeasurer ?? defaultTextMeasurer;

  // 1. Initialize working states
  const workingStates = initializeWorkingStates(spec, surface);

  // 2. Initial placement pass
  let currentLayout = buildCandidateLayout(workingStates, surface, measurer);
  let validation = validateLayout(currentLayout, surface, spec);

  // If initial placement is fully valid, return immediately
  if (validation.isValid) {
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    return {
      ...currentLayout,
      metrics: {
        ...currentLayout.metrics,
        durationMs,
        hardViolations: 0,
        overlapCount: 0,
        clippingCount: 0,
      },
    };
  }

  // 3. Degradation loop in strict REVERSE priority order:
  // Exhaust all steps of lowest priority elements before touching higher priority elements.
  const roleDegradationRank: Record<ElementRole, number> = {
    branding: 1,
    secondary: 2,
    action: 3,
    primary: 4,
    hero: 5,
  };

  const degradationQueue = [...workingStates].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Highest numeric priority (lowest importance) first
    }
    return roleDegradationRank[a.role] - roleDegradationRank[b.role];
  });

  const maxIterations = 60;
  let iterations = 0;

  for (const targetState of degradationQueue) {
    if (validation.isValid || iterations >= maxIterations) {
      break;
    }

    // Repeatedly degrade this single element through its ladder until it is exhausted
    // or until the whole layout becomes valid!
    let canDegradeFurther = true;
    while (canDegradeFurther && !validation.isValid && iterations < maxIterations) {
      iterations++;
      canDegradeFurther = degradeElement(targetState, surface);

      currentLayout = buildCandidateLayout(workingStates, surface, measurer);
      validation = validateLayout(currentLayout, surface, spec);
    }
  }

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const finalValidation = validateLayout(currentLayout, surface, spec);

  return {
    ...currentLayout,
    metrics: {
      ...currentLayout.metrics,
      durationMs,
      hardViolations: finalValidation.hardViolations.length,
      overlapCount: finalValidation.overlaps.length,
      clippingCount: finalValidation.clipped.length,
    },
  };
}

/** Alias for resolve() matching layout engine naming convention. */
export const resolveLayout = resolve;

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
import { DiagnosticsCollector, type ResolutionDiagnostics } from "./diagnostics";

/** Options to configure the constraint resolver execution. */
export interface ResolveOptions {
  /** Custom text measurement implementation (defaults to EstimateTextMeasurer). */
  readonly textMeasurer?: TextMeasurer;
}

/** Layout geometric archetype category derived dynamically from surface aspect ratio. */
export type LayoutArchetype = "TallStack" | "BalancedGrid" | "HorizontalSplit" | "UltraWideRibbon";

/**
 * Determines the geometric macro-archetype purely from aspect ratio.
 *
 * @param width - Surface width in pixels.
 * @param height - Surface height in pixels.
 * @returns Classified LayoutArchetype.
 */
export function determineLayoutArchetype(width: number, height: number): LayoutArchetype {
  const aspectRatio = width / Math.max(1, height);
  if (aspectRatio > 3.5) {
    return "UltraWideRibbon";
  }
  if (aspectRatio > 1.35) {
    return "HorizontalSplit";
  }
  if (aspectRatio >= 0.85) {
    return "BalancedGrid";
  }
  return "TallStack";
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
      const aspectRatio =
        elem.type === "image" && elem.aspectRatio ? elem.aspectRatio : elem.role === "hero" ? 1.5 : 1.0;

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
        elem.type === "button" && elem.minTapTarget ? elem.minTapTarget : 0,
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

/** Spatial placement for 2-column HorizontalSplit archetype (e.g. Mobile Landscape 640x360). */
function placeHorizontalSplit(
  workingStates: ElementWorkingState[],
  surface: SurfaceProfile,
  measurer: TextMeasurer,
  contentX: number,
  contentY: number,
  availableWidth: number,
  availableHeight: number,
): ResolvedElement[] {
  const activeStates = workingStates.filter((s) => s.visible);
  const heroState = activeStates.find((s) => s.role === "hero");
  const contentStates = activeStates.filter((s) => s !== heroState);

  const gutter = 16;
  const leftColWidth = heroState ? Math.floor((availableWidth - gutter) * 0.44) : 0;
  const rightColWidth = heroState ? availableWidth - leftColWidth - gutter : availableWidth;

  const leftColX = contentX;
  const rightColX = heroState ? contentX + leftColWidth + gutter : contentX;

  const resolvedElements: ResolvedElement[] = [];

  // 1. Hero in left column
  if (heroState) {
    const heroMeasured = measureState(heroState, surface, leftColWidth, availableHeight, measurer);
    const heroWidth = Math.min(leftColWidth, heroMeasured.width);
    const heroHeight = Math.min(availableHeight, heroMeasured.height);
    const heroX = leftColX + Math.max(0, Math.round((leftColWidth - heroWidth) / 2));
    const heroY = contentY + Math.max(0, Math.round((availableHeight - heroHeight) / 2));

    resolvedElements.push({
      id: heroState.id,
      type: heroState.type,
      role: heroState.role,
      priority: heroState.priority,
      x: heroX,
      y: heroY,
      width: heroWidth,
      height: heroHeight,
      status: heroState.status,
      decisions: [...heroState.decisions],
      src: heroState.type === "image" && heroState.original.type === "image" ? heroState.original.src : undefined,
      visible: true,
    });
  }

  // 2. Remaining elements in right column
  const sortedRightStates = [...contentStates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const roleRank: Record<ElementRole, number> = { primary: 1, action: 2, secondary: 3, branding: 4, hero: 5 };
    return roleRank[a.role] - roleRank[b.role];
  });

  const measuredRightItems = sortedRightStates.map((st) => ({
    state: st,
    measured: measureState(st, surface, rightColWidth, availableHeight, measurer),
  }));

  const totalRightHeight = measuredRightItems.reduce((sum, item) => sum + item.measured.height, 0);
  let gap = 10;
  if (measuredRightItems.length > 1) {
    const space = availableHeight - totalRightHeight;
    gap = Math.max(4, Math.min(12, Math.floor(space / (measuredRightItems.length - 1))));
  }

  let currentY = contentY + Math.max(0, Math.round((availableHeight - (totalRightHeight + (measuredRightItems.length - 1) * gap)) / 2));
  for (const item of measuredRightItems) {
    const { state, measured } = item;
    const itemW = Math.min(rightColWidth, measured.width);
    const itemX = rightColX + Math.max(0, Math.round((rightColWidth - itemW) / 2));
    const itemY = currentY;

    resolvedElements.push({
      id: state.id,
      type: state.type,
      role: state.role,
      priority: state.priority,
      x: itemX,
      y: itemY,
      width: itemW,
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

  return resolvedElements;
}

/** Spatial placement for UltraWideRibbon archetype (e.g. Broadcast TV Lower-Third 1920x250). */
function placeUltraWideRibbon(
  workingStates: ElementWorkingState[],
  surface: SurfaceProfile,
  measurer: TextMeasurer,
  contentX: number,
  contentY: number,
  availableWidth: number,
  availableHeight: number,
): ResolvedElement[] {
  const activeStates = workingStates.filter((s) => s.visible);
  const resolvedElements: ResolvedElement[] = [];

  const brandingState = activeStates.find((s) => s.role === "branding");
  const heroState = activeStates.find((s) => s.role === "hero");
  const ctaState = activeStates.find((s) => s.role === "action");
  const textStates = activeStates.filter((s) => s.role === "primary" || s.role === "secondary");

  const gap = 24;
  let currentX = contentX;

  // 1. Branding on far left
  if (brandingState) {
    const brandMeasured = measureState(brandingState, surface, 160, availableHeight, measurer);
    const brandW = Math.min(180, brandMeasured.width);
    const brandH = Math.min(availableHeight, brandMeasured.height);
    const brandY = contentY + Math.max(0, Math.round((availableHeight - brandH) / 2));

    resolvedElements.push({
      id: brandingState.id,
      type: brandingState.type,
      role: brandingState.role,
      priority: brandingState.priority,
      x: currentX,
      y: brandY,
      width: brandW,
      height: brandH,
      status: brandingState.status,
      decisions: [...brandingState.decisions],
      src: brandingState.type === "image" && brandingState.original.type === "image" ? brandingState.original.src : undefined,
      visible: true,
    });
    currentX += brandW + gap;
  }

  // 2. Hero thumbnail next
  if (heroState) {
    const heroMaxW = Math.round(availableHeight * 1.3);
    const heroMeasured = measureState(heroState, surface, heroMaxW, availableHeight, measurer);
    const heroW = Math.min(heroMaxW, heroMeasured.width);
    const heroH = Math.min(availableHeight, heroMeasured.height);
    const heroY = contentY + Math.max(0, Math.round((availableHeight - heroH) / 2));

    resolvedElements.push({
      id: heroState.id,
      type: heroState.type,
      role: heroState.role,
      priority: heroState.priority,
      x: currentX,
      y: heroY,
      width: heroW,
      height: heroH,
      status: heroState.status,
      decisions: [...heroState.decisions],
      src: heroState.type === "image" && heroState.original.type === "image" ? heroState.original.src : undefined,
      visible: true,
    });
    currentX += heroW + gap;
  }

  // 3. CTA on far right
  let ctaW = 0;
  if (ctaState) {
    const ctaMeasured = measureState(ctaState, surface, 320, availableHeight, measurer);
    ctaW = Math.min(340, ctaMeasured.width);
    const ctaH = Math.min(availableHeight, ctaMeasured.height);
    const ctaX = contentX + availableWidth - ctaW;
    const ctaY = contentY + Math.max(0, Math.round((availableHeight - ctaH) / 2));

    resolvedElements.push({
      id: ctaState.id,
      type: ctaState.type,
      role: ctaState.role,
      priority: ctaState.priority,
      x: ctaX,
      y: ctaY,
      width: ctaW,
      height: ctaH,
      fontSize: ctaMeasured.fontSize,
      status: ctaState.status,
      decisions: [...ctaState.decisions],
      label: ctaState.displayText,
      visible: true,
    });
  }

  // 4. Headline & Price in center column
  const centerColWidth = Math.max(100, contentX + availableWidth - (ctaW > 0 ? ctaW + gap : 0) - currentX);
  const measuredTextItems = textStates.map((st) => ({
    state: st,
    measured: measureState(st, surface, centerColWidth, availableHeight, measurer),
  }));

  const totalTextH = measuredTextItems.reduce((sum, item) => sum + item.measured.height, 0);
  const textGap = 6;
  let textY = contentY + Math.max(0, Math.round((availableHeight - (totalTextH + (measuredTextItems.length - 1) * textGap)) / 2));

  for (const item of measuredTextItems) {
    const { state, measured } = item;
    const itemW = Math.min(centerColWidth, measured.width);

    resolvedElements.push({
      id: state.id,
      type: state.type,
      role: state.role,
      priority: state.priority,
      x: currentX,
      y: textY,
      width: itemW,
      height: measured.height,
      fontSize: measured.fontSize,
      status: state.status,
      decisions: [...state.decisions],
      content: state.displayText,
      visible: true,
    });
    textY += measured.height + textGap;
  }

  return resolvedElements;
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

  const archetype = determineLayoutArchetype(surface.width, surface.height);
  let resolvedElements: ResolvedElement[];

  if (archetype === "HorizontalSplit") {
    resolvedElements = placeHorizontalSplit(
      workingStates,
      surface,
      measurer,
      contentX,
      contentY,
      availableWidth,
      availableHeight,
    );
  } else if (archetype === "UltraWideRibbon") {
    resolvedElements = placeUltraWideRibbon(
      workingStates,
      surface,
      measurer,
      contentX,
      contentY,
      availableWidth,
      availableHeight,
    );
  } else {
    // TallStack & BalancedGrid default vertical flow
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
    resolvedElements = [];

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
      archetype,
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
 * Returns the descriptive decision string if degraded, or null if the element's ladder is fully exhausted.
 */
function degradeElement(state: ElementWorkingState, surface: SurfaceProfile): string | null {
  state.ladderStep++;

  // 1. Droppable / Branding role elements: shrink -> reposition -> drop
  const isDroppable =
    state.original.canDrop === true ||
    (state.original.canDrop !== false &&
      (state.role === "branding" || state.role === "secondary" || state.priority >= 3));

  if (state.role === "branding" || (state.priority >= 3 && isDroppable)) {
    if (state.ladderStep === 1) {
      if (state.scale > 0.6 && state.original.canShrink !== false) {
        state.scale = 0.6;
        state.status = "shrunk";
        const decision = `Shrunk branding/secondary element to 60% scale.`;
        state.decisions.push(decision);
        return decision;
      }
    } else if (state.ladderStep === 2) {
      if (!state.isRepositioned) {
        state.isRepositioned = true;
        state.status = "repositioned";
        const decision = `Repositioned to compact peripheral zone.`;
        state.decisions.push(decision);
        return decision;
      }
    } else if (state.ladderStep >= 3) {
      if (isDroppable && state.visible) {
        state.visible = false;
        state.status = "dropped";
        const decision = `Dropped: priority ${state.priority}, canDrop=true, insufficient space remaining.`;
        state.decisions.push(decision);
        return decision;
      }
    }
  }

  // Non-droppable element explicitly marked canDrop=false
  if (state.original.canDrop === false && state.ladderStep >= 3) {
    if (!state.decisions.some((d) => d.includes("canDrop=false"))) {
      const decision = `Cannot drop element (canDrop=false); remaining at minimum size despite constraint pressure.`;
      state.decisions.push(decision);
    }
  }

  // 2. Text element ladder: shrink font -> wrap -> truncate
  if (state.type === "text") {
    if (state.original.canShrink !== false && state.fontSize && state.fontSize > state.minFontSize) {
      const stepDown = Math.max(state.minFontSize, state.fontSize - 4);
      const oldFont = state.fontSize;
      state.fontSize = stepDown;
      state.status = "shrunk";
      const decision = `Reduced font size ${oldFont}px -> ${stepDown}px to fit available height.`;
      state.decisions.push(decision);
      return decision;
    }

    if (!state.isTruncated && state.original.canTruncate !== false && state.displayText.length > 12) {
      const truncateLength = Math.max(8, Math.floor(state.displayText.length * 0.6));
      state.displayText = state.displayText.slice(0, truncateLength).trim() + "...";
      state.isTruncated = true;
      state.status = "truncated";
      const decision = `Truncated text copy with ellipsis to fit safe boundary.`;
      state.decisions.push(decision);
      return decision;
    }
  }

  // 3. Image element ladder: scale down -> crop
  if (state.type === "image") {
    if (state.original.canShrink !== false && state.scale > 0.5) {
      state.scale = Math.max(0.4, state.scale - 0.25);
      state.status = "shrunk";
      const decision = `Scaled image dimensions to ${Math.round(state.scale * 100)}% to fit available space.`;
      state.decisions.push(decision);
      return decision;
    }
  }

  // 4. Button element ladder: shrink padding (NEVER below minTapTarget)
  if (state.type === "button") {
    if (state.original.canShrink !== false && state.scale > 0.5) {
      state.scale = 0.5;
      state.status = "shrunk";
      const decision = `Reduced button internal padding to fit available space while maintaining minTapTarget (${surface.minTapTarget ?? 44}px).`;
      state.decisions.push(decision);
      return decision;
    }
  }

  // Final check for non-droppable non-shrinkable elements
  if (state.original.canDrop === false || state.original.canShrink === false) {
    if (!state.decisions.some((d) => d.includes("canDrop=false"))) {
      const decision = `Cannot drop element (canDrop=false); remaining at minimum size despite constraint pressure.`;
      state.decisions.push(decision);
    }
  }

  return null;
}

/**
 * Resolves a declarative AdSpec against a SurfaceProfile, returning both the ResolvedLayout and detailed diagnostics.
 *
 * @param spec - The declarative ad specification to lay out.
 * @param surface - Target surface profile with physical bounds and constraints.
 * @param options - Resolution options including custom text measurement engine.
 * @returns Object containing the ResolvedLayout and structured ResolutionDiagnostics report.
 */
export function resolveWithDiagnostics(
  spec: AdSpec,
  surface: SurfaceProfile,
  options?: ResolveOptions,
): { layout: ResolvedLayout; diagnostics: ResolutionDiagnostics } {
  const startTime = performance.now();
  const measurer = options?.textMeasurer ?? defaultTextMeasurer;
  const diagnostics = new DiagnosticsCollector();

  // 1. Normalize stage
  const safeArea = surface.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const availableWidth = Math.max(1, surface.width - (safeArea.left + safeArea.right));
  const availableHeight = Math.max(1, surface.height - (safeArea.top + safeArea.bottom));
  const archetype = determineLayoutArchetype(surface.width, surface.height);

  diagnostics.record(
    "normalize",
    `Normalized surface bounds: ${surface.width}x${surface.height}px (Aspect ratio: ${(surface.width / surface.height).toFixed(2)}, Archetype: ${archetype}) with safeArea insets [top:${safeArea.top}, right:${safeArea.right}, bottom:${safeArea.bottom}, left:${safeArea.left}]. Active content area: ${availableWidth}x${availableHeight}px.`,
  );
  diagnostics.record(
    "normalize",
    `Input AdSpec validated: ${spec.elements.length} elements sorted into priority hierarchy.`,
  );

  // 2. Measure stage
  const workingStates = initializeWorkingStates(spec, surface);

  for (const st of workingStates) {
    const measured = measureState(st, surface, availableWidth, availableHeight, measurer);
    diagnostics.record(
      "measure",
      `Measured ${st.type} element '${st.id}' (role: ${st.role}, priority: ${st.priority}): ${measured.width}x${measured.height}px${measured.fontSize ? `, fontSize: ${measured.fontSize}px` : ""}.`,
      st.id,
    );
  }

  // 3. Initial placement pass
  let currentLayout = buildCandidateLayout(workingStates, surface, measurer);
  const activeCount = workingStates.filter((s) => s.visible).length;
  diagnostics.record(
    "place",
    `Initial spatial placement pass: positioned ${activeCount}/${spec.elements.length} elements using ${archetype} archetype.`,
  );

  let validation = validateLayout(currentLayout, surface, spec);
  diagnostics.record(
    "validate",
    `Layout validation: ${validation.isValid ? "All hard constraints satisfied." : `${validation.hardViolations.length} constraint violations detected.`}`,
  );

  // 4. Priority-ordered degradation loop if constraint violations exist
  if (!validation.isValid) {
    const roleDegradationRank: Record<ElementRole, number> = {
      branding: 1,
      secondary: 2,
      action: 3,
      primary: 4,
      hero: 5,
    };

    const degradationQueue = [...workingStates].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return roleDegradationRank[a.role] - roleDegradationRank[b.role];
    });

    const maxIterations = 60;
    let iterations = 0;

    for (const targetState of degradationQueue) {
      if (validation.isValid || iterations >= maxIterations) {
        break;
      }

      let canDegradeFurther = true;
      while (canDegradeFurther && !validation.isValid && iterations < maxIterations) {
        iterations++;
        const decisionText = degradeElement(targetState, surface);

        if (decisionText) {
          diagnostics.record(
            "degrade",
            `Degraded element '${targetState.id}': ${decisionText}`,
            targetState.id,
          );
          currentLayout = buildCandidateLayout(workingStates, surface, measurer);
          validation = validateLayout(currentLayout, surface, spec);
          diagnostics.record(
            "validate",
            `Post-degradation check: ${validation.isValid ? "Resolved! All constraints satisfied." : `${validation.hardViolations.length} violations remaining.`}`,
          );
        } else {
          canDegradeFurther = false;
        }
      }
    }
  }

  // Re-build layout with final state decisions
  currentLayout = buildCandidateLayout(workingStates, surface, measurer);

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const finalValidation = validateLayout(currentLayout, surface, spec);

  const finalLayout: ResolvedLayout = {
    ...currentLayout,
    metrics: {
      ...currentLayout.metrics,
      durationMs,
      hardViolations: finalValidation.hardViolations.length,
      overlapCount: finalValidation.overlaps.length,
      clippingCount: finalValidation.clipped.length,
    },
  };

  const totalHardConstraints = 4;
  let hardViolationsCount = 0;
  if (finalValidation.overlaps.length > 0) hardViolationsCount++;
  if (finalValidation.clipped.length > 0) hardViolationsCount++;
  if (finalValidation.tapTargetViolations.length > 0) hardViolationsCount++;
  if (finalValidation.textSizeViolations.length > 0) hardViolationsCount++;

  const diagnosticsReport: ResolutionDiagnostics = {
    trace: diagnostics.getTrace(),
    summary: {
      elementsResolved: finalLayout.elements.filter((el) => el.visible).length,
      elementsTotal: spec.elements.length,
      hardConstraintsSatisfied: Math.max(0, totalHardConstraints - hardViolationsCount),
      hardConstraintsTotal: totalHardConstraints,
      overlaps: finalValidation.overlaps.length,
      clipping: finalValidation.clipped.length,
      durationMs,
    },
  };

  return {
    layout: finalLayout,
    diagnostics: diagnosticsReport,
  };
}

/**
 * Resolves a declarative AdSpec against a target SurfaceProfile to produce a concrete ResolvedLayout.
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
  return resolveWithDiagnostics(spec, surface, options).layout;
}

/** Alias for resolve() matching layout engine naming convention. */
export const resolveLayout = resolve;

// Core domain types and interfaces for declarative ad specifications, surface constraints, and resolved layout outputs.

/** Semantic role of an element within the ad's visual hierarchy. */
export type ElementRole = "primary" | "hero" | "action" | "branding" | "secondary";

/** Concrete graphical kind/type of an element. */
export type ElementKind = "text" | "image" | "button";

/** Numerical priority ranking from 1 (highest/critical) to 5 (lowest/disposable). */
export type Priority = 1 | 2 | 3 | 4 | 5;

/** Base attributes shared across all declarative ad elements. */
export interface BaseElement {
  /** Unique identifier for the element within an ad spec. */
  readonly id: string;
  /** High-level visual hierarchy role. */
  readonly role: ElementRole;
  /** Importance priority ranking (1 is highest priority, 5 is lowest). */
  readonly priority: Priority;
  /** Optional minimum width constraint in pixels. */
  readonly minWidth?: number;
  /** Optional minimum height constraint in pixels. */
  readonly minHeight?: number;
  /** Optional preferred natural width in pixels. */
  readonly preferredWidth?: number;
  /** Optional preferred natural height in pixels. */
  readonly preferredHeight?: number;
  /** Whether this element may be downscaled during spatial constraint pressure. */
  readonly canShrink?: boolean;
  /** Whether this element may be dropped completely under extreme spatial starvation. */
  readonly canDrop?: boolean;
  /** Whether text content may be truncated with ellipsis when lines exceed available space. */
  readonly canTruncate?: boolean;
}

/** Declarative text element containing copy, font sizing, and typography preferences. */
export interface TextElement extends BaseElement {
  readonly type: "text";
  /** The text string content to render. */
  readonly content: string;
  /** Optional minimum font size in pixels (overrides surface defaults if larger). */
  readonly minFontSize?: number;
  /** Optional preferred/ideal font size in pixels. */
  readonly preferredFontSize?: number;
  /** Optional maximum line count limit before truncating. */
  readonly maxLines?: number;
}

/** Declarative image or media element with optional aspect ratio and source URLs. */
export interface ImageElement extends BaseElement {
  readonly type: "image";
  /** Aspect ratio width-to-height (e.g. 1.0 for square, 1.777 for 16:9). */
  readonly aspectRatio?: number;
  /** Optional image URL or asset reference. */
  readonly src?: string;
  /** Optional accessibility alt text. */
  readonly alt?: string;
}

/** Declarative interactive button or Call-To-Action (CTA) element. */
export interface ButtonElement extends BaseElement {
  readonly type: "button";
  /** Button text label. */
  readonly label: string;
  /** Optional minimum touch target dimension override in pixels. */
  readonly minTapTarget?: number;
}

/** Discriminated union of all supported declarative ad elements. */
export type AdElement = TextElement | ImageElement | ButtonElement;

/** Declarative ad specification representing a surface-agnostic ad unit. */
export interface AdSpec {
  /** Optional unique identifier for the ad spec. */
  readonly id?: string;
  /** Ordered list of declarative content elements. */
  readonly elements: readonly AdElement[];
}

/** Hardware or platform safe area inset margins in pixels. */
export interface SafeArea {
  /** Inset from the top physical edge (e.g. notch, status bar). */
  readonly top: number;
  /** Inset from the right physical edge. */
  readonly right: number;
  /** Inset from the bottom physical edge (e.g. home indicator). */
  readonly bottom: number;
  /** Inset from the left physical edge. */
  readonly left: number;
}

/** Expected physical viewing distance from the human viewer to the display. */
export type ViewingDistance = "near" | "medium" | "far";

/** Surface profile describing physical screen dimensions and environmental constraints. */
export interface SurfaceProfile {
  /** Unique machine-readable identifier for the surface (e.g. "mobilePortrait"). */
  readonly id: string;
  /** Human-readable display name for the surface profile. */
  readonly name: string;
  /** Physical viewport width in pixels. */
  readonly width: number;
  /** Physical viewport height in pixels. */
  readonly height: number;
  /** Optional safe area insets to prevent placing elements over hardware cutouts. */
  readonly safeArea?: SafeArea;
  /** Minimum touch/tap target dimension in pixels for touch surfaces (e.g. 44px or 60px). */
  readonly minTapTarget?: number;
  /** Minimum legible text size in pixels (crucial for far-viewing broadcast surfaces). */
  readonly minTextSize?: number;
  /** Viewing distance categorization influencing font size scaling. */
  readonly viewingDistance?: ViewingDistance;
  /** Whether the surface is touch-interactive only. */
  readonly touchOnly?: boolean;
}

/** Lifecycle degradation state of an element within a resolved layout. */
export type ElementStatus = "kept" | "shrunk" | "repositioned" | "truncated" | "dropped";

/** Computed absolute coordinate placement and styling attributes for a single resolved element. */
export interface ResolvedElement {
  /** Unique element identifier matching the input AdElement. */
  readonly id: string;
  /** Graphical type of the element. */
  readonly type: ElementKind;
  /** High-level visual hierarchy role. */
  readonly role: ElementRole;
  /** Original priority ranking. */
  readonly priority: Priority;
  /** Absolute horizontal X coordinate of the top-left corner in pixels. */
  readonly x: number;
  /** Absolute vertical Y coordinate of the top-left corner in pixels. */
  readonly y: number;
  /** Computed width in pixels. */
  readonly width: number;
  /** Computed height in pixels. */
  readonly height: number;
  /** Computed font size in pixels (for text and button elements). */
  readonly fontSize?: number;
  /** Lifecycle degradation state applied during constraint resolution. */
  readonly status: ElementStatus;
  /** Human-readable audit decisions recording why this element was sized or placed as is. */
  readonly decisions: readonly string[];
  /** Resolved text content (may be truncated). */
  readonly content?: string;
  /** Resolved button label. */
  readonly label?: string;
  /** Resolved image asset source. */
  readonly src?: string;
  /** Whether this element is visible in the final layout (false if dropped). */
  readonly visible: boolean;
}

/** Quality and constraint verification metrics computed during layout resolution. */
export interface LayoutMetrics {
  /** Total resolution time in milliseconds. */
  readonly durationMs: number;
  /** Count of hard constraint violations (must be 0 for a valid layout). */
  readonly hardViolations: number;
  /** Count of overlapping element pairs (must be 0 for a valid layout). */
  readonly overlapCount: number;
  /** Count of elements clipped outside the visible surface bounds (must be 0). */
  readonly clippingCount: number;
  /** Macro-archetype chosen for spatial partitioning. */
  readonly archetype?: string;
}

/** Immutable layout intermediate representation produced by the constraint resolver. */
export interface ResolvedLayout {
  /** Surface profile ID for which this layout was resolved. */
  readonly surfaceId: string;
  /** Total canvas dimensions. */
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  /** All resolved elements with their absolute positions and dimensions. */
  readonly elements: readonly ResolvedElement[];
  /** Quality and constraint verification metrics. */
  readonly metrics: LayoutMetrics;
}

/** Custom typed error thrown when schema or semantic validation fails, listing all encountered issues. */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly issues: readonly string[] = [],
  ) {
    super(
      issues.length > 0
        ? `${message}:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`
        : message,
    );
    this.name = "ValidationError";
  }
}

/** Custom typed error thrown when an ad spec contains duplicate element IDs. */
export class DuplicateElementIdError extends ValidationError {
  constructor(readonly duplicateId: string) {
    const msg = `Duplicate element ID detected in AdSpec: "${duplicateId}". All element IDs must be unique.`;
    super(msg, [msg]);
    this.name = "DuplicateElementIdError";
  }
}

/** Custom typed error thrown when an input specification fails schema or sanity checks. */
export class InvalidSpecError extends ValidationError {
  constructor(message: string, issues: readonly string[] = []) {
    super(message, issues.length > 0 ? issues : [message]);
    this.name = "InvalidSpecError";
  }
}

/** Custom typed error thrown when a surface profile fails dimension or constraint checks. */
export class InvalidSurfaceError extends ValidationError {
  constructor(message: string, issues: readonly string[] = []) {
    super(message, issues.length > 0 ? issues : [message]);
    this.name = "InvalidSurfaceError";
  }
}

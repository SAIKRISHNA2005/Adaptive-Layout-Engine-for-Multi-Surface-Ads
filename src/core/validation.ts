// Runtime schema validation using Zod for incoming ad specs and surface profiles to prevent invalid configurations.

import { z } from "zod";
import {
  DuplicateElementIdError,
  InvalidSpecError,
  InvalidSurfaceError,
  ValidationError,
  type AdElement,
  type AdSpec,
  type SurfaceProfile,
} from "./types";

/** Zod schema for element roles within the ad visual hierarchy. */
export const elementRoleSchema = z.enum(["primary", "hero", "action", "branding", "secondary"]);

/** Zod schema for element graphical kinds. */
export const elementKindSchema = z.enum(["text", "image", "button"]);

/** Zod schema for numerical priorities 1 to 5. */
export const prioritySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/** Shared base properties schema across all ad elements. */
const baseElementSchema = z.object({
  id: z.string().trim().min(1, "Element ID cannot be empty or whitespace."),
  role: elementRoleSchema,
  priority: prioritySchema,
  minWidth: z.number().positive("minWidth must be a positive number.").optional(),
  minHeight: z.number().positive("minHeight must be a positive number.").optional(),
  preferredWidth: z.number().positive("preferredWidth must be a positive number.").optional(),
  preferredHeight: z.number().positive("preferredHeight must be a positive number.").optional(),
  canShrink: z.boolean().optional(),
  canDrop: z.boolean().optional(),
  canTruncate: z.boolean().optional(),
});

/** Schema for text elements. */
export const textElementSchema = baseElementSchema.extend({
  type: z.literal("text"),
  content: z.string({ required_error: "Text element requires a 'content' string." }),
  minFontSize: z.number().positive("minFontSize must be positive.").optional(),
  preferredFontSize: z.number().positive("preferredFontSize must be positive.").optional(),
  maxLines: z.number().int().positive("maxLines must be a positive integer.").optional(),
});

/** Schema for image elements. */
export const imageElementSchema = baseElementSchema.extend({
  type: z.literal("image"),
  aspectRatio: z.number().positive("aspectRatio must be a positive number.").optional(),
  src: z.string().optional(),
  alt: z.string().optional(),
});

/** Schema for button elements. */
export const buttonElementSchema = baseElementSchema.extend({
  type: z.literal("button"),
  label: z.string({ required_error: "Button element requires a 'label' string." }),
  minTapTarget: z.number().positive("minTapTarget must be positive.").optional(),
});

/** Discriminated union schema for all ad element types. */
export const adElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  buttonElementSchema,
]);

/** Schema for complete ad specifications. */
export const adSpecSchema = z.object({
  id: z.string().optional(),
  elements: z
    .array(adElementSchema, { required_error: "AdSpec must contain an 'elements' array." })
    .min(1, "AdSpec cannot be empty; at least one element is required."),
});

/** Schema for safe area insets. */
export const safeAreaSchema = z.object({
  top: z.number().nonnegative("safeArea.top must be non-negative."),
  right: z.number().nonnegative("safeArea.right must be non-negative."),
  bottom: z.number().nonnegative("safeArea.bottom must be non-negative."),
  left: z.number().nonnegative("safeArea.left must be non-negative."),
});

/** Schema for surface profiles. */
export const surfaceProfileSchema = z.object({
  id: z.string().min(1, "SurfaceProfile 'id' cannot be empty."),
  name: z.string().min(1, "SurfaceProfile 'name' cannot be empty."),
  width: z.number().positive("Surface width must be a positive number."),
  height: z.number().positive("Surface height must be a positive number."),
  safeArea: safeAreaSchema.optional(),
  minTapTarget: z.number().positive("minTapTarget must be a positive number.").optional(),
  minTextSize: z.number().positive("minTextSize must be a positive number.").optional(),
  viewingDistance: z.enum(["near", "medium", "far"]).optional(),
  touchOnly: z.boolean().optional(),
});

/** Formats Zod validation issues into clear human-readable strings. */
function formatZodErrors(error: z.ZodError): string[] {
  return error.errors.map((e) => {
    const path = e.path.length > 0 ? e.path.join(".") : "root";
    return `[${path}] ${e.message}`;
  });
}

/**
 * Validates and normalizes raw input into a typed AdSpec, throwing a detailed ValidationError if malformed.
 *
 * @param input - The unknown object to validate as an AdSpec.
 * @returns A validated AdSpec instance.
 * @throws {DuplicateElementIdError} When duplicate element IDs are encountered.
 * @throws {ValidationError} When the spec violates schema or semantic integrity rules.
 */
export function parseAdSpec(input: unknown): AdSpec {
  if (input === null || typeof input !== "object") {
    throw new InvalidSpecError("Invalid AdSpec: Input must be a non-null object.", [
      "Input must be an object with an 'elements' array.",
    ]);
  }

  const result = adSpecSchema.safeParse(input);
  const issues: string[] = [];

  if (!result.success) {
    issues.push(...formatZodErrors(result.error));
  }

  const parsedSpec = result.success ? result.data : null;
  const rawElements = (input as { elements?: unknown }).elements;

  if (Array.isArray(rawElements)) {
    const seenIds = new Set<string>();
    let duplicateId: string | null = null;

    for (let index = 0; index < rawElements.length; index++) {
      const rawElem = rawElements[index];
      if (rawElem && typeof rawElem === "object" && "id" in rawElem) {
        const id = String((rawElem as { id: unknown }).id);
        if (seenIds.has(id)) {
          duplicateId = id;
          issues.push(`Duplicate element ID: "${id}" detected at element index ${index}. All element IDs must be unique.`);
        }
        seenIds.add(id);
      }
    }

    if (duplicateId && issues.length === 1) {
      throw new DuplicateElementIdError(duplicateId);
    }
  }

  if (issues.length > 0 || !parsedSpec) {
    throw new InvalidSpecError("Failed to validate AdSpec", issues);
  }

  return {
    id: parsedSpec.id,
    elements: parsedSpec.elements as unknown as readonly AdElement[],
  };
}

/**
 * Validates and normalizes raw input into a typed SurfaceProfile, checking physical constraints.
 *
 * @param input - The unknown object to validate as a SurfaceProfile.
 * @returns A validated SurfaceProfile instance.
 * @throws {ValidationError} When the surface violates dimension, safe area, or tap target constraints.
 */
export function parseSurfaceProfile(input: unknown): SurfaceProfile {
  if (input === null || typeof input !== "object") {
    throw new InvalidSurfaceError("Invalid SurfaceProfile: Input must be a non-null object.", [
      "Input must be an object with 'width' and 'height' properties.",
    ]);
  }

  const result = surfaceProfileSchema.safeParse(input);
  const issues: string[] = [];

  if (!result.success) {
    issues.push(...formatZodErrors(result.error));
  }

  const data = result.success ? result.data : null;
  const raw = input as Partial<SurfaceProfile>;

  // Check physical geometry constraints if basic dimensions are numbers
  const width = typeof raw.width === "number" ? raw.width : undefined;
  const height = typeof raw.height === "number" ? raw.height : undefined;

  if (width !== undefined && height !== undefined && width > 0 && height > 0) {
    // 1. Validate minTapTarget fits within surface bounds
    if (typeof raw.minTapTarget === "number") {
      const minDim = Math.min(width, height);
      if (raw.minTapTarget > minDim) {
        issues.push(
          `surface.minTapTarget (${raw.minTapTarget}px) exceeds surface minimum dimension (${minDim}px) — no valid layout is possible.`,
        );
      }
    }

    // 2. Validate safe area insets
    if (raw.safeArea) {
      const { top, right, bottom, left } = raw.safeArea;
      if (typeof left === "number" && typeof right === "number") {
        if (left + right >= width) {
          issues.push(
            `Safe area horizontal insets (left: ${left}px + right: ${right}px = ${left + right}px) exceed or equal surface width (${width}px).`,
          );
        }
      }
      if (typeof top === "number" && typeof bottom === "number") {
        if (top + bottom >= height) {
          issues.push(
            `Safe area vertical insets (top: ${top}px + bottom: ${bottom}px = ${top + bottom}px) exceed or equal surface height (${height}px).`,
          );
        }
      }
    }
  }

  if (issues.length > 0 || !data) {
    throw new InvalidSurfaceError("Failed to validate SurfaceProfile", issues);
  }

  return data as SurfaceProfile;
}

export { ValidationError };

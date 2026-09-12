// Builder helpers and schema definitions for declarative, surface-agnostic ad specifications.

import {
  DuplicateElementIdError,
  InvalidSpecError,
  type AdElement,
  type AdSpec,
} from "./types";

/** Input specification type for the defineAd factory function. */
export interface AdSpecInput {
  /** Optional identifier for the ad unit. */
  readonly id?: string;
  /** List of ad elements to include in the specification. */
  readonly elements: readonly AdElement[];
}

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
 * Creates, validates, and returns an immutable, deeply frozen AdSpec.
 * Rejects duplicate element IDs with a typed DuplicateElementIdError.
 *
 * @param input - The raw ad specification containing elements and metadata.
 * @returns A validated, deeply frozen AdSpec object.
 * @throws {DuplicateElementIdError} If any element ID is used more than once.
 * @throws {InvalidSpecError} If the spec is empty or invalid.
 */
export function defineAd(input: AdSpecInput): Readonly<AdSpec> {
  if (!input || !Array.isArray(input.elements)) {
    throw new InvalidSpecError("AdSpec must contain an 'elements' array.");
  }

  if (input.elements.length === 0) {
    throw new InvalidSpecError("AdSpec cannot be empty; at least one element is required.");
  }

  const seenIds = new Set<string>();

  for (const element of input.elements) {
    if (!element || typeof element.id !== "string" || element.id.trim() === "") {
      throw new InvalidSpecError("Every element in AdSpec must possess a valid, non-empty 'id'.");
    }

    if (seenIds.has(element.id)) {
      throw new DuplicateElementIdError(element.id);
    }
    seenIds.add(element.id);
  }

  const spec: AdSpec = {
    id: input.id,
    elements: [...input.elements],
  };

  return deepFreeze(spec);
}

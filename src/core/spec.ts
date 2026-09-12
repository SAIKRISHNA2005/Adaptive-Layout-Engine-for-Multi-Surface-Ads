// Builder helpers and schema definitions for declarative, surface-agnostic ad specifications.

import { type AdElement, type AdSpec } from "./types";
import { parseAdSpec } from "./validation";

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
 * Validates through the central parseAdSpec runtime validation engine.
 *
 * @param input - The raw ad specification containing elements and metadata.
 * @returns A validated, deeply frozen AdSpec object.
 * @throws {DuplicateElementIdError} If any element ID is used more than once.
 * @throws {ValidationError} If the spec fails structural or schema validation.
 */
export function defineAd(input: AdSpecInput): Readonly<AdSpec> {
  const validated = parseAdSpec(input);
  return deepFreeze(validated);
}

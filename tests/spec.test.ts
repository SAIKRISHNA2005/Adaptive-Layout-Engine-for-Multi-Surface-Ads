// Unit tests for defineAd factory and spec domain validation.
import { describe, it, expect } from "vitest";
import { defineAd, type AdSpecInput } from "../src/core/spec";
import { DuplicateElementIdError, InvalidSpecError, type AdElement } from "../src/core/types";

describe("defineAd", () => {
  it("creates a fully-typed, valid ad specification", () => {
    const spec = defineAd({
      id: "sneaker-campaign",
      elements: [
        { id: "headline", type: "text", role: "primary", priority: 1, content: "Unleash Pure Speed" },
        { id: "product-image", type: "image", role: "hero", priority: 1, src: "shoe.png", aspectRatio: 1.2 },
        { id: "cta", type: "button", role: "action", priority: 2, label: "Shop Now" },
        { id: "logo", type: "image", role: "branding", priority: 3, src: "logo.svg" },
        { id: "price", type: "text", role: "secondary", priority: 2, content: "$180" },
      ],
    });

    expect(spec.id).toBe("sneaker-campaign");
    expect(spec.elements).toHaveLength(5);
    expect(spec.elements[0]?.id).toBe("headline");
  });

  it("produces an immutable, deeply frozen object", () => {
    const spec = defineAd({
      elements: [
        { id: "headline", type: "text", role: "primary", priority: 1, content: "Summer Sale" },
        { id: "cta", type: "button", role: "action", priority: 2, label: "Buy" },
      ],
    });

    expect(Object.isFrozen(spec)).toBe(true);
    expect(Object.isFrozen(spec.elements)).toBe(true);
    expect(Object.isFrozen(spec.elements[0])).toBe(true);

    // Assert that runtime modifications throw in strict mode
    expect(() => {
      // @ts-expect-error Cannot assign to 'id' because it is a read-only property.
      spec.id = "hacked";
    }).toThrow();
  });

  it("throws DuplicateElementIdError when duplicate element IDs are provided", () => {
    expect(() => {
      defineAd({
        elements: [
          { id: "headline", type: "text", role: "primary", priority: 1, content: "First" },
          { id: "cta", type: "button", role: "action", priority: 2, label: "Click" },
          { id: "headline", type: "text", role: "secondary", priority: 3, content: "Duplicate!" },
        ],
      });
    }).toThrowError(DuplicateElementIdError);
  });

  it("throws InvalidSpecError when elements list is empty or missing", () => {
    expect(() => {
      defineAd({ elements: [] });
    }).toThrowError(InvalidSpecError);

    expect(() => {
      defineAd({ elements: null } as unknown as AdSpecInput);
    }).toThrowError(InvalidSpecError);

    expect(() => {
      defineAd(null as unknown as AdSpecInput);
    }).toThrowError(InvalidSpecError);
  });

  it("throws InvalidSpecError if an element lacks a valid string id", () => {
    expect(() => {
      defineAd({
        elements: [
          { type: "text", role: "primary", priority: 1, content: "No ID" } as unknown as AdElement,
        ],
      });
    }).toThrowError(InvalidSpecError);
  });
});

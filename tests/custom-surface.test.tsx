// Test suite verifying engine generalization across arbitrary unseen custom surfaces and CustomSurfaceEditor validation.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { resolve, resolveWithDiagnostics } from "../src/core/resolver";
import { defineSurface } from "../src/core/surfaces";
import { defaultDemoAdSpec } from "../src/demo/adSpec";
import { CustomSurfaceEditor } from "../src/demo/CustomSurfaceEditor";
import { parseSurfaceProfile, ValidationError } from "../src/core/validation";
import { type SurfaceProfile } from "../src/core/types";

describe("Custom / Unknown 5th Surface Generalization (Phase 11)", () => {
  // 1. Direct Engine Generalization Test
  it("resolves an arbitrary unseen surface (700x300, safeArea 30/30/20/30, minText 24, minTap 48) with zero hard violations", () => {
    const arbitraryProfile: Readonly<SurfaceProfile> = defineSurface({
      id: "interview-live-custom-surface",
      name: "Airport Terminal Info Screen (700x300)",
      width: 700,
      height: 300,
      safeArea: { top: 20, right: 30, bottom: 20, left: 30 },
      minTapTarget: 48,
      minTextSize: 24,
      viewingDistance: "medium",
      touchOnly: true,
    });

    // Resolve using the exact same resolve() function used for standard surfaces
    const { layout, diagnostics } = resolveWithDiagnostics(defaultDemoAdSpec, arbitraryProfile);

    // Assert zero hard violations, overlaps, or boundary clippings
    expect(diagnostics.summary.hardConstraintsSatisfied).toBe(diagnostics.summary.hardConstraintsTotal);
    expect(diagnostics.summary.overlaps).toBe(0);
    expect(diagnostics.summary.clipping).toBe(0);
    expect(layout.metrics.hardViolations).toBe(0);

    // Also assert resolve() directly returns matching layout elements
    const directLayout = resolve(defaultDemoAdSpec, arbitraryProfile);
    expect(directLayout.elements.length).toBe(layout.elements.length);

    // All active elements must be within safe content area
    for (const el of layout.elements.filter((e) => e.visible)) {
      expect(el.x).toBeGreaterThanOrEqual(arbitraryProfile.safeArea?.left ?? 0);
      expect(el.y).toBeGreaterThanOrEqual(arbitraryProfile.safeArea?.top ?? 0);
      expect(el.x + el.width).toBeLessThanOrEqual(arbitraryProfile.width - (arbitraryProfile.safeArea?.right ?? 0));
      expect(el.y + el.height).toBeLessThanOrEqual(arbitraryProfile.height - (arbitraryProfile.safeArea?.bottom ?? 0));

      // Minimum text size enforced
      if ((el.type === "text" || el.type === "button") && el.fontSize) {
        expect(el.fontSize).toBeGreaterThanOrEqual(arbitraryProfile.minTextSize ?? 0);
      }

      // Minimum tap target enforced
      if (el.type === "button") {
        expect(el.width).toBeGreaterThanOrEqual(arbitraryProfile.minTapTarget ?? 0);
        expect(el.height).toBeGreaterThanOrEqual(arbitraryProfile.minTapTarget ?? 0);
      }
    }
  });

  // 2. Runtime Validation Rejection Test
  it("rejects an invalid surface profile (minTapTarget > width) with a clear ValidationError instead of crashing", () => {
    const invalidProfile = {
      id: "invalid-small-surface",
      name: "Invalid Surface",
      width: 40,
      height: 200,
      minTapTarget: 60, // 60px > 40px width -> impossible
    };

    expect(() => parseSurfaceProfile(invalidProfile)).toThrowError(ValidationError);

    try {
      parseSurfaceProfile(invalidProfile);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const valErr = err as ValidationError;
      expect(valErr.issues.some((issue) => issue.includes("minTapTarget"))).toBe(true);
    }
  });

  // 3. CustomSurfaceEditor UI Interaction Test (Valid submission)
  it("submits a valid custom surface form and triggers onSave callback", () => {
    const handleSave = vi.fn();
    render(<CustomSurfaceEditor onSave={handleSave} />);

    // Fill in width & height
    const widthInput = screen.getByLabelText(/Width \(px\)/i);
    fireEvent.change(widthInput, { target: { value: "800" } });

    const heightInput = screen.getByLabelText(/Height \(px\)/i);
    fireEvent.change(heightInput, { target: { value: "400" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Create & Resolve Surface/i });
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    const createdSurface: SurfaceProfile = handleSave.mock.calls[0]![0];
    expect(createdSurface.width).toBe(800);
    expect(createdSurface.height).toBe(400);
    expect(createdSurface.id).toMatch(/^custom-/);
  });

  // 4. CustomSurfaceEditor UI Interaction Test (Invalid submission with inline errors)
  it("displays specific inline error messages when invalid surface parameters are entered", () => {
    const handleSave = vi.fn();
    render(<CustomSurfaceEditor onSave={handleSave} />);

    // Set width to 30px, while minTapTarget is 48px (impossible to satisfy)
    const widthInput = screen.getByLabelText(/Width \(px\)/i);
    fireEvent.change(widthInput, { target: { value: "30" } });

    const minTapInput = screen.getByLabelText(/Min Tap Target/i);
    fireEvent.change(minTapInput, { target: { value: "50" } });

    const submitBtn = screen.getByRole("button", { name: /Create & Resolve Surface/i });
    fireEvent.click(submitBtn);

    // onSave should NOT be called
    expect(handleSave).not.toHaveBeenCalled();

    // Inline validation error message displayed
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Surface Validation Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/exceeds surface minimum dimension/i)).toBeInTheDocument();
  });
});

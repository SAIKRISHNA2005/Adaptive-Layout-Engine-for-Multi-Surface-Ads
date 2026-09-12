// Unit and interaction tests for ConstraintInspector component.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConstraintInspector } from "../src/demo/ConstraintInspector";
import { mobilePortrait, broadcastLowerThird, stressTestSurface } from "../src/core/surfaces";
import { resolveWithDiagnostics } from "../src/core/resolver";
import { defaultDemoAdSpec } from "../src/demo/adSpec";

describe("ConstraintInspector (Phase 8)", () => {
  const { layout, diagnostics } = resolveWithDiagnostics(defaultDemoAdSpec, mobilePortrait);

  it("renders surface profile metadata without hardcoding", () => {
    render(
      <ConstraintInspector
        surface={mobilePortrait}
        layout={layout}
        diagnostics={diagnostics}
      />,
    );

    expect(screen.getByText(/Surface Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/320 × 480 px/i)).toBeInTheDocument();
    expect(screen.getByText(/44 px/i)).toBeInTheDocument(); // minTapTarget
    expect(screen.getByText(/Auto \(12px\+\)/i)).toBeInTheDocument(); // minTextSize auto
  });

  it("renders surface profile metadata with explicit minTextSize when present", () => {
    const broadcastResult = resolveWithDiagnostics(defaultDemoAdSpec, broadcastLowerThird);
    render(
      <ConstraintInspector
        surface={broadcastLowerThird}
        layout={broadcastResult.layout}
        diagnostics={broadcastResult.diagnostics}
      />,
    );

    expect(screen.getByText(/1920 × 250 px/i)).toBeInTheDocument();
    expect(screen.getByText(/32 px/i)).toBeInTheDocument(); // minTextSize on broadcast (32px)
  });

  it("renders element statuses with degradation badges", () => {
    render(
      <ConstraintInspector
        surface={mobilePortrait}
        layout={layout}
        diagnostics={diagnostics}
      />,
    );

    // Headline, Hero Image, Price, CTA, Branding
    expect(screen.getByText("headline")).toBeInTheDocument();
    expect(screen.getByText("hero-image")).toBeInTheDocument();
    expect(screen.getByText("price-tag")).toBeInTheDocument();
    expect(screen.getByText("cta-button")).toBeInTheDocument();
    expect(screen.getByText("brand-logo")).toBeInTheDocument();
  });

  it("renders live constraint checklist derived from diagnostics", () => {
    render(
      <ConstraintInspector
        surface={mobilePortrait}
        layout={layout}
        diagnostics={diagnostics}
      />,
    );

    expect(screen.getByText("Surface Viewport Bounds")).toBeInTheDocument();
    expect(screen.getByText("Pairwise Zero Collision")).toBeInTheDocument();
    expect(screen.getByText("Minimum Touch Tap Target")).toBeInTheDocument();
    expect(screen.getByText("Minimum Text Legibility")).toBeInTheDocument();
  });

  it("triggers onHoverElement callback on mouse enter/leave", () => {
    const handleHover = vi.fn();
    render(
      <ConstraintInspector
        surface={mobilePortrait}
        layout={layout}
        diagnostics={diagnostics}
        onHoverElement={handleHover}
      />,
    );

    const headlineRow = screen.getByText("headline").closest("div");
    if (headlineRow) {
      fireEvent.mouseEnter(headlineRow);
      expect(handleHover).toHaveBeenCalledWith("headline");

      fireEvent.mouseLeave(headlineRow);
      expect(handleHover).toHaveBeenCalledWith(null);
    }
  });

  it("renders space pressure gauge and degradation action table under stressTestSurface", () => {
    const stressResult = resolveWithDiagnostics(defaultDemoAdSpec, stressTestSurface);
    render(
      <ConstraintInspector
        surface={stressTestSurface}
        layout={stressResult.layout}
        diagnostics={stressResult.diagnostics}
        spec={defaultDemoAdSpec}
      />,
    );

    expect(screen.getByTestId("space-pressure-indicator")).toBeInTheDocument();
    expect(screen.getByText(/Space Pressure:/i)).toBeInTheDocument();
    expect(screen.getByText("Degradation Action Breakdown")).toBeInTheDocument();

    // Table rows exist with action badges
    expect(screen.getAllByText("DROP").length).toBeGreaterThan(0); // brand-logo is dropped
    expect(screen.getAllByText("TRUNCATE").length).toBeGreaterThan(0); // price-tag is truncated
  });
});

// Unit and interaction tests for ResolutionTrace component.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResolutionTrace } from "../src/demo/ResolutionTrace";
import { mobilePortrait } from "../src/core/surfaces";
import { resolveWithDiagnostics } from "../src/core/resolver";
import { defaultDemoAdSpec } from "../src/demo/adSpec";

describe("ResolutionTrace (Phase 8)", () => {
  const { diagnostics } = resolveWithDiagnostics(defaultDemoAdSpec, mobilePortrait);

  it("renders pipeline stage headers and trace step messages", () => {
    render(<ResolutionTrace diagnostics={diagnostics} />);

    expect(screen.getByText("Resolution Trace")).toBeInTheDocument();
    expect(screen.getAllByText(/normalize/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/place/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/validate/i).length).toBeGreaterThan(0);
  });

  it("shows element ID tags on element-specific trace steps", () => {
    render(<ResolutionTrace diagnostics={diagnostics} />);

    expect(screen.getAllByText("@headline").length).toBeGreaterThan(0);
    expect(screen.getAllByText("@cta-button").length).toBeGreaterThan(0);
  });

  it("supports collapsing and expanding stages", () => {
    render(<ResolutionTrace diagnostics={diagnostics} />);

    const collapseAllBtn = screen.getByText("Collapse All");
    fireEvent.click(collapseAllBtn);

    // After collapse all, headers show "▶ Show"
    expect(screen.getAllByText("▶ Show").length).toBeGreaterThan(0);

    const expandAllBtn = screen.getByText("Expand All");
    fireEvent.click(expandAllBtn);

    expect(screen.getAllByText("▼ Hide").length).toBeGreaterThan(0);
  });

  it("calls onHoverElement when hovering trace steps associated with an element", () => {
    const handleHover = vi.fn();
    render(<ResolutionTrace diagnostics={diagnostics} onHoverElement={handleHover} />);

    const headlineTag = screen.getAllByText("@headline")[0];
    if (headlineTag) {
      fireEvent.mouseEnter(headlineTag.closest("div")!);
      expect(handleHover).toHaveBeenCalledWith("headline");

      fireEvent.mouseLeave(headlineTag.closest("div")!);
      expect(handleHover).toHaveBeenCalledWith(null);
    }
  });
});

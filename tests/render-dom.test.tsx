// Integration tests for React DOM layout renderer and component projection.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { defineAd } from "../src/core/spec";
import { defineSurface, mobilePortrait, retailKiosk } from "../src/core/surfaces";
import { resolve } from "../src/core/resolver";
import { RenderedAd } from "../src/renderers/render-dom";

describe("RenderedAd (Phase 6 - DOM Renderer)", () => {
  const sampleSpec = defineAd({
    id: "summer-sneaker",
    elements: [
      { id: "headline", type: "text", role: "primary", priority: 1, content: "Lightning Fast Runners" },
      { id: "product-image", type: "image", role: "hero", priority: 1, aspectRatio: 1.5, preferredWidth: 280, preferredHeight: 180 },
      { id: "cta", type: "button", role: "action", priority: 2, label: "Buy Now", minTapTarget: 44 },
      { id: "logo", type: "image", role: "branding", priority: 3, aspectRatio: 1.0, preferredWidth: 60, preferredHeight: 60, canDrop: true },
    ],
  });

  it("renders container matching exact surface width and height", () => {
    const layout = resolve(sampleSpec, mobilePortrait);
    render(<RenderedAd layout={layout} surface={mobilePortrait} spec={sampleSpec} />);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container).toBeInTheDocument();
    expect(container.style.width).toBe(`${mobilePortrait.width}px`);
    expect(container.style.height).toBe(`${mobilePortrait.height}px`);
  });

  it("renders non-dropped elements at their resolved coordinates and dimensions", () => {
    const layout = resolve(sampleSpec, mobilePortrait);
    render(<RenderedAd layout={layout} surface={mobilePortrait} spec={sampleSpec} />);

    for (const el of layout.elements) {
      if (el.visible && el.status !== "dropped") {
        const domEl = screen.getByTestId(`rendered-element-${el.id}`);
        expect(domEl).toBeInTheDocument();
        expect(domEl.style.left).toBe(`${el.x}px`);
        expect(domEl.style.top).toBe(`${el.y}px`);
        expect(domEl.style.width).toBe(`${el.width}px`);
        expect(domEl.style.height).toBe(`${el.height}px`);
      }
    }
  });

  it("completely omits dropped elements from the DOM tree rather than hiding via CSS", () => {
    // Artificial small kiosk surface forcing branding logo to drop
    const shrunkKiosk = defineSurface({
      ...retailKiosk,
      id: "shrunkKiosk",
      height: 220,
      safeArea: { top: 10, right: 10, bottom: 10, left: 10 },
    });

    const layout = resolve(sampleSpec, shrunkKiosk);

    // Verify branding logo is dropped in the layout IR
    const droppedLogo = layout.elements.find((el) => el.id === "logo");
    expect(droppedLogo?.status).toBe("dropped");
    expect(droppedLogo?.visible).toBe(false);

    render(<RenderedAd layout={layout} surface={shrunkKiosk} spec={sampleSpec} />);

    // Assert that the dropped element does NOT exist anywhere in the DOM
    expect(screen.queryByTestId("rendered-element-logo")).toBeNull();

    // Verify high-priority elements ARE present
    expect(screen.getByTestId("rendered-element-headline")).toBeInTheDocument();
    expect(screen.getByTestId("rendered-element-product-image")).toBeInTheDocument();
    expect(screen.getByTestId("rendered-element-cta")).toBeInTheDocument();
  });

  it("renders semantic elements (p, button, image container) with correct text copy", () => {
    const layout = resolve(sampleSpec, mobilePortrait);
    render(<RenderedAd layout={layout} surface={mobilePortrait} spec={sampleSpec} />);

    expect(screen.getByText("Lightning Fast Runners")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeInTheDocument();
  });

  it("applies status debugging indicators when debugOutlines is true", () => {
    // Create a layout where text is shrunk
    const tightSurface = defineSurface({
      id: "tight-screen",
      name: "Tight Screen",
      width: 200,
      height: 250,
    });

    const layout = resolve(sampleSpec, tightSurface);
    render(<RenderedAd layout={layout} surface={tightSurface} spec={sampleSpec} debugOutlines={true} />);

    const shrunkElements = layout.elements.filter((el) => el.visible && el.status !== "kept");
    if (shrunkElements.length > 0) {
      const firstShrunk = shrunkElements[0];
      const domEl = screen.getByTestId(`rendered-element-${firstShrunk?.id}`);
      expect(domEl.getAttribute("data-status")).toBe(firstShrunk?.status);
    }
  });
});

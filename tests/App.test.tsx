// Smoke and interaction tests for root App shell and surface switching.
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/demo/App";

describe("App Shell (Phase 7 - Multi-Surface Live Switching)", () => {
  it("renders with default mobile portrait surface and displays all 5 elements", () => {
    render(<App />);

    expect(screen.getByText("Adaptive Layout Engine")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Mobile Interstitial \(Portrait\)/i })).toBeInTheDocument();

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("320px");
    expect(container.style.height).toBe("480px");

    // All elements in default demo ad spec rendered
    expect(screen.getByText(/Sound Beyond Silence/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Order AeroTune Pro Now/i })).toBeInTheDocument();
  });

  it("switches to broadcast lower-third surface producing UltraWideRibbon composition", () => {
    render(<App />);

    const broadcastTab = screen.getByRole("tab", { name: /Broadcast Lower-Third/i });
    fireEvent.click(broadcastTab);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("1920px");
    expect(container.style.height).toBe("250px");

    expect(screen.getByText(/Archetype: UltraWideRibbon/i)).toBeInTheDocument();
  });

  it("switches to mobile landscape surface producing HorizontalSplit 2-column composition", () => {
    render(<App />);

    const landscapeTab = screen.getByRole("tab", { name: /Mobile Interstitial \(Landscape\)/i });
    fireEvent.click(landscapeTab);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("640px");
    expect(container.style.height).toBe("360px");

    expect(screen.getByText(/Archetype: HorizontalSplit/i)).toBeInTheDocument();
  });

  it("switches to retail kiosk surface producing 1080x1080 square composition", () => {
    render(<App />);

    const kioskTab = screen.getByRole("tab", { name: /Retail Kiosk Screen \(Square\)/i });
    fireEvent.click(kioskTab);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("1080px");
    expect(container.style.height).toBe("1080px");
  });
});

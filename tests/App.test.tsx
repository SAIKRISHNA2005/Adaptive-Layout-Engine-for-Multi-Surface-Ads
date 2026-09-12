// Smoke and interaction tests for root App shell and surface switching.
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/demo/App";

describe("App Shell (Phase 7 & 8 - Multi-Surface Live Switching & Tooling)", () => {
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

    // R&D Tooling panels rendered
    expect(screen.getByText(/Surface Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolution Trace/i)).toBeInTheDocument();
  });

  it("switches to broadcast lower-third surface producing UltraWideRibbon composition", () => {
    render(<App />);

    const broadcastTab = screen.getByRole("tab", { name: /Broadcast Lower-Third/i });
    fireEvent.click(broadcastTab);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("1920px");
    expect(container.style.height).toBe("250px");

    expect(screen.getAllByText(/UltraWideRibbon/i).length).toBeGreaterThan(0);
  });

  it("switches to mobile landscape surface producing HorizontalSplit 2-column composition", () => {
    render(<App />);

    const landscapeTab = screen.getByRole("tab", { name: /Mobile Interstitial \(Landscape\)/i });
    fireEvent.click(landscapeTab);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("640px");
    expect(container.style.height).toBe("360px");

    expect(screen.getAllByText(/HorizontalSplit/i).length).toBeGreaterThan(0);
  });

  it("switches to retail kiosk surface producing 1080x1080 square composition", () => {
    render(<App />);

    const kioskTab = screen.getByRole("tab", { name: /Retail Kiosk Screen \(Square\)/i });
    fireEvent.click(kioskTab);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("1080px");
    expect(container.style.height).toBe("1080px");
  });

  it("switches to Stress Test surface displaying space pressure gauge and spatial starvation notice", () => {
    render(<App />);

    const stressTab = screen.getByRole("tab", { name: /Stress Test/i });
    fireEvent.click(stressTab);

    const container = screen.getByTestId("rendered-ad-container");
    expect(container.style.width).toBe("240px");
    expect(container.style.height).toBe("320px");

    expect(screen.getByText(/Spatial Starvation Active/i)).toBeInTheDocument();
    expect(screen.getByTestId("space-pressure-indicator")).toBeInTheDocument();
  });
});

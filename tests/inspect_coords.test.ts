import { describe, it } from "vitest";
import { defaultDemoAdSpec } from "../src/demo/adSpec";
import { mobilePortrait, mobileLandscape, broadcastLowerThird, retailKiosk, stressTestSurface } from "../src/core/surfaces";
import { resolveWithDiagnostics } from "../src/core/resolver";

describe("Inspect Coords", () => {
  it("prints coordinates for all demo surfaces", () => {
    const surfaces = [mobilePortrait, mobileLandscape, broadcastLowerThird, retailKiosk, stressTestSurface];
    for (const s of surfaces) {
      const { layout, diagnostics } = resolveWithDiagnostics(defaultDemoAdSpec, s);
      console.log(`\n=== Surface: ${s.name} (${s.width}x${s.height}) ===`);
      console.log(`Archetype: ${layout.metrics.archetype}, Violations: ${layout.metrics.hardViolations}, Overlaps: ${diagnostics.summary.overlaps}, Clipping: ${diagnostics.summary.clipping}`);
      for (const el of layout.elements) {
        console.log(`  [${el.id}] (${el.role}) visible:${el.visible}, status:${el.status} => x:${el.x}, y:${el.y}, w:${el.width}, h:${el.height}, font:${el.fontSize}`);
      }
    }
  });
});

# Architecture & Design Decisions Log

This document records the foundational architectural decisions, invariants, and edge-case findings discovered during the design, development, and stress testing of the Adaptive Layout Engine for Multi-Surface Ads.

---

## 1. Core Architecture & Separation of Concerns

### Decision: Pure Functional Resolver decoupled from Rendering Platforms
- **Problem**: Advertising layouts must render across heterogeneous surfaces (DOM, Canvas, WebGL, server-side pre-rendering, digital out-of-home displays). Coupling layout decisions to DOM layout or browser rendering passes prevents headless testing, deterministic simulation, and cross-platform rendering.
- **Solution**: The engine strictly enforces a pipeline: `AdSpec + SurfaceProfile -> [Resolver Engine] -> ResolvedLayout -> [Renderers: DOM / Canvas / SSR]`.
- **Outcome**: The DOM renderer ([`render-dom.tsx`](file:///c:/Users/saikr/OneDrive/Desktop/flam-ai-frontend-r&d-assignment/src/renderers/render-dom.tsx)) and Canvas renderer ([`render-canvas.ts`](file:///c:/Users/saikr/OneDrive/Desktop/flam-ai-frontend-r&d-assignment/src/renderers/render-canvas.ts)) are 100% pure visual consumers. They contain zero layout decision logic and consume the identical `ResolvedLayout` representation.

---

## 2. Invariant Safety & Layout Correctness

### Decision: Layout Correctness Invariants as Strict Physical Laws
- **Rule 1 (Zero Overlap)**: No two visible elements may have intersecting bounding boxes:
  $$\forall A, B \in \text{elements}, A \ne B \implies \text{rectsOverlap}(A, B) = \text{false}$$
- **Rule 2 (Zero Clipping)**: Every visible element's bounding box must be completely contained within the surface viewport and safe area insets:
  $$x \ge \text{safeArea.left} \land y \ge \text{safeArea.top} \land (x + w) \le (\text{width} - \text{safeArea.right}) \land (y + h) \le (\text{height} - \text{safeArea.bottom})$$
- **Rule 3 (Tap Target Compliance)**: Any kept touchable element must meet or exceed surface and role tap target requirements ($\ge \max(\text{minTapTarget}, 44\text{px})$ on touch displays).
- **Rule 4 (Legibility Compliance)**: Kept text elements must meet or exceed surface `minTextSize`.

---

## 3. Findings from Property-Based Testing (Phase 15 R&D Signal)

Using `fast-check` to generate hundreds of randomized surface geometries ($100 \le w \le 2400$, $100 \le h \le 2400$, randomized safe area insets, $0 \le \text{minTapTarget} \le 80$, $0 \le \text{minTextSize} \le 48$, and varied viewing distances) surfaced genuine edge cases and architectural bugs that standard fixed test fixtures never exposed:

### Finding 1: Infinite Truncation Loop on Short Strings
- **Counterexample Surfaced**:
  `Surface: 100x100, safeArea: 0, minTapTarget: 0, minTextSize: 0`
- **Symptom**: Fast-check reported 3 clipped elements on a 100x100 surface.
- **Root Cause**: In `degradeElement`, text truncation was defined as:
  ```typescript
  const truncateLength = Math.max(6, Math.floor(state.displayText.length * 0.5));
  state.displayText = state.displayText.slice(0, truncateLength).trim() + "...";
  ```
  When `displayText` was `"Only $299..."` and shrunk to `"Only $..."` (length 9), `truncateLength` evaluated to $\max(6, \lfloor 9 \times 0.5 \rfloor) = 6$. `slice(0, 6)` produced `"Only $"`, and adding `"..."` produced `"Only $..."` (length 9).
  Because the length was still $> 8$, the loop continued returning a non-null degradation decision string indefinitely until `maxIterations = 60` was exhausted. This prevented the queue from ever progressing to degrade other elements or drop optional elements.
- **Resolution**:
  Refactored text truncation into progressive word-level keyword compaction with an explicit `isTruncated` state flag:
  1. Truncate to first 2 words + `"..."`
  2. Truncate to single keyword + `"..."`
  3. Cease truncation once non-contracting and progress along the ladder.

### Finding 2: Safe Area Inset vs. Minimum Tap Target Inconsistency
- **Counterexample Surfaced**:
  `Surface: 100x100, safeArea: { top: 0, right: 7, bottom: 0, left: 15 }, minTapTarget: 79`
- **Symptom**: Clipping violation when placing a 79px button.
- **Root Cause**: The surface validator (`parseSurfaceProfile`) verified `minTapTarget <= min(width, height)` ($79 \le 100$, which is true), but failed to account for safe area insets. The horizontal insets ($15 + 7 = 22$) left an available content width of only $100 - 22 = 78\text{px}$. A 79px tap target is geometrically impossible to place inside a 78px safe content width without clipping.
- **Resolution**:
  Updated [`parseSurfaceProfile`](file:///c:/Users/saikr/OneDrive/Desktop/flam-ai-frontend-r&d-assignment/src/core/validation.ts) to validate `minTapTarget` against the **safe content area dimensions** ($\min(\text{width} - \text{insets}_h, \text{height} - \text{insets}_v)$), correctly identifying and rejecting surfaces where safe areas leave insufficient room for the requested touch target.

### Finding 3: Premature Element Dropping vs. Multi-Pass Degradation
- **Counterexample Surfaced**:
  On the Phase 10 Stress Test surface (240x320), a greedy single-element degradation loop dropped `price-tag` before larger, lower-priority elements (such as the 360x270 `hero-image`) had even performed their first scaling step.
- **Root Cause**: Iterating through elements in a greedy `while` loop degraded element $N$ all the way to its drop step before element $N+1$ performed its non-destructive shrink step.
- **Resolution**:
  Separated progressive degradation into distinct, priority-ordered passes:
  - **Pass 1 (Non-destructive adjustments)**: All elements shrink padding, font size, and image scales.
  - **Pass 2 (Content compaction)**: Text copy and button labels truncate to essential keywords.
  - **Pass 3 (Selective dropping)**: Droppable secondary/branding elements drop in strict priority order.
  - **Pass 4 (Emergency spatial exhaustion)**: Under extreme spatial starvation (e.g. 100x100), non-action elements drop to protect the core CTA button from boundary clipping.

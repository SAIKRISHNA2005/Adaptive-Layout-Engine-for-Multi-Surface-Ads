# Architecture Decision Records (ADR) & Design Log

This log documents foundational architectural decisions, invariants, and empirical edge-case findings discovered during the design, development, and stress testing of the Adaptive Layout Engine for Multi-Surface Ads.

---

## ADR-001: Priority-Ordered Greedy Resolver vs. General Linear Programming Solver

- **Status**: Accepted
- **Context**: 
  The engine must map declarative ad elements onto arbitrary surface geometries while satisfying geometric constraints (zero overlap, containment), hardware constraints (safe areas, tap targets), and ergonomic constraints (viewing distance, legibility). The resolution must execute in sub-millisecond time (<10ms), support deterministic headless testing, and provide explainable step-by-step diagnostic traces.
- **Decision**: 
  Implement a priority-ordered greedy topological resolver paired with progressive, multi-pass degradation ladders rather than a general-purpose Linear Programming (LP) or Simplex solver (such as Cassowary).
- **Alternatives Considered**:
  1. *General LP / Simplex Solver (e.g., Cassowary)*:
     - *Pros*: Solves arbitrary systems of linear equality and inequality constraints.
     - *Cons*: Continuous solvers struggle with discrete disjunctions (e.g., Element A must be placed *either* above *or* beside Element B), discrete state transitions (dropping an element entirely, truncating copy to keyword, switching font size tiers), and non-linear text line-wrapping boundaries. LP solvers are computationally heavy, prone to solver failure or high latency on pathological inputs, and act as opaque black boxes that make generating human-readable explainability traces difficult.
  2. *Priority-Ordered Greedy Topological Resolver (Chosen)*:
     - *Pros*: Deterministic, $O(N \log N)$ computational complexity, sub-millisecond execution (<2ms), zero external dependencies, and inherently explainable. Macro-archetypes (`TallStack`, `HorizontalSplit`, `UltraWideRibbon`, `BalancedGrid`) partition spatial topology, while element priority ladders strictly dictate space allocation and degradation sequence.
     - *Cons*: Does not search all possible 2D packing permutations, but generates predictable, aesthetically sound layouts aligned with graphic design hierarchy.

---

## ADR-002: Strict Binary Classification of Hard vs. Soft Constraints

- **Status**: Accepted
- **Context**: 
  Display surfaces present both non-negotiable physical constraints (e.g., canvas boundaries, hardware notches, minimum touch target sizes) and design preferences (e.g., preferred aspect ratio, optimal margins, whitespace distribution).
- **Decision**: 
  Enforce a strict binary separation between Hard Constraints and Soft Constraints:
  - **Hard Constraints (Invariants)**: Non-negotiable physical laws. Any layout candidate violating a hard constraint (boundary clipping, element overlap, tap target $< \text{minTapTarget}$, font size $< \text{minTextSize}$) is invalid ($\text{Score} = -\infty$) and triggers immediate degradation or candidate rejection.
  - **Soft Constraints (Preferences)**: Evaluated via a multi-objective scoring function ($[0, 100]$ score) incorporating visibility weight, degradation penalties, visual balance, and whitespace economy to rank valid candidates.
- **Alternatives Considered**:
  - *Unified Soft Penalty Model (Penalty Minimization)*:
    - *Cons*: Treating all constraints as soft weights in an optimization equation risks "satisficing" violations—an optimizer might accept a 4px button overlap or boundary clip if the overall whitespace score is sufficiently high. In advertising and UI systems, boundary clipping and element overlaps are catastrophic failures that must never be traded off against aesthetic preferences.

---

## ADR-003: Renderer-Independent Functional Core

- **Status**: Accepted
- **Context**: 
  The engine must support diverse presentation layers: modern interactive DOM, HTML5 Canvas 2D, and potential future targets (WebGL, server-side pre-rendered SVG/PNG, digital out-of-home signage displays).
- **Decision**: 
  The core resolver (`src/core/`) is a 100% pure TypeScript module that has zero dependencies on browser APIs, the DOM, React, or Canvas. It takes a declarative `AdSpec` and a `SurfaceProfile` and returns an immutable `ResolvedLayout` Intermediate Representation (IR). Renderers (`render-dom.tsx`, `render-canvas.ts`) are decoupled, pure visual projection layers that consume the IR.
- **Alternatives Considered**:
  - *DOM-Coupled Layout (CSS Flexbox / Grid inside React components)*:
    - *Cons*: Couples layout calculation to browser layout passes (`getBoundingClientRect`), prevents running headless Vitest test suites in Node environments, eliminates Canvas or server-side rendering, and makes testing non-deterministic due to browser rendering engine differences.

---

## ADR-004: Decoupling Surface Resolution from CSS Media Queries

- **Status**: Accepted
- **Context**: 
  Responsive web design traditionally relies on CSS `@media` queries to alter layouts based on browser window dimensions.
- **Decision**: 
  Target ad surfaces are treated as virtualized physical displays defined by semantic `SurfaceProfile` specifications (`width`, `height`, `safeArea`, `minTapTarget`, `minTextSize`, `viewingDistance`), entirely independent of the browser window embedding them. Layout decisions are computed mathematically by the resolver. CSS media queries are restricted solely to the peripheral studio chrome (e.g., switching between 3-column desktop view and tabbed mobile studio view).
- **Alternatives Considered**:
  - *CSS Media Query-Driven Ad Layouts*:
    - *Cons*: CSS media queries only inspect the parent viewport, not the embedded ad frame or physical display characteristics. CSS cannot reason about semantic element priorities, cannot dynamically drop lower-priority elements when copy expands, and cannot enforce viewing-distance text legibility across varying display formats.

---

## ADR-005: TextMeasurer Strategy Pattern (DOM, Canvas, and Estimate Heuristic)

- **Status**: Accepted
- **Context**: 
  Accurate layout resolution requires measuring text bounding boxes at various font sizes and maximum widths to calculate line wrapping and vertical height. However, text measurement engines differ between environments (browser main thread, Web Workers, Node.js test runners).
- **Decision**: 
  Abstract text measurement behind a pluggable `TextMeasurer` interface (`measureText({ text, fontSize, fontWeight, maxWidth })`). Provide three interchangeable implementations:
  1. `DOMTextMeasurer`: Uses an offscreen, cached HTML element for pixel-perfect browser DOM layout.
  2. `CanvasTextMeasurer`: Uses `OffscreenCanvas` / Canvas 2D `ctx.measureText` for high-throughput headless or canvas environments.
  3. `EstimateTextMeasurer`: A deterministic mathematical heuristic based on typographic character aspect ratios and line-height coefficients, operating with zero external dependencies in headless Node environments.
- **Alternatives Considered**:
  - *Relying Exclusively on Canvas `measureText`*:
    - *Cons*: Fails in Node.js environments without installing heavy native C++ binary dependencies (`node-canvas`), breaking zero-setup CI workflows.
  - *Relying Exclusively on DOM*:
    - *Cons*: Incompatible with headless Node/Vitest without mock DOM environments, and unusable inside Web Workers or pure Canvas pipelines.

---

## ADR-006: Empirical Findings from Property-Based Testing

Using `fast-check` to generate hundreds of randomized surface geometries ($100 \le w \le 2400$, $100 \le h \le 2400$, randomized safe area insets, $0 \le \text{minTapTarget} \le 80$, $0 \le \text{minTextSize} \le 48$, and varied viewing distances) surfaced genuine edge cases and architectural bugs that standard fixed test fixtures never exposed:

### Finding 1: Infinite Truncation Loop on Short Strings
- **Counterexample Surfaced**:
  `Surface: 100x100, safeArea: 0, minTapTarget: 0, minTextSize: 0`
- **Symptom**: Fast-check reported 3 clipped elements on a 100x100 surface.
- **Root Cause**: In `degradeElement`, text truncation calculated:
  `const truncateLength = Math.max(6, Math.floor(state.displayText.length * 0.5));`
  When `displayText` was `"Only $299..."` and shrunk to `"Only $..."` (length 9), `truncateLength` evaluated to $\max(6, \lfloor 9 \times 0.5 \rfloor) = 6$. `slice(0, 6)` produced `"Only $"`, and adding `"..."` produced `"Only $..."` (length 9). Because the length remained $> 8$, the loop returned a non-null degradation decision string indefinitely until `maxIterations = 60` was exhausted, blocking other elements from degrading or dropping.
- **Resolution**:
  Refactored text truncation into progressive keyword compaction with an explicit `isTruncated` state flag (truncate to 2 words + `"..."`, then single keyword + `"..."`, then cease and advance to the next ladder step).

### Finding 2: Safe Area Inset vs. Minimum Tap Target Inconsistency
- **Counterexample Surfaced**:
  `Surface: 100x100, safeArea: { top: 0, right: 7, bottom: 0, left: 15 }, minTapTarget: 79`
- **Symptom**: Clipping violation when placing a 79px button.
- **Root Cause**: The surface validator verified `minTapTarget <= min(width, height)` ($79 \le 100$), but failed to subtract safe area insets. Horizontal insets ($15 + 7 = 22$) left an available content width of only $78\text{px}$. A 79px tap target is geometrically impossible to place inside a 78px safe content width.
- **Resolution**:
  Updated [`parseSurfaceProfile`](src/core/validation.ts) to validate `minTapTarget` against safe content area dimensions ($\min(\text{width} - \text{insets}_h, \text{height} - \text{insets}_v)$).

### Finding 3: Premature Element Dropping vs. Multi-Pass Degradation
- **Counterexample Surfaced**:
  On constrained surfaces (e.g. 240x320), a greedy single-element degradation loop dropped `price-tag` before larger, lower-priority elements (such as the 360x270 `hero-image`) had completed their non-destructive scaling.
- **Root Cause**: Iterating through elements in a greedy `while` loop degraded element $N$ all the way to its drop step before element $N+1$ performed its first shrink step.
- **Resolution**:
  Structured degradation into 4 distinct, priority-ordered passes:
  - **Pass 1 (Non-destructive adjustments)**: All elements shrink padding, font size, and image scales.
  - **Pass 2 (Content compaction)**: Text copy and button labels truncate to essential keywords.
  - **Pass 3 (Selective dropping)**: Droppable secondary/branding elements drop in strict inverse priority order.
  - **Pass 4 (Emergency spatial exhaustion)**: Under extreme spatial starvation, non-action elements drop to protect the core CTA button from boundary clipping.

# Architecture Blueprint: Adaptive Layout Engine for Multi-Surface Ads

## 1. End-to-End Data Flow

The Adaptive Layout Engine models multi-surface ad layout as a deterministic, constraint-guided geometric pipeline. It takes an abstract, surface-agnostic description of ad content and a physical surface specification, and generates a concrete coordinate mapping that can be consumed by any rendering backend.

```text
┌─────────────────────────┐     ┌──────────────────────────────┐
│  AdSpec                 │     │  SurfaceProfile              │
│  - Elements & Roles     │     │  - Physical Dimensions (W,H) │
│  - Priorities (1..N)    │     │  - Safe Area Insets          │
│  - Raw Content Payloads │     │  - Hardware Constraints      │
└────────────┬────────────┘     └──────────────┬───────────────┘
             │                                 │
             └───────────────┬─────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  Constraint Resolver Engine │
              │  (100% Pure TypeScript)     │
              │  - Spatial Partitioning     │
              │  - Priority Degradation     │
              │  - Candidate Evaluation     │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │  ResolvedLayout (IR)        │
              │  - Element Coordinates (x,y)│
              │  - Dimensions (w,h) & Scales│
              │  - Visibility & Truncation  │
              │  - Diagnostic Trace Logs    │
              └───────┬─────────────┬───────┘
                      │             │
        ┌─────────────┴──┐       ┌──┴────────────┐
        ▼                ▼       ▼               ▼
 ┌──────────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────┐
 │ React / DOM  │ │ Canvas 2D  │ │ Headless SVG │ │ Future Live │
 │ Renderer     │ │ Renderer   │ │ Exporter     │ │ Preview     │
 └──────────────┘ └────────────┘ └──────────────┘ └─────────────┘
```

### Why the Resolver Must Be 100% Framework-Agnostic
1. **Separation of Concerns**: Layout calculation is pure geometry, typography math, and constraint resolution. Tying resolution to DOM elements, browser layout passes (`getBoundingClientRect`), or React component lifecycles makes testing slow, non-deterministic, and impossible in headless environments (e.g., automated CI test suites, edge SSR workers, or batch pre-rendering).
2. **Pluggable Render Targets**: By producing an Intermediate Representation (`ResolvedLayout`) containing absolute normalized rectangles, typographic scales, and clipping flags, any rendering engine (DOM, HTML5 Canvas, WebGL, SVG, or Native Mobile) can render the ad with zero code changes to the resolver.
3. **Purity & Testability**: A pure function `resolve(spec, surface, options?): ResolvedLayout` guarantees reproducibility: given the exact same `AdSpec` and `SurfaceProfile`, the layout output is bit-for-bit identical across all platforms and execution environments.

---

## 2. Resolver Internal Pipeline Stages

The layout engine executes an 8-stage pipeline to resolve constraints systematically and explainably:

```text
┌───────────┐    ┌─────────┐    ┌────────────┐    ┌──────────┐
│ Normalize ├───►│ Measure ├───►│ Candidates ├───►│ Place by │
│           │    │         │    │ Generation │    │ Priority │
└───────────┘    └─────────┘    └────────────┘    └────┬─────┘
                                                       │
┌─────────────┐    ┌──────────┐    ┌───────────┐       │
│ Diagnostics │◄───┤ Degrade/ │◄───┤ Validate/ │◄──────┘
│ & Telemetry │    │ Repair   │    │ Score     │
└─────────────┘    └──────────┘    └───────────┘
```

### 1. Normalize (`normalize`)
- **Responsibility**: Validates input `AdSpec` and `SurfaceProfile` against runtime Zod schemas. Computes effective canvas bounds after subtracting hardware/platform `safeArea` insets. Sorts elements into canonical order by declared `priority` (1 = highest, N = lowest) and breaks ties deterministically by element role (`hero` > `primary` > `action` > `secondary` > `branding`).
- **Inputs**: Raw `AdSpec`, Raw `SurfaceProfile`.
- **Outputs**: Sanitized `NormalizedSpec`, `ActiveWorkingArea` bounding box, and `PriorityQueue`.

### 2. Measure (`measure`)
- **Responsibility**: Computes intrinsic, minimum, and ideal dimensions for each element. For text, it runs font-size-to-glyph metrics to compute multi-line wrapping boundaries at candidate font sizes. For images, it preserves aspect ratios and calculates minimum readable bounding boxes. For buttons, it ensures dimensions meet or exceed surface `minTapTarget`.
- **Inputs**: `NormalizedSpec`, `SurfaceProfile`, `MeasurementEngine` (Canvas/DOM or pure font metric table).
- **Outputs**: Map of `ElementId -> ElementMeasurement` (intrinsic width/height, min bounding box, line wrapping thresholds).

### 3. Generate Candidates (`generate candidates`)
- **Responsibility**: Inspects surface topology (aspect ratio $\text{AR} = \frac{W}{H}$, viewing distance, available area) and generates macro-structural layout archetypes (e.g. `VerticalStack`, `HorizontalSplit`, `BannerSidebarRow`, `HeroCentricGrid`). Each archetype defines relative spatial zones for primary content, media, and actions.
- **Inputs**: `ActiveWorkingArea`, Aspect Ratio category (`tall`, `wide`, `square`, `extreme-wide`), `ElementMeasurement` map.
- **Outputs**: Ordered list of `CandidateArchetype` strategies to test against constraints.

### 4. Place by Priority (`place by priority`)
- **Responsibility**: Within a selected macro-archetype, allocates spatial boxes greedily starting with Priority 1 elements (Hero Image, Headline), followed by Priority 2 (Action/CTA, Price), and finally Priority 3 (Branding Logo). Elements are placed in their preferred topological zones without overlapping previously committed higher-priority bounding boxes.
- **Inputs**: `CandidateArchetype`, `PriorityQueue`, `ElementMeasurement` map.
- **Outputs**: Tentative `SpatialPlacementMap` containing un-validated `(x, y, w, h)` bounding boxes for all active elements.

### 5. Validate & Score (`validate & score`)
- **Responsibility**: Evaluates the tentative placement against all hard constraints (boundary containment, zero overlap between any pair of elements, minimum tap targets, minimum font sizes). Computes a multi-objective fitness score considering content utilization, visual hierarchy preservation, alignment penalties, and whitespace balance.
- **Inputs**: Tentative `SpatialPlacementMap`, `SurfaceProfile`, Hard/Soft constraint definitions.
- **Outputs**: `ValidationResult` (boolean valid, list of violation tokens) and `CandidateScore` (numerical penalty & aesthetic metric).

### 6. Degrade / Repair (`degrade / repair`)
- **Responsibility**: If hard constraint validation fails or spatial starvation occurs (content overflows the surface), this stage executes targeted, element-specific degradation steps on the lowest available priority items. It repeatedly applies discrete degradation tiers (shrink font $\to$ wrap text $\to$ crop image $\to$ drop branding) until all hard constraints are satisfied or only the minimum irreducible core remains.
- **Inputs**: Failing `SpatialPlacementMap`, list of constraint violations, `PriorityQueue`.
- **Outputs**: Repaired `SpatialPlacementMap` with guaranteed zero overlaps and updated visibility/truncation states.

### 7. Finalize IR (`finalize IR`)
- **Responsibility**: Converts the repaired spatial map into the canonical, immutable `ResolvedLayout` intermediate representation. Calculates exact pixel coordinates, font size styles, text truncation ellipsis markers, button tap target paddings, and background frame coordinates.
- **Inputs**: Repaired `SpatialPlacementMap`, `SurfaceProfile`.
- **Outputs**: Typed `ResolvedLayout` ready for renderers.

### 8. Diagnostics & Telemetry (`emit diagnostics`)
- **Responsibility**: Constructs an explainability trace detailing every step taken during resolution: chosen macro-archetype, initial measurements, degradation steps applied with rationales, dropped elements, and final constraint verification audit.
- **Inputs**: Pipeline execution logs and audit records.
- **Outputs**: `ResolutionTrace` object attached to the `ResolvedLayout`.

---

## 3. Hard vs. Soft Constraints & Priority Model

To achieve predictable adaptation without fragile heuristics, the engine strictly categorizes all constraints into two distinct tiers:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ HARD CONSTRAINTS (Zero-Tolerance Violations — Must Satisfy 100%)       │
│                                                                        │
│ • Surface Bounding Box:   0 <= x <= x+w <= Surface.width               │
│ • Safe Area Insets:       Placement strictly within Safe Margin        │
│ • Pairwise Disjointness:  Intersection(ElemA, ElemB) == 0 (No Overlap) │
│ • Min Tap Target:         Touch elements >= surface.minTapTarget (px)  │
│ • Min Legible Text Size:  Font size >= surface.minTextSize (px)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Unmet Hard Constraints trigger
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PRIORITY-ORDERED DEGRADATION                                           │
│ • Downgrade lowest priority elements first (P3 Branding -> P2 Price)   │
│ • Protect high priority elements (P1 Headline, P1 Hero, P2 CTA)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Satisfied Hard Constraints evaluated by
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ SOFT CONSTRAINTS / PREFERENCES (Scored Optimization Functions)         │
│                                                                        │
│ • Preferred Element Size & Natural Aspect Ratio                        │
│ • Preferred Content Order & Visual Balance                             │
│ • Whitespace Distribution & Margin Uniformity                          │
│ • Reading Flow Alignment (Left-to-Right / Top-to-Bottom)               │
└────────────────────────────────────────────────────────────────────────┘
```

### Hard Constraints
Hard constraints represent physical and legal boundaries. A candidate layout that violates any single hard constraint has a score of $-\infty$ and is invalid:
1. **Surface Bounds**: All visible elements must fit strictly inside $[0, W_{\text{surface}}] \times [0, H_{\text{surface}}]$.
2. **Safe Area Insets**: Elements must not penetrate reserved hardware cutouts (e.g., notch, home bar) or broadcast TV title-safe zones.
3. **Pairwise Disjointness**: No two visible elements may overlap bounding rectangles ($\forall i \neq j, \text{Rect}_i \cap \text{Rect}_j = \emptyset$).
4. **Minimum Tap Target**: On touch surfaces (e.g., `retailKiosk`, `mobileInterstitial`), interactive elements (buttons/CTAs) must have both width and height $\ge \text{minTapTarget}$ (e.g., 44px on mobile, 60px on kiosk).
5. **Minimum Legible Text Size**: On surfaces viewed from afar (e.g., `broadcastLowerThird`), text elements must never render below $\text{minTextSize}$ (e.g., 32px), even if shrinking font size would otherwise avoid an overflow.

### Soft Constraints & Objective Scoring
Soft constraints guide candidate ranking when multiple valid configurations exist. Soft penalties penalize deviations from ideal design intent:
$$\text{Score} = w_{\text{vis}} \cdot \text{VisibilityScore} - w_{\text{dist}} \cdot \text{DistortionPenalty} - w_{\text{white}} \cdot \text{WhitespaceVariance} - w_{\text{deg}} \cdot \text{DegradationPenalty}$$

---

## 4. Degradation Ladder per Element Type

When available screen area is insufficient to satisfy all elements at their ideal sizes, the engine degrades elements along deterministic, role-specific ladders ordered strictly from lowest priority ($P_N$) to highest priority ($P_1$).

```text
Element Type      Degradation Sequence (Progressive Steps)
──────────────    ──────────────────────────────────────────────────────────────
Text              [Ideal Size] ──► [Shrink Font to MinTextSize] ──► [Wrap to Max Lines] ──► [Truncate with Ellipsis]
Image             [Ideal 1:1/16:9] ──► [Scale Down to MinHeroSize] ──► [Crop to Focused Aspect] ──► [Iconic Preview]
Button / CTA      [Full Padding + Subtext] ──► [Compact Padding] ──► [Reposition] ──► [LOCK AT minTapTarget (NEVER DROP)]
Branding Logo     [Full Wordmark] ──► [Compact Logo] ──► [Icon Mark] ──► [Reposition to Corner] ──► [DROP CLEANLY]
```

### Strict Protection Invariant: CTA vs. Branding
- **CTA (Priority 2, Role: `action`)** is an essential conversion anchor. It is strictly protected from being dropped. It may shed accessory icons or padding, but its interactive hit box is locked at or above `surface.minTapTarget`.
- **Branding (Priority 3, Role: `branding`)** provides secondary context. If space diminishes, branding will shed secondary text, scale down, migrate to available secondary margins, and finally **drop out completely** before the CTA or Hero image is compromised.

---

## 5. Extensibility: Adding Surfaces & Renderers Without Modifying the Resolver

The system is decoupled through typed domain contracts:

```text
 ┌──────────────────────┐         ┌───────────────────────────┐
 │  SurfaceProfile      │         │  ResolvedLayout           │
 │  (Contract)          │         │  (Immutable IR)           │
 └──────────┬───────────┘         └─────────────┬─────────────┘
            │                                   │
            ▼                                   ▼
 ┌──────────────────────┐         ┌───────────────────────────┐
 │ resolver.ts          │         │ render-dom.tsx            │
 │ resolveLayout(       │───────► │ render-canvas.ts          │
 │   spec: AdSpec,      │         │ [Any New Renderer]        │
 │   surface: Surface)  │         └───────────────────────────┘
 └──────────────────────┘
```

### Adding a New Surface Profile (e.g. Ultra-Wide Billboard or Smartwatch)
To add a new surface, one simply defines a new `SurfaceProfile` object conforming to the interface:
```typescript
export interface SurfaceProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  safeArea?: { top: number; right: number; bottom: number; left: number };
  minTapTarget?: number;
  minTextSize?: number;
  viewingDistance?: "near" | "medium" | "far";
  touchOnly?: boolean;
}
```
The resolver never checks `if (surface.id === "mobile")`. Instead, it reads `width`, `height`, `minTapTarget`, `minTextSize`, and aspect ratio dynamically. Any arbitrary 5th profile provided during testing will resolve automatically.

### Adding a New Renderer (e.g. WebGL, SVG, PDF)
Renderers consume only the resolved IR:
```typescript
export interface ResolvedLayout {
  surfaceId: string;
  dimensions: { width: number; height: number };
  elements: ResolvedElement[];
  trace: ResolutionTrace;
}
```
A renderer has zero awareness of constraints, priorities, or degradation algorithms; it is simply a pure projection of 2D bounding boxes and styles.

---

## 6. What We Are Explicitly NOT Building (Scope Boundaries)

In accordance with the assignment's explicit guidance, we intentionally avoid over-engineering:

1. **No General Linear Programming / Simplex Solver**:
   - *Rationale*: General LP solvers (like Cassowary or Simplex) are heavyweight, non-transparent, and struggle with non-linear discrete degradation (such as dropping an element or switching text line wrapping). A priority-ordered spatial partition and greedy degradation cascade is fully deterministic, $O(N \log N)$, easily debugged, and explainable step-by-step.
2. **No Dynamic Plugin Architecture**:
   - *Rationale*: A single ad domain with well-defined element roles (`hero`, `primary`, `action`, `secondary`, `branding`) does not warrant dynamic runtime plugin loaders or foreign module registries. We keep the core typed and compact.
3. **No Animation / Physics Engine in the Core Resolver**:
   - *Rationale*: The resolver's sole output is a static, deterministic geometric state. Layout transitions and animations belong exclusively in the presentation/rendering layer (e.g. CSS transitions or React motion wrappers in the demo UI).

---

## 7. Open Architectural Questions for Alignment

Before finalizing implementation in Phase 2, the following design decisions are documented for explicit alignment:

1. **Scoring Model: Flat vs. Aspect-Ratio-Weighted Scoring**:
   - *Recommendation*: Use a normalized $[0, 100]$ score composed of visibility weight (40%), constraint compliance (30%), visual balance (20%), and whitespace economy (10%).
2. **Measurement Engine Abstraction in Headless Tests**:
   - *Recommendation*: Provide a fast, offline Canvas/heuristic text metrics fallback when running under Vitest/Node, while using real Canvas context metrics in browser environments.
3. **Macro Archetype Partitioning**:
   - *Recommendation*: Use 4 primary topological archetypes:
     - `TallStack` (aspect ratio $< 0.8$, e.g. Mobile Portrait)
     - `BalancedSplit` (aspect ratio $0.8 \le \text{AR} \le 1.3$, e.g. Square Kiosk)
     - `WideHorizontal` (aspect ratio $1.3 < \text{AR} \le 3.0$, e.g. Mobile Landscape)
     - `UltraWideRibbon` (aspect ratio $> 3.0$, e.g. Broadcast Lower-Third)

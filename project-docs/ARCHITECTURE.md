# Architecture Blueprint: Adaptive Layout Engine for Multi-Surface Ads

## 1. End-to-End Data Flow

The Adaptive Layout Engine models multi-surface ad layout as a deterministic, constraint-guided geometric pipeline. It takes an abstract, surface-agnostic description of ad content and a physical surface specification, and generates a concrete coordinate mapping that can be consumed by any rendering backend.

```mermaid
flowchart TD
    subgraph Inputs ["1. Declarative Specifications"]
        A["<b>AdSpec</b><br/>• Semantic Elements & Roles<br/>• Priorities (1..N)<br/>• Text Copy, Image URLs, Buttons"]
        B["<b>SurfaceProfile</b><br/>• Dimensions (Width × Height)<br/>• Safe Area Insets (Notch, TV Safe)<br/>• Hardware Constraints (Tap, Text, Distance)"]
    end

    subgraph Core ["2. Constraint Resolver Engine (Pure TypeScript)"]
        C["<b>Macro-Archetype Classifier & Normalizer</b><br/>Aspect-ratio-driven spatial zone allocation"]
        D["<b>Priority Degradation & Repair</b><br/>Multi-pass constraint satisfaction loop"]
        C --> D
    end

    subgraph Output ["3. Intermediate Representation (IR)"]
        E["<b>ResolvedLayout</b><br/>• Normalized coordinates (x, y, w, h)<br/>• Typography scale & line wrapping<br/>• Diagnostic explainability trace"]
    end

    subgraph Consumers ["4. Rendering Consumers"]
        F["<b>React / DOM Renderer</b><br/>Interactive DOM elements & CSS styles"]
        G["<b>Canvas 2D Renderer</b><br/>Rasterized HTML5 Canvas graphics"]
        H["<b>Headless SVG / SSR Exporter</b><br/>Vector output & automated validation"]
    end

    Inputs --> C
    D --> E
    E --> F
    E --> G
    E --> H

    classDef inStyle fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;
    classDef coreStyle fill:#0f172a,stroke:#8b5cf6,stroke-width:2px,color:#f8fafc;
    classDef irStyle fill:#1e1e38,stroke:#06b6d4,stroke-width:2px,color:#f8fafc;
    classDef renderStyle fill:#182234,stroke:#10b981,stroke-width:2px,color:#f8fafc;

    class A,B inStyle;
    class C,D coreStyle;
    class E irStyle;
    class F,G,H renderStyle;
```

### Why the Resolver Must Be 100% Framework-Agnostic
1. **Separation of Concerns**: Layout calculation is pure geometry, typography math, and constraint resolution. Tying resolution to DOM elements, browser layout passes (`getBoundingClientRect`), or React component lifecycles makes testing slow, non-deterministic, and impossible in headless environments (e.g., automated CI test suites, edge SSR workers, or batch pre-rendering).
2. **Pluggable Render Targets**: By producing an Intermediate Representation (`ResolvedLayout`) containing absolute normalized rectangles, typographic scales, and clipping flags, any rendering engine (DOM, HTML5 Canvas, WebGL, SVG, or Native Mobile) can render the ad with zero code changes to the resolver.
3. **Purity & Testability**: A pure function `resolve(spec, surface, options?): ResolvedLayout` guarantees reproducibility: given the exact same `AdSpec` and `SurfaceProfile`, the layout output is bit-for-bit identical across all platforms and execution environments.

---

## 2. Resolver Internal Pipeline Stages

The layout engine executes a deterministic 5-stage pipeline to resolve constraints systematically and explainably:

```mermaid
flowchart LR
    S1["<b>1. Normalize</b><br/>Zod schema validation<br/>Safe area subtraction<br/>Archetype selection"]
    S2["<b>2. Measure</b><br/>Text line wrapping<br/>Hero aspect ratio<br/>Tap target bounds"]
    S3["<b>3. Place</b><br/>Topological zones<br/>Priority placement<br/>Coordinate mapping"]
    S4["<b>4. Validate & Score</b><br/>Hard invariants check<br/>Aesthetic balance<br/>Multi-objective score"]
    S5["<b>5. Degrade / Repair</b><br/>Pass 1: Shrink<br/>Pass 2: Truncate<br/>Pass 3: Drop"]

    S1 --> S2 --> S3 --> S4 --> S5

    classDef stage fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#f8fafc;
    class S1,S2,S3,S4,S5 stage;
```

### 1. Normalize (`normalize`)
- **Responsibility**: Validates input `AdSpec` and `SurfaceProfile` against runtime Zod schemas. Computes effective canvas bounds after subtracting hardware/platform `safeArea` insets. Derives the geometric macro-archetype from aspect ratio ($\text{AR} = \frac{W}{H}$) and establishes the working coordinate space.
- **Inputs**: Raw `AdSpec`, Raw `SurfaceProfile`.
- **Outputs**: Sanitized `NormalizedSpec`, `ActiveWorkingArea` bounding box, and classified `LayoutArchetype`.

### 2. Measure (`measure`)
- **Responsibility**: Computes intrinsic, minimum, and ideal dimensions for each element via the pluggable `TextMeasurer` abstraction (`DOMTextMeasurer`, `CanvasTextMeasurer`, or `EstimateTextMeasurer`). Computes multi-line text wrapping thresholds, image aspect ratios, and button tap-target hit boxes.
- **Inputs**: `NormalizedSpec`, `SurfaceProfile`, `TextMeasurer`.
- **Outputs**: Map of `ElementId -> ElementMeasurement` (intrinsic dimensions, line wrapping boundaries, tap target bounds).

### 3. Place (`place`)
- **Responsibility**: Positions elements within the selected macro-archetype topology:
  - `TallStack` ($\text{AR} < 0.85$, e.g., Mobile Portrait): Single-column centered vertical stack.
  - `BalancedGrid` ($0.85 \le \text{AR} \le 1.35$, e.g., Retail Kiosk): Media top, headline/content middle, actions bottom with balanced padding.
  - `HorizontalSplit` ($1.35 < \text{AR} \le 3.5$, e.g., Mobile Landscape): 2-column layout (hero media left, copy and actions right).
  - `UltraWideRibbon` ($\text{AR} > 3.5$, e.g., Broadcast Lower-Third): Single horizontal row partitioned into branding, hero media, copy block, and trailing CTA.
- **Inputs**: `LayoutArchetype`, `ElementMeasurement` map, `ActiveWorkingArea`.
- **Outputs**: Tentative `SpatialPlacementMap` containing un-validated `(x, y, w, h)` bounding boxes for all active elements.

### 4. Validate & Score (`validate`)
- **Responsibility**: Evaluates the tentative placement against all hard constraints (boundary containment, pairwise non-overlap, minimum tap targets, minimum font sizes). Computes a multi-objective fitness score considering content utilization, visual hierarchy preservation, and whitespace balance.
- **Inputs**: Tentative `SpatialPlacementMap`, `SurfaceProfile`, Hard/Soft constraint definitions.
- **Outputs**: `ValidationResult` (boolean valid, list of violation tokens) and `CandidateScore` (numerical fitness metric).

### 5. Degrade / Repair (`degrade`)
- **Responsibility**: If hard constraint validation fails or spatial starvation occurs, executes targeted degradation passes in strict priority order (lowest priority $P_N$ to highest $P_1$):
  - *Pass 1 (Non-destructive adjustments)*: Shrink padding, scale font size down towards `minTextSize`, scale hero image.
  - *Pass 2 (Progressive keyword truncation)*: Compact text copy to essential keywords with ellipsis (`...`).
  - *Pass 3 (Selective dropping)*: Drop lower-priority optional elements marked with `canDrop: true` (e.g. secondary copy, price tag, branding logo).
  - *Pass 4 (Spatial starvation emergency containment)*: Non-action elements drop to protect the core CTA button from boundary clipping.
- **Inputs**: Failing `SpatialPlacementMap`, list of constraint violations, priority queue.
- **Outputs**: Repaired `SpatialPlacementMap` with guaranteed zero overlaps and zero clipping.

### Diagnostics & Telemetry
Every stage records events to a `DiagnosticsCollector`, producing an explainable, step-by-step `ResolutionDiagnostics` audit report detailing decisions, duration, and constraint satisfaction.

---

## 3. Hard vs. Soft Constraints & Priority Model

To achieve predictable adaptation without fragile heuristics, the engine strictly categorizes all constraints into two distinct tiers:

```mermaid
flowchart TD
    subgraph Hard ["HARD CONSTRAINTS (Zero-Tolerance Physical Invariants)"]
        H1["<b>Surface Bounding Box</b>: 0 ≤ x ≤ x+w ≤ Surface.width"]
        H2["<b>Safe Area Insets</b>: Placement strictly within safe margins"]
        H3["<b>Pairwise Disjointness</b>: RectA ∩ RectB = ∅ (Zero Overlap)"]
        H4["<b>Minimum Tap Target</b>: Touch target ≥ surface.minTapTarget"]
        H5["<b>Minimum Legible Text</b>: Font size ≥ surface.minTextSize"]
    end

    subgraph Trigger ["Invariant Failure Trigger"]
        T1{"Any Hard Constraint<br/>Violated?"}
    end

    subgraph Degradation ["PRIORITY-ORDERED DEGRADATION"]
        D1["<b>Priority Ladder Cascade</b><br/>• Degrade lowest priority elements first (P3 Branding ➔ P2 Price)<br/>• Strictly protect high priority conversion elements (P1 Headline, P1 Hero, P2 CTA)"]
    end

    subgraph Soft ["SOFT CONSTRAINTS / PREFERENCES (Scored Optimization Functions)"]
        S1["<b>Visual Balance & Centering</b>: Centroid alignment"]
        S2["<b>Preferred Element Size</b>: Natural aspect ratios"]
        S3["<b>Whitespace Distribution</b>: Balanced margins & padding"]
        S4["<b>Reading Flow</b>: Natural visual hierarchy"]
    end

    Hard --> T1
    T1 -- "Yes (Score = -∞)" --> D1
    D1 --> Hard
    T1 -- "No (100% Valid)" --> Soft

    classDef hardStyle fill:#2d1515,stroke:#ef4444,stroke-width:2px,color:#f8fafc;
    classDef degStyle fill:#2e1f0c,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;
    classDef softStyle fill:#0f2419,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    classDef trigStyle fill:#1e1e38,stroke:#8b5cf6,stroke-width:2px,color:#f8fafc;

    class H1,H2,H3,H4,H5 hardStyle;
    class T1 trigStyle;
    class D1 degStyle;
    class S1,S2,S3,S4 softStyle;
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

```mermaid
flowchart LR
    subgraph Text ["Text Elements (Headline / Price)"]
        T1["Ideal Size"] --> T2["Shrink Font to MinTextSize"] --> T3["Wrap to Max Lines"] --> T4["Truncate with Ellipsis"]
    end

    subgraph Image ["Image Elements (Hero Product)"]
        I1["Ideal 16:9 / 1:1"] --> I2["Scale Down to MinHeroSize"] --> I3["Crop / Refocus Aspect"] --> I4["Iconic Preview"]
    end

    subgraph Button ["Action Button (CTA) - PROTECTED"]
        B1["Full Padding + Subtext"] --> B2["Compact Padding"] --> B3["Reposition"] --> B4["LOCK AT minTapTarget<br/>(NEVER DROPPED)"]
    end

    subgraph Branding ["Branding Elements (Logo / Wordmark)"]
        L1["Full Wordmark"] --> L2["Compact Logo"] --> L3["Icon Mark"] --> L4["DROP CLEANLY<br/>(First to be removed)"]
    end

    classDef step fill:#1e293b,stroke:#64748b,stroke-width:1px,color:#f8fafc;
    classDef locked fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    classDef dropped fill:#4c0519,stroke:#f43f5e,stroke-width:2px,color:#f8fafc;

    class T1,T2,T3,T4,I1,I2,I3,I4,B1,B2,B3,L1,L2,L3 step;
    class B4 locked;
    class L4 dropped;
```

### Strict Protection Invariant: CTA vs. Branding
- **CTA (Priority 2, Role: `action`)** is an essential conversion anchor. It is strictly protected from being dropped. It may shed accessory icons or padding, but its interactive hit box is locked at or above `surface.minTapTarget`.
- **Branding (Priority 3, Role: `branding`)** provides secondary context. If space diminishes, branding will shed secondary text, scale down, migrate to available secondary margins, and finally **drop out completely** before the CTA or Hero image is compromised.

---

## 5. Extensibility: Adding Surfaces & Renderers Without Modifying the Resolver

The system is decoupled through typed domain contracts:

```mermaid
flowchart TD
    subgraph Contract ["Typed Domain Contract"]
        SP["<b>SurfaceProfile</b><br/>• width, height<br/>• safeArea insets<br/>• minTapTarget, minTextSize<br/>• viewingDistance"]
        AS["<b>AdSpec</b><br/>• elements, roles, priorities"]
    end

    subgraph Resolver ["Independent Pure Resolver (resolver.ts)"]
        R["<b>resolveLayout(spec, surface, options?)</b><br/>Deterministic coordinate calculation<br/>Zero DOM or Canvas dependencies"]
    end

    subgraph IR ["Immutable Intermediate Representation"]
        RL["<b>ResolvedLayout</b><br/>• surfaceId, dimensions<br/>• elements: [x, y, w, h, scale, visible]<br/>• trace: ResolutionDiagnostics"]
    end

    subgraph Renderers ["Decoupled Render Targets"]
        R1["<b>React / DOM (render-dom.tsx)</b>"]
        R2["<b>Canvas 2D (render-canvas.ts)</b>"]
        R3["<b>WebGL / WebGPU Displays</b>"]
        R4["<b>Headless SSR / Vector Exporters</b>"]
    end

    Contract --> R
    R --> IR
    IR --> R1
    IR --> R2
    IR --> R3
    IR --> R4

    classDef contractStyle fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;
    classDef resolverStyle fill:#0f172a,stroke:#8b5cf6,stroke-width:2px,color:#f8fafc;
    classDef irStyle fill:#1e1e38,stroke:#06b6d4,stroke-width:2px,color:#f8fafc;
    classDef rendererStyle fill:#182234,stroke:#10b981,stroke-width:2px,color:#f8fafc;

    class SP,AS contractStyle;
    class R resolverStyle;
    class RL irStyle;
    class R1,R2,R3,R4 rendererStyle;
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

## 7. Architectural Decisions & Production Implementation Alignment

The design questions originally identified during preliminary research were resolved as follows:

1. **Scoring Model: Multi-Objective Fitness Evaluation**:
   - *Production Solution*: Implemented in `src/core/scoring.ts`. Evaluates layout candidates on a normalized $[0, 100]$ scale across four dimensions:
     - Visibility Weight (40%): Rewards keeping declared elements visible, heavily penalizing drops of higher-priority items.
     - Degradation Penalties (30%): Deducts points for font shrinkage, text truncation, and hero scale reductions.
     - Visual Balance (20%): Evaluates horizontal and vertical centroid centering and alignment consistency.
     - Whitespace Economy (10%): Rewards balanced content fill factor avoiding extreme dead space or overcrowding.

2. **Measurement Engine Abstraction in Heterogeneous Environments**:
   - *Production Solution*: Implemented `TextMeasurer` strategy interface (`src/measurement/`).
     - In live React browser demo: `DOMTextMeasurer` uses offscreen cached DOM elements for pixel-perfect line wraps.
     - In Canvas rendering: `CanvasTextMeasurer` uses `CanvasRenderingContext2D` or `OffscreenCanvas`.
     - In headless CI/Vitest: `EstimateTextMeasurer` provides deterministic font-aspect heuristics with zero binary dependencies.

3. **Macro Archetype Partitioning**:
   - *Production Solution*: Formally implemented 4 geometric archetypes in `src/core/resolver.ts` derived dynamically from surface aspect ratio ($\text{AR} = \frac{W}{H}$):
     - `TallStack` ($\text{AR} < 0.85$, e.g., Mobile Portrait)
     - `BalancedGrid` ($0.85 \le \text{AR} \le 1.35$, e.g., Retail Kiosk Screen)
     - `HorizontalSplit` ($1.35 < \text{AR} \le 3.5$, e.g., Mobile Landscape)
     - `UltraWideRibbon` ($\text{AR} > 3.5$, e.g., Broadcast Lower-Third)


# Architecture Blueprint: Adaptive Layout Engine

## Core Pipeline Architecture
```text
AdSpec (Declarative Intent) + SurfaceProfile (Hardware/Context Constraints)
       │
       ▼
   Validation & Normalization (Zod schemas, constraint sanity checks)
       │
       ▼
   Measurement Pass (DOM/Canvas/Pure text metric calculations)
       │
       ▼
   Constraint Resolution Engine (Hierarchical spatial partitioner + priority degradation)
       │
       ▼
   Scoring & Diagnostics (Feasibility evaluation, overlap detection, resolution trace)
       │
       ▼
   Resolved Layout IR (Element bounds, visibility, typographic scaling, transform specs)
       │
   ┌───┴───────────────┐
   ▼                   ▼
DOM / React         Canvas 2D
Renderer            Renderer
```

## Architectural Principles
1. **Pure TypeScript Resolution Core**: Zero framework or DOM dependencies in `src/core/`. The layout algorithm is 100% deterministic and unit-testable in Node/headless environments.
2. **First-Class Constraints**: Surface profiles dictate spatial, sensory, and accessibility constraints (e.g. `minTapTarget`, `minTextSize`, safe areas, viewing distance, aspect ratio) rather than device name heuristics.
3. **Graceful Priority-Based Degradation**: Strict priority cascade (P1 Hero/Headline > P2 Action/Price > P3 Branding/Secondary) with multi-stage degradation (full -> compact -> truncated -> collapsed).
4. **Pluggable Render Backends**: Both DOM (React) and Canvas 2D consume the exact same typed `ResolvedLayout` intermediate representation (IR).
5. **Full Diagnostics & Explainability**: Resolution decisions are traced step-by-step with diagnostic logs and scoring metrics for transparency and live debugging.

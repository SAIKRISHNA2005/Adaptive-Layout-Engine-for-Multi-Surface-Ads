# Architecture Decision Records (ADR)

## ADR-001: Separation of Core Resolver from Rendering Backends
- **Status**: Accepted
- **Context**: The engine needs to support DOM, Canvas, and potentially unknown future renderers.
- **Decision**: All resolution logic lives in `src/core/` and outputs a normalized `ResolvedLayout` representation with explicit `(x, y, width, height, scale, visible, typography)` properties per element.
- **Consequences**: Enables 100% headless testing with Vitest and straightforward implementation of multiple renderers.

## ADR-002: Multi-Stage Priority Degradation Model
- **Status**: Accepted
- **Context**: Shrinking surfaces cannot satisfy all elements without clipping or overlapping.
- **Decision**: Elements undergo discrete degradation tiers (e.g. `Full` -> `Compact` -> `Minimal/Icon` -> `Dropped`) ordered inversely by priority before higher-priority elements are affected.
- **Consequences**: Deterministic, zero-overlap degradation behavior even on extremely constrained surfaces.

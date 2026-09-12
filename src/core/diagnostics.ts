// Diagnostic tracing and explainability logger recording step-by-step resolution passes and degradation reasons.

/** Pipeline stage identifier for diagnostic trace records. */
export type PipelineStage = "normalize" | "measure" | "place" | "validate" | "degrade";

/** A single chronological trace event emitted during constraint resolution. */
export interface ResolutionTraceStep {
  /** Monotonically increasing 1-indexed sequence number. */
  readonly step: number;
  /** Resolver pipeline stage that generated this event. */
  readonly stage: PipelineStage;
  /** Clear human-readable explanation of the action or calculation. */
  readonly message: string;
  /** Optional target element ID associated with this event. */
  readonly elementId?: string;
}

/** Structured diagnostics report summarizing layout resolution performance and decisions. */
export interface ResolutionDiagnostics {
  /** Chronological trace of every pipeline decision and transformation. */
  readonly trace: readonly ResolutionTraceStep[];
  /** High-level summary metrics suitable for visual UI inspector dashboards. */
  readonly summary: {
    /** Number of elements successfully positioned and visible in the final layout. */
    readonly elementsResolved: number;
    /** Total number of elements originally declared in the AdSpec. */
    readonly elementsTotal: number;
    /** Number of hard constraints completely satisfied. */
    readonly hardConstraintsSatisfied: number;
    /** Total number of hard constraints evaluated. */
    readonly hardConstraintsTotal: number;
    /** Final count of element bounding box overlaps (target: 0). */
    readonly overlaps: number;
    /** Final count of elements clipped outside surface bounds (target: 0). */
    readonly clipping: number;
    /** Total pipeline execution time in milliseconds. */
    readonly durationMs: number;
    /** Human-readable list of hard constraint violations detected if any remain unsatisfied. */
    readonly violations?: readonly string[];
  };
}

/** Stateful collector accumulating structured trace entries during resolver execution. */
export class DiagnosticsCollector {
  private readonly steps: ResolutionTraceStep[] = [];
  private stepCounter = 1;

  /**
   * Records a new diagnostic trace step in chronological order.
   *
   * @param stage - The active pipeline stage.
   * @param message - Descriptive explanation of the event or calculation.
   * @param elementId - Optional element ID if the event pertains to a specific element.
   */
  record(stage: PipelineStage, message: string, elementId?: string): void {
    this.steps.push({
      step: this.stepCounter++,
      stage,
      message,
      elementId,
    });
  }

  /** Returns all collected trace steps as an immutable array. */
  getTrace(): readonly ResolutionTraceStep[] {
    return [...this.steps];
  }
}

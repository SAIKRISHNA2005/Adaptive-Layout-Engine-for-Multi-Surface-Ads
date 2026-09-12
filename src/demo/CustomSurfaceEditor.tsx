// Live visual editor for defining arbitrary, unseen 5th surface profiles with custom aspect ratios, constraints, and viewing distances.

import React, { useState } from "react";
import { type SurfaceProfile, type ViewingDistance } from "../core/types";
import { defineSurface } from "../core/surfaces";
import { parseSurfaceProfile, ValidationError } from "../core/validation";

/** Props for the CustomSurfaceEditor component. */
export interface CustomSurfaceEditorProps {
  /** Callback fired when a valid custom surface is submitted and created. */
  readonly onSave: (surface: SurfaceProfile) => void;
  /** Callback fired when the editor modal/drawer is dismissed. */
  readonly onCancel?: () => void;
  /** Optional initial surface profile values to prefill. */
  readonly initialValues?: Partial<SurfaceProfile>;
}

/** Form state interface for custom surface editor. */
interface FormState {
  name: string;
  width: string;
  height: string;
  safeTop: string;
  safeRight: string;
  safeBottom: string;
  safeLeft: string;
  minTapTarget: string;
  minTextSize: string;
  viewingDistance: ViewingDistance;
  touchOnly: boolean;
}

/**
 * Interactive form component for defining and validating arbitrary, unknown-at-design-time surface profiles.
 * Validates strictly through parseSurfaceProfile and emits immutable SurfaceProfile objects.
 */
export const CustomSurfaceEditor: React.FC<CustomSurfaceEditorProps> = ({
  onSave,
  onCancel,
  initialValues,
}) => {
  const [form, setForm] = useState<FormState>({
    name: initialValues?.name ?? "Custom Surface",
    width: initialValues?.width ? String(initialValues.width) : "700",
    height: initialValues?.height ? String(initialValues.height) : "300",
    safeTop: initialValues?.safeArea?.top !== undefined ? String(initialValues.safeArea.top) : "20",
    safeRight: initialValues?.safeArea?.right !== undefined ? String(initialValues.safeArea.right) : "30",
    safeBottom: initialValues?.safeArea?.bottom !== undefined ? String(initialValues.safeArea.bottom) : "20",
    safeLeft: initialValues?.safeArea?.left !== undefined ? String(initialValues.safeArea.left) : "30",
    minTapTarget: initialValues?.minTapTarget ? String(initialValues.minTapTarget) : "48",
    minTextSize: initialValues?.minTextSize ? String(initialValues.minTextSize) : "24",
    viewingDistance: initialValues?.viewingDistance ?? "medium",
    touchOnly: initialValues?.touchOnly ?? true,
  });

  const [errors, setErrors] = useState<readonly string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const parsedWidth = parseFloat(form.width);
    const parsedHeight = parseFloat(form.height);
    const parsedSafeTop = parseFloat(form.safeTop) || 0;
    const parsedSafeRight = parseFloat(form.safeRight) || 0;
    const parsedSafeBottom = parseFloat(form.safeBottom) || 0;
    const parsedSafeLeft = parseFloat(form.safeLeft) || 0;
    const parsedMinTap = form.minTapTarget ? parseFloat(form.minTapTarget) : undefined;
    const parsedMinText = form.minTextSize ? parseFloat(form.minTextSize) : undefined;

    const surfaceId = `custom-${Date.now().toString(36)}`;
    const candidate = {
      id: surfaceId,
      name: form.name.trim() || "Custom Surface",
      width: parsedWidth,
      height: parsedHeight,
      safeArea: {
        top: parsedSafeTop,
        right: parsedSafeRight,
        bottom: parsedSafeBottom,
        left: parsedSafeLeft,
      },
      minTapTarget: parsedMinTap,
      minTextSize: parsedMinText,
      viewingDistance: form.viewingDistance,
      touchOnly: form.touchOnly,
    };

    try {
      // 1. Central runtime validation pass
      parseSurfaceProfile(candidate);

      // 2. Immutable surface construction
      const newSurface = defineSurface(candidate);
      onSave(newSurface);
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.issues && err.issues.length > 0 ? [...err.issues] : [err.message]);
      } else if (err instanceof Error) {
        setErrors([err.message]);
      } else {
        setErrors(["An unknown validation error occurred."]);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Custom Surface Editor"
      style={{
        backgroundColor: "#0b1120",
        border: "1px solid rgba(147, 51, 234, 0.4)",
        borderRadius: "16px",
        padding: "24px",
        color: "#f8fafc",
        maxWidth: "680px",
        width: "100%",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(147, 51, 234, 0.2)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#c084fc", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🛠️</span>
            <span>Custom Surface Profile Editor</span>
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
            Define arbitrary, unknown-at-design-time surface topologies to test engine generalization
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close custom surface editor"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Inline Validation Error Messages */}
      {errors.length > 0 && (
        <div
          role="alert"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "8px",
            padding: "12px 14px",
            marginBottom: "16px",
            color: "#fca5a5",
            fontSize: "12px",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>Surface Validation Failed:</div>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {errors.map((msg, idx) => (
              <li key={idx} style={{ marginTop: "2px" }}>
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Name input */}
        <div>
          <label htmlFor="surface-name-input" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
            Surface Display Name
          </label>
          <input
            id="surface-name-input"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Airport Terminal Banner"
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              color: "#ffffff",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Physical Dimensions (Width x Height) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label htmlFor="surface-width-input" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
              Width (px) *
            </label>
            <input
              id="surface-width-input"
              type="number"
              value={form.width}
              onChange={(e) => setForm({ ...form, width: e.target.value })}
              required
              min="1"
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label htmlFor="surface-height-input" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
              Height (px) *
            </label>
            <input
              id="surface-height-input"
              type="number"
              value={form.height}
              onChange={(e) => setForm({ ...form, height: e.target.value })}
              required
              min="1"
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Safe Area Insets (Top, Right, Bottom, Left) */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
            Hardware Safe Area Insets (px)
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Top</span>
              <input
                id="safe-top-input"
                type="number"
                value={form.safeTop}
                onChange={(e) => setForm({ ...form, safeTop: e.target.value })}
                min="0"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "6px",
                  color: "#ffffff",
                  fontSize: "12px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Right</span>
              <input
                id="safe-right-input"
                type="number"
                value={form.safeRight}
                onChange={(e) => setForm({ ...form, safeRight: e.target.value })}
                min="0"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "6px",
                  color: "#ffffff",
                  fontSize: "12px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Bottom</span>
              <input
                id="safe-bottom-input"
                type="number"
                value={form.safeBottom}
                onChange={(e) => setForm({ ...form, safeBottom: e.target.value })}
                min="0"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "6px",
                  color: "#ffffff",
                  fontSize: "12px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Left</span>
              <input
                id="safe-left-input"
                type="number"
                value={form.safeLeft}
                onChange={(e) => setForm({ ...form, safeLeft: e.target.value })}
                min="0"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "6px",
                  color: "#ffffff",
                  fontSize: "12px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>

        {/* Min Tap Target & Min Text Size */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label htmlFor="min-tap-target-input" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
              Min Tap Target (px)
            </label>
            <input
              id="min-tap-target-input"
              type="number"
              value={form.minTapTarget}
              onChange={(e) => setForm({ ...form, minTapTarget: e.target.value })}
              placeholder="e.g. 48"
              min="0"
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label htmlFor="min-text-size-input" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
              Min Text Size (px)
            </label>
            <input
              id="min-text-size-input"
              type="number"
              value={form.minTextSize}
              onChange={(e) => setForm({ ...form, minTextSize: e.target.value })}
              placeholder="e.g. 24"
              min="0"
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Viewing Distance & Touch Checkbox */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "center" }}>
          <div>
            <label htmlFor="viewing-distance-select" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
              Viewing Distance
            </label>
            <select
              id="viewing-distance-select"
              value={form.viewingDistance}
              onChange={(e) => setForm({ ...form, viewingDistance: e.target.value as ViewingDistance })}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "#1e293b",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            >
              <option value="near">Near (Handheld / Mobile)</option>
              <option value="medium">Medium (Desktop / Kiosk)</option>
              <option value="far">Far (TV / Billboard)</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "18px" }}>
            <input
              id="touch-only-checkbox"
              type="checkbox"
              checked={form.touchOnly}
              onChange={(e) => setForm({ ...form, touchOnly: e.target.checked })}
              style={{ width: "16px", height: "16px", accentColor: "#a855f7", cursor: "pointer" }}
            />
            <label htmlFor="touch-only-checkbox" style={{ fontSize: "13px", color: "#e2e8f0", cursor: "pointer", userSelect: "none" }}>
              Touch Interaction (Touch Only)
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "9px 18px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                color: "#cbd5e1",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            style={{
              padding: "9px 22px",
              backgroundColor: "#9333ea",
              border: "1px solid #a855f7",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)",
            }}
          >
            Create & Resolve Surface
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomSurfaceEditor;

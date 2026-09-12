// Bespoke vector iconography for Adaptive Layout Engine R&D Studio.
// Crafted to eliminate generic emoji placeholders per ui-ux-pro-max and taste-skill guidelines.

import React from "react";

export interface IconProps {
  readonly size?: number;
  readonly color?: string;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

/** Adaptive Layout Engine geometric core logo (interlocking responsive bounds). */
export const IconEngine: React.FC<IconProps> = ({ size = 18, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" stroke={color} strokeWidth="1.75" strokeDasharray="2 2" opacity="0.4" />
    <rect x="5" y="5" width="14" height="14" rx="3" stroke={color} strokeWidth="2" />
    <path d="M9 12H15M12 9V15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="5" cy="5" r="1.5" fill={color} />
    <circle cx="19" cy="5" r="1.5" fill={color} />
    <circle cx="5" cy="19" r="1.5" fill={color} />
    <circle cx="19" cy="19" r="1.5" fill={color} />
  </svg>
);

/** Smartphone in portrait orientation. */
export const IconPhonePortrait: React.FC<IconProps> = ({ size = 15, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <rect x="6" y="2" width="12" height="20" rx="3" stroke={color} strokeWidth="1.8" />
    <line x1="10" y1="5" x2="14" y2="5" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
    <circle cx="12" cy="18" r="1" fill={color} opacity="0.8" />
  </svg>
);

/** Smartphone / tablet in landscape orientation. */
export const IconPhoneLandscape: React.FC<IconProps> = ({ size = 15, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <rect x="2" y="6" width="20" height="12" rx="3" stroke={color} strokeWidth="1.8" />
    <line x1="5" y1="10" x2="5" y2="14" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
    <circle cx="18" cy="12" r="1" fill={color} opacity="0.8" />
  </svg>
);

/** Ultra-wide broadcast lower-third ribbon. */
export const IconBroadcast: React.FC<IconProps> = ({ size = 15, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <rect x="1" y="8" width="22" height="8" rx="2" stroke={color} strokeWidth="1.8" />
    <path d="M4 12H9M15 12H20" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
    <rect x="10.5" y="10" width="3" height="4" rx="0.5" fill={color} />
  </svg>
);

/** Retail kiosk square interactive screen. */
export const IconKiosk: React.FC<IconProps> = ({ size = 15, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <rect x="4" y="3" width="16" height="16" rx="3" stroke={color} strokeWidth="1.8" />
    <path d="M9 21H15M12 19V21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="11" r="2" stroke={color} strokeWidth="1.5" opacity="0.7" />
  </svg>
);

/** Stress test spatial pressure gauge glyph. */
export const IconStress: React.FC<IconProps> = ({ size = 15, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <path
      d="M12 3L21 19H3L12 3Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill={color} />
  </svg>
);

/** Plus icon for custom surface creation. */
export const IconPlus: React.FC<IconProps> = ({ size = 15, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" opacity="0.5" />
    <path d="M12 8V16M8 12H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Telemetry pulse / latency activity. */
export const IconPulse: React.FC<IconProps> = ({ size = 14, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <path
      d="M3 12H7L10 4L14 20L17 12H21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Spatial starvation indicator flame. */
export const IconFlame: React.FC<IconProps> = ({ size = 14, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <path
      d="M12 3C12 3 17 8 17 13C17 16.5 14.5 19 12 19C9.5 19 7 16.5 7 13C7 10 9 6 12 3Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M12 11C12 11 14 13 14 14.5C14 16 13 17 12 17C11 17 10 16 10 14.5C10 13 12 11 12 11Z"
      fill={color}
    />
  </svg>
);

/** Terminal prompt / execution trace console. */
export const IconTerminal: React.FC<IconProps> = ({ size = 14, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <rect x="3" y="4" width="18" height="16" rx="3" stroke={color} strokeWidth="1.8" />
    <path d="M7 9L10 12L7 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="15" x2="16" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** 50/50 vertical split view mode. */
export const IconSplit: React.FC<IconProps> = ({ size = 13, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <rect x="4" y="4" width="16" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
    <rect x="4" y="13" width="16" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
  </svg>
);

/** Maximize / expand console view. */
export const IconExpand: React.FC<IconProps> = ({ size = 13, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <path d="M15 4H20V9M9 20H4V15M20 4L13 11M4 20L11 13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Minimize / collapse console view. */
export const IconMinimize: React.FC<IconProps> = ({ size = 13, color = "currentColor", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M7 9L12 14L17 9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

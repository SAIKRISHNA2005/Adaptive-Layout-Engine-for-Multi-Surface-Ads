// Realistic declarative ad specification for demo showcase and live surface adaptation.

import { defineAd } from "../core/spec";
import { type AdSpec } from "../core/types";

/**
 * Realistic flagship wireless headphones ad specification.
 * Contains primary headline, hero product image, price, call-to-action, and brand logo.
 */
export const defaultDemoAdSpec: Readonly<AdSpec> = defineAd({
  id: "aero-tune-pro-launch",
  elements: [
    {
      id: "brand-logo",
      type: "image",
      role: "branding",
      priority: 3,
      aspectRatio: 2.2,
      preferredWidth: 120,
      preferredHeight: 45,
      canDrop: true,
      canShrink: true,
      alt: "AeroTune Audio",
    },
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content: "Sound Beyond Silence. Pure Acoustic Mastery.",
      preferredFontSize: 28,
      minFontSize: 14,
      canShrink: true,
      canTruncate: true,
    },
    {
      id: "hero-image",
      type: "image",
      role: "hero",
      priority: 1,
      aspectRatio: 1.33,
      preferredWidth: 360,
      preferredHeight: 270,
      canShrink: true,
      alt: "AeroTune Pro Wireless ANC Headphones",
    },
    {
      id: "price-tag",
      type: "text",
      role: "secondary",
      priority: 2,
      content: "Only $299 • Free 2-Day Express Shipping",
      preferredFontSize: 16,
      minFontSize: 12,
      canShrink: true,
      canTruncate: true,
    },
    {
      id: "cta-button",
      type: "button",
      role: "action",
      priority: 2,
      label: "Order AeroTune Pro Now",
      minTapTarget: 44,
      canShrink: true,
      canDrop: false,
    },
  ],
});

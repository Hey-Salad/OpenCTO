// OpenCTO Design Tokens
// Based on OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md

export const colors = {
  // Brand Colors
  primary: "#ed4c4c",       // Cherry Red
  secondary: "#faa09a",     // Peach
  tertiary: "#ffd0cd",      // Light Peach
  base: "#ffffff",          // White

  // Dark Surfaces
  background: "#111111",
  surface: "#1a1a1a",
  surface2: "#222222",
  border: "#2a2a2a",
  mutedText: "#888888",
  bodyText: "#f0f0f0",

  // Semantic Colors
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ed4c4c",
  info: "#faa09a",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  full: "9999px",
} as const;

export const typography = {
  fonts: {
    display: "'Grandstander', cursive",
    body: "'Figtree', sans-serif",
    code: "'JetBrains Mono', 'Courier New', monospace",
  },
  sizes: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px",
    xxl: "24px",
    display: "32px",
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const layout = {
  sidebar: {
    left: "215px",
    right: "290px",
  },
} as const;

export const borders = {
  thin: `1px solid ${colors.border}`,
  medium: `2px solid ${colors.border}`,
  accent: `3px solid ${colors.primary}`,
} as const;

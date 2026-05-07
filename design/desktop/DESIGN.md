---
name: Claudio FM Pro
colors:
  surface: '#121414'
  surface-dim: '#121414'
  surface-bright: '#37393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1c'
  surface-container: '#1e2020'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#2f3131'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#c8c6c7'
  on-secondary: '#313031'
  secondary-container: '#4a494a'
  on-secondary-container: '#bab8b9'
  tertiary: '#c9c6c9'
  on-tertiary: '#303032'
  tertiary-container: '#adabae'
  on-tertiary-container: '#404042'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#e5e2e3'
  secondary-fixed-dim: '#c8c6c7'
  on-secondary-fixed: '#1c1b1c'
  on-secondary-fixed-variant: '#474647'
  tertiary-fixed: '#e4e2e4'
  tertiary-fixed-dim: '#c8c6c8'
  on-tertiary-fixed: '#1b1b1d'
  on-tertiary-fixed-variant: '#474649'
  background: '#121414'
  on-background: '#e2e2e2'
  surface-variant: '#333535'
typography:
  display-clock:
    fontFamily: Space Mono
    fontSize: 72px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Space Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Mono
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '300'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '300'
    lineHeight: '1.5'
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 32px
  container-padding: 24px
---

## Brand & Style
The design system for Claudio FM evokes the precision of high-end hardware rack units and the clinical aesthetics of modern developer environments. It targets a professional audience that demands high-information density without sacrificing visual sophistication. 

The style is a hybrid of **Terminal-Inspired Minimalism** and **Modern Glassmorphism**. It utilizes a "Darker than Dark" foundation to allow high-contrast neon elements to pop with purposeful intensity. The aesthetic is immersive and widescreen, prioritizing a cinematic "mission control" feel. It balances the nostalgia of dot-matrix telemetry with the sharpness of ultra-modern sans-serif typography, resulting in a UI that feels both authoritative and cutting-edge.

## Colors
The palette is built on a foundation of **True Black (#000000)** to ensure perfect OLED blacks and infinite depth. **Deep Charcoal (#0a0a0b)** is used for container surfaces to provide a subtle distinction from the background. 

**Neon Green (#22c55e)** serves as the primary functional accent, reserved strictly for active states, "Live" indicators, and critical telemetry data. This green should carry a subtle 2px blur glow in "Live" states to simulate physical LED illumination. Secondary surfaces use semi-transparent grays to create a glass effect, allowing the background dotted texture to remain visible through the UI layers.

## Typography
This design system employs a high-contrast typographic pairing. **Space Mono** is used for branding, headers, and time-based data, mimicking the dot-matrix displays of vintage audio processors. For all "Display" levels, a slight horizontal scan-line effect or pixel-grid mask should be applied to enhance the hardware feel.

**Geist** is the workhorse for metadata, controls, and labels. It must be used in its thinner weights (300/400) to maintain a "technical drawing" appearance. Labels are frequently set in all-caps with generous letter spacing to maximize legibility at small sizes within dense control clusters.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for ultra-wide displays. The screen is divided into modular zones: a fixed sidebar for global navigation, a persistent bottom bar for master audio controls, and a flexible central canvas for channel strips and visualizations.

A **4px baseline grid** governs all internal element spacing. A consistent **subtle dotted grid pattern** (1px dots spaced 24px apart) must be overlaid across the entire background, acting as a visual guide for the user's eye. Components should align strictly to this grid, reinforcing the feeling of a precision instrument.

## Elevation & Depth
Depth is achieved through **Glassmorphism** and **Tonal Layering** rather than traditional drop shadows. 

1.  **Level 0 (Background):** True Black with the dotted grid texture.
2.  **Level 1 (Sub-panels):** Deep Charcoal with 40% opacity and a 12px backdrop blur.
3.  **Level 2 (Active Modals/Pop-overs):** Deep Charcoal with 80% opacity, a 1px solid border (#ffffff10), and a 20px backdrop blur.

Instead of shadows, use **inner glows** and **outer neon glows** (#22c55e) to indicate focus or active status. Elements should feel like they are floating just above a dark glass surface.

## Shapes
The shape language is predominantly **Industrial and Sharp**. A minimal border radius of **4px (Soft)** is applied to containers and buttons to prevent the UI from feeling overly aggressive, while maintaining a precise, engineered look. 

Interactive elements like sliders and knobs should utilize circular forms to mimic physical hardware, while data readouts and waveform containers should remain strictly rectangular.

## Components
-   **Buttons:** Transparent backgrounds with a 1px border. On hover, the border and text glow Neon Green. For "Live" buttons, a solid Neon Green fill with black text is used.
-   **VU Meters:** Vertical segmented bars. Segments are dim gray when inactive and bright Neon Green when signal is present. The peak segment should have a soft green outer glow.
-   **Channel Strips:** Tall, narrow glass containers. Use ultra-thin Geist for labels at the top and bottom.
-   **Waveform Displays:** Rendered in Neon Green lines over a true black background. The waveform should have a subtle "ghosting" effect (motion blur) as it scrolls.
-   **Inputs/Sliders:** Sliders consist of a single 1px horizontal line with a small 12px circular thumb. The thumb glows when active.
-   **Status Badges:** Small "On Air" badges use Space Mono. When active, they pulse slowly with a 4px Neon Green glow.
-   **Dotted Grid:** A global CSS background-image using a radial-gradient to create a 1px dot every 24px, set at 10% opacity.
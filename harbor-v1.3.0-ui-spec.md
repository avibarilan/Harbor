# Harbor v1.3.0 — UI Visual Redesign Spec
## Unifi Site Manager-Inspired Design System

---

## Overview

Harbor needs a visual identity that feels premium, trustworthy, and modern — exactly like Unifi Site Manager. The goal is not to copy Unifi, but to apply the same design philosophy: clean structure, deep color palette, subtle motion, and attention to every small detail. When someone opens Harbor for the first time, it should feel like a professional product.

Version bump: `1.2.x` → `1.3.0`

---

## 1. Design Philosophy

- **Dark-first, light available** — Dark mode is the primary experience. Light mode is fully supported and equally polished.
- **Subtle over flashy** — Animations and effects exist to guide attention, not distract. Everything should feel intentional.
- **Depth through layers** — Cards sit above backgrounds, modals above cards. Light and shadow create hierarchy.
- **Color carries meaning** — Green = online/good, Yellow = warning/offline, Red = error/danger, Blue = action/selected.
- **Typography is structure** — Font weight and size do the heavy lifting. Avoid using too many colors for text.

---

## 2. Color System

### Dark Mode (default)

```css
--color-bg-base: #0e1117          /* Page background — very dark navy */
--color-bg-surface: #161b22       /* Cards, sidebar — slightly lighter */
--color-bg-elevated: #1c2128      /* Modals, dropdowns — elevated surfaces */
--color-bg-hover: #21262d         /* Hover states */

--color-border: #30363d           /* Default borders */
--color-border-subtle: #21262d    /* Subtle dividers */

--color-text-primary: #e6edf3     /* Main text — near white */
--color-text-secondary: #8b949e   /* Secondary text — muted */
--color-text-tertiary: #484f58    /* Placeholder, disabled */

--color-accent: #2563eb           /* Harbor blue — primary action color */
--color-accent-hover: #1d4ed8     /* Darker on hover */
--color-accent-subtle: #1e3a5f    /* Subtle blue tint for selected states */

--color-success: #3fb950          /* Online, connected, up to date */
--color-success-subtle: #1a3326   /* Success background tint */
--color-warning: #d29922          /* Offline, degraded */
--color-warning-subtle: #2d2008   /* Warning background tint */
--color-danger: #f85149           /* Error, danger zone */
--color-danger-subtle: #3d1217    /* Danger background tint */

--color-particle: rgba(37, 99, 235, 0.15)  /* Background particle color */
```

### Light Mode

```css
--color-bg-base: #f3f4f6
--color-bg-surface: #ffffff
--color-bg-elevated: #ffffff
--color-bg-hover: #f9fafb

--color-border: #e5e7eb
--color-border-subtle: #f3f4f6

--color-text-primary: #111827
--color-text-secondary: #6b7280
--color-text-tertiary: #9ca3af

--color-accent: #2563eb
--color-accent-hover: #1d4ed8
--color-accent-subtle: #eff6ff

--color-success: #16a34a
--color-success-subtle: #f0fdf4
--color-warning: #d97706
--color-warning-subtle: #fffbeb
--color-danger: #dc2626
--color-danger-subtle: #fef2f2

--color-particle: rgba(37, 99, 235, 0.06)
```

---

## 3. Typography

Use the system font stack — no external font dependencies:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif;
```

### Scale

```css
--text-xs: 0.75rem      /* 12px — labels, timestamps, badges */
--text-sm: 0.875rem     /* 14px — secondary content, table rows */
--text-base: 1rem       /* 16px — body text */
--text-lg: 1.125rem     /* 18px — card titles, section headers */
--text-xl: 1.25rem      /* 20px — page titles */
--text-2xl: 1.5rem      /* 24px — instance name on detail page */
--text-3xl: 1.875rem    /* 30px — dashboard hero numbers */
```

### Weights
- `400` — body text
- `500` — labels, secondary headings
- `600` — primary headings, important values
- `700` — rare, only for hero numbers on dashboard

---

## 4. Spacing & Shape

```css
--radius-sm: 6px        /* Badges, small elements */
--radius-md: 8px        /* Cards, inputs, buttons */
--radius-lg: 12px       /* Modals, large cards */
--radius-full: 9999px   /* Pills, status dots */

--shadow-sm: 0 1px 3px rgba(0,0,0,0.3)
--shadow-md: 0 4px 12px rgba(0,0,0,0.4)
--shadow-lg: 0 8px 32px rgba(0,0,0,0.5)
```

---

## 5. Background Animation — Floating Particles / Network Nodes

This is the signature visual effect. It runs on the login page and subtly on the main app background. It must be GPU-accelerated and never cause any performance issues.

### Implementation

Create a React component `<ParticleBackground />` using an HTML5 Canvas element, absolutely positioned behind all content with `z-index: 0`. All other content has `position: relative; z-index: 1`.

### Particle behavior

```javascript
const PARTICLE_CONFIG = {
  count: 60,                    // Total particles on screen
  speed: 0.3,                   // Very slow drift speed
  minRadius: 1,                 // Minimum particle size
  maxRadius: 2.5,               // Maximum particle size
  connectionDistance: 120,      // Draw line between particles within this distance
  connectionOpacity: 0.15,      // Max opacity of connection lines (dark mode)
  particleOpacity: 0.4,         // Particle dot opacity (dark mode)
  color: '#2563eb',             // Particle and line color
};
```

### Behavior details
- Particles drift slowly in random directions
- When two particles come within `connectionDistance` of each other, draw a line between them — opacity fades based on distance (closer = more opaque)
- Particles that reach the edge gently bounce back
- On mouse move, particles within 80px of the cursor are very slightly attracted toward it (subtle, barely noticeable)
- In light mode, use much lower opacity values (0.08 for connections, 0.2 for particles)
- Use `requestAnimationFrame` for the animation loop
- Resize observer to handle window resize
- Pause animation when tab is not visible (`document.visibilityState`)

### Where to show it
- **Login page** — full screen, prominent
- **Main app** — behind the sidebar and content, very subtle (reduce opacity by 40% vs login)
- **Dashboard page** — full visibility
- **Instance detail pages** — reduced opacity so it doesn't compete with content

---

## 6. Component Redesign

### 6.1 Sidebar

```
Width: 220px (expanded) / 60px (collapsed — add collapse toggle)
Background: var(--color-bg-surface)
Right border: 1px solid var(--color-border)
```

**Logo area** (top, 56px tall):
- Harbor anchor icon (larger, ~24px)
- "Harbor" text in `--text-lg` weight `600`
- Subtle bottom border

**Navigation items**:
- Height: 40px per item
- Padding: 0 12px
- Hover: background `--color-bg-hover`, transition 150ms
- Active: background `--color-accent-subtle`, left border 2px solid `--color-accent`, text color `--color-accent`
- Icon + label layout, icons 16px

**Instances section**:
- Section label "INSTANCES" in `--text-xs` weight `500` color `--color-text-tertiary`, uppercase, letter-spacing
- Location groups are collapsible with animated chevron (150ms ease)
- Instance rows show colored status dot (8px) + name
- Active instance row highlighted with accent

**Bottom area**:
- Version number `Harbor v1.3.0` in `--text-xs` `--color-text-tertiary`
- Dark/light mode toggle button (moon/sun icon)
- User avatar/name

---

### 6.2 Instance Cards (Dashboard)

Each card is a premium-feeling surface:

```
Background: var(--color-bg-surface)
Border: 1px solid var(--color-border)
Border-radius: var(--radius-lg)
Padding: 20px
Box-shadow: var(--shadow-sm)
Transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease
```

On hover:
```
Transform: translateY(-2px)
Box-shadow: var(--shadow-md)
Border-color: var(--color-accent) at 40% opacity
```

Card layout:
```
[Status dot + Instance name]              [Location badge]
[HA version]
─────────────────────────────────────────
[Entities count]  [Automations]  [Add-ons]
─────────────────────────────────────────
[Companion status]              [→ Open]
```

Status dot: 10px circle, glowing pulse animation when online:
```css
@keyframes pulse-online {
  0%, 100% { box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(63, 185, 80, 0); }
}
animation: pulse-online 2s ease infinite;
```

---

### 6.3 Tabs (Instance Detail Page)

Current tabs are functional but look plain. Redesign:

```
Tab bar: border-bottom 1px solid var(--color-border)
Each tab: padding 12px 16px, --text-sm, --color-text-secondary
Active tab: --color-text-primary, border-bottom 2px solid --color-accent (overlapping the bar border)
Hover: --color-text-primary, transition 150ms
```

Add a subtle slide animation when switching tabs — the content area fades in (opacity 0→1, translateY 4px→0, 200ms ease).

---

### 6.4 Buttons

**Primary button:**
```css
background: var(--color-accent);
color: white;
border-radius: var(--radius-md);
padding: 8px 16px;
font-size: var(--text-sm);
font-weight: 500;
transition: background 150ms, transform 100ms, box-shadow 150ms;
box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);

:hover {
  background: var(--color-accent-hover);
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.3);
}
:active {
  transform: scale(0.97);
}
```

**Secondary button:**
```css
background: transparent;
border: 1px solid var(--color-border);
color: var(--color-text-primary);
:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-text-secondary);
}
```

**Danger button:**
```css
background: var(--color-danger-subtle);
border: 1px solid var(--color-danger) at 30% opacity;
color: var(--color-danger);
:hover {
  background: var(--color-danger);
  color: white;
}
```

---

### 6.5 Status Badges / Pills

```css
border-radius: var(--radius-full);
padding: 2px 10px;
font-size: var(--text-xs);
font-weight: 500;

/* Online */
background: var(--color-success-subtle);
color: var(--color-success);
border: 1px solid rgba(63, 185, 80, 0.2);

/* Offline */
background: var(--color-warning-subtle);
color: var(--color-warning);

/* Error */
background: var(--color-danger-subtle);
color: var(--color-danger);
```

---

### 6.6 Data Tables (Entities, Automations, Users, Add-ons)

```
Header row: --text-xs uppercase letter-spacing, --color-text-tertiary, border-bottom
Data rows: 48px height, border-bottom 1px solid --color-border-subtle
Row hover: background --color-bg-hover, transition 100ms
```

Add a subtle **skeleton loading state** — pulsing gray bars while data loads instead of a plain spinner. This makes the app feel much faster.

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
```

---

### 6.7 Toast Notifications

Replace the bottom-right error toasts with premium-styled ones:

```
Position: bottom-right, 16px margin
Width: 320px
Background: var(--color-bg-elevated)
Border: 1px solid var(--color-border)
Border-left: 3px solid (color based on type — success/warning/danger/info)
Border-radius: var(--radius-md)
Box-shadow: var(--shadow-lg)
Padding: 14px 16px
```

Entry animation: slide in from right + fade in (300ms ease)
Exit animation: slide out to right + fade out (200ms ease)

Auto-dismiss after 5 seconds. Show a thin progress bar at the bottom that depletes over 5 seconds.

---

### 6.8 Modals

```
Backdrop: rgba(0,0,0,0.6) with blur(4px) — frosted glass effect
Modal: --color-bg-elevated, --shadow-lg, --radius-lg
Max-width: 480px (standard) / 600px (wide)
```

Entry animation: backdrop fades in, modal scales from 0.95→1 + fades in (250ms ease)
Exit animation: reverse (200ms ease)

---

### 6.9 Login Page

The login page is the first thing new users see — make it count.

```
Full-screen dark background (#0e1117)
ParticleBackground component — full opacity
```

Center card:
```
Width: 400px
Background: var(--color-bg-surface) with 60% opacity + backdrop-blur(20px)
Border: 1px solid rgba(255,255,255,0.08)
Border-radius: var(--radius-lg)
Box-shadow: var(--shadow-lg)
Padding: 40px
```

Top of card:
- Anchor icon in accent blue, 40px, with subtle glow
- "Harbor" in `--text-2xl` weight `600`
- "Fleet Management for Home Assistant" in `--text-sm` `--color-text-secondary`

Input fields: standard styling but with focus ring in accent blue

Login button: full width, primary style with glow on hover

Bottom: "Harbor v1.3.0" in `--text-xs` `--color-text-tertiary`

---

### 6.10 Dashboard Hero Section

At the top of the dashboard, above the instance cards:

```
A stats bar showing fleet-wide summary:
[Total Instances: 12]  [Online: 11]  [Offline: 1]  [Updates Available: 3]
```

Each stat is a small card with a large number and a label underneath. The "Updates Available" stat is amber if > 0.

---

## 7. Micro-animations Checklist

These small details collectively make the product feel alive and premium:

| Element | Animation |
|---|---|
| Online status dot | Soft pulse glow, 2s loop |
| Instance cards | Lift on hover (translateY -2px) |
| Sidebar nav items | Background fade on hover (150ms) |
| Tab switch | Content fade + slide up (200ms) |
| Modal open/close | Scale + fade (250ms / 200ms) |
| Toast in/out | Slide from right (300ms / 200ms) |
| Toast progress bar | Linear width depletion over 5s |
| Buttons | Scale down on click (0.97, 100ms) |
| Primary button | Blue glow on hover |
| Skeleton loaders | Opacity pulse (1.5s loop) |
| Accordion/collapse | Height + chevron rotation (150ms) |
| Page transitions | Fade in on route change (150ms) |
| Particle background | Continuous slow drift |

---

## 8. Dark / Light Mode Toggle

- Store preference in `localStorage`
- Respect `prefers-color-scheme` as the default if no preference stored
- Toggle button in bottom of sidebar: moon icon (dark mode) / sun icon (light mode)
- Mode switch: smooth CSS transition on background and border colors (300ms ease)
- Apply mode class (`dark` / `light`) to the `<html>` element — use CSS variables that change per class

---

## 9. Responsive Considerations

Harbor is primarily a desktop tool but should be usable on tablet:

- Below 1024px: sidebar collapses to icon-only mode automatically
- Below 768px: sidebar becomes a slide-out drawer with hamburger trigger
- Instance cards on dashboard: grid columns reduce from 3 → 2 → 1

---

## 10. Implementation Notes for Claude Code

1. **Create a `design-tokens.css` file** at the root of the frontend with all CSS variables from section 2. Import it globally.

2. **Create `ParticleBackground.jsx`** as a standalone reusable component. Accept props: `opacity` (default 1.0), `particleCount` (default 60).

3. **Create `SkeletonLoader.jsx`** component with variants: `text`, `card`, `table-row`.

4. **Update `tailwind.config.js`** to include the custom color tokens so Tailwind classes can reference them.

5. **All transitions use these standard values:**
   - Instant feedback: 100ms
   - Standard: 150ms  
   - Emphasis: 200-300ms
   - Never exceed 400ms for UI transitions

6. **Do not use any external animation libraries** (Framer Motion, GSAP etc.) — pure CSS transitions and Canvas API only. Keep the bundle lean.

7. **Test both dark and light mode** for every component before considering it done.

8. **The particle canvas must not block pointer events** — set `pointer-events: none` on the canvas element.

---

## 11. Files to Create / Modify

| File | Change |
|---|---|
| `frontend/src/styles/design-tokens.css` | Create — all CSS variables |
| `frontend/src/components/ParticleBackground.jsx` | Create — canvas animation |
| `frontend/src/components/SkeletonLoader.jsx` | Create — loading states |
| `frontend/src/components/Toast.jsx` | Redesign |
| `frontend/src/components/Modal.jsx` | Redesign |
| `frontend/src/components/Sidebar.jsx` | Redesign |
| `frontend/src/components/StatusBadge.jsx` | Redesign |
| `frontend/src/components/Button.jsx` | Create unified button component |
| `frontend/src/pages/Login.jsx` | Full redesign |
| `frontend/src/pages/Dashboard.jsx` | Add hero stats bar, redesign cards |
| `frontend/src/pages/InstanceDetail.jsx` | Tab animation, skeleton loaders |
| `frontend/tailwind.config.js` | Add custom color tokens |
| `package.json` | Bump version to 1.3.0 |

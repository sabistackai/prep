# PREP: Brand & Theme Spec (light + dark)

> Hand this file to Claude Code. It replaces the old graphite/lime theme (`#0A0F14` / `#84CC16`, Manrope, JetBrains Mono) everywhere in the PREP app.
> Logo: **Concept B, "Checklist P"**: a letter P whose bowl is a ticked box and whose stem carries list lines.

---

## 1. Goal

1. Apply the PREP brand colours from the logo across the whole app (parent and nanny screens).
2. Support **Light**, **Dark** and **System** modes, with System as the default.
3. Every colour comes from a **CSS variable token**. Components never use raw hex values.

---

## 2. Brand colours (from the logo)

| Name | Hex | Role |
|---|---|---|
| Indigo | `#22307A` | Primary brand colour: logo stem, primary buttons (light mode), app icon background |
| Marigold | `#F4B740` | Accent: logo bowl, highlights, progress, the "ticked" moment |
| Periwinkle | `#8E97CC` | Secondary: logo list lines, secondary accents |
| Ink | `#141A3D` | Darkest text colour |
| White | `#FFFFFF` | Surfaces (light), logo stem (dark) |

**Rule:** marigold is a **fill** colour, never text on a light background (it fails contrast). Text on marigold is always Ink `#141A3D`.

---

## 3. Theme tokens

All pairs below were chosen to meet WCAG AA (4.5:1 for body text).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#F5F6FB` | `#0E1330` | Page background |
| `--surface` | `#FFFFFF` | `#161C42` | Cards, sheets, nav bars |
| `--surface-2` | `#EEF1FB` | `#1E2552` | Inputs, inset rows, hover |
| `--border` | `#DDE1F0` | `#2B3366` | Card borders, dividers |
| `--text` | `#141A3D` | `#EEF0FA` | Main text |
| `--text-muted` | `#545B7A` | `#A9B0D6` | Secondary text, labels, timestamps |
| `--primary` | `#22307A` | `#A5ADE8` | Primary buttons, links, active nav, focus ring |
| `--on-primary` | `#FFFFFF` | `#141A3D` | Text and icons on `--primary` |
| `--primary-soft` | `#E3E7F8` | `#262E66` | Selected chips, active tab background |
| `--accent` | `#F4B740` | `#F4B740` | Progress bars, ticked boxes, highlights, FAB |
| `--on-accent` | `#141A3D` | `#141A3D` | Text and icons on `--accent` |
| `--accent-soft` | `#FDF1D6` | `#3A3320` | "In progress" badge background |
| `--accent-text` | `#8A5A00` | `#F4B740` | Text in "in progress" badges |
| `--success` | `#15803D` | `#4ADE80` | "Ready" text and icons |
| `--success-soft` | `#DCF5E5` | `#163A2A` | "Ready" badge background |
| `--warning` | `#C2410C` | `#FDBA74` | "Due soon" text and icons |
| `--warning-soft` | `#FDE7DA` | `#3D2618` | "Due soon" badge background |
| `--danger` | `#B91C1C` | `#F87171` | "Overdue", errors, delete |
| `--danger-soft` | `#FCE2E2` | `#3F1D24` | "Overdue" banner background |
| `--focus` | `#22307A` | `#F4B740` | Keyboard focus outline |

### Status → token mapping (prep checklist)

| Status | Badge | Notes |
|---|---|---|
| Not started | `--surface-2` bg, `--text-muted` text | |
| In progress (e.g. 3/7) | `--accent-soft` bg, `--accent-text` text | |
| Ready | `--success-soft` bg, `--success` text, with a tick icon | Show the ready time |
| Overdue | `--danger-soft` bg, `--danger` text | Overdue banner uses the same pair |

Tick boxes: unticked = `--border` outline; ticked = `--accent` fill with an Ink tick (same as the logo's bowl). Progress bars: `--surface-2` track, `--accent` fill; `--success` when complete; `--danger` once overdue.

### Child colours (avatars and child tags)

Readable in both modes, with Ink `#141A3D` text on top:

`#F4B740` (marigold), `#8E97CC` (periwinkle), `#5BD1B3` (mint), `#FF8A5B` (tangerine), `#F2A7C3` (pink), `#7CC4F2` (sky)

Assign in this order as children are added.

---

## 4. Typography

| Role | Font | Weights | Where |
|---|---|---|---|
| Brand / headings | **Fredoka** | 500, 600 | Wordmark, page titles, card titles, big numbers ("2 of 3 ready") |
| Body / UI | **Nunito Sans** | 400, 600, 700, 800 | Everything else: text, buttons, inputs, labels |

- Load both with `next/font/google` and expose them as `--font-display` and `--font-body`.
- Use `font-variant-numeric: tabular-nums` for times and counts.
- Uppercase labels: 12px, weight 800, letter-spacing `0.12em`, `--text-muted`.
- The wordmark is always **lowercase "prep"** in Fredoka 600.
- Remove Manrope and JetBrains Mono from the project.

---

## 5. Implementation

### 5.1 Theme switching
- Use **`next-themes`** with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `disableTransitionOnChange`.
- Add a **Theme** setting (System / Light / Dark) in Settings for parents and in the nanny's profile menu.
- Optional: save the choice to a `members.theme` column (`'system' | 'light' | 'dark'`) so it follows the user across devices; the local choice from `next-themes` applies on first paint.

### 5.2 CSS variables (`app/globals.css`)

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --bg: #F5F6FB;
  --surface: #FFFFFF;
  --surface-2: #EEF1FB;
  --border: #DDE1F0;
  --text: #141A3D;
  --text-muted: #545B7A;
  --primary: #22307A;
  --on-primary: #FFFFFF;
  --primary-soft: #E3E7F8;
  --accent: #F4B740;
  --on-accent: #141A3D;
  --accent-soft: #FDF1D6;
  --accent-text: #8A5A00;
  --success: #15803D;
  --success-soft: #DCF5E5;
  --warning: #C2410C;
  --warning-soft: #FDE7DA;
  --danger: #B91C1C;
  --danger-soft: #FCE2E2;
  --focus: #22307A;
  color-scheme: light;
}

.dark {
  --bg: #0E1330;
  --surface: #161C42;
  --surface-2: #1E2552;
  --border: #2B3366;
  --text: #EEF0FA;
  --text-muted: #A9B0D6;
  --primary: #A5ADE8;
  --on-primary: #141A3D;
  --primary-soft: #262E66;
  --accent: #F4B740;
  --on-accent: #141A3D;
  --accent-soft: #3A3320;
  --accent-text: #F4B740;
  --success: #4ADE80;
  --success-soft: #163A2A;
  --warning: #FDBA74;
  --warning-soft: #3D2618;
  --danger: #F87171;
  --danger-soft: #3F1D24;
  --focus: #F4B740;
  color-scheme: dark;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-primary: var(--primary);
  --color-on-primary: var(--on-primary);
  --color-primary-soft: var(--primary-soft);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --color-accent-soft: var(--accent-soft);
  --color-accent-text: var(--accent-text);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --font-display: var(--font-fredoka), "Nunito Sans", system-ui, sans-serif;
  --font-sans: var(--font-nunito-sans), system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius-card: 16px;
  --radius-control: 10px;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
}

:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
```

This is for **Tailwind v4**. If the project is on Tailwind v3, put the same variables in `globals.css`, set `darkMode: 'class'` in `tailwind.config`, and map each colour under `theme.extend.colors` as `'var(--token)'`.

Usage in components: `bg-surface`, `text-muted`, `border-border`, `bg-primary text-on-primary`, `bg-accent text-on-accent`, `font-display`, etc.

### 5.3 Fonts (`app/layout.tsx`)

```tsx
import { Fredoka, Nunito_Sans } from "next/font/google";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fredoka" });
const nunito = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito-sans" });

// <html lang="en" suppressHydrationWarning className={`${fredoka.variable} ${nunito.variable}`}>
```

### 5.4 Browser and PWA colours
- In `app/layout.tsx` metadata/viewport:
  - `themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F6FB" }, { media: "(prefers-color-scheme: dark)", color: "#0E1330" }]`
- `manifest.webmanifest`: `"theme_color": "#22307A"`, `"background_color": "#F5F6FB"`.

---

## 6. Logo assets

Create `components/brand/PrepMark.tsx` (the symbol), `PrepLogo.tsx` (symbol + wordmark), and export static files to `public/brand/`.

### 6.1 Mark on light backgrounds

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 8 90 104" role="img" aria-label="PREP">
  <rect x="40" y="16" width="60" height="50" rx="18" fill="#F4B740"/>
  <rect x="28" y="16" width="18" height="88" rx="9" fill="#22307A"/>
  <path d="M63 41l9 9 16-17" fill="none" stroke="#22307A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="54" y="78" width="30" height="9" rx="4.5" fill="#22307A" opacity="0.45"/>
  <rect x="54" y="95" width="18" height="9" rx="4.5" fill="#22307A" opacity="0.45"/>
</svg>
```

### 6.2 Mark on dark backgrounds (and on indigo)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 8 90 104" role="img" aria-label="PREP">
  <rect x="40" y="16" width="60" height="50" rx="18" fill="#F4B740"/>
  <rect x="28" y="16" width="18" height="88" rx="9" fill="#FFFFFF"/>
  <path d="M63 41l9 9 16-17" fill="none" stroke="#22307A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="54" y="78" width="30" height="9" rx="4.5" fill="#8E97CC"/>
  <rect x="54" y="95" width="18" height="9" rx="4.5" fill="#8E97CC"/>
</svg>
```

`PrepMark` should pick the light or dark version from the current theme (or take a `variant="light" | "dark"` prop). The tick stays indigo `#22307A` in both, because it always sits on marigold.

### 6.3 Small sizes
- **48 px and below:** drop the two list lines; thicken the tick to `stroke-width="10"`.
- **28 px and below (favicon):** stem and bowl only, no tick or lines.

### 6.4 Lockup (`PrepLogo`)
- Mark on the left, lowercase **"prep"** in Fredoka 600 on the right.
- Mark height = 1.2 × the wordmark's cap height; gap = 0.25 × mark width.
- Wordmark colour: `#22307A` on light, `#FFFFFF` on dark.
- Optional tagline under the wordmark: "Parents' Routine & Errands Planner", Nunito Sans 700, `--text-muted`.

### 6.5 App icon and favicon
- **App icon:** indigo `#22307A` square background, dark-background mark centred at 54% of the icon width. Export `icon-192.png`, `icon-512.png`, `maskable-512.png` (mark at 44% so it survives masking), `apple-touch-icon.png` (180).
- **Favicon:** `favicon.svg` using the 28 px simplified mark on an indigo rounded square (radius 22%), plus `favicon.ico` (32).
- Clear space around any logo = the stem's width on every side. Never stretch, recolour outside these variants, add shadows, or put the light mark on dark backgrounds.

---

## 7. Component guidance

- **Primary button:** `bg-primary text-on-primary`, radius 10px, min height 44px, weight 700.
- **Accent button / FAB** (e.g. "Send task"): `bg-accent text-on-accent`. Use at most one accent button per screen.
- **Secondary button:** `bg-surface-2 text-text border border-border`.
- **Cards:** `bg-surface border border-border rounded-[16px]`; no shadows in dark mode, a very soft shadow in light mode is optional.
- **Active nav tab:** icon and label in `text-primary`, with a `bg-primary-soft` pill behind the icon.
- **Nanny screens:** larger tap targets (min 48px), tick boxes 26px, Fredoka for each child's name on the prep cards.
- **Push notification icon:** use the dark-background mark on indigo; Android's small monochrome badge icon = the simplified mark in white on transparent.

---

## 8. Tasks for Claude Code

1. Install `next-themes`; add the `ThemeProvider` to the root layout.
2. Replace `globals.css` theme setup with section 5.2, and swap fonts per 5.3.
3. Search the codebase for hard-coded colours (`#0A0F14`, `#84CC16`, any other hex/rgb in components or Tailwind arbitrary values like `bg-[#...]`) and replace them with tokens.
4. Remove Manrope and JetBrains Mono imports and usages.
5. Add the Theme setting (System / Light / Dark) for parents and nannies.
6. Build `PrepMark` and `PrepLogo`, add the logo to the login screens, the parent header and the nanny app header.
7. Generate the icon and favicon files in `public/` and update `manifest.webmanifest` and the metadata colours.
8. Update the status badges, progress bars and tick boxes to the mapping in section 3.

## 9. Done when

- [ ] The app follows the phone's light or dark setting by default, and the manual Light / Dark / System switch works without a flash of the wrong theme on reload.
- [ ] No component contains a hard-coded colour; `grep -rE "#[0-9A-Fa-f]{3,8}" app components` returns only `globals.css` and the logo SVGs.
- [ ] Text meets 4.5:1 contrast in both themes (check with axe or Lighthouse).
- [ ] Ready, in progress, due soon and overdue are distinguishable in both themes, including by icon or label and not by colour alone.
- [ ] The installed PWA shows the indigo app icon, and the favicon is correct in the browser tab.
- [ ] The logo uses the correct variant on light, dark and indigo backgrounds.

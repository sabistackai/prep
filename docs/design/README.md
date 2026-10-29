# Design references

| File | What it is |
|---|---|
| `PREP-theme-spec.md` | Brand and theme spec: indigo / marigold palette, light + dark tokens, Fredoka + Nunito Sans, logo rules. Replaces the graphite/lime theme in the build spec (section 6). |
| `logo-concept-b-checklist-p.zip` | Mockup of logo Concept B, "Checklist P" (a P whose bowl is a ticked box). Unzip and serve the folder, then open `ConceptB.dc.html`. Reference only: the scripts inside are the mockup tool's viewer, not app code. |

## Deviations from the spec

| Token (light) | Spec | Used | Why |
|---|---|---|---|
| `--success` | `#15803D` | `#147A3A` | 4.36:1 on `--success-soft`, under AA for the small bold "Ready" badge. Now 4.71:1. |
| `--warning` | `#C2410C` | `#B93E0B` | 4.34:1 on `--warning-soft`, under AA for the "Due soon" badge. Now 4.69:1. |

`node scripts/check-contrast.mjs` checks every token pair in both themes.

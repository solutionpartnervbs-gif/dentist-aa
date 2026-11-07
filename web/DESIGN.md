# Design System: Suyat Dental Clinic website (patient site + booking app)

Token source of truth: `web/src/styles/tokens.css`. Everything below names tokens from that file; build from tokens, never from literals.
Provenance: shipped values were kept; layers marked **generated** were produced by the Color Palette, Typography and Design System skills; none were invented by hand. Creative Director review: **not run** (that expert is not available in this session), so this is unreviewed.

## Visual Direction
- **Register: application + marketing.** The landing page (hero, services, how-it-works, branches) is marketing: expressive, spacious. The booking chat, forms, receipt and staff admin are application: functional, restrained, minimal motion.
- **Personality:** a calm, friendly, trustworthy neighbourhood clinic. Cool cyan on near-white with a navy ink; red is a small sharp accent, never a field colour.
- **Signature element:** the animated hero reel (Remotion) on the landing page. Nothing else on that page competes with it; everything else stays flat and quiet.
- **Audience / what matters most:** patients booking on a phone, often older or in a hurry. Legibility, 44px targets and a fast path to "Book appointment" beat decoration.
- **Build rule:** application views use steps from the first two motion bands and 12px–20px radii; only the hero may use the entrance band.

## Color
Hues: primary cyan 219 (read from brand `--cyan` #00b4d8); neutrals "ink" hue 262 (read from the shipped navy neutrals, a deliberate cool-ink pairing 43° from the primary). Both scales share one lightness ladder, so any pairing that passes at one hue passes at the other.

**Scale steps and jobs** (`--cyan-N` and `--ink-N`): 50 tinted backgrounds · 100 hover backgrounds · 200 borders and dividers · 300 disabled · 400 secondary elements · 500 primary anchor (not for text on white) · 600 primary hover (`--color-action-hover`) · 700 active/pressed · 800 dark surfaces · 900 dark text on light · 950 darkest. Use ink steps for neutral text, borders and surfaces when a role token below does not already cover it.

**Roles (use these in components)**
| Role | Token | Rule |
|---|---|---|
| Page ground | `--bg` | Page background only |
| Raised surface | `--surface` | Cards, panels, inputs |
| Sunken / sections | `--surface-2` | Alternate sections, transcript, empty states. In dark mode this is also the raised layer: depth = lighter surface |
| Text | `--text`, `--text-muted` | Body and secondary text (6:1+). Never use alpha-tinted text |
| Action | `--color-action` / `--color-action-hover` / `--color-on-action` | Primary buttons, links, selected state. 5.69:1 with white (light), 9.25:1 with dark ink (dark) |
| Link | `--color-link` | Inline text links (same value as the action colour) |
| Focus | `--color-focus` | 3px outline, 2px offset, on every interactive element |
| Soft accent | `--cyan-soft` (shipped) | Selected/hover tint behind navy text |
| Borders | `--border` (decorative), `--color-border-strong` (form controls, 3:1+) | A control's visible boundary always uses the strong one |
| Brand accent | `--red`, `--cyan`, `--orange` (shipped) | **Decorative or large text only** (see Findings). `--orange` carries navy text only |
| Semantic | `--color-success-bg`, `--color-success-fg`, `--color-success-text`; `--color-error-bg`, `--color-error-fg`, `--color-error-text`; `--color-warning-bg`, `--color-warning-fg`, `--color-warning-text`; `--color-info-bg`, `--color-info-fg`, `--color-info-text` | `bg` = tinted panel, `text` = copy on that panel (8:1+), `fg` = icon/border (3:1+ on surface). Never convey state by colour alone: pair with an icon and words |

**Distribution:** ~60% neutral surfaces, ~30% secondary text/borders, ~10% accent. Cyan action colour appears on one primary button per view.
**Dark mode:** overrides only the semantic layer (chroma −10%, no pure black/white). Depth comes from `--surface` → `--surface-2`; shadow tokens collapse to a 1px `--border` ring.

## Typography
Families (two): `--font` Plus Jakarta Sans for all UI/body (humanist, open counters = approachable care); `--font-display` Space Grotesk for h1–h3 only. The "Suyat" wordmark's script face lives inside the Logo component and is not a token.
Scale: responsive pair, 16px/20px base, ratio 1.2 on phones (the booking flow) → 1.333 on desktop (hero presence), viewport 320–1280px; five sizes, all derived:
| Token | Element | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| `--size-display` | landing `h1` / hero | 27.6 → 47.4px | `--weight-bold` | `--leading-display` | `--tracking-heading` |
| `--size-heading` | `h2`, app page title (receipt, admin `h1`) | 23 → 35.5px | `--weight-bold` | `--leading-heading` | `--tracking-heading` |
| `--size-sub` | `h3`, card titles | 19.2 → 26.7px | `--weight-bold` | `--leading-sub` | `--tracking-heading` |
| `--size-body` | paragraphs, forms, chat, tables | 16px fixed | `--weight-regular` (labels and nav: `--weight-semibold`) | `--leading-body` | `--tracking-body` |
| `--size-caption` | hints, meta, helper text | 14px fixed | `--weight-regular`, muted colour | `--leading-caption` | `--tracking-body`; all-caps labels use `--tracking-label` |
Rules: nothing below `--size-body` except `--size-caption`; button, label and caption text is never fluid; use `font-variant-numeric: tabular-nums` on admin tables, times and booking references. Measure: 55–75 characters for paragraphs. Light-on-dark line-height adjustment was not applied because the background is not fixed; add 0.05 if a dark-only view ships.
Vertical rhythm: `--rhythm` = 24px = body line height = `--space-6`. Space blocks in multiples of it.

## Spacing
4px base (`--space-N`). Use by context:
| Steps | Use |
|---|---|
| `--space-0-5`, `--space-1`, `--space-2` | inside a component; icon to label; around a control |
| `--space-3`, `--space-4` | between related elements in a group; form field gaps |
| `--space-6`, `--space-8` | between sections of a view; card padding on desktop |
| `--space-12`, `--space-16` | between major landing sections |
| `--space-24`, `--space-32` | hero spacing, page-level margins |
`--space-0` resets. Gaps between sections must exceed gaps within a section. Page gutter is `--gutter`, max width `--maxw` (shipped). Type relationship: section spacing uses multiples of `--rhythm` (24, 48, 96px); 72px is intentionally not a step.

## Components
- **Radius** (friendly high end; ratio ≈1.5): `--radius-xs` 8px chips/tags · `--radius-sm` 12px inputs, buttons-in-cards, small cards · `--radius` 20px cards, panels, modals · `--radius-lg` 28px hero frame, assistant panel · `--radius-full` pills, icon buttons, avatars.
- **Borders:** `--border-width` 1px decorative; `--border-width-strong` 2px for control boundaries and selected states.
- **Elevation** (tinted navy, not black; `--shadow-tint` holds the shared tint so a re-theme changes one value): `--shadow-sm` raised chips/inputs; `--shadow-md` cards (shipped `--shadow` is the equivalent of a large card shadow and stays); `--shadow-lg` sticky header, popovers; `--shadow-xl` modals. Dark mode replaces all with a ring.
- **Motion** (application defaults): `--duration-fast` press/toggle/colour; `--duration-normal` hover, menus, tooltips; `--duration-layout` drawer/modal/accordion; `--duration-entrance` hero reel only. Easing: `--easing-default`/`--easing-out` for enters, `--easing-in` for exits; exits last ≈75% of the matching enter. No bounce or elastic curves. Reduced motion sets all durations to ~0 (the tokens do it).
- **Naming:** primitives `--cyan-N`, `--ink-N`; roles `--color-*`; type `--size-*`, `--weight-*`, `--leading-*`, `--tracking-*`; space `--space-N`; shape `--radius-*`, `--border-width*`; depth `--shadow-*`; motion `--duration-*`, `--easing-*`. Shipped names (`--cyan`, `--red`, `--navy`, `--orange`, `--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--border`, `--shadow`, `--radius`, `--radius-sm`, `--gutter`, `--maxw`, `--font`, `--font-display`, `--cyan-soft`, `--cyan-deep`) are unchanged.
- **States for every interactive element:** default, hover (only inside `@media (hover: hover)`), focus-visible, active, disabled, loading, error (and empty/success for containers). Minimum target 44×44px. Reference implementation: `work/components/appointment-booking-form.html`.

## Rules
1. No raw hex, px or ms in component CSS where a token exists. A missing token is added to `tokens.css`, never inlined.
2. Text contrast ≥ 4.5:1 (≥ 3:1 for ≥ 24px or ≥ 18.66px bold, and for UI boundaries, icons and focus rings), light and dark.
3. `--cyan` (#00b4d8) is never text or a control boundary on light surfaces (2.46:1). `--red` (#ea2825) is not small text (4.35:1 light, 3.61:1 dark); use `--color-error-text` for error copy and `--color-error-fg` for error icons/borders.
4. Primary button = `--color-action` fill with `--color-on-action` text. One primary action per view.
5. Never pure black or pure white as a new colour; neutrals come from `--ink-N` or the shipped surfaces.
6. Never convey state by colour alone. Never use bounce/elastic easing or generic drop shadows without the tint.
7. At most two families and five type sizes. Body ≥ 16px.
8. Themes override the semantic layer only (`--color-*`, surfaces, shadows); never primitives.

## Findings against shipped values (reported, NOT changed — owner decides)
| # | Shipped value | Problem | Change it would take |
|---|---|---|---|
| 1 | `--cyan-deep` #0087a6 used for white-text buttons (`.btn-primary`, user chat bubble, `.seg` selected) and links (`app.css` lines 8, 23, 26, 37, 85, 92) | White on it is **4.19:1** (needs 4.5:1); as link text on dark surface **3.75:1** | Point those usages at `--color-action` (5.69:1 light, 8.1:1 dark) / `--color-on-action`, or set `--cyan-deep: #00708b` |
| 2 | `--red` #ea2825 as small text (`.service-num`, `.steps span`, `.receipt .ref`) and under white text (`.btn-danger`) | **4.35:1** light, **3.61:1** dark text | Use `--color-error-text` for text; give `.btn-danger` a darker fill (e.g. `--color-error-fg`) |
| 3 | `--font-display` Space Grotesk | Named as a prohibited primary font in the Creative Director's taxonomy. Here it is the heading (secondary) face, so only flagged | Replace with a geometric-row family (Outfit, Urbanist or Figtree) for headings |
| 4 | Font load requests weights 400–800 and a third family (Dancing Script) | 800 is unused; the script face serves only the logo | Load 400/600/700 only; convert the wordmark to outlined SVG to drop the third family |
| 5 | `--surface: #ffffff` | Pure white as a surface | Move to a tinted near-white (≈ oklch(99.5% 0.004 223)) |
| 6 | Hero `h1` previously 64px max | Now capped at 47.4px by the scale | Add a +4 hero step (≈56.9px) if the hero needs more |

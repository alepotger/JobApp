# JobApp — presentation-layer rebuild

**Status: APPROVED and implemented.** Built on branch
`claude/tracker-ui-category-grouping-2agu7r`. Phase 3 and Phase 4 results are at
the end of this document.
Governed by [`docs/design-dossier.md`](../design-dossier.md), cited throughout
by section. Every number below is measured, not asserted; the measurement
scripts are named where they apply.

---

## Phase 1 — Audit

### 1.1 Inventory

Frequency is a first-class input because §3.1 *When NOT to animate* inverts on
it. Counts are per working session for an active job hunt (~25 live rows).

| # | Surface | Must communicate | Frequency |
|---|---|---|---|
| 1 | Connect / setup, 5 steps | *You are configuring your own database, and here is exactly where to click* | Once, ever |
| 2 | SQL copy block | *This is safe, opaque, and you do not need to read it* | Once |
| 3 | Sign-in — email entry | *No password exists; this is not a wall* | ~Monthly |
| 4 | Sign-in — link sent | *Two routes out, and which one applies to you* | ~Monthly |
| 5 | Sign-in — OTP entry | *Type six digits* | Rare (2nd device) |
| 6 | Sign-in — error + fix | *What broke, and the exact string to paste* | Rare, high-stakes |
| 7 | "Is this your database?" | *Whose project you are about to write to* | Every sign-in |
| 8 | Session-checking | *Not broken, just deciding* | Every load |
| 9 | Pipeline loading | *Your rows are coming* | Every load |
| 10 | Empty state | *How to make the first row* | Once or twice |
| 11 | Desktop table, 8 columns | *The whole pipeline at a glance* | Continuous |
| 12 | Mobile layout | Same, at 390px | Continuous on phone |
| 13 | Stage rail | *Shape of the funnel; also a filter* | ~10× |
| 14 | **Status pill + cycling** | *Where this sits; click to advance* | **~40×, the most repeated action** |
| 15 | Inline editable cell | *This text is yours to change* | **~30×** |
| 16 | Checklist cell | *Discrete next actions, tickable in place* | ~15× |
| 17 | Sync chip | *Saved / saving / offline* | Ambient |
| 18 | Chase counter | *How much has gone quiet* | Ambient |
| 19 | Example tag + banner | *These three are invented, not yours* | First session only |
| 20 | Funnel analytics | *Occupancy and real transition timings* | ~3× |
| 21 | Detail drawer | *Scoring and offer terms for one row* | ~5× |
| 22 | Rating swatches | *1–5, clearable* | ~10× |
| 23 | Offer fields + date mask | *Salary, equity, start date* | Rare |
| 24 | Group / sort / filter bar | *How the list is narrowed, and the way out* | ~8× |
| 25 | Add application | *Start a row* | ~5× |
| 26 | Undo toast | *That was reversible, for 12s* | ~8× |
| 27 | Recently-deleted panel | *Nothing is gone yet* | Rare |
| 28 | Database error banner | *What failed, verbatim* | Rare, high-stakes |
| 29 | Migration notice | *Your schema is behind; here is the SQL* | Once |
| 30 | Sign out | *Confirm; your data stays* | Rare |
| 31 | Theme toggle | *Light or dark* | Rare |
| 32 | Print / export | *Paper version* | Rare |
| 33 | Focus / hover / disabled / loading | *Where you are; what is live* | Continuous |

### 1.2 Violations against the dossier

| # | Violation | Governing section |
|---|---|---|
| V1 | **`--font-display: 'Inter Display', Inter, Geist…` is declared but no font is ever loaded.** Zero `@font-face`, zero font requests. Every user gets the system stack while the code claims otherwise. | §1.2 *Material honesty* — Rams 6, "does not attempt to manipulate with promises that cannot be kept" |
| V2 | **No optimistic-UI rollback anywhere.** `patch()` writes local state, fires the request, and on error shows a banner while *leaving the optimistic state applied*. The row now lies. | §1.3 — "Rollback is *the heart of optimistic UI*; omitting it is the anti-pattern" |
| V3 | **No request-identity scheme.** `grep -c "requestId\|mutationId\|sequence"` → 0. Cycling the status three times fast can reconcile out of order. | §1.3 — out-of-order reconciliation; "assign each optimistic mutation an ID" |
| V4 | **Hard delete is optimistic.** `purge()` splices the row locally *before* awaiting the network. | §Recommendations Stage 2 — "Do *not* apply it to financial or destructive/irreversible actions" |
| V5 | **The stage rail animates `width`.** | §3.1 — "animate **only transform and opacity** (GPU-composited, avoids layout thrash)" |
| V6 | **`--ease-spring: cubic-bezier(.34,1.56,.64,1)` on rating swatches and score hover.** An overshoot curve on a thing that is not thrown. | §3.1 — springs are for what the user *manipulates*; §4.1 eraser test |
| V7 | **Dark mode is the default whenever the OS says so**, for a tool whose whole job is sustained reading of dense rows. | §2.3 — positive-polarity advantage; §Benchmarks — "If your audience skews toward long-form reading… default to light mode" |
| V8 | **Spacing scale is raw pixels** (`--s-1:4px … --s-9:96px`), numeric not semantic, no ratio. | §2.1 — "a named semantic scale (space-1…space-N) derived from a base unit, not raw pixels" |
| V9 | **Type scale is hand-picked**, no modular ratio (.6875/.75/.8125/.875/1/1.25/1.625/2.125rem — ratios of 1.09, 1.08, 1.08, 1.14, 1.25, 1.3, 1.31). | §2.1 — modular scale from a named ratio |
| V10 | **Zero `clamp()`, zero container queries.** Layout switches on a viewport breakpoint at 1024px. | §2.1 — "the frontier has moved past device breakpoints to intrinsic design" |
| V11 | **Measure is uncontrolled on most prose.** One `66ch` rule exists; six surfaces use `max-w-2xl` (42rem ≈ 96ch at body size). | §2.2 — 45–75 CPL, 66 ideal |
| V12 | **No `font-feature-settings` at all.** `font-variant-numeric: tabular-nums` is present on three selectors; no `zero`, no `cv05`, no small caps. | §2.2 — "*expensive* typography adds the invisible layer… tabular figures for data" |
| V13 | **Colour system is hex-first with an OKLCH `@supports` layer bolted on top** — 3 palettes × ~40 tokens duplicated. The hex is the source of truth. | §2.3 — "migrate the *token* layer to OKLCH"; §Stage 1 |
| V14 | **Elevation uses shadow in light mode** (`--sh-1/2/3`) rather than surface lightness. | §2.3 — "elevation must be re-expressed with *lighter* surfaces (Material) rather than heavier shadows" |
| V15 | **Loading is a bare text line** ("Checking session", "Loading pipeline…") with no assessment of the ~1s floor. | §3.3 — "below ~1s, *neither* is needed"; skeletons must mirror real layout |
| V16 | **The funnel prints four stat tiles above four bars carrying the same four numbers.** | §4.1 Tufte — data-ink ratio; erase redundancy |
| V17 | **Empty state is a sentence and a button**, not an onboarding surface. | §3.3 — "the first-run empty state is the single best onboarding surface" |
| V18 | **No latency instrumentation of any kind.** | §Stage 1 — "Instrument interaction latency. Set hard budgets" |

---

## Phase 2 — Proposal

## Foundations

### Colour

Authored in OKLCH (§2.3). One neutral ramp: hue **255**, chroma held at
0.003–0.020, **lightness stepped** — which is what makes the steps perceptually
even and is exactly what HSL cannot promise. Accent and semantic hues follow the
same discipline: fixed hue, chroma held, lightness stepped.

The hex column is the browser's own resolution of the OKLCH, captured by
`design/measure-palette.js`, kept only for reference — **OKLCH is the source of
truth** and there is no `@supports` fallback layer (see Subtractions S2).

**Light (default)**

| Token | OKLCH | sRGB |
|---|---|---|
| `--page` | `oklch(98.6% 0.003 255)` | `#f9fbfc` |
| `--surface` | `oklch(100% 0 255)` | `#ffffff` |
| `--sunken` | `oklch(96.8% 0.004 255)` | `#f3f5f7` |
| `--line-soft` | `oklch(93.5% 0.006 255)` | `#e7eaee` |
| `--line` | `oklch(88.5% 0.008 255)` | `#d6d9de` |
| `--line-strong` | `oklch(65% 0.013 255)` | `#8a9097` |
| `--ink-3` | `oklch(54.5% 0.016 255)` | `#6a717a` |
| `--ink-2` | `oklch(47.5% 0.016 255)` | `#565d65` |
| `--ink` | `oklch(26% 0.020 255)` | `#1e252e` |
| `--accent` | `oklch(52% 0.170 258)` | `#1c65c8` |
| `--accent-ink` | `oklch(44% 0.150 258)` | `#0f4ea3` |
| `--accent-wash` | `oklch(96.5% 0.022 258)` | `#ebf4ff` |
| `--danger-ink` | `oklch(46% 0.165 25)` | `#a01e23` |
| `--danger-wash` | `oklch(96% 0.025 25)` | `#ffece9` |
| `--warn-ink` | `oklch(46% 0.110 75)` | `#7b4d00` |
| `--warn-wash` | `oklch(96% 0.035 85)` | `#fdf1d8` |
| `--good-ink` | `oklch(45% 0.120 155)` | `#006836` |
| `--good-wash` | `oklch(96% 0.030 155)` | `#e3f8e9` |

**Dark** — a separate palette, not an inversion (§2.3). Ground is `17% L`, not
0%; ink stops at `93% L`, not 100%. Both deliberate: pure black under pure white
is the halation pairing the dossier names.

| Token | OKLCH | sRGB |
|---|---|---|
| `--page` | `oklch(17% 0.008 255)` | `#0d1013` |
| `--surface` | `oklch(21% 0.009 255)` | `#16191c` |
| `--sunken` | `oklch(15% 0.007 255)` | `#090b0e` |
| `--raised` | `oklch(25% 0.010 255)` | `#1e2226` |
| `--line-soft` | `oklch(26% 0.010 255)` | `#212429` |
| `--line` | `oklch(31% 0.012 255)` | `#2c3136` |
| `--line-strong` | `oklch(56% 0.016 255)` | `#6e757e` | *(raised from 52% — see C.7)* |
| `--ink-3` | `oklch(64% 0.016 255)` | `#868d96` |
| `--ink-2` | `oklch(76% 0.014 255)` | `#abb2ba` |
| `--ink` | `oklch(93% 0.006 255)` | `#e5e8ec` |
| `--accent` | `oklch(72% 0.150 258)` | `#66a5ff` |
| `--accent-ink` | `oklch(80% 0.120 258)` | `#8dc0ff` |
| `--accent-wash` | `oklch(27% 0.045 258)` | `#18273c` |
| `--danger-ink` | `oklch(78% 0.130 25)` | `#ff958d` |
| `--danger-wash` | `oklch(27% 0.050 25)` | `#3b1c1a` |
| `--warn-ink` | `oklch(82% 0.110 80)` | `#eabc6e` |
| `--warn-wash` | `oklch(27% 0.045 80)` | `#32240a` |
| `--good-ink` | `oklch(80% 0.130 155)` | `#72d699` |
| `--good-wash` | `oklch(26% 0.045 155)` | `#102a1a` |

**Measured contrast, every text-on-surface pair.** WCAG figures are floors
(§2.3), so the interesting column is the spread, not the pass.

| Pair | Light | Dark |
|---|---|---|
| body on page ground | **14.88** | **15.52** |
| body in a row card | **15.45** | **14.36** |
| secondary label | **6.67** | **8.24** |
| tertiary hint / placeholder on card | **4.93** | **5.26** |
| tertiary hint on ground | **4.75** | **5.69** |
| accent / link text | **7.96** | **9.34** |
| text in an accent notice | **7.17** | **7.97** |
| text in an error banner | **6.81** | **7.27** |
| text in a warning / Example tag | **6.46** | **8.56** |
| text in a success checkpoint | **6.22** | **8.62** |
| text on a sunken well (SQL block) | **14.14** | **16.03** |
| text on a raised surface (menu) | **15.45** | **13.02** |
| input / control border *(1.4.11, 3:1 floor)* | **3.22** | **3.79** |
| capsule edge on `--raised` *(1.4.11)* | **3.22** | **3.44** |
| focus ring on card *(1.4.11)* | **5.61** | **7.05** |
| focus ring on ground *(1.4.11)* | **5.40** | **7.62** |

Two failures in my first draft were caught by measuring and fixed before this
document was written: light `--ink-3` at 59.5% L gave 4.04:1 (below AA) and is
now 54.5% L; `--line-strong` at 79% L gave 1.93:1 as an input border and is now
65% L. Both re-measured above.

**Where the floors are deliberately exceeded, and why (§2.3 "contrast as a
compositional tool").** The three ink levels are set at roughly **15 : 6.7 : 4.9**
rather than clustered just above 4.5. That ~2.2× step between each is what lets
the eye rank a row without reading it — company name first, secondary label
second, placeholder last — so hierarchy is carried by contrast rather than by
adding weight or size. AAA (7:1) is met on body text everywhere and deliberately
*not* met on tertiary hints: a placeholder that competes with real data is a
worse outcome than a placeholder below AAA.

**Decorative dividers are reported, not failed.** Row hairlines measure 1.42:1
(light) / 1.34:1 (dark). WCAG 1.4.11 governs contrast *required to identify a
component*; a row separator identifies nothing — the card surface and its
content do that. Raising hairlines to 3:1 would produce the gridlines Tufte
tells us to erase (§4.1). Stated explicitly so the choice is visible rather than
an oversight.

### Light or dark — verdict

**Light is the default. Dark is offered, remembered, and never assumed.**

§2.3 is unusually direct: multiple studies find a **positive-polarity
advantage** (dark-on-light read faster and more accurately); light-on-dark
causes **halation** for astigmatic readers; and the §Benchmarks line is written
for exactly this app — *"If your audience skews toward long-form reading or
older/astigmatic users, default to light mode."*

JobApp is sustained reading of dense rows of small text. That is the profile the
dossier names. The dossier also insists on the honest prevalence figure: **~40%
pooled adult astigmatism (Hashemi et al. 2023)**, not the unreferenced ~50% that
circulates — and 40% is more than enough to decide this.

This changes behaviour: today the app silently adopts `prefers-color-scheme:
dark`. **Proposed: light on first visit regardless of OS**, with a single
dismissible line offering the switch when the OS prefers dark, and the choice
remembered thereafter. Listed as **Departure D1** because it overrides a
platform signal — I want that visible, not buried.

### Type

**Inter Variable, latin subset, with the optical-size axis — self-hosted,
base64-inlined.** `@fontsource-variable/inter@5.3.0`,
`inter-latin-opsz-normal.woff2`.

**Weight cost, measured: 71 KB woff2 → ~95 KB base64 inline.** The `wght`-only
cut is 47 KB if you want the optical-size axis dropped; §2.2 names optical
sizing as precisely the thing that separates *correct* from *expensive*
typography, so I am proposing the 71 KB.

Why self-hosted and inlined rather than Google Fonts: this project spent a whole
cycle pinning every dependency with SRI and removing the Tailwind CDN so no
third party could change what users run. A Google Fonts `<link>` reintroduces an
unpinnable third party *and* needs a CSP change. Inlined as a `data:` URI it
needs no CSP change (`font-src 'self' data:` already permits it), has **zero
network latency and no FOUT**, and works on the school and office networks the
README already warns about. Fallback stack stays `system-ui` so a failed decode
degrades rather than breaks.

Why Inter specifically: it ships `tnum` (tabular figures), `zero` (slashed
zero), `cv05`, and a genuine `opsz` axis — the feature set §2.2 lists.

- **Modular scale: 1.2 (minor third)**, from §2.1's named ratios. The smallest
  offered, chosen because a dense table needs many distinguishable steps inside
  a narrow range; 1.333 or 1.5 would blow the header off the row.
- **Base: 0.9375rem (15px).** Steps: `10.4 / 12.5 / 15 / 18 / 21.6 / 25.9 / 31.1px`.
- **Display sizes are fluid** (§2.1 intrinsic design):
  `--text-display: clamp(1.617rem, 1.35rem + 1.1vw, 2.074rem)`.

**Measure, in ch, for every prose surface** (§2.2, 45–75 CPL, 66 ideal):

| Surface | Measure | Rationale |
|---|---|---|
| Setup step body | `62ch` | Instructional prose, read once, carefully |
| Setup checkpoint | `58ch` | Short confirmations, tighter is scannable |
| Sign-in body | `54ch` | Two short paragraphs |
| Error banner body | `56ch` | Must be read under stress; short lines help |
| Example / migration notice | `60ch` | |
| Empty-state teaching copy | `48ch` | Deliberately below Bringhurst's ideal; this is glanced, not read |
| Table cell content | **not constrained by ch** | Column width is the constraint; §2.2's measure guidance is for prose, not cells |
| Footer / keyboard legend | `72ch` | Reference text, scanned |

**Leading** (§2.2 — rises for sans-serif, longer measures, and screens):
body `1.55`; prose at 60ch+ `1.65`; table cells `1.4` (short strings, vertical
density matters more); display `1.1`; uppercase micro-labels `1.2`.

**Where tabular figures are enforced** (§2.2 — "tabular figures that don't
jitter in a table"). `font-feature-settings: "tnum" 1, "zero" 1` on: every score
cell and aggregate; the funnel's counts, percentages and day-averages; the chase
counter; the "N tracked · N live" header; stage-rail counts; the date field; the
salary and equity fields; the six-digit OTP input; the version string. Slashed
zero is on wherever a `0` could be read as `O` — the OTP field above all.

### Space

Base unit **0.25rem (4px)**, ratio **1.5**, compounding from `0.5rem` and
snapped to even pixels. Named semantically, never numerically (§2.1):

| Token | Value | Use |
|---|---|---|
| `--space-hair` | 2px | Optical nudges only |
| `--space-tight` | 4px | Icon-to-label |
| `--space-snug` | 6px | Inside a pill |
| `--space-base` | 8px | Default gap |
| `--space-cosy` | 12px | Cell padding |
| `--space-room` | 18px | Between field groups |
| `--space-loose` | 28px | Between sections |
| `--space-open` | 42px | Above a major heading |
| `--space-vast` | 64px | Page margins at width |

Pure ×1.5 from 8 gives 12, 18, 27, 40.5, 60.75; snapping to 28, 42, 64 keeps
every value on an even-pixel boundary so 1px hairlines never land on a
half-pixel. **The snapping is the concession and it is stated, not hidden.**

**Where optical alignment overrides mathematical alignment** (§2.1):

1. **The stage-pill glyph.** The status dot is optically centred against the
   cap-height of the label, not the line box — `translateY(-0.5px)`.
2. **The disclosure triangle** in the score cell. A right-pointing triangle's
   visual mass sits left of its bounding-box centre; it gets `+1px` of left
   padding to look centred in its tap target.
3. **Uppercase micro-labels** sit optically high in their line box; they get
   `padding-block-start` reduced by 1px against their sibling sentence-case
   labels so baselines agree.
4. **The `×` delete affordance** is a glyph in a square target: `-0.5px`
   vertical, because the multiplication sign's ink sits above the optical
   centre.
5. **Card left padding is 1px greater than right** — a left border plus a round
   corner reads as tighter on the left than the same numeric padding on the
   right.

---

## Motion

**Ceiling: 200ms for standard transitions, 150ms for exits, absolute cap
300ms.** §3.1 sets ~300ms as the outer bound and the Linear teardown in §3.1
notes "defaulting to shorter transitions is one of the easiest ways to make an
app feel faster" with Linear's defaults "well below" Material's 200ms and iOS's
350ms. Nothing in this app is a drawer needing the 500ms allowance.

| Transition | Duration | Easing | Property |
|---|---|---|---|
| Detail drawer open | 200ms | `cubic-bezier(.22,1,.36,1)` | `grid-template-rows`, `opacity` |
| Detail drawer close | 150ms | `cubic-bezier(.22,1,.36,1)` | as above |
| Funnel collapse / expand | 200ms | `cubic-bezier(.22,1,.36,1)` | `grid-template-rows` |
| Undo toast in | 180ms | `cubic-bezier(.22,1,.36,1)` | `transform`, `opacity` |
| Undo toast out | 150ms | `ease-out` | `transform`, `opacity` |
| Notice banner in | 180ms | `cubic-bezier(.22,1,.36,1)` | `transform`, `opacity` |
| Row leaving on delete | 160ms | `ease-out` | `transform`, `opacity` |
| Mobile row action reveal | tracks the finger | — | `transform` |
| Theme change | 0ms | — | — |

`cubic-bezier(.22,1,.36,1)` is the dossier's named *smooth* spring
approximation (§3.1). The energetic `(.34,1.56,.64,1)` is **not used anywhere**
— see Subtractions S5. Entering elements use ease-out per §3.1; §3.1's
asymmetric pattern (instant in, graceful out) is applied to the undo toast.

**Only `transform` and `opacity` animate**, per §3.1 — with one stated
exception: `grid-template-rows: 0fr → 1fr` for the two collapsibles. It is not
GPU-composited, but it is the only technique that animates to *intrinsic*
height without measuring the DOM. Confined to two elements, both user-initiated,
both under 200ms. **Departure D4.**

### Interactions that will NOT animate

§3.1 *When NOT to animate*: "high-frequency, low-novelty interactions… should
often appear *without* animation — after the hundredth viewing, a fade becomes a
tax on perceived speed." Freiberg's own tool "felt *faster* after he removed
motion from core keyboard interactions."

| Interaction | Frequency | Why not |
|---|---|---|
| **Status pill cycling** | ~40×/session | The single most-repeated action in the app. Any transition here is a tax paid forty times. The colour swap must land in the same frame as the click. |
| Inline cell open / close | ~30× | The caret must be live instantly; an entrance reads as input lag. |
| Dropdown menus | ~8× each | §3.1 names command menus explicitly. |
| Stage-rail filter chips | ~10× | Pressed state is instant. |
| Checklist tick | ~15× | Must feel like a physical checkbox. |
| Rating swatch fill | ~10× | Direct manipulation with immediate readout. |
| Focus ring | Continuous | An animated focus ring makes keyboard nav feel syrupy. |
| Theme toggle | Rare | A 300ms cross-fade of every surface is the most expensive animation in the app for the least information. |
| Sync chip state change | Ambient | Ambient status must not draw the eye. |
| Hover on rows and buttons | Continuous | Instant in; §3.1's asymmetric pattern gives them a 150ms fade *out* only. |

### Interruptible and velocity-aware

Only one gesture exists: **mobile row swipe.** §3.1's threshold logic:

- **Reversible reveal** (swipe to show row actions) triggers **during** the
  gesture, after **32px** of travel. It tracks the finger 1:1, is interruptible,
  and follows the release velocity to whichever end state is nearer.
- **Destructive commit** (delete) triggers **only on gesture end**, regardless
  of distance travelled, and only past **50% of row width** — so a
  half-committed swipe always reverses. Per §3.1: "destructive actions… should
  trigger only on gesture *end* regardless of distance, so a half-committed
  gesture can be reversed."
- Velocity is computed from the last two pointer samples; a flick above
  **0.5 px/ms** commits the *reveal* even below 32px, but **never** the delete.

All of it is suppressed under `prefers-reduced-motion`, where the swipe becomes
a static action row.

---

## Surfaces

| # | Surface | Treatment | Governing principle |
|---|---|---|---|
| 1 | Setup, 5 steps | Unchanged structurally — it was rebuilt against real user failure. Retypeset: 62ch measure, numbered sub-steps at `--space-cosy`, checkpoints as `--good-wash` blocks at 6.22:1. | §1.1 expertise-reversal: scaffolding is correct here because every reader is a novice, once |
| 2 | SQL block | `--sunken` well, mono, 14.14:1, `max-height` with scroll, copy button first | §2.3 elevation by lightness |
| 3–5 | Sign-in | 54ch. Link and code routes as two labelled branches, not prose | §1.1 recognition over recall |
| 6 | Sign-in error | See *Error states* below | §3.3, §1.2 Rams 6 |
| 7 | "Is this your database?" | Retained verbatim in behaviour, restyled as a `--raised` panel with the project origin in mono at 15.45:1 | §1.2 material honesty |
| 8 | Session-checking | **Nothing.** See *Loading* | §3.3 sub-1s floor |
| 9 | Pipeline loading | Skeleton, but only past 1s | §3.3 |
| 10 | Empty state | See *Empty state* below | §3.3 |
| 11 | Desktop table | Rows as cards on `--surface` over `--page`; hairlines at 1.42:1; **no shadows**; column widths from a `ch`-derived grid | §2.3 elevation by lightness; §4.1 data-ink |
| 12 | Mobile | See *The seven-column problem* | §2.1 container queries |
| 13 | Stage rail | Single-hue ordinal ramp, lightness stepped; proportional bar; count in tabular figures | §2.3 perceptual uniformity |
| 14 | Status pill | Four tokens per stage (fill / border / text / mark), each pairing measured ≥4.5:1 against its own fill. **Zero transition.** | §3.1 when not to animate |
| 15 | Inline cell | Hover raises to `--sunken` instantly; focus ring 5.61:1; caret at end on open | §3.2 invisible friction |
| 16 | Checklist | Native checkbox, `accent-color`; ticked text to `--ink-3` + strike | §1.1 recognition |
| 17 | Sync chip | Ambient, `--ink-3`, no motion; only "offline" takes `--warn-ink` | §3.3 |
| 18 | Chase counter | Tabular; `--warn-wash` only when non-zero | §2.2 |
| 19 | Example tag / banner | `--warn-wash` tag at 6.46:1; banner in `--accent-wash` at 7.17:1 | §1.2 honesty |
| 20 | Funnel | **Stat tiles deleted.** Bars carry the numbers; sparkline-thin, data-ink ~1.0 | §4.1 Tufte |
| 21 | Detail drawer | `grid-template-rows` 0fr→1fr, 200ms; both panels identical surfaces | §3.3 |
| 22 | Ratings | 5 swatches, `--accent` fill, no transition, × to clear | §3.1 |
| 23 | Offer fields | Masked date; tabular; `--space-room` between groups | §2.2 |
| 24 | View bar | Three dropdowns + Reset view when dirty | §1.1 |
| 25 | Add application | Primary, `--accent`, only filled button on the page | §1.2 restraint |
| 26 | Undo toast | 180ms in / 150ms out, `transform`+`opacity` | §3.1 asymmetric |
| 27 | Deleted panel | Sunken well at page foot | §2.3 |
| 28 | Error banner | See *Error states* | §3.3 |
| 29 | Migration notice | `--warn-wash`, SQL + copy inline | §3.3 |
| 30 | Sign out | Confirm dialog retained verbatim | inviolable #10-adjacent |
| 31 | Theme toggle | Text label, no glyph, no transition | §4.1 eraser |
| 32 | Print | Forces the full light palette | — |
| 33 | Focus / hover / disabled | 2px `--accent` ring at 2px offset, ≥5.4:1 everywhere; disabled at `--ink-3` + `cursor:default` | §2.3 |

### Empty state as the primary onboarding surface

§3.3: *"the first-run empty state is the single best onboarding surface — it
should teach the primary action in context rather than drop the user into a
blank void."*

Today it is one sentence and a button. Proposed: the empty table renders **one
ghost row in the real table geometry** — same eight columns, same widths, same
type — with each cell carrying its own one-word instruction (`Company` ·
`Role` · `City` · click to advance · …) at `--ink-3`. Above it, at 48ch: *"Add
your first application. Every cell is editable — click one and type."* The
primary button sits at the row's left edge, aligned to the Company column, so
the click lands where the first cell will be.

It teaches the geometry, the editability and the primary action *in situ*, and
because it is the real table markup it cannot drift from the real layout.

Distinct from the *filtered*-empty state, which already names what is hiding
rows and offers one control back. That stays.

### Error states as trust-building moments

§3.3 and §1.2 (Rams 6): name what happened, preserve the user's input, offer
concrete recovery.

| Error | Names it | Preserves input | Concrete recovery |
|---|---|---|---|
| Sign-in redirect misconfigured | "Supabase refused to send you back here" | Email address stays in the field | The exact origin string, with a copy button |
| OTP wrong / expired | "That code has expired" | Code field cleared, email kept | "Send another" inline |
| Database error on write | Verbatim Postgres message + code in a mono well | **The optimistic value is rolled back and the cell reopens with the user's text still in it** | Retry button that re-fires the same mutation id |
| Schema behind | "Your database is missing N columns" | — | SQL + copy, pipeline still readable underneath |
| CDN blocked | "The page scripts did not load" | — | Names the exact hosts; suggests mobile data |
| Read-back empty (RLS) | "The row was created but could not be read back" | — | Names `FOR ALL` as the fix |

The third row is the one that does not exist today and is the point of V2: an
error currently leaves the wrong value on screen. Rolling back *and* handing the
text back is the frustration-to-relief arc §3.3 calls a peak-end opportunity.

### Loading

§3.3: below ~1s neither skeleton nor spinner is needed; skeletons suit full-page
loads and must mirror real layout and not shift; spinners suit short discrete
ops.

| Surface | Treatment | Justification |
|---|---|---|
| Session check | **Nothing** for 1000ms, then a skeleton | Typically 50–200ms from `getSession()`. A flash below 1s is the annoyance §3.3 names |
| Pipeline first load | **Nothing** for 1000ms, then a table skeleton | Same |
| Table skeleton | Real `<table>`, real `<colgroup>`, 5 rows of `--line-soft` blocks at exact cell heights | §3.3: "a skeleton must *mirror the real layout* (and stabilize CLS)" — the skeleton is the real table with its text swapped for blocks, so CLS is structurally 0 |
| Cell save | **Nothing** — optimistic | §1.3 |
| Status cycle | **Nothing** — optimistic | §1.3 |
| Add application | **Nothing** — optimistic | §1.3 |
| Hard delete | **Spinner in the confirm button**, disabled while in flight | §3.3 short discrete op; §Stage 2 — never optimistic |
| Connect → first query | Spinner in the Connect button | Short discrete op, network-bound |
| Sending magic link | Spinner in the Send button | Short discrete op |

CLS is 0 by construction: the skeleton *is* the table element with placeholder
blocks in the cells, so replacing blocks with text changes no box.

### The seven-column table on a phone

The hardest problem, and the brief forbids hiding columns.

**Diagnosis.** The eight columns are not peers. They fall into four roles:

- **Identity** — Company, Role, Location. *Answers "which application?"*
- **State** — Status. *The primary action target, ~40×/session.*
- **Working notes** — Replies, Next steps, Notes. *Long-form; on desktop most are empty most of the time.*
- **Judgement** — Score. *One number, plus a drawer.*

The current mobile card renders all three working-note fields unconditionally,
empty or not — so a phone shows three empty labelled boxes per row, and the
identity that matters is buried above them.

**Proposal — a container-query record, not a card.** `container-type: inline-size`
on the row wrapper, so the switch is driven by the *row's* width, not the
viewport (§2.1: container queries are "the true enabler of portable
design-system components"). One component, two layouts, no 1024px cliff.

Below `44rem`:

```
┌────────────────────────────────────────┐
│ Northwind                   ⟨ APPLIED ⟩│  ← identity + state, one line, always
│ Analyst, Strategy · London        4.0 ▸ │  ← role · city · score, one line
├────────────────────────────────────────┤
│ REPLIES    Automated acknowledgement…  │  ← only fields WITH content
│ NEXT       ☑ Send the CV               │
│            ☐ Follow up next week       │
├────────────────────────────────────────┤
│ + Notes                                 │  ← empty fields collapse to one adder
└────────────────────────────────────────┘
```

- **No column is hidden.** Every one is reachable, and every one with content is
  rendered. Empty fields collapse into a single `+ Notes` affordance that names
  what is missing — which is *more* discoverable than an empty labelled box.
- **Identity and state are pinned** to line one, because those are what a scan
  needs and what the most-repeated action targets.
- The status pill is right-aligned and full-height — a **44px** target at the
  thumb-reachable edge (Fitts's Law is about pointing, and §Caveats confirms it
  is robust for exactly that).
- Swipe reveals delete, per the threshold logic above.
- Score keeps its drawer; the drawer is the same component as desktop.

This is a genuinely different *information* decision from the current card, not
a restyle: **render what exists, name what does not, pin what is scanned.**

---

## Budgets

§3.2: 100ms instant, 400ms Doherty, 1s flow, 10s attention lost. Elite keyboard
tools target 50ms.

| Interaction class | Budget | Method |
|---|---|---|
| Keystroke → glyph in cell | **≤16ms** (1 frame) | Uncontrolled input, no re-render above the cell |
| Hover / focus feedback | **≤16ms** | No transition on in |
| **Status pill click → colour change** | **≤16ms** | Optimistic, no animation |
| Checklist tick → strike | ≤16ms | Optimistic |
| Cell save (⌘↵) → committed | ≤50ms local | Optimistic; network async |
| Filter / sort / group | **≤100ms** | Pure client-side over ≤500 rows |
| Add application → row present | ≤100ms local | Optimistic insert with a temp id |
| Drawer open → laid out | ≤200ms | Matches the 200ms transition |
| First contentful paint (font inline) | ≤400ms | No font round-trip |
| Sign-in submit → feedback | ≤400ms, spinner past 1s | Network-bound |
| Hard delete → row gone | Network-bound, **spinner immediately** | Never optimistic |

Instrumented with `performance.mark`/`measure` around each class, reported in
Phase 4 as actual numbers (closes V18).

### Optimistic UI

§1.3. **Applies to:** status cycling, cell edits, checklist ticks, rating
changes, soft delete, restore, add application, clearing scores.

**Rollback design** — the piece that does not exist today (V2). Every mutation
captures the prior value before mutating. On error: restore the prior value,
surface the error naming the field, and reopen the cell with the user's text
intact. Rollback is unconditional; the dossier calls omitting it *the*
anti-pattern.

**Request identity** (V3). Each mutation gets
`{ id: ++seq, rowId, field, prior, next }`. A per-`(rowId, field)` map holds the
latest issued id. On response:

- response id **<** latest for that key → **ignore entirely** (stale; a newer
  mutation already owns the field)
- response id **===** latest and ok → clear the pending entry
- response id **===** latest and error → roll back to that mutation's `prior`,
  show the error

This is exactly §1.3's fix for "if a user toggles three times quickly, responses
can arrive out of order and a naive rollback reverts to stale state" — which is
live in this app today, because status cycling is one click and users do it in
bursts.

**Must NOT apply** (§Stage 2 — "do *not* apply it to destructive/irreversible
actions"):

- **Hard delete (`purge`)** — currently optimistic (V4). Becomes: confirm →
  disable + spinner → await → remove on success. Irreversible.
- **Sign out** — session teardown, not a mutation.
- **Connect / credential save** — must not appear connected before the client
  is built.
- **The SQL migration** — runs in Supabase, not here.

---

## Subtractions

The thesis. Each passes §4.1's eraser test in writing: *if removing it loses no
meaning, remove it.*

| # | Removed | Cost recovered | Meaning lost |
|---|---|---|---|
| S1 | **Tailwind entirely** — 11.3 KB inlined, plus the regeneration hazard where a new class silently does nothing | 11.3 KB → **5.7 KB**, and a whole class of build error | None. **Correction: the JSX uses ~120 utilities, not the ~40 I estimated when proposing this.** Hand-writing them still halves the weight and removes the generator, but the figure in the original proposal was wrong and is corrected here |
| S2 | **The hex `@supports` fallback layer** — 3 palettes × ~40 tokens duplicated | ~300 lines | None. §2.3: OKLCH native since 2023, and it is baseline in every browser this app supports |
| S3 | **All box-shadows in light mode** (`--sh-1/2/3`) | 3 tokens × 3 themes = 9 | None — elevation moves to surface lightness, which §2.3 says is the correct mechanism anyway |
| S4 | **The funnel's four stat tiles** | ~40 lines and a full row of vertical space | None — the bars beneath already carry the same four numbers. Pure §4.1 chartjunk |
| S5 | **`--ease-spring` overshoot curve** | 1 token, 2 uses | None. Nothing here is thrown |
| S6 | **`transition: width` on the stage rail** | — | None; violates §3.1 and is replaced by `transform: scaleX()` |
| S7 | **The `.tk-glyph` ▶ rotation** | — | None; the open state is already carried by the drawer's presence |
| S8 | **`tracking-widest` (0.13em) uppercase micro-labels** | — | Decorative. Retained only where a label must not be confused with data |
| S9 | **The never-loaded `'Inter Display'`/`Geist` stacks** | — | Nothing was ever loaded. Removing the lie is the point (V1) |
| S10 | **`--surface-2`** (2 uses) | 1 token × 3 themes | None; `--sunken` covers it |
| S11 | **`--t-3xl` (34px)** — one use | 1 token | Replaced by fluid `clamp()` |
| S12 | **Tailwind's generated `blur` / `grayscale` / `filter` / `collapse` / `table` utilities** — emitted, never used | ~1 KB | None |
| S13 | **The theme toggle's ☾/☀ glyph** | — | None; the word is unambiguous and the glyph is a second encoding of it |
| S14 | **Three separate radius tokens** (`--r-1/2/3/4` at 6/8/10/14px) collapsed to two | 2 tokens | None; four radii on one page is noise, not hierarchy |
| S15 | **`--lh-none`, `--tr-normal`, `--w-light`** — declared, unused or used once | 3 tokens | None |
| S16 | **The desktop/mobile 1024px breakpoint fork** — two separate component trees (`DesktopRow` + `MobileCard`) | ~90 lines of duplicated field logic | None; one container-queried component replaces both, and they can no longer disagree |
| S17 | **Per-row empty note fields on mobile** | 3 empty boxes × every row | Nothing — an empty labelled box communicates less than a named adder |
| S18 | **Animation on ten interaction types** (see the NOT list) | — | Perceived speed *gained*, per §3.1 |

**Net:** ~13 KB shipped weight and ~400 lines removed, against ~95 KB added by
the inlined font. That is an honest net *increase* of ~82 KB — spent entirely on
the one thing §2.2 says separates correct from expensive typography, with zero
added network round-trips. If you would rather not pay it, the `wght`-only cut
is 47 KB and the fallback is the system stack at 0 KB; say which and I will
price it into Phase 3.

---

## The capsule — a shape primitive

### C.1 The reference, extracted

Read from `design/preview.html` and measured in a browser, not estimated.
Declared values first, then computed geometry.

| Property | Declared | Computed / verified |
|---|---|---|
| `border-radius` | `999px` | Box is **43.34px** tall → effective radius **21.67px** = exactly h/2. **It is a true stadium**, not a fixed large value: the browser clamps 999px down to half the height, so it re-derives at any height |
| Border | `1px solid var(--line-strong)` | `1px solid oklch(0.65 0.013 255)` |
| Background | `var(--raised)` | `oklch(1 0 255)` — in light, `--raised` resolves to the same white as `--surface` |
| `box-shadow` | `0 8px 24px oklch(26% .02 255/.12)` | **One layer.** Not a stack |
| Padding | `8px 18px` | `--space-base` / `--space-room` |
| Aspect | — | 298.47 × 43.34 = **6.89 : 1** |
| Nested control radius | `var(--r-sm)` = `6px` | Height 25.34px, so **not** a stadium (6 < 12.67) |

**Outer : inner radius = 21.67 : 6 = 3.61 : 1.**

**This ratio is accidental, and that is the finding.** The inner control is not
derived from the container at all — it is just `--r-sm`, the same token a
standalone button uses. The concentric value (outer effective radius minus the
vertical inset, `21.67 − 8`) would be **13.67px**. The current 6px is **2.3×
tighter than concentric**, which is why the button reads as a rectangle dropped
into a capsule rather than a control belonging to it. Specimen A renders both
side by side; the corrected one has curves parallel to its container.

### C.2 The primitive

Lifted out of the component into the token layer. Named for what the shape *is*
in the system — a discrete, self-contained, single-line object that can be acted
on — not for the one component that happened to have it first.

```css
/* ── SHAPE PRIMITIVE: the capsule ────────────────────────────────
   Extracted from the undo toast. Every member of the application-row
   family references these. Changing the family's shape is a one-line
   edit here, not a search across components. */
--capsule-h:        32px;    /* nominal single-line control height   */
--capsule-h-sm:     24px;    /* pills, tags, chips                   */
--capsule-h-lg:     44px;    /* a capsule that nests another control */
--capsule-r:        999px;   /* stadium — self-clamps to h/2         */
--capsule-pad-y:    8px;
--capsule-pad-x:    18px;    /* optical, not 12px — see C.5.4        */
--capsule-edge:     1px solid var(--line-strong);
--capsule-surface:  var(--raised);
--capsule-wrap:     nowrap;  /* enforced, not merely stated — see C.5.1 */
--capsule-lift:     0 8px 24px oklch(26% .02 255 / .12);  /* one layer */

/* ── NESTING RULE ────────────────────────────────────────────────
   A control inside a capsule takes the container's effective radius
   minus the vertical inset, so the two curves stay concentric.
   Derived, so it survives a change to --capsule-h. */
--capsule-r-nested:    calc(var(--capsule-h)    / 2 - var(--capsule-pad-y)); /*  8px */
--capsule-r-nested-lg: calc(var(--capsule-h-lg) / 2 - var(--capsule-pad-y)); /* 14px */

/* ── FALLBACK ────────────────────────────────────────────────────
   Where the stadium breaks down (C.5.1, C.5.2). */
--capsule-r-block:  10px;
```

**Placement rule:** a capsule may sit on `--surface`, `--page` or `--raised`.
**It may not sit on `--sunken`** — measured, `--line-strong` on `--sunken` is
**2.95:1** in light, just under the 3:1 non-text floor. The sunken well hosts
the SQL block and the trash list; neither is a capsule, so this costs nothing.

**Corrected ratio, and a clamp worth knowing about.** Nominally
`--capsule-h-lg` 44px → outer 22px, nested 14px = 1.57 : 1. **Measured, it is
1.71 : 1**, and the difference is instructive: the nested control is only
25.34px tall, so its own half-height is 12.67px and the browser clamps the 14px
down to that. The nested control becomes a stadium itself.

That is the **correct degenerate case, not a bug** — a small pill inside a large
pill — and it needs no special handling because `border-radius` clamps on its
own. Stated explicitly so nobody later "fixes" the discrepancy between the
nominal 14px and the rendered 12.67px. The rule to remember: *the nesting radius
is an upper bound; below 2× it, the control is a stadium.*

### C.3 Application across the family

| Surface | Shape | Shadow | Governing reason |
|---|---|---|---|
| **Status pill**, 6 stage variants | **Full capsule** at `--capsule-h-sm` | none | The canonical member. Single-line, fixed content, ~4:1 aspect |
| **Chase chip** (amber / rose states) | **Full capsule**, `--warn-wash` / `--danger-wash` fill | none | Same class as the pill; a discrete signal object |
| **Example tag** | **Full capsule**, small | none | Same class |
| **Add-application** | **Full capsule**, accent fill | none | The one filled control on the page |
| **Dropdown trigger** (group / sort / filter) | **Full capsule** | none | Single-line, in flow |
| **Restore control** in the trash panel | **Capsule at `--capsule-r-nested`** | none | It sits *inside* a well, so it takes the nested radius |
| **Undo toast** | **Full capsule at `--capsule-h-lg`** + nested Undo at 14px | **YES** | The only member that genuinely floats |
| **Editable cell — resting** | **Not a capsule.** No border, no fill. `--capsule-r-block` on hover tint only | none | See C.4 |
| **Editable cell — editing** | `--capsule-r-block` 10px + `--capsule-edge` | none | Can wrap ⇒ not a capsule (C.5.1) |
| **Sync chip** | **Not a capsule.** Bare dot + text | none | Ambient, not actionable. Giving status a control's shape would invite clicking it |
| **Stage rail segments** | **Not a capsule — a track** | none | Aspect far beyond 6:1. This *is* the track case (C.5.2) |
| **Funnel bar + track** | **Track**, fully rounded ends | none | Same |
| **Database error banner** | **Not a capsule.** `--capsule-r-block` | none | Multi-line and full-width |
| **Migration / example notices** | `--capsule-r-block` | none | Multi-line |
| **Recently-deleted entries** | **Not a capsule.** Rows in a sunken well | none | Placement rule forbids capsules on `--sunken` |
| **Rating swatches** | **Not a capsule.** 3px-radius squares | none | A quantity read as a bar, not six objects |
| **Offer / score input fields** | **Not capsules.** `--capsule-r-block` | none | Wide, short, and can wrap |
| **Dropdown menu panel** | `--capsule-r-block` | **YES** | Floats over content |

### C.4 Explicitly not in the family — and why that list matters

The brief is right that this is the more important list. **Nine of the eighteen
surfaces above are excluded.** If everything becomes a capsule the shape stops
encoding anything and becomes wallpaper — §4.1's eraser test applied to a shape
rather than an effect.

The capsule means: **a discrete object you can act on.** Each exclusion fails
that on a specific count:

- **Editable cell (resting)** — the largest exclusion, and the one that decides
  the table's character. A cell is *text in a column*, not an object. At table
  width it measures ~22:1, four times past where a stadium reads as a shape
  (C.5.2). Bordering every cell would also produce exactly the gridlines Tufte
  tells us to erase (§4.1 data-ink). It stays flat and unbordered until touched.
- **Sync chip** — not actionable. A control's shape on a status readout is a
  false affordance; §1.2 material honesty, Rams 6.
- **Stage rail, funnel bars** — these are *tracks*: continuous quantity, not
  discrete objects. They are fully rounded for a different reason and should not
  be confused with membership.
- **Error and migration banners** — multi-line by definition.
- **Trash rows** — excluded by the placement rule, not by aspect.
- **Rating swatches** — five squares read as one quantity. Rounding them into
  five capsules would make them read as five separate objects.

### C.5 Where the stadium breaks down

Each rule below is set from a rendered specimen, not asserted.

**C.5.1 Multi-line.** The threshold is not a pixel value — CSS cannot count
lines without JS. It is a **content rule: if the content can wrap, it is not a
capsule.** Replies, Next steps, Notes and every notice fall to
`--capsule-r-block` (10px). Specimen D shows why: at three lines the stadium
becomes a lozenge, the caps stop relating to the text block, and the first and
last lines sit visibly inside the curve.

**The rule is enforced, not merely stated.** Rendering the family in a real row
caught the gap: with a narrow Status column the "To apply" pill *wrapped to two
lines* and became exactly the tall lozenge this rule forbids. Stating a rule the
CSS does not enforce is how it gets broken later, so `--capsule-wrap: nowrap` is
part of the primitive and `.capsule--block` explicitly restores `normal`. The
Status column is sized to `7.5rem` so the longest label fits without the nowrap
turning a wrap into an overflow.

**C.5.2 Aspect ratio.** **The stadium holds to 6:1.** From specimen B: 2:1
through 6:1 read as considered shapes; 7:1 is borderline; at 9:1 the flat middle
dominates and the caps read as leftovers; 22:1 (a table cell) is absurd. Above
6:1 a surface is either `--capsule-r-block` or explicitly declared a track. The
undo toast measures 6.89:1 — marginally over, and acceptable only because it is
a floating object read as a single unit rather than a field in a row. Noted as
the family's one tolerated exception.

**C.5.3 Adjacency.** **Gap 8–12px; default `--space-base` (8px).** Derived rule:
*gap ≥ half the effective radius, ≤ the effective radius* — at `--capsule-h-sm`
(r = 12) that is 6–12px; at `--capsule-h` (r = 16), 8–16px. Specimen C confirms
the bounds empirically: at 4px the curves nearly touch and pinch the gap into a
dark notch; at 22px the row scatters and stops reading as one set.

**C.5.4 Text inset.** `--capsule-pad-x: 18px`, against a rectangle's 12px at the
same height. **This is an optical correction, not a mathematical one** (§2.1
optical vs mathematical alignment): at the vertical centre the curve reaches the
box edge, so measured clearance is identical to a rectangle's — but the eye
integrates the curve closing in above and below the text and reads the text as
crowded. +6px (+50%) restores parity. Specimen F shows all three side by side.

**C.5.5 Focus rings — verified at every radius the family uses.** `outline`
follows `border-radius` in all target browsers. Confirmed by render at 999px
(stadium), 14px (nested-lg), 10px (block), 8px (nested), 6px: the ring is
concentric at all five, with `outline-offset: 2px` preserving an even gap around
the curve. Specimen E.

**C.5.6 Mobile.** In the record layout the status pill sits on line one at
`--capsule-h-sm`, measuring ~4:1 — comfortably inside the 6:1 bound, and
*better* proportioned than in the table because the card constrains its width.
Cells become full-width blocks at `--capsule-r-block`, which is the correct
shape for them at any width. The family holds; rendered in the preview.

### C.6 Shadow — the eraser test, per surface

> **REVISED at your direction.** My original verdict removed the shadow from
> every surface except the two that float, and your brief backed it: *"I would
> rather have a flat cell that is honest than a floating one that is pretty."*
> You have since asked for shadows behind the cells. That is your call and I
> have made it — the table below is updated. I am leaving the original
> reasoning visible rather than quietly rewriting history, because the argument
> against is the thing you would want back if you change your mind.
>
> **Two things worth knowing before you settle on it.**
>
> 1. **The shadow goes on the row, never on each cell.** Horizontal
>    `border-spacing` is 0, so the cells are flush; a shadow on each `<td>`
>    casts onto its neighbours and draws vertical seams down the column
>    boundaries. Tested and rendered as option **D** in the preview — it is
>    visibly wrong. `<tr>` carries it cleanly under `border-collapse: separate`.
> 2. **In dark mode it is nearly invisible, at any intensity.** Rendered A, B
>    and C side by side in dark and they are barely distinguishable. That is
>    §2.3 working as documented — on a dark ground elevation has to come from a
>    *lighter surface*, not a darker shadow. The shadow is therefore effectively
>    a light-mode-only treatment, and the dark theme still leans on
>    `--surface` 21% L against `--page` 17% L to separate the card. Not a
>    defect, but it means the change buys you less than half of what it looks
>    like it buys.

**Elevation scale**

```css
--shadow-rest:  0 2px 4px oklch(26% .02 255/.08), 0 10px 24px oklch(26% .02 255/.10);
--shadow-raise: 0 3px 6px oklch(26% .02 255/.10), 0 14px 32px oklch(26% .02 255/.13);
--shadow-float: 0 8px 24px oklch(26% .02 255/.12);
/* dark: same three, recoloured to pure black at .50 / .55 / .55 */
```

Three intensities are rendered in the preview as **C.0**; **C (deeper) is applied throughout**, chosen by you over the lighter B.

§4.1: *if removing the effect loses no meaning, remove it.* A shadow claims the
element is above the page. That claim is either true or it is decoration.

| Surface | Verdict | Reasoning |
|---|---|---|
| Surface | Verdict | Reasoning |
|---|---|---|
| **Undo toast** | **`--shadow-float`** | Genuinely floats: fixed position, overlapping content, dismissible |
| **Dropdown menu panel** | **`--shadow-float`** | Overlays content it is not part of |
| **Row card** (the whole `<tr>`) | **`--shadow-rest`** ← *revised* | Your call. Carried on the row, not the cells (see D above) |
| **Row card, hover** | **`--shadow-raise`** ← *revised* | Hover already raises the surface to `--sunken`; the shadow now moves with it |
| **Editable cell, editing** | **NONE** | It sits inside a row that is already lifted, and the no-nesting rule below outranks the argument for lifting it. Distinguished by its edge, its surface and the focus ring instead |
| **Mobile record card** | **`--shadow-rest`** ← *revised* | Same object as the row card, different layout |
| **Panels** (scorecard, offer) | **`--shadow-rest`** ← *revised* | Same family |
| Editable cell, resting | **NONE** | Its container already carries the shadow; adding a second would double it |
| Status pill | **NONE** | Sits *in* a card that is already lifted. A shadow inside a shadow reads as a mistake |
| Chase chip, example tag | **NONE** | Same |
| Add-application | **NONE** | Emphasis comes from being the only filled control |
| Dropdown trigger | **NONE** | In flow |
| Error / migration banners | **NONE** | Full-width, in flow |
| Stage rail, funnel | **NONE** | Tracks are recessed, not raised |
| Trash rows, restore | **NONE** | Inside a well — recessed |
| Rating swatches | **NONE** | — |

**Seven surfaces now carry a shadow, up from two.** The principle that survives
the revision is the one that matters most: **nothing nested inside a lifted
surface gets its own shadow.** A pill with a shadow sitting on a card with a
shadow is the failure mode this table exists to prevent — it reads as two
objects at two heights when there is only one. Dark mode continues to lean on
surface lightness per §2.3 regardless, since the shadow barely registers there.

### C.7 Contrast — two failures found and fixed

The brief warned that a lighter border on a lighter surface is the easy way to
fail. It caught two real ones.

| Pair | Was | Now | Fix |
|---|---|---|---|
| `--line-strong` on `--sunken`, light | **2.95** ✗ | n/a | Placement rule: capsules never sit on `--sunken` |
| `--line-strong` on `--raised`, **dark** | **2.92** ✗ | **3.44** ✓ | Dark `--line-strong` raised from `52%` → **`56%` L**. The toast sits on `--raised` in dark, so this was a live failure |

Knock-on effects of the dark token change, re-measured: against `--surface`
**3.79** (was 3.22), against `--page` **4.10**. Both improve. **The
input/control border figure committed in the Foundations table changes from 3.22
to 3.79 in dark; light is unchanged at 3.22.**

**The stage pill borders cannot reach 3:1, and should not try.** Measured: the
border at 25% ink-over-fill gives 1.41–1.50; at 45% only 1.89–2.27. Reaching 3:1
would need ~70%+, which stops being a border and becomes an outline. More
importantly the *fill itself* cannot get there either — a light tint on a white
card measures **1.11:1** at 96% L, and deepening it to 88% L only reaches 1.42
while dragging the label from 6.22 down to 4.89.

This is geometric, not a tuning problem: a pale tint on white cannot clear 3:1
against white. The resolution is the same as **D5**: WCAG 1.4.11 governs contrast
*required to identify* a component and its state. For the status pill:

- **that it is a control** — position in the Status column, pointer cursor, and
  a focus ring at **5.61:1**
- **its state** — the **text label**, at **6.22–6.60:1** light and **5.88–8.62:1**
  dark

Colour is a redundant second encoding, which is also what satisfies WCAG 1.4.1
(use of colour). **This creates a standing constraint: the stage label must never
be reduced to a colour swatch.** If the text were ever dropped, colour would
become the sole state encoding and the pill would fail. Written down here so a
future "cleaner" pill cannot quietly break it.

### C.8 Inviolable behaviours

Nothing in this section touches data access, auth, realtime, migrations or Edge
Functions. It changes `border-radius`, `box-shadow`, `padding`, one dark
`--line-strong` value, and where a control gets its radius from. All ten
inviolable behaviours are unaffected by construction, and will be re-verified
individually after Phase 3 as the rebuild brief requires.

---

## Departures

| # | Departure | Reasoning |
|---|---|---|
| **D1** | **Light mode is forced on first visit, overriding `prefers-color-scheme: dark`** | §2.3 and §Benchmarks direct long-form-reading tools to default light. But overriding a platform signal is genuinely contentious and the dossier does not explicitly bless overriding the OS. Mitigated by a one-line dismissible offer to switch, and the choice is remembered. **Flagging for your veto.** |
| **D2** | **No command palette**, despite §Stage 2 "add a command palette as a first-class surface" | A palette earns its place by collapsing *find* and *do* across a broad action space (Raycast, Linear — hundreds of commands). JobApp has ~10 actions, all already one keystroke away via the existing grid model. Adding a palette adds a surface without collapsing a step, and §1.1's expertise-reversal effect says scaffolding an expert does not need *is* extraneous load. |
| **D3** | **No View Transitions API**, despite §3.3 naming it | §3.3 values it for *shared-element* transitions preserving object permanence across a context switch. This app has no context switch — the detail drawer expands in place, beneath the row it belongs to, so permanence is already visually intact. Eraser test (§4.1): removing it loses nothing. |
| **D4** | **`grid-template-rows` is animated**, against §3.1's transform/opacity-only rule | It is the only way to animate to intrinsic height without measuring the DOM. Confined to two user-initiated elements, both ≤200ms. Stated rather than silent. |
| **D5** | **Hairlines below the 3:1 non-text floor** (1.42:1 / 1.34:1) | WCAG 1.4.11 governs contrast needed to *identify a component*; a divider identifies nothing. Raising them produces the gridlines §4.1 tells us to erase. Every contrast that *does* identify a component clears 3:1. |
| **D6** | **Tailwind removed**, though the brief lists it as part of the envelope | The brief explicitly invites this: *"Consider whether Tailwind is earning its place at all, and say so if it is not."* It is not — ~40 utilities, 11.3 KB, and a regeneration step that can silently drop a class. |

### Where the brief and the dossier conflict

One place, and the brief told me to say so:

The brief lists Tailwind inside the technical envelope while also inviting me to
challenge it. The dossier's §2.1 architecture (semantic token scale, container
queries, `clamp()`) and §4.1 eraser test both point away from a utility
framework being used at 5% of its surface area. **I follow the dossier and
remove it** (D6). If you would rather keep Tailwind, say so and I will keep it —
but the token layer will do the real work either way, and Tailwind will be
carrying ~40 classes it needs a regeneration step to guarantee.

---

## Not in scope, raised rather than done

Per the brief's instruction to stop and raise rather than change:

1. **`prefers-color-scheme` handling** (D1) is a behaviour change to the theme
   boot script. It touches no auth or data path, but it changes what an existing
   user sees on next load. Needs your yes.
2. **Making `purge` non-optimistic** (V4) changes *when* a row disappears. It is
   a latency/presentation decision, but it edits a function that calls Supabase.
   I read it as in scope because the brief asks me to state where optimistic UI
   must not apply — confirming.
3. **CSP** needs no change under the inlined-font proposal. If you prefer Google
   Fonts, `netlify.toml` needs `style-src` and `font-src` entries — say so and I
   will raise it as its own change.

---

## Preview

[`design/preview.html`](preview.html) — every surface and state from the
inventory on one scrollable page, in real type, colour and spacing. Static,
no Supabase client, no auth, marked not-for-deployment.

**Awaiting APPROVED.** `tracker-public/index.html` is untouched; nothing is
committed.


---

## Phase 3 — Implementation

Built on `claude/tracker-ui-category-grouping-2agu7r`. `main` untouched.

### The ten inviolable behaviours — verified individually

Each exercised or read from the shipped source, not inspected and hoped for.
Harness: `design/verify-inviolable.js`.

| # | Behaviour | Result | Evidence |
|---|---|---|---|
| 1 | `user_id` on every insert **and** defaulted to `auth.uid()` in the DB | **PASS** | 2 insert sites, both carry it; `setup.sql:24` sets the column default |
| 2 | Empty `insert().select()` surfaced as an RLS read-back failure | **PASS** | `addRow` branches on the empty array and calls `setOpError` naming `FOR ALL` |
| 3 | Every Supabase call captures and displays `error` | **PASS** | 8 call sites, all bind `error` |
| 4 | Sign-in offers magic link **and** six-digit OTP | **PASS** | `signInWithOtp` + `verifyOtp({email, token, type:"email"})` |
| 5 | Entered URLs reduced to origin | **PASS** | `/rest/v1/`, trailing slash and bare host all → `https://abcdefgh.supabase.co` |
| 6 | No credentials hardcoded/defaulted/injected; clean browser gets an empty form | **PASS** | fields `["",""]`, storage `[]`, **0 requests to any Supabase host** |
| 7 | localStorage keys carry no personal identifier | **PASS** | `tracker.config/theme/funnel/examplesDismissed` |
| 8 | Generic Example Consulting / Studio / Foundation seed | **PASS** | exact match |
| 9 | Adding a row clears an active stage filter | **PASS** | filtered to 1 row, after add 5 visible |
| 10 | Soft delete restores to position; hard delete separately confirmed | **PASS** | order preserved; confirm dialog fired |

### Works with no Edge Functions and no email provider

**Confirmed.** Zero references to `functions.invoke`, `/functions/v1`,
`tracker_settings` or `inbound_messages` in the shipped page; `SELECT_COLUMNS`
reads only from `public.applications`. That is the state almost every user is
in, and it is the state every check above ran in.

### Deviation found mid-build — S16, brought back rather than substituted

**`container-type` does not work on a `<tr>`.** It is *accepted* — computed
style reports `inline-size` — but the query never fires, because size
containment does not apply to table-row boxes. Verified with a minimal case
(`design/cq-tr-test.html`): the probe inside a `<tr>` container never matches.

So S16's "one component, container-queried" cannot be built while the pipeline
is a real `<table>`. What I did instead, and what I did **not** do:

- **Built:** the record *content* rule from C.5.6 — fields with content render,
  empty ones collapse into one adder naming what is missing. That is the
  user-facing answer to the seven-column problem and needed no mechanism change.
- **Not built:** the single container-queried component. It requires replacing
  `<table>` with CSS grid plus ARIA roles, which is a structural change beyond
  the presentation layer and would put the keyboard grid and native table
  semantics at risk. **Awaiting your decision.**

---

## Phase 4 — Verification

### Latency, measured

| Interaction | Budget | Median | Max |
|---|---|---|---|
| Status pill click → DOM committed | ≤16ms (1 frame) | **0.2ms** | 3.6ms |
| Hover feedback | ≤16ms | **0.1ms** | 0.5ms |
| Filter / reset view | ≤100ms | **0.1ms** | 0.4ms |
| Add application → row present | ≤100ms | **69ms** | — |

**A correction worth recording.** My first measurements reported ~16.7ms for
everything, including a pure-CSS hover that cannot cost a frame of JavaScript.
The cause was the harness: an `await` inside an async `page.evaluate` resumes on
the next animation frame, putting a fixed ~16.7ms floor under every reading.
Measured synchronously — and validated against a provably-zero operation (0.0ms)
and a 1ms busy loop (1ms) in the same page — the real figures are the ones
above. I nearly reported a false failure.

### Contrast — matches the committed figures exactly

| Pair | Light (committed) | Dark (committed) |
|---|---|---|
| body on surface | **15.45** (15.45) | **14.36** (14.36) |
| secondary | **6.67** (6.67) | **8.24** (8.24) |
| tertiary | **4.93** (4.93) | **5.26** (5.26) |
| accent text | **7.96** (7.96) | **9.34** (9.34) |
| control border | **3.22** (3.22) | **3.79** (3.79) |
| every stage label on its fill | min **4.79** | min **5.88** |

### Motion, keyboard, network

- **`prefers-reduced-motion`: 0 of 370 elements still animate.**
- **Keyboard: 45 stops, 42 distinct, no trap; 0 stops without a visible focus ring.**
- **Nothing renders behind a network round-trip** — the table renders from local
  state, writes are optimistic with rollback, and the only non-optimistic action
  (hard delete) shows a spinner and disables its control.

### Two accessibility regressions the keyboard pass caught

1. **The status pill carried `transition-all`**, which animated the *focus ring's*
   width — so for the first frames after Tab the ring measured 0px. This also
   violated my own spec twice over (§3.1: the pill is the ~40×/session action and
   must not transition; and focus rings must never animate). Removed.
2. **Checkboxes lost their native focus ring** to the reset's `:focus{outline:none}`
   with nothing replacing it. Added a global `:focus-visible` floor so anything
   focusable gets a ring, not only elements someone remembered to tag `.tk-focus`.

### Suite results after the rebuild

**99/99** UI · **26/26** reversibility · **10/10** inviolable · **12/12** Phase 4 ·
**13/13** upgrade-path against a first-release schema · **0** CSP violations ·
**0** page errors.

---

# Refinement round 2

Seven changes. Sections R1–R7. `index.html` untouched; this is proposal +
preview only.

## R1 — Shadows: diagnosis, then fix

### Root cause

**Not the table.** `<tr>` renders `box-shadow` correctly and
`border-collapse` is already `separate`. Both elements resolve to the *same*
computed value and the first 8px of falloff are pixel-identical:

| px below edge | 0 | 2 | 4 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|
| funnel card | .7253 | .7644 | .8206 | .8510 | .8504 | .8586 |
| application row | .7253 | .7721 | .8206 | .8510 | .8504 | **cut** |

**Column alignment is not at risk.** *(This originally read "We keep the
table." It was right about the shadow and wrong about the table — see R1b,
which supersedes it. Column alignment is still not at risk; the reason is now
subgrid rather than `<table>`.)*

Two causes, on different rows:

- **A — interior rows.** `border-spacing: 0 8px` leaves 8px before the next
  row's opaque cells. The shadow needs **59px** to reach page ground, so 51px
  renders behind the next row. Measured across gaps 8/12/16/20/24: **visible
  falloff == gap, exactly**, every time. The gap is the sole limiter. The cut
  lands at luminance .8586 against a .9616 ground — a **0.103 step** — with the
  next row's border (.692) immediately under it. That abutment is the "clipped,
  not lifted" reading.
- **B — the last row.** The table sits in
  `<div class="hidden overflow-x-auto lg:block">`. Per spec, when one overflow
  axis is not `visible` the other computes to `auto`, so `overflow-x-auto`
  silently yields **`overflow-y: auto`**, which clips. Confirmed by fix:
  `padding-bottom` took the last row from **8px → 32px** of visible falloff.
- **C — every row's left and right edge.** *Found while building the preview,
  after the paragraph above was already written.* The same overflow rule clips
  **both** axes, not just the vertical one, and the table is exactly as wide as
  the wrapper's content box — so every row's side shadow was being cut flush at
  the table edge. Measured on a 30px strip level with a row's mid-height, page
  ground at 0.9829:

  | | falloff curve to the left of the row |
  |---|---|
  | reference card, unclipped | 0.983 … 0.940 0.925 0.912 **0.850** |
  | row inside the wrapper, `padding-bottom` only | 0.983 0.983 0.983 … **flat, no falloff at all** |
  | row inside the wrapper, padded on three sides | 0.983 … 0.940 0.928 **0.916** |

  Depth went **0.0000 → 0.1330**, which is the reference card's depth to four
  decimal places. `padding-bottom` alone would have shipped rows that still did
  not match the cards, and the difference is invisible in a screenshot of a
  single row — it only shows against the card, side by side.

Ruled out: divider painting over (no such rule), row overlap (gap is positive,
paint order is fine), shadow too small (it is too *large* for the room).

### The token

Already shared and already identical — nothing to unify. Verbatim, two layers:

```css
--shadow-rest: 0 2px 4px  oklch(26% .02 255 / .08),
               0 10px 24px oklch(26% .02 255 / .10);
```

### The fix, and the decision I made

| gap | falloff shown | residual step |
|---|---|---|
| 8px (today) | 56% | 0.1030 |
| 18px `--space-room` | 77% | 0.0532 |
| **28px `--space-loose`** | **~97%** | **~0.008** |

**Chosen: 28px.** You asked for the rows to be *identical* to the cards, and
18px does not deliver that — a 0.053 residual is still a visible termination.
28px is the next value on the committed 1.5-ratio space scale (18 × 1.5 ≈ 28),
so it needs no new token. It costs **+20px per row**, about **+16% total list
height** on a 25-row pipeline — the price of the deeper elevation you chose last
round, and defensible under §1.2, where refusing to fill the screen is itself
the costly signal.

Plus, for causes B and C, the scroll wrapper pads on three sides and is pulled
back out horizontally so the table's layout width is unchanged:

```css
.tk-scroll{
  overflow-x: auto;
  padding: var(--space-base) var(--space-loose) var(--space-loose);
  margin:  calc(var(--space-base) * -1) calc(var(--space-loose) * -1) 0;
}
```

28px of horizontal pull-back is affordable because the table only renders at
`lg`, where the shell already pays `lg:px-12` = 48px. The top needs only 8px:
the shadow's upward extent is 2px (10px offset against a 24px blur), and the
matching negative top margin keeps the table's position unchanged.

**Expanded rows read as one card, not two.** Two stacked shadows 1px apart is
the "shadow inside a shadow" failure C.6 forbids. Under R1b this needs no
mechanism at all: the drawer is a block *inside* the row element, so the pair is
one box by construction — one background, one radius, one ring, one shadow, and
no junction to conceal. The cell-level bridge this section previously specified,
and the three shadow copies that carried its hairlines, are deleted.

## R1b — Square corners: the row stops being a table row

### Symptom

Every application cell rendered with a square corner protruding past its curve,
at all four corners, with the shadow tracing the square rather than the curve.

### Root cause

**The radius and background were on a different element from the shadow.**
`border-radius` and `background` were on each `<td>`; `box-shadow` was on the
`<tr>`, which has no radius of its own. The cells drew a curve; the row cast a
square. Checked and excluded: `border-collapse` was already `separate`, there
was no nested background wrapper, and nothing was hardcoded `#fff` — the
protruding colour was `--surface`, which is why it read as white in light mode
and as a dark notch in dark.

This is the same fault as the earlier shadow defect only in the sense that both
came from the shadow living on the `<tr>`. The gap diagnosis in R1 stands
unchanged and every number in it re-measured identically after this rebuild.

### Why it could not be fixed in place

One element must own background, radius and shadow. Inside a table, none can.
Each of these was built and measured, not reasoned about:

| Element | Result |
|---|---|
| `<td>` | Clips its background to the radius correctly, but a per-cell shadow falls on the neighbouring cell and draws a vertical seam. Clipping each cell's shadow to its own column removes the overlap and leaves a hard vertical step in the shadow instead. Both visible. |
| `<tr>` | Applies the radius to its **shadow** but paints its **background** square. |
| `<tbody>` | Same — and it spans an expanded pair, which looked like the answer. Built, measured, abandoned. |

In the separated-borders model a radius on a row or a row group shapes what it
*casts*, not what it *fills*. The invariant is unsatisfiable in a table.

### The change, and what it costs

Rows are now grid rows. The container is a grid; each row is a grid item
spanning all columns with `grid-template-columns: subgrid`.

```css
.tk2{display:grid}
.tk2 > *{grid-column:1/-1;display:grid;grid-template-columns:subgrid}
.tk2-row{background:var(--surface);border-radius:var(--r-md);
         box-shadow:var(--shadow-rest), inset 0 0 0 1px var(--line)}
```

**Column alignment is preserved.** Subgrid sizes the tracks once, across all
rows at once — the same thing a table does. **Measured: 17 grids, 42 rows,
zero misaligned**, header and multi-line rows included.

The hairline becomes an inset ring rather than four cell borders, because a ring
follows a radius and four borders never did.

**What else this affects.** `index.html` is now converted too; this section
records what that took.

- **Semantics** are explicit: `role="table"` with `aria-colcount`,
  `role="columnheader"` on the eight headings, `role="row"` per row and
  `role="cell"` per cell. The card that wraps a row and its drawer is
  `role="presentation"`, so the rows stay the table's owned children while the
  card owns the paint. Verified: 0 orphaned rows, 8 cells on every row.
- **Keyboard navigation needed no change at all.** I said earlier it walks
  `td`/`tr`; it does not. `onGridKey` resolves cells through
  `data-r`/`data-c` attributes and `grid.current.querySelector`, which is
  structure-agnostic. Verified working after the conversion: arrows move
  0,0 → 0,1 → 1,1, and a cell open for editing still yields the arrows to the
  caret.
- **Column proportions barely move.** Old vs new cell widths at 1440px:
  `190 186 125 120 207 195 212 76` → `184 184 113 128 198 198 226 80`.
  Identical total (1311px); largest single change 14px.
- **Browser support.** Subgrid is Chrome 117+, Safari 16+, Firefox 71+. There is
  no fallback; on an older engine the columns would not align.
- **The drawer** stops being a `colspan` row and becomes a block inside the
  card, which is what removes the pair problem entirely.
- **Print** still works: `break-inside: avoid` moved to the row card, which is a
  block element, so it applies more reliably than it did on a `<tr>`.
- **Converted alongside the table:** the loading skeleton and the empty-state
  specimen, both of which were tables. They use the same grid with
  `min-width: 0` so they do not force a scroller.
- **Untouched:** the mobile card layout, which never used the table.

### Verified in `index.html`

Driven against the real app with a stubbed Supabase session — 15/15:

| | |
|---|---|
| No `<table>` elements remain | 0 |
| `role="table"`, 8 `columnheader`s, `aria-colcount=8` | pass |
| Every row owned by the table or a presentational card | 0 orphans |
| Every data row has exactly 8 cells | `[8,8,8,8,8]` |
| Subgrid alignment | 6 rows, **0 misaligned** — and 0 again under group-by |
| Arrow-key navigation | `c=0 → c=1 → r=1,c=1` |
| No square corner, first and last row, light **and** dark | 4/4 corners clean each |
| Expanded row and drawer are one card | one box, one shadow, radius 10px |
| Scroll wrapper pads and pulls back | `28px / 28px / -28px` |
| Page errors, load and after interaction | none |

Inviolable behaviours: **1–8 pass** via `design/verify-inviolable.js` (selectors
updated for the new markup). **9 and 10 cannot run in this sandbox** — they need
a signed-in session, and they stall identically on the *pre-conversion* build,
so it is an environment limit rather than a regression. Both were therefore
exercised directly against a stubbed session on both builds and compared:
*add clears the stage filter* (filtered 1 → 6 after add) and *soft delete
restores to position* — **identical outcomes old and new**.

No horizontal overflow at 1024 / 1280 / 1440 / 1920, and the grid stays hidden
at 390 where the card layout takes over.

### Verified in the preview

At 4× on all four corners of the first row, two adjacent rows, the hovered row,
the selected row, a multi-line row, the last row, the expanded pair, and the
mobile card collapsed and expanded — in light and dark, against the `.record`
`<div>` as a known-good control. The shadow follows the curve continuously with
no straight segment and no gap.

Everything R1 claimed still holds after the rebuild: visible falloff **9 / 19 /
29px** at gaps 8 / 18 / 28, and the row's side-shadow depth **0.1330**, which is
the reference card's depth to four decimals.

## R2 — Dropdowns: label vs value

**Primary lever: contrast (§2.3, "contrast as a compositional tool").** Label
at `--ink-3`, value at `--ink` — a measured **4.93 : 1 vs 15.45 : 1**, a 3.1×
step. That is the same mechanism already carrying rank everywhere else in the
app, so it adds no new vocabulary.

**Supporting lever: case.** Label stays uppercase micro; value becomes sentence
case. This does a second job — uppercase reads as machine-fixed chrome, sentence
case as the thing you chose. One primary, one supporting; the separator rule,
the weight change and the extra spacing are all declined as decoration.

**Label contrast: 4.93 : 1** — unchanged from the committed floor. The
hierarchy comes from raising the *value*, not from whispering the label.

**Width stability.** The value gets `min-width` in `ch`, sized to the longest
option for that control — Group by `8ch` ("Location"), Sort `14ch` ("Pipeline
order"), Filter `9ch` ("Any score") — and is left-aligned within it. The trigger
therefore never changes width when the value changes, so the toolbar cannot
shift under the cursor. At mobile width the triggers wrap as a group; the
`ch` minimums are small enough that none forces a horizontal scroll.

## R3 — The funnel

### R3a Threshold gating

**Threshold: 20 rows that have reached Applied or beyond** (`status !== "to-apply"`,
excluding deleted). Below it, no ratio is shown anywhere in the funnel.

**Locked is a real state, not a disabled one (§3.3, empty states as
onboarding).** Where each percentage would sit, the locked funnel shows
progress — *"14 of 20 applications"* — with a thin progress track. The counts
themselves stay, because they are honest at any n. The copy frames it as
arriving, not as missing: *"Rates unlock at 20 applications — they are noise
below that."* No greyed-out controls, no padlock, no "coming soon".

**On acknowledging the unlock — I argue for the quietest possible marker.**
A celebration would be unearned in the dossier's exact sense: §1.2's material
honesty (Rams 6) says do not promise what you cannot keep, and crossing an
arbitrary threshold is not an achievement. But silence is also wrong — the
funnel would change shape with no explanation. So: the first render past the
threshold shows one line, *"Reply rate unlocked — 20 applications tracked"*,
which does not animate, does not block, and does not return. Recorded in
`localStorage` (`tracker.unlockSeen`), which is a preference key, not data —
**no schema change**.

### R3b Interview → Offer ratio: deleted

Count kept, percentage gone. Agreed and for the reason given: there is no volume
at which it stabilises, so it displays precision the data does not have. §4.1's
eraser test applied to a number rather than an effect.

### R3c Reply rate is the primary metric

Applied → Replied gets the visual weight: `--t-2` figure, primary ink, on its
own line above the stage bars, with the denominator stated (*"9 of 41
applications"*) so the ratio is never floating. Every other rate is `--t--1`
secondary. §2.3 again — rank by contrast and size, not by decoration.

### R3d Median time-to-reply — computable, no schema change

**Confirmed against the data model.** `stage_history` already stores
`{to, at}` per transition and `firstReached(row, stage)` returns a timestamp, so

```
median over rows of ( firstReached(r,"replied") − firstReached(r,"applied") )
```

is derivable from existing rows. **No new column, no migration.**

Median rather than mean, because reply times are strongly right-skewed — one
reply after 60 days would drag a mean into uselessness. Sample size is printed
beside it, as the existing stage timings already do, and it is gated behind the
same 20-application threshold. Rows without both timestamps simply do not
contribute — the same rule the current means already follow.

## R4 — Rotating carets

**Current implementation is broken in two different ways**, which the audit
found: the row and funnel carets are a static `▶` that never changes (the
rotation rule was removed as subtraction S7), and the mobile card **swaps
`▲`/`▼`** — two glyphs, exactly the swap you said must go.

**Replacement: one inline SVG chevron, rotated.** A text glyph's ink is not
centred in its em box, so `transform-origin: center` wobbles — this is the
failure mode you flagged, and it is why the glyph goes. The SVG is drawn on a
symmetric `viewBox` with the chevron centred, so the box centre *is* the visual
centre and rotation is stable by construction.

- Collapsed `rotate(0)` → expanded `rotate(90deg)`. Transform only.
- **200ms in / 150ms out, `cubic-bezier(.22,1,.36,1)`** — taken from the
  committed motion table's drawer row, not invented. Justified against the
  table's own frequency rule: the detail drawer is ~5×/session and the funnel
  ~3×, which puts both on the animate side of §3.1's high-frequency cutoff,
  unlike the status pill at ~40× which stays instant.
- `prefers-reduced-motion`: direction still changes, instantly — the existing
  global rule collapses the duration and the `rotate` still applies.
- One rule, both places.

## R5 — Header: one primary action plus an overflow menu

Header becomes exactly two elements.

**Primary — "Add application".** Solid `--accent` fill, white label. The only
filled control on the screen, which is what makes it unambiguous (§1.2:
restraint is what gives the one emphasis its force).

**Overflow — a single `⋯` trigger**, `aria-label="More actions"`, no content
names on it. Contains Dark/Light, Share/Export, then a divider, then Sign out.

- **Sign out is separated** by a rule and takes `--danger-ink`, because it is
  destructive relative to its neighbours.
- **Keyboard:** Enter/Space open, ↑↓ move, Home/End jump, Escape closes and
  returns focus to the trigger, Tab closes. `role="menu"` / `menuitem`.
- **Outside click and Escape both close.**
- **Asymmetric timing (§3.1, Linear):** opens **instantly, 0ms** — it is
  summoned deliberately and an entrance reads as lag — and fades out over
  **150ms**, matching `--d-out`.
- **The theme item shows current state from inside**: "Dark mode ✓" / "Light
  mode ✓" with `aria-checked`, since the toggle is no longer visible at a glance.
- At mobile width the trigger is the same 44px target and the menu is
  right-anchored so it cannot overflow the viewport.

## R6 — Mobile: collapsible replies / next steps / notes

**Scope: the mobile layout branch only.** The desktop table renders
`DesktopRow`, which has no such section, so there is nothing to diverge — the
two cannot disagree because the collapsible does not exist on the desktop path.
That is the honest scoping answer: it is a layout branch, not a media query
applied to shared markup.

- **Collapses with content in it.** That is the requirement — a card with three
  filled paragraphs is the one most worth shrinking — so collapse is never
  disabled on the basis of having content.
- **Collapsed-with-content shows a count and a one-line preview**:
  *"3 fields · Automated acknowledgement received…"*. A dot says only
  "something"; a count says how much; the preview says what. On a phone the
  decision being made is "is it worth opening", and only the preview answers
  that. Truncated to one line with `text-overflow: ellipsis`.
- **Persists per row for the session.** Kept in a `Map` held by `Tracker` and
  keyed by row id, so scrolling a long list cannot silently reset it. Not
  localStorage — it is view state, not a preference, and should not outlive the
  session.
- **Same caret as R4**, same duration and easing.
- **Height animation:** `grid-template-rows: 0fr → 1fr`, the technique already
  declared as **Departure D4**. It is not GPU-composited, and the honest reason
  it is acceptable here is scope: one small subtree, user-initiated, ≤200ms, at
  most a handful on screen at once. The alternative — measuring and animating a
  pixel height — thrashes layout harder and needs JS on every resize.
- **A cell being edited cannot be collapsed mid-edit.** The toggle is disabled
  while the section contains the active editing element, with
  `title="Finish editing first"`, so the user cannot lose a caret or an
  uncommitted value.

## R7 — Strip the instructional text

Removed: the keyboard-hints footer and the descriptive lines beneath the
heading. **Kept: the LIVE / OFFLINE indicator** — state, not instruction, and
the one thing on screen that cannot be inferred.

### Affordance audit — every control that text was carrying

| Control | Self-evident? | Action |
|---|---|---|
| Status pill | Partly — it looks pressable but not that it *advances* | `title="Advance to Replied"`, naming the next stage; `aria-label` already dynamic |
| Editable cell | Yes — hover raises it and the caret appears | none |
| Checklist tick | Yes — native checkbox | none |
| Score cell + caret | Yes, once the caret rotates (R4) | `aria-expanded` already present |
| Chase count | **No** — "1 awaiting chase" does not say what a chase is | `title="Live applications untouched for 7+ days"` |
| Sync chip | **No** — LIVE is ambiguous alone | `title="Changes sync to your other devices"` |
| Stage rail chips | Yes — pressed state is visible | none |
| Dropdowns | Yes, more so after R2 | none |
| Overflow menu | Yes — `⋯` is conventional | `aria-label="More actions"` |
| **Keyboard grid** (arrows / Enter / Shift+Enter / ⌘Enter / Esc) | **No — genuinely undiscoverable** | see below |

**One genuine discoverability loss, named rather than hidden:** the keyboard
grid. Nothing on screen suggests arrow keys move between cells or that
Shift+Enter advances a stage. Per §3.3 the right home for first-run teaching is
the empty state, not persistent chrome — so **the keyboard model moves into the
empty state**, which already renders the real table geometry and is exactly
where someone is looking when they have not yet learned the tool. It is shown
once, to a new user, in the place they are already reading, and disappears the
moment they have a row. §1.1's expertise-reversal effect is the argument:
scaffolding that helps a novice becomes noise for the expert, and permanent
chrome makes everyone pay the novice's price forever.

## Preview — what it shows, and what was measured in it

`design/preview.html` now carries every state the brief asked for. Nothing in
`tracker-public/index.html` has been touched.

| Brief | Where |
|---|---|
| Funnel locked and unlocked | R3, side by side, plus the unlock marker |
| Dropdowns with long and short values | R2, both rows, plus the rejected "before" |
| Full row list — first, last, hovered, selected, multi-line | R1, one table at the chosen gap |
| Both caret states, on rows and on the funnel | R4 |
| Header with the menu open and closed | R5 |
| Mobile card collapsed-empty, collapsed-with-content, expanded | R6, plus expanded-mid-edit |
| Header after the instructional text is removed | R5, against the "before" |

Hover and keyboard selection cannot occur in a static file, so those two rows
have the state painted on by classes that exist only in the preview and are
labelled as such in the first column.

### Measured, not asserted

Every number below was read back from the rendered preview.

| Check | Result |
|---|---|
| Row gap renders as specified | 8 / 18 / 28px; visible falloff 9 / 19 / 29px — **falloff == gap**, reproduced independently of the diagnosis harness |
| Row side shadow vs reference card | depth **0.1330 both** — identical curve |
| Bridge between row and drawer | flat 1.000 across all 28px; hairline present at 0.850 |
| Dropdown trigger width, short vs long value | Group **184.39px both**, Sort **204.19px both**, Filter **170.95px both** — zero shift |
| Dropdown label vs value contrast | **4.93 : 1** vs **15.45 : 1** light; **5.26** vs **14.36** dark |
| Caret rotation origin | `6px 6px` on a 12×12 box — exactly the centre, so no wobble |
| Collapsible heights | closed **0px**, open **161.1 / 89.7px** — `0fr → 1fr` resolves |
| Container query on the card layout | all 7 record specimens render; the query fires |
| Contrast, 12 new surfaces × 2 themes | **24 / 24 pass**, lowest 4.93 : 1 against a 4.5 floor |
| Page overflow | none at 1440 / 1024 / 768 |
| Console / page errors | none |

Two things the preview does **not** claim to prove: the 200ms/150ms caret
timing (static file, no interaction) and the menu's keyboard model, both of
which are specified in R4 and R5 and belong to implementation.

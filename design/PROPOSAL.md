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

# Refinement round 3 — shipped in `index.html`

Round 2 (R1–R7) was proposal and preview only. This round implements the six
outstanding items in the live page and re-verifies everything.

## 0. The invariant, restated and held

**One element owns `background`, `border-radius` and `box-shadow`** — the
`.tk-rowcard` on desktop, the `.tk-card` on mobile — with the hairline as an
`inset` ring on that same element rather than borders on children. No ancestor
of a card may clip. Nothing in this round required breaking it; the collapsible
lives *inside* the mobile card, and the header restructure touches no wrapper
that a card sits in.

## 1. Dropdowns — label versus value

**Primary lever: contrast (§2.3, contrast as a compositional tool).** Label
`--ink-3`, value `--ink`. **Measured 4.93 : 1 for the label** on `--surface`,
which is the floor committed in round 2 and not a whisper below it — the
hierarchy comes from raising the value to 15.45 : 1, not from dimming the label.

**Supporting lever: case.** Label stays uppercase micro, value becomes sentence
case: uppercase reads as machine-fixed chrome, sentence case as the thing you
chose. Weight, separator and extra spacing are all declined — three more levers
would be decoration, not hierarchy.

**Width stability.** The value reserves `max(option.length) + "ch"`, *derived
from that control's own items* rather than hardcoded, so it cannot drift when an
option is added. Verified by changing every dropdown's value and re-measuring:
`Group by 162.84 → 162.84`, `Sort 202.89 → 202.89`, `Filter 148.2 → 148.2`.
Zero shift. The chevron is untouched.

## 2. Rotating carets

The row and funnel carets were a **static `▶` that never changed** — the app had
no rotation rule at all. Replaced by one `<Caret>` component used in all three
places (row, funnel, mobile disclosure).

- **One element rotating, not two glyphs.** An inline SVG, because a text
  glyph's ink is not centred in its em box and wobbles under rotation. This
  path's bounding box is centred on (6,6). **Measured `transform-origin:
  6px 6px` on a 12×12 box** — exactly the centre.
- **Transform only**; measured `transition-property: transform`.
- **200ms in / 150ms out**, which are the committed `--d-in` / `--d-out`, not
  new numbers. Justified against the motion table's own frequency rule:
  disclosure is low-frequency (drawer ~5×/session, funnel ~3×), unlike the
  status pill at ~40×/session which stays instant.
- `prefers-reduced-motion`: the existing global rule collapses the duration, and
  the rotation still applies, so **direction still changes, instantly**.
- Zero `▶` glyphs remain anywhere in the document.

## 3. Header — one primary action plus an overflow

Header is **exactly two elements** (measured: 2 children). "Add application"
takes a solid `--accent` fill and is the only filled control on screen — §1.2,
restraint is what gives the one emphasis its force. Everything else moves behind
a single `⋯`, `aria-label="More actions"`, which does **not** name its contents.

- **Sign out separated** by a rule and coloured `--danger-ink`.
- **Theme states current mode from inside** as a `menuitemradio` with
  `aria-checked`, since the toggle is no longer visible at a glance.
- **Asymmetric timing (§3.1):** opens **instantly** — it is summoned
  deliberately and an entrance on a summoned surface reads as lag — and fades
  out over `--d-out`.
- Keyboard verified end to end: arrows move into the menu (`activeElement` is a
  `menuitem`), **Escape closes and returns focus to the trigger**, Tab closes,
  outside click closes.
- `ThemeToggle` is deleted rather than left orphaned.

## 4. Mobile collapsible

**Scoped as a layout branch, not a media query.** `lg:hidden` renders
`MobileCard`; the desktop path renders `DesktopRow`, which has no such section.
The two cannot diverge because the collapsible does not exist on the desktop
path at all.

- **Collapses with content in it** — measured 156px open → 0px closed on a card
  with a filled field. Collapse is never disabled for having content.
- **Collapsed-with-content shows a count and a one-line preview** —
  *"1 field · Recruiter replied on the 14th…"*. A dot says only "something"; a
  count says how much; the preview says what, and on a phone the decision is
  "is this worth opening", which only the preview answers.
- **Persists per row for the session** in a `Map` held by `Tracker` and keyed by
  row id — verified still collapsed after scrolling the list and back. Not
  `localStorage`: view state, not a preference.
- **Height animates `grid-template-rows: 0fr → 1fr`** via the existing
  `.tk-collapse`, already declared as Departure D4. Not GPU-composited; the
  honest reason it is acceptable is scope — one small subtree, user-initiated,
  ≤200ms. Measuring a pixel height thrashes layout harder and needs JS on resize.
- **Cannot be collapsed mid-edit** — the toggle disables while the section holds
  a focused textarea, with `title="Finish editing first"`. Verified `disabled=true`.

## 5. The funnel

**5a. Threshold gating.** 20 rows that have **reached Applied**; rows still at
To apply do not count. Below it, **no ratio appears anywhere** — verified no `%`
in the document and no KPI element, while stage counts still render. In place of
the percentage, a progress track and *"14 of 20 applications"*. Locked is a real
state with its own content — no greyed-out controls, no padlock, no "coming
soon" (§3.3).

**On acknowledging the unlock, I argue for the quietest possible marker.** A
celebration would be unearned in the dossier's exact sense — §1.2 material
honesty, Rams 6: do not promise what you cannot keep, and crossing an arbitrary
threshold is not an achievement. But silence is also wrong, because the panel
changes shape with no explanation. So: one line, once, on the first render past
the threshold, which does not animate, does not block and does not return.
Recorded in `localStorage` under `tracker.unlockSeen` — a preference key, **not
a schema change**.

**5b. Interview → Offer ratio.** There was no percentage to delete: `step.share`
was computed and **never rendered**. Saying "removed" would have been false, so
what actually happened is that the dead computation was erased and the count
stays. The stated reasoning holds either way and is now the documented position.

**5c. Reply rate is primary.** `--t-2` figure, primary ink, above the stage bars,
with the denominator stated (*"9 of 26 applications"*) so the ratio never floats.

**5d. Median time-to-reply — added, no schema change.** `stage_history` and
`firstReached()` already exist, so the median of
`firstReached(r,"replied") − firstReached(r,"applied")` is computable from
current rows. Median rather than mean because reply times are strongly
right-skewed. Sample size printed beside it; gated behind the same threshold.

## 6. Instructional text stripped

Removed: the paragraph explaining stage advancement and chase, and the whole
keyboard-hints footer. **Kept the LIVE / OFFLINE chip** — state, not
instruction.

| Control | Self-evident alone? | Action taken |
|---|---|---|
| Status pill | Looked pressable, never said what pressing *did* | `title="Advance to <next stage>"`, following `advance()` rather than a hardcoded list |
| Chase count | **No** — "awaiting chase" named a rule only the paragraph explained | `title` carries the 7-day rule and the reset-on-edit behaviour |
| Sync chip | **No** — "Live" alone is ambiguous | `title` per state, naming sync explicitly |
| Editable cell | Yes — hover raises it, caret appears | none |
| Checklist tick | Yes — native checkbox | none |
| Score cell | Yes, now that the caret rotates | none |
| Overflow menu | Yes — `⋯` is conventional | `aria-label="More actions"` |
| Dropdowns | Yes, more so after item 1 | none |
| **Keyboard model** | **No — genuinely undiscoverable** | moved into the empty state |

**On the Share/Export collision the brief flags:** it loses its explanatory text
and moves into a menu on the same day, so it is the most exposed control. Its
`title` — *"Opens your browser's print dialogue — choose Save as PDF"* — moves
with it onto the menu item, so the one thing that was genuinely non-obvious
about it (that "Share/Export" means print-to-PDF) survives both changes.

**The one genuine discoverability loss, named rather than hidden:** the keyboard
model. Nothing on screen suggests arrow keys move between cells or that
Shift+Enter advances a stage. Per §3.3 first-run teaching belongs in the empty
state, so the key grid moves there — shown once, to someone who has not learned
the tool, in the place they are already reading, and gone the moment they have a
row. §1.1's expertise-reversal effect is the argument against permanent chrome:
scaffolding that helps a novice becomes noise for everyone else, forever.

## A trap worth recording

`min-w-[14rem]` on the new menu **silently did nothing**: there is no build
step, so the Tailwind subset in this file is hand-maintained, and an
arbitrary-value class that is not already present has no rule behind it. The
menu rendered ~110px wide with every item wrapped. Caught by looking at a
screenshot, not by any assertion. Now uses `min-w-[15rem]`, which exists.

## A pre-existing defect this round exposed

The shadow matrix flagged a hard step at the bottom edge of the **mobile card**,
in both themes. Diagnosed rather than assumed: the card list used
`space-y-4` = **18px**, unchanged between builds, so this was not a regression
from this round — it is R1's cause A surviving in the layout R1 never revisited,
because R1 only fixed the desktop table. R1's own table predicted it: 18px shows
77% of the falloff and leaves a 0.053 residual step. Fixed with a dedicated
`.tk-cardlist` at `--space-loose` (28px), matching the committed desktop
decision, rather than editing the shared `space-y-4` utility.

# Refinement round 4

## 0. The invariant, restated and held

**One element owns `background`, `border-radius` and `box-shadow`** — the
`.tk-rowcard` on desktop, the `.tk-card` on mobile — with the hairline as an
`inset` ring on that same element, and no clipping ancestor. Item 1 changes the
shadow itself and the spacing around it, but not where they are declared.
**16/16 states clean after the change.**

## 1. Row spacing

### Diagnosis, before touching anything

| | Before |
|---|---|
| Row gap | **28px** (`--space-loose`), measured 28px |
| Row height | **61px** → height : gap = **2.18 : 1** |
| `--shadow-rest` | `0 2px 4px /.08` + `0 10px 24px /.10`, **spread 0 on both layers** |
| Vertical reach | `max(2 + 4/2, 10 + 24/2)` = **22px** |
| Was the gap widened for the shadow? | **Yes.** R1 chose 28px precisely so the falloff was not cut. |

So shrinking the gap alone would have reintroduced the defect. The shadow is
the lever, as the brief says.

### The change

| | Before | After |
|---|---|---|
| `--shadow-rest` | `0 2px 4px /.08`, `0 10px 24px /.10` | `0 1px 2px /.07`, `0 3px 6px /.09` |
| `--shadow-raise` | `0 3px 6px /.10`, `0 14px 32px /.13` | `0 1px 2px /.09`, `0 4px 8px /.12` |
| Reach | 22px | **6px** |
| Row gap | 28px | **12px** (`--space-cosy`) |
| Height : gap | 2.18 : 1 | **5.08 : 1** |
| Clearance | 6px spare | 6px spare — the same margin, at a fifth of the distance |

**Why a smaller shadow is more honest here, not just smaller.** The row does not
float above the page; it sits on it, and the elevation is signalling *separation
between rows*. The 22px reach was inherited from the undo toast, which genuinely
does float. Applying §4.1's eraser test to the elevation rather than to an
element: what remains is the least shadow that still separates. Measured
residual at the end of the available room is **0.0039** — the falloff completes
before the next row begins.

**Grouped mode.** Intra-group **12px**, inter-group **28px** — measured
`intra [12,12]` vs `inter [28,28,28]`, a 2.3× difference. The grid's row-gap is
uniform, so the difference is carried by a `margin-top` on the group heading,
with the first heading exempt because it follows the column headers rather than
a group.

**Mobile** stays at **18px**. A ~200px card needs proportionally more separation
than a 61px row to read as a discrete object; 18px still clears the 6px reach
three times over. Measured residual 0.0039.

Stacking context was not the constraint — raw distance was, and the numbers
above are the whole story.

## 2. Dropdown typography — the premise did not hold

**Measured before changing anything: both parts were already the same family.**

| | Label | Value |
|---|---|---|
| Family | `Inter var` | `Inter var` |
| Size | 10.4px (`--t--2`) | 10.4px (`--t--2`) |
| Weight | 600 | 600 |

There was no family mismatch and nothing to move. What read as foreign was
**case**: the value was the only sentence-case text in a control row where the
stage chips, the column headers and the status pills are all uppercase micro.

**The brief's own reasoning resolves it.** These values are *system-defined
options, not user-authored content*, so by the convention already in use here —
uppercase for machine-fixed, sentence case for human-facing — the value belongs
on the machine-fixed side. It becomes uppercase, and the hierarchy moves off
case onto the two levers that remain:

- **Weight**: label `--w-regular` 400, value `--w-semibold` 600.
- **Colour**: label `--ink-3` **4.93 : 1**, value `--ink` **15.45 : 1**. The
  label is unchanged from the committed floor — the hierarchy comes from
  raising the value, not from dimming the label.

Size stays at `--t--2`, on the committed 1.2 scale. **Tracking on both is
`--tr-caps` = `.075em`** (0.78px at 10.4px), because uppercase at default
tracking reads as cramped. No third family enters; both are `--font-ui`.

**Width stability still holds** — measured across a value change:
`Group by 170.83 → 170.83`, `Sort 221.02 → 221.02`, `Filter 157.06 → 157.06`.
The `ch` reservation is scaled **1.15×** because uppercase is wider per
character than the `0` that defines `ch`.

## 3. Header

**3a.** The counts line is erased: the rows and the stage rail already state
them, so restating them is noise (§4.1). The sync chip is not a restatement, so
it moves rather than dying with the line around it — into the action zone,
immediately left of the primary button. It matters most at the moment it
changes, and that moment is right after an edit, so it belongs in the same
fixation zone as the controls just used (§2.1, proximity) as the quietest thing
in that zone rather than a fourth peer.

**One real loss, reported rather than absorbed.** `stale` — "N awaiting chase" —
was computed only as an aggregate and displayed only on that line. There is **no
per-row staleness indicator**, so unlike "tracked" and "live" this count was
*not* restated anywhere, and removing the line removes the signal. The brief
named it explicitly for removal so it is gone, but if you want it back the
honest home is a per-row marker rather than a header count, since the aggregate
never told you *which* row to chase.

**3b.** Both controls take their height from **one token**, `--control-h: 36px`,
rather than from padding — measured **36 vs 36** at both 1440px and 390px, with
centres aligned to **Δ0**. Radius is `--r-2` on both: with equal heights and no
nesting, the concentric rule degenerates to equality, the same correct
degenerate case as the capsule's stadium clamp (C.1). Equal height, not equal
weight — only the primary is filled.

## 4. Theme icons

Two rows, each stating a **state** rather than an action, as a radio group with
`aria-checked` — so the current theme is unambiguous from inside the menu now
that the toggle is not visible at a glance. "Light mode ✓" answers that; "Switch
to dark" would not.

- Inline SVG, `stroke="currentColor"`, so both follow the menu's text colour and
  need no second declaration for the other theme.
- **Sized to cap height**: a 1em box with the glyph drawn to ~0.72em, which is
  Inter's cap height, so it matches the capitals beside it rather than an
  arbitrary pixel value. Measured 10.39px at `--t--2`.
- **Optically aligned**: `top: .5px`. A circular sun centred by computation sits
  visibly high (§2.1, optical versus mathematical alignment).
- **Stroke 1.75 on both, identical to the caret** — verified by reading both
  attributes and comparing.
- `aria-hidden` on both; the label carries the meaning.

## Verification

**Items:** 13/13 on the four items; 32/32 on the round-3 suite; 15/15 on
structure and the corner fix.

**Shadow regression, 16/16 clean** — corners *and* bottom-edge falloff, on
first, adjacent, multi-line, last, hovered and selected/expanded rows plus the
mobile card collapsed and expanded, in light and dark.

**Two detector faults found and fixed rather than accepted as results.** The
bottom-edge probe sampled a fixed 24px window, which now exceeds the 12px gap,
so it was measuring the *next* card's edge and reporting a step; it is now
bounded by the real distance to whatever follows. And the expanded-row corner
probe ran with the pointer still parked on a card from the hover probe, so
`--hover` made the interior sample match the wedge — a false positive on all
four corners in light only. Both were confirmed by probing the same corner in
isolation before changing anything.

**Inviolable behaviours: all ten pass** — 1–8 via `design/verify-inviolable.js`,
9 and 10 driven against a stubbed session.

**Four assertions in the harness encoded the previous design** and were updated
to the current one rather than left to fail silently: shared case on the
dropdowns, three elements in the header action zone, four items in the menu, and
a 12px scroll-wrapper pad.

# Recently deleted — bulk restore and bulk purge

Reported from use: deleting five applications meant clearing them one at a
time. Emptying a bin one row at a time is the wrong shape for a bin — the whole
point of the panel is that it holds a batch you have already decided about.

**Two controls in the panel header:** *Restore all N* and *Delete all for good*.

- **One request, not N.** Both use `.in("id", ids)` — a single `PATCH` and a
  single `DELETE`, verified by intercepting the network. Beyond being faster,
  it means a partial failure cannot leave the list half-processed.
- **Restore all is optimistic, delete all is not.** The same test the dossier
  applies everywhere else (§1.3, and §Recommendations Stage 2): restoring is
  reversible and high-success, so it applies immediately with a rollback if the
  write fails; purging is irreversible, so the rows stay on screen, disabled,
  until the database confirms they are gone.
- **Restore all offers an undo** that re-deletes the same ids, with its own
  rollback — matching `removeRow`, which already treats an undo as putting the
  row back as it was rather than as a fresh edit.
- **Delete all confirms with the count**, because "delete everything" is a
  different decision at 2 rows than at 40.
- **Shown only past one row.** With a single item they would duplicate the
  buttons directly beneath them, and a control that repeats its neighbour is
  what §4.1's eraser test removes.
- Per-row buttons are disabled while a bulk action is in flight, so the two
  paths cannot race.

**Verified 11/11** by driving the reported scenario: delete five → bulk restore
(one PATCH, all five back) → undo (all five back in the bin) → bulk purge (one
DELETE, bin empty) → confirm the controls disappear at one row. No page errors.

---

# Multi-page support — proposal

Step 1 only. No code written; `index.html` is untouched.

Several independent collections of applications within one account, switchable
like sheets in a spreadsheet.

---

## 0. Is this the right design at all?

Two things worth arguing before any of it gets built.

### 0.1 A table, or just a column?

A page is an exclusive saved filter, and the app already has grouping. So the
cheap design is a single `page text not null default 'Applications'` column on
`applications`, switched through the existing `groupBy` machinery. No table, no
foreign key, no RLS policy, no bootstrap problem, and the migration reduces to
one `add column if not exists` inside the mechanism that already exists.

That is genuinely tempting and I looked hard at it. It fails on one
requirement, and the brief states that requirement itself:

**You cannot create an empty page.** A page that is only a value in a column
comes into existence when a row carries it and vanishes when the last row
stops. There is no "new page" to land on, so there is no empty state to design,
and deleting the last application on a page silently deletes the page. The
brief asks for a new page's empty state as an onboarding surface — that alone
settles it.

Two lesser failures confirm it: renaming a page becomes an `update` across
every row that carries the old value, which splits a page in half if it fails
partway; and page order has nowhere to live, so ordering could only ever be
alphabetical.

**A table is justified, not assumed.**

### 0.2 The real cost of this feature is analytical, not structural

The schema barely moves. What pages actually cost you is that they fragment
every number the app computes. That is not a side effect to be managed — it is
the point of the feature (internship and graduate conversion rates are
different numbers and mixing them destroys both), and it is also the thing that
will make the app feel worse if handled carelessly. §4.1 below is the whole
answer and it is the part of this proposal I would most want you to push on.

Everything else here I hold loosely. That part I have thought hardest about.

---

## 1. The deployment problem

Every user loads one hosted page against their own database. A push reaches
everybody in seconds; their schema does not change. So new code meets an old
schema, for every existing user, at once.

### 1.1 Detection — reuse, do not invent

The app already solves this, at `index.html:954-971` and `:3675-3742`. Columns
are named explicitly in `SELECT_COLUMNS` rather than `select *`, **so asking
for them is itself the schema check**; `isMissingColumn` recognises Postgres
`42703` and PostgREST `PGRST204`; the loader sets `needsMigration` and then
**re-fetches with `select("*")`** so the reader still sees every application
they own; `MigrationNotice` (`:3128`) shows the SQL with a copy button.

The whole of multi-page detection is one string:

```js
const SELECT_COLUMNS = [ …twenty-one existing columns…, "page_id" ].join(", ")
```

An unmigrated database now fails that probe on `page_id`, exactly as a
pre-scoring database fails it on `benefits_score`. No new detector, no new
error code, no second notice, no new UI. `MIGRATION_SQL` grows a section.

### 1.2 Why the detection cannot itself error

This is the part worth being careful about, because the obvious implementation
breaks it.

`tracker_pages` does not exist on an unmigrated database. Querying it raises
`42P01` / `PGRST205`, which `isMissingColumn` does **not** recognise — it would
fall through to `report()` and surface a raw Postgres error, which is precisely
the outcome the brief forbids.

So the ordering is a hard rule, not a preference:

> **Nothing queries `tracker_pages` until the `page_id` probe has come back
> clean.**

Sequentially, on load:

1. `select(SELECT_COLUMNS)` — includes `page_id`. This is the probe.
2. `isMissingColumn(error)` → `setNeedsMigration(true)`, re-fetch with `*`,
   set `multiPage = false`, **return without touching `tracker_pages`**.
3. Clean → `page_id` exists → the pages query is now safe to run.

These cannot race: step 3 is in the same `await` chain as step 1. There is no
parallel fetch, no `Promise.all`, and no realtime subscription to
`tracker_pages` created before step 3 succeeds.

**Secondary guard.** A half-run migration could leave `page_id` present and
`tracker_pages` absent. That is not reachable through the notice — the SQL is
one script — but a hand-edited database could get there. So add
`isMissingTable` (`42P01`, `PGRST205`, `/relation .* does not exist/i`) and, on
that error only, fall back to single-page mode and raise the migration notice.
Degrade, never throw.

**Detection cost: zero extra requests.** `page_id` rides along on the query
that already runs.

### 1.3 Fully usable, not degraded

Unmigrated, the app runs exactly as it does today:

| Surface | Unmigrated behaviour |
|---|---|
| Rows | All of them, via the existing `select("*")` fallback |
| Page switcher | Not rendered at all |
| Overflow menu | No "New page" item |
| Funnel, stage rail, view bar | Unchanged — they read `rows`, which is every row |
| Recently deleted | Unchanged |
| Add application | Unchanged; no `page_id` in the insert |
| Realtime | Unchanged, single `applications` channel |
| Migration notice | The one existing notice, dismissible |

The single boolean `multiPage` gates every new surface. With it false the
feature is not present, rather than present-and-disabled. **Someone who never
migrates sees one dismissible notice and nothing else.**

### 1.4 The migration

Idempotent, additive, never destructive. `create table if not exists`,
`add column if not exists`, and two backfills guarded by `where not exists` /
`where page_id is null`.

```sql
create table if not exists public.tracker_pages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users(id) on delete cascade,
  name       text not null default 'Applications',
  sort_order bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tracker_pages_user_idx
  on public.tracker_pages (user_id, sort_order);

alter table public.tracker_pages enable row level security;

drop policy if exists "owner full access pages" on public.tracker_pages;
create policy "owner full access pages"
  on public.tracker_pages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.tracker_pages to authenticated;

-- Nullable on purpose: see 2.3.
alter table public.applications
  add column if not exists page_id uuid
    references public.tracker_pages(id) on delete set null;

create index if not exists applications_page_idx
  on public.applications (user_id, page_id, sort_order);

-- One default page per account that has applications and no page yet.
insert into public.tracker_pages (user_id, name, sort_order)
select distinct a.user_id, 'Applications', 0
  from public.applications a
 where not exists (
   select 1 from public.tracker_pages p where p.user_id = a.user_id
 );

-- Nothing becomes invisible.
update public.applications a
   set page_id = (
     select p.id from public.tracker_pages p
      where p.user_id = a.user_id
      order by p.sort_order, p.created_at
      limit 1
   )
 where a.page_id is null;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'tracker_pages'
  ) then
    alter publication supabase_realtime add table public.tracker_pages;
  end if;
end $$;
```

Shipped as `supabase/migrations/003-pages.sql`, and appended to
`MIGRATION_SQL` and `setup.sql`. Deliberately **not** folded into `002`: that
migration is the Edge Function feature, which almost nobody runs, and pages
must not inherit its irrelevance.

### 1.5 The default page is called "Applications"

Considered and rejected: `Default` and `Untitled` read as placeholder text a
one-page user is left staring at; `2026` presumes a taxonomy and is wrong for
anyone who started last year; `Main` and `General` are filing-cabinet words for
something that holds one specific thing.

`Applications` is what the collection actually is, so a one-page user reading
the label — on the rare occasion they see it — reads a true statement.

**The honest weakness:** the moment you create `Internships`, the first page
still reading `Applications` is imprecise, because internships are applications
too. The mitigation is that creating a second page is exactly the moment
renaming the first becomes worth offering, and the switcher should surface it
inline at that moment. Cheap, and it turns the weakness into the prompt.

### 1.6 Migrate on the laptop, then open the phone

**Confirmed, and it needs no special handling.** Same code, migrated database:
the phone's probe includes `page_id`, succeeds, so the pages query runs and
multi-page mode turns on by itself. Nothing is stored client-side that gates
the feature.

The one wrinkle is the *active* page. The phone's `localStorage` has no
`tracker.page` yet, so the lookup misses. §4.7 makes that a fallback to the
first page, never a blank screen.

Reverse direction — phone unmigrated, laptop migrated — cannot happen: it is
one database.

---

## 2. Schema

### 2.1 Named `tracker_pages`, called "pages" in the interface

`boards` imports a kanban model this app does not have — the pipeline is a
table with a stage column, not columns of cards. `lists` collides with ordinary
UI copy ("the list of applications") and with the trash panel.

`pages` matches your own framing and the spreadsheet-sheet metaphor.

Prefixed to `tracker_pages` for two reasons: it matches `tracker_settings`,
the convention already established for tables this app added after the first
release; and `pages` is a generic enough name to squat on in a database the
user owns and may use for something else.

### 2.2 Ownership, ordering, renaming

- `user_id` with `default auth.uid()` and `on delete cascade` — the same shape
  as `applications` (`setup.sql:24`), so inviolable #1 covers the new table by
  construction.
- `sort_order bigint` — same type and role as on `applications`. Reordering is
  a write of two integers.
- `created_at timestamptz` — the stable tiebreak when two pages share a
  `sort_order`, which a botched reorder can produce.
- **Renaming is `update tracker_pages set name = … where id = …`.** One row,
  one field. This is the clearest advantage of a table over a text column,
  where a rename is a multi-row update that can split a page if it fails
  partway.

No `deleted` column. Pages are not soft-deleted, because deleting one destroys
nothing (§2.4) — a trash can for an action that loses no data is ceremony.

### 2.3 `page_id` is nullable, and that is the safety mechanism

```sql
page_id uuid references public.tracker_pages(id) on delete set null
```

`not null` is the instinct and it is wrong here. Nullable buys three things:

1. **The migration cannot fail.** Adding a nullable column to a live table is
   metadata-only. `not null` would need a default or a backfill inside the same
   statement, on a table holding the user's real data.
2. **`on delete set null` is a database-enforced floor.** Whatever happens to
   the application-level move in §2.4 — a crash, a lost connection, a client on
   an old build — Postgres guarantees a deleted page leaves its rows *pointing
   nowhere*, not pointing at something wrong.
3. **A null is renderable.** The client rule is: **a row with `page_id is null`
   appears on the first page.** So there is no state in which an application
   exists and is invisible. That is the property that actually matters, and it
   holds without any trigger, constraint or repair job.

### 2.4 Deleting a page moves its applications; the last page cannot be deleted

The three options, and why the third wins.

**Cascade — rejected outright.** One click destroying an unbounded amount of
the user's work, in an app whose entire delete story is a soft-delete bin with
an undo. It contradicts the grammar of everything around it.

**Refuse to delete a non-empty page — rejected.** It is safe and it is
useless: emptying a 30-row page one row at a time to be allowed to delete it is
worse than the problem. It also has no coherent answer for trashed rows — is a
page holding only deleted rows empty or not? Every answer to that is arbitrary.

**Move to the first remaining page — chosen.**

```
Deleting page X moves every application on X — live and trashed alike —
to the lowest-sort_order remaining page. The last page cannot be deleted.
```

Why it is the safest reasonable option: **no application is ever destroyed,
hidden, or made unreachable.** The only thing lost is the grouping, which is
the metadata the user just asked to discard. The result is fully visible and
fully editable the instant the action completes.

Why "first remaining" rather than "a default page": it needs no `is_default`
flag, no protected row, and it is total — there is always a lowest
`sort_order` among the survivors. Blocking deletion of the last page is then
the only special case, and it is one the user can see and understand.

Order of operations, and what each layer is for:

1. `update applications set page_id = <survivor> where page_id = <doomed>` —
   makes the outcome *predictable*.
2. `delete from tracker_pages where id = <doomed>` — the actual deletion.
3. If step 1 never ran, `on delete set null` plus the null-renders-on-first-
   page rule makes the outcome *safe*.

Step 3 is why step 1 does not need a transaction.

### 2.5 RLS

Matched to the existing `FOR ALL` pattern, which exists specifically so an
insert cannot succeed while the read-back silently returns nothing — the
failure inviolable #2 was written to catch:

```sql
create policy "owner full access pages"
  on public.tracker_pages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`for all` covers select, insert, update and delete with one `using` and one
`with check`. A `for insert`-only policy would let page creation appear to
succeed and then vanish, which is the bug the app already has a dedicated error
message for (`index.html:3903-3907`). The page-create path gets the same
`insert().select()` empty-array check and the same message.

### 2.6 No database default for `page_id`, and no trigger

The brief asks whether `page_id` wants a default the way `user_id` has
`auth.uid()`.

**It cannot have one.** `auth.uid()` works because the database knows who is
connected. Nothing in the database knows which page the user is *looking at*,
and a Postgres column default may not contain a subquery, so
`default (select id from tracker_pages …)` is not expressible. The nearest
equivalent is a `before insert` trigger on `applications` filling a null
`page_id` with the user's first page.

**Recommended against**, on grounds of proportionality:

- The null-renders-on-first-page rule (§2.3) already delivers the identical
  user-visible outcome — a client that forgets `page_id` produces a row on the
  first page — with no trigger.
- The rule additionally covers a case the trigger cannot: a row whose page was
  deleted *after* insert.
- A trigger is a write-path intervention on the live `applications` table,
  firing on every insert forever, to protect against a bug in a client we
  control and can test.

The client sets `page_id` on insert. The null rule is the floor. That is
enough.

### 2.7 Every account gets a page — where, and what if it fails

**Migration** creates it for existing accounts and backfills every row (§1.4).

**App code** creates it for everyone else. After the probe comes back clean,
the app reads `tracker_pages`; if the result is empty it inserts one named
`Applications`. Idempotent, and it covers new signups, an account created
before the migration ran, and a migration whose insert matched nothing because
the account had no applications yet.

**A trigger on `auth.users` is not recommended**, despite `002` using one for
`tracker_settings`. It is the most fragile of the three: it requires elevated
privileges, it silently does not exist for anyone who has not run the
migration — which is every new signup on an unmigrated project, exactly the
case it is supposed to cover — and it cannot be retried. The app-code path
subsumes it completely.

**If page creation fails:** `pages` is empty, `multiPage` stays false, and the
app renders every row on an unlabelled single page. The failure surfaces
through the existing `report()` path. **It cannot blank the screen**, because
the row query and the page query are independent and the rows have already
loaded.

---

## 3. Realtime, and why switching is free

Current subscription (`index.html:3745-3767`): one channel, `event: "*"`,
`table: "applications"`, no filter. RLS scopes it to the user. Every change
merges into `all`.

**Recommendation: change nothing about it.**

The page filter belongs at the derivation step, one line below where the
delete filter already is (`:4028`):

```js
const rows = all.filter((r) => !r.deleted && onActivePage(r));
```

This satisfies both halves of the requirement at once:

- **Other pages' rows never enter the current view** — they are in `all`, and
  `all` is not what renders.
- **A page you are not looking at still updates** — the merge into `all` is
  unconditional, so when you switch, the data is already current. No refetch,
  no stale window.

And it answers the latency budget as a side effect: see §5.2.

**A second subscription, on `tracker_pages`**, so a rename or a new page made
on the laptop appears on the phone. Created **only when `multiPage` is true**,
which per §1.2 means only after the probe proved the table exists. On an
unmigrated database it is never created, so it cannot error.

Cost of holding every page's rows in memory: this is a personal job tracker.
Tens of rows, low hundreds at the far end. The initial query is already
unfiltered and already returns all of them.

---

## 4. Everything else this touches

### 4.1 The funnel threshold — the decision that matters

`RATE_THRESHOLD = 20`, gating `replyStats` on `reachedApplied(rows)`
(`index.html:1103`, `:1134`). Split 25 applications across two pages and both
sides fall under the gate. **The user loses a number by organising their work.**
That is a regression caused by using the product correctly, and it is not
acceptable.

The three options as posed are: count across all pages, count per page, or let
the user choose. I think **the option list is missing the answer**, and this is
the one place I want to push back on the framing rather than pick.

**Counting globally and displaying per page is not safe.** The gate is not
arbitrary — the code says why it exists: *"Ratios on single-digit counts are
noise, so nothing derived shows below a threshold"* (`:1100-1102`). It is a
**sample-size** guarantee for the number on screen. Unlocking on a global count
of 25 and then rendering a rate computed from the 12 on this page shows exactly
the noisy figure the gate was built to suppress. It fixes the complaint by
breaking the thing being complained about.

**Counting per page** keeps the guarantee and keeps the regression.

**Letting the user choose** is a settings toggle about a statistical subtlety
the user should never have to hold in working memory — textbook extraneous
load (§1.1), and a preference that then needs storing, explaining and
migrating.

**Recommendation: gate globally, compute on the largest population that clears
the gate, and say which population it is.**

```
reply rate is unlocked when applications across ALL pages ≥ 20

the number shown is computed from:
  this page      if this page alone has ≥ 20
  all pages      otherwise
and the line names which
```

- Organising never removes a number you already had — the global count only
  grows when you split.
- Every rate displayed is still computed on ≥ 20. The guarantee is intact.
- The label carries the difference: *"Reply rate · 31% · across all pages"*
  versus *"Reply rate · 28% · on this page"*. Rams 6 and §1.2 material honesty
  — the number states its own population instead of implying a scope it does
  not have.
- It self-resolves. A page that grows past 20 starts reporting itself, with no
  setting and no announcement.

The existing one-time unlock marker (`:2821-2831`) fires on the global
transition, once, as it does now.

### 4.2 The funnel itself — per page

Stage occupancy has no threshold, so it carries no sample-size risk, and your
argument is the right one: internship and graduate conversion are different
numbers and averaging them destroys both. The collapsed summary line
(*"N live in the funnel · applied 4 · interview 2"*) is per page too, or it
contradicts the panel it summarises.

The inter-stage means already print their own `sampled` count next to them
(`:1166-1167`), so they are self-labelling about sample size and are safe to
narrow.

**Per page, with the single exception of the reply rate in §4.1.**

### 4.3 Stage rail — per page. Confirmed.

It is a filter control over the rows on screen. Counting rows you cannot see
and then filtering to nothing would be incoherent. It reads `rows`, which is
already page-scoped by §3.

### 4.4 Group, sort, filter — per page in effect, not remembered per page

They operate on the current page's rows automatically, since they read `rows`.

**They should not be remembered per page.** Switching pages would then silently
change your sort order and active filters — a hidden state change on the
highest-frequency interaction in the feature, which is the "where am I"
re-orientation tax §1.1 identifies as the deep cost of context switching. View
controls should mean the same thing everywhere they are visible.

So the view carries across the switch, and the existing machinery already
handles the consequences: a `groupValue` that does not exist on the new page
falls back to showing every group (`:4054-4063`, already built), and a filter
that hides everything produces the existing self-explaining empty state, which
already names the active filters and offers one-click reset (`:4072`).

### 4.5 Inbound email — no change needed. Confirmed.

`inbound-email/index.ts:143-147` selects
`id, company, role_title, status, replies, contact_email, activity,
stage_history` filtered on `user_id` and `deleted` only. It never mentions
`page_id`, so it already searches every page, and a reply files against
whichever application matches wherever it sits. The update at `:182-186` keys
on `id` and `user_id`. Adding a nullable column changes neither.

`service_role` needs no grant on `tracker_pages`, because the function never
reads it.

**One behavioural note, not a defect:** `pickApplication` returns nothing when
two rows tie on score (`_shared/inbound.ts:189`). Two pages each holding a
"Northwind" makes that marginally likelier. The behaviour is unchanged and
correct — refusing to guess is the design — and the existing fix still applies:
set `contact_email` on one of them.

### 4.6 Weekly digest — one email, and no change this release

One email covering everything is right: the digest answers "what has gone
quiet", and that is a single actionable list regardless of which page a row
sits on. Splitting it into one email per page would make a weekly nudge into
weekly nagging.

**On grouping: recommend shipping no digest change at all.** Grouping the
stale list under page headings means the function must read `tracker_pages`,
which gives a function that runs unattended — on a schedule, with its response
body discarded by `pg_cron` — a hard dependency on a table that does not exist
on most users' databases. That is a new silent failure mode bought for a
cosmetic gain.

The digest keeps working, untouched, whether or not the user has migrated.
Group it later if the flat list turns out to be the wrong shape in practice.

### 4.7 Active page persistence

`localStorage`, key `tracker.page`, matching the existing key convention
(`tracker.theme`, `tracker.funnel`, `tracker.examplesDismissed`). It stores a
page UUID, which carries no personal identifier — inviolable #7 holds, and the
bar is set by `tracker.config`, which already stores the project URL and key.

Resolution, in order, with two fallbacks so a blank screen is unreachable:

```js
activePage =
     pages.find(p => p.id === stored)   // normal
  ?? pages[0]                           // stored page deleted elsewhere
  ?? null                               // no pages at all → single-page mode
```

A stored page deleted on another device resolves to the first page, and the
stored key is rewritten to match so it self-heals. `null` renders every row
unfiltered, which is the unmigrated behaviour — correct, not broken.

### 4.8 Soft delete — per page

The Recently deleted panel shows the **current page's** trashed rows.

The deciding argument is the bulk actions built last round. "Delete all
permanently" must destroy exactly what is listed above it. A global bin sitting
at the bottom of one page, whose purge silently takes another page's rows with
it, is the kind of surprise that bins exist to prevent.

**Restoring returns a row to its original page automatically** — soft delete
writes `deleted`, never `page_id`, so the association survives untouched.

**If that page no longer exists:** it cannot, through the app — page deletion
moves trashed rows along with live ones (§2.4). Through a hand-edited database,
`on delete set null` leaves `page_id` null and the row restores onto the first
page. Visible either way.

### 4.9 Add application — lands on the current page. Confirmed.

`addRow` (`:3877`) gains `page_id: activePage?.id ?? null` and nothing else.

**Inviolable #9 holds by construction:** the three filter-clearing lines
(`setFilter(null); setGroupValue(null); setMinScore("")` at `:3899-3901`) are
untouched, and the new row is on the active page, so it is visible after the
clear. To be explicit about the thing that would break it — **adding a row must
not switch pages**, and nothing in the change does.

`sort_order` stays a global max (`:3878`). A new row on page B taking a number
above everything on page A is harmless: ordering is only ever compared within a
page.

### 4.10 Export / share — current page

`window.print()` prints the DOM, so today it prints what is on screen, already
filtered and grouped, and the print header names those narrowings
(`:4226-4231`). Pages join that sentence:

```
Pipeline export · 5 Aug 2026 · 12 of 12 applications · page: Internships
```

All-pages export would mean rendering pages you are not looking at into the DOM
for print only, which breaks the "print what you see" grammar the feature
already has and would surprise anyone who filtered first.

---

## 5. Interface

`docs/design-dossier.md` governs; sections cited inline.

### 5.1 It does not animate

**§3.1, "When NOT to animate":** *high-frequency, low-novelty interactions
(command menus opened hundreds of times a day, macOS right-click menus, the
Cmd-Tab switcher) should often appear without animation — after the hundredth
viewing, a fade becomes a tax on perceived speed.* Freiberg found his own tool
felt **faster** after removing motion from core keyboard interactions. Key
Finding 5 states the same rule at the top of the document.

Page switching is the canonical instance: high frequency, zero novelty, and
entirely about arriving somewhere rather than about the journey. Content swaps
in one frame.

The active indicator does not slide either. A 150-200ms travelling underline is
a delay imposed on every switch, forever, to show the user something they
already know — which tab they just clicked.

**The counter-argument, taken seriously and rejected:** §3.3 shared-element
transitions preserve object permanence and cut re-orientation cost. That
applies when an object *becomes* a different view of itself — a thumbnail
zooming into its detail. Switching pages replaces one set of objects with a
different set. There is no shared element, so there is nothing for the
transition to be honest about, and animating it would assert a continuity that
does not exist.

Motion is used in exactly one place in this feature: nowhere.

### 5.2 Latency budget: one frame, and nothing to prefetch

**Budget: < 16ms.** Not the 100ms instant tier (§3.2) and not the 400ms
Doherty threshold — one frame.

That is not ambition, it is arithmetic. §3 loads every page's rows in the
query that already runs, and holds them in `all`. Switching pages sets one
piece of React state and re-runs a `filter`. **There is no network request on
switch, so there is nothing to prefetch, cache or make optimistic.**

This is why §3 keeps the subscription user-scoped rather than filtering it per
page: a page-filtered subscription would need tearing down and re-establishing
on every switch, which converts a free operation into a round trip and a
visible loading state. The naive optimisation is the thing that would make it
slow.

Measurement after build: switch between two pages of ~50 rows and record the
React commit duration. It must not exceed one frame at 60Hz.

### 5.3 Placement — existing empty space, no new vertical band

The constraint is threefold: do not compete with "Add application" for primary
status; do not push the rows down; do not add extraneous load (§1.1).

The header today (`:4150-4223`) is `flex justify-between items-end`, with a
lone `<h1>JobApp</h1>` on the left and `SyncChip · Add application ·
OverflowMenu` on the right. **The left block is one short word and a large
amount of empty space, and the header's height is already set by the 36px
controls on the right.**

The switcher goes there, under the wordmark, inside the existing header box:

```
┌──────────────────────────────────────────────────────────────┐
│  JobApp │ Applications  Internships  2027  +   ● live  [+ Add…]  [⋯]  │
└──────────────────────────────────────────────────────────────┘
```

**Corrected after measuring.** My first draft of this section stacked the strip
on a second line under the wordmark and asserted it added no height. Built and
measured, that grew the header from **56.2px to 90.3px — +34.1px**, which
pushes every row down and breaks the brief's requirement outright.

So the strip shares **one baseline row** with the wordmark, separated by a
hairline divider. Measured in `design/preview.html`, at 1024 / 1100 / 1280 /
1440px, with three pages: **56.2px with the strip, 56.2px without it, at every
width.** No horizontal overflow at any of them.

The lesson is worth recording because it nearly shipped as prose: *"it fits in
the space already there"* was a plausible-sounding claim about a layout I had
not rendered. It was wrong by 34 pixels.
- **No competition for primary status.** "Add application" is the only filled
  control in the interface. Tabs are text with a 2px underline on the active
  one — quieter than the sync chip. §1.2: restraint is what gives the single
  emphasis its force, so adding a second filled control would weaken the
  primary action rather than just sitting beside it.
- **Rows do not move.** Everything below the header is untouched.

### 5.4 One page shows nothing at all

Not a greyed-out strip, not a single tab, not a "1 page" chip. **Nothing.**

§1.1, the expertise-reversal effect: *the same scaffolding that reduces
extraneous load for a novice becomes extraneous load itself for an expert.* A
tab strip with one tab is a permanent piece of chrome explaining a feature the
user is not using.

Discovery lives in the overflow menu — **"New page"** — alongside Share/Export
and the theme controls, which is already the home for low-frequency
configuration. Create a second page and the strip appears, with both tabs. That
is the moment the affordance becomes useful and the moment it arrives.

### 5.5 Create, rename, reorder, delete

**Create** — overflow menu → "New page" → an inline text input appears at the
end of the strip, focused, committing on Enter and cancelling on Escape. **Not
a modal:** §1.1 names every modal as a forced working-memory reload, and naming
a page is not worth one.

**Rename** — click the active tab a second time, or "Rename" in the tab's own
menu, turning it into the same inline input. This matches the app's existing
grammar, which the empty state states outright: *"Every cell is editable —
click one and type."*

**Reorder** — "Move left" / "Move right" in the tab's menu. **Not drag.**
Honest about the trade: drag is the nicer gesture and it is what a spreadsheet
does. It is also expensive to build well, hostile on touch, and needs its own
keyboard equivalent regardless. Two menu items are the whole feature for a
handful of pages. If pages routinely reach eight or more, revisit.

**Delete** — the destructive path, and it gets the care "delete for good" gets,
with one difference that the copy must be honest about: **nothing is destroyed**
(§2.4). So the confirmation states the actual consequence rather than
performing danger:

```
Delete "Internships"?

Its 14 applications move to "Applications". Nothing is deleted —
they keep their stage, notes, scores and history.

               [ Cancel ]  [ Delete page ]
```

The count is real, read from the rows in hand. A page with no applications says
so and is a one-line confirmation. The last remaining page cannot be deleted:
the menu item is disabled and says why — *"This is your only page"* — rather
than being absent, so the rule is learnable instead of mysterious.

Rams 6 and §1.2: a dialogue that shouts about danger it cannot deliver teaches
the user to click through dialogues.

### 5.6 A new page's empty state

§3.3: *the first-run empty state is the single best onboarding surface* — and a
new page is a second chance at it. But the same section's neighbour, §1.1's
expertise-reversal effect, says re-teaching an expert is a tax.

So **two states, chosen on total rows across all pages, not on this page's**:

- **Genuinely new account** (`all.length === 0`) — the existing full first-run
  state, unchanged: the sentence, the Add button, and the ghost row carrying
  the real table geometry with a one-word instruction per cell.
- **New page on an established account** — one line and the button:
  *"Nothing on this page yet."* + `+ Add application`. Someone with 40
  applications does not need to be told cells are editable.

The distinction is one condition and it is the difference between an onboarding
surface and a lecture.

### 5.7 Mobile

Below `lg`, a horizontal tab strip is the wrong control: it truncates, it
scrolls sideways off the screen, and the tab you want is the one you cannot
see. The brief is right to rule that out.

**Below `lg`: one full-width button showing the current page, opening a menu of
all pages.**

```
┌──────────────────────────────────────────┐
│  Internships · 14                     ▾  │
└──────────────────────────────────────────┘
```

- **Always fully visible.** No horizontal scroll, no truncation, no hidden
  tabs, and it does not degrade as pages are added.
- **Recognition over recall** (§1.1) — the control states where you are rather
  than requiring you to find it among peers.
- **Full-width tap target.** Fitts's law is robust for pointing (dossier
  caveats), and this is the largest target the layout allows.
- **It is the existing `OverflowMenu` primitive**, already built, already
  keyboard-accessible, already positioned and dismissed correctly. No new
  mechanism, no new dependency.
- Precedent is the correct one: Google Sheets on a phone uses a sheet-list
  button, not a tab strip.

Create, rename, reorder and delete live in the same menu, so mobile is not a
reduced version of the feature.

### 5.8 Keyboard

- `role="tablist"` / `role="tab"`, with the table container as
  `role="tabpanel"` and `aria-selected` on the active tab.
- Roving tabindex: the strip is **one** tab stop. Left/Right move between
  pages, Home/End jump to first/last. This is the standard pattern and screen
  readers announce it without extra ARIA.
- No conflict with the grid's existing `onGridKey` — separate focus zones, and
  the strip's handler does not reach the grid.
- `tk-focus` on every tab, with the ring following the tab's own radius rather
  than a rectangle around it. Re-verified after build.

**On a global shortcut: recommend against.** The obvious binding is
`Cmd/Ctrl+1…9`, which is browser tab switching on every major browser, and
`Alt+1…9` is the same on Windows and Linux. Stealing it from someone who
reaches for it out of habit is worse than not having it. Pages get switched a
handful of times a day, not hundreds — below the bar where a global shortcut
earns a collision that severe. Arrow keys within the strip are enough.

This is a decision to revisit only if a command palette lands, where page
switching becomes a search result and the collision disappears. That is a
separate feature and is not proposed here.

### 5.9 Shape, elevation, and re-verifying the invariant

Tabs use `tk-r2` and the existing focus ring. No new shadow token, no new
radius, no new surface colour. The active tab is a 2px underline in
`var(--accent)` — not a filled pill, which would compete with the primary
button (§5.3).

**The invariant, restated because this change sits directly above the rows:**

> One element owns `background`, `border-radius` and `box-shadow`. The hairline
> is an `inset` ring on that same element. No clipping ancestor.

Nothing in this feature touches `.tk-rowcard`, `.tk-grid`, `.tk-scroll` or the
subgrid structure. But the header gaining a second line changes what sits above
the rows, and the R1 round proved that layout above the rows can move their
edges. So after build, re-run both probes:

1. **Corner probe** — sample the four corners of a row card, with the pointer
   parked away from the grid so `--hover` is not active. (That second clause is
   the round-4 detector fault; it is not repeated.)
2. **Bottom-edge probe** — sample below the last card with a window smaller
   than the current row gap, so it measures the card's own shadow and not the
   next card's edge.

Both must match their pre-change values. **If either moves, the placement is
wrong and gets revised before anything ships**, not tuned with box-shadow
values.

---

## 6. Constraints

| Constraint | How it is met |
|---|---|
| Single self-contained `index.html`, no build step | No new file, no new script tag |
| Pinned CDN dependencies | Unchanged |
| No new typeface | Tabs use the existing `tk-micro` scale |
| No new dependency | Tabs are markup; mobile reuses `OverflowMenu` |
| Ten inviolable behaviours | Re-verified individually, pass/fail each, via `design/verify-inviolable.js` after build. #1 (`user_id` + `auth.uid()` default) extends to `tracker_pages`; #2 (`FOR ALL` read-back) extends to page creation; #7 (no personal identifier in `localStorage`) covers `tracker.page`; #9 (add clears the stage filter) is explicitly re-tested with two pages, per §4.9 |
| Works with no Edge Functions and no email provider | Unchanged. `tracker_pages` is a client table with an RLS policy; neither function reads it, and §4.6 ships no function change at all |
| Do not commit or push | Nothing committed. `index.html` untouched |

One statement in the prior verification needs updating rather than repeating:
the round-4 check recorded *"`SELECT_COLUMNS` reads only from
`public.applications`"*. After this the app reads two tables. The property that
actually mattered — **no Edge Function dependency, no email provider
dependency** — is unchanged, and that is what the re-run will assert.

---

## 7. Where I think the brief is wrong

Four places, in descending order of how much I would argue.

1. **The funnel threshold options are all wrong** (§4.1). Counting globally and
   displaying per page breaks the guarantee the gate exists to provide; per
   page keeps the regression; a user setting makes the user think about
   sampling. The answer is to gate globally, compute on the largest qualifying
   population, and label which. I would push hardest here.

2. **Per-page view settings should not exist** (§4.4). The brief asks whether
   each page remembers its own group/sort/filter. It should not — silently
   changing the view on switch is a hidden state change on the feature's
   highest-frequency action.

3. **The digest should get no change at all** (§4.6), not merely "one email".
   Grouping by page gives an unattended scheduled function a hard dependency on
   a table most databases do not have, for a cosmetic gain, in a system whose
   response body nobody reads.

4. **Reordering should not be drag** (§5.5). It is the nicer gesture and the
   wrong cost for a handful of pages, especially on touch.

And one thing the brief gets exactly right, worth saying because it is the
part most easily lost: **remaining fully usable while unmigrated is the hard
requirement here**, not a courtesy. §1.2's ordering rule — nothing queries
`tracker_pages` before the column probe returns clean — is the single line most
likely to be broken by a later change, and it is the one that turns this from a
feature into an outage.

---

## 8. Measured in the preview, not asserted

`design/preview.html` renders all seven states on the shipped token block
(`index.html:22-122`, lifted verbatim). Four things were measured in it rather
than claimed. Two changed the design.

### 8.1 Header height — the claim was wrong, the design changed

Covered in §5.3. First draft: strip on a second line, "no added height".
Measured: **+34.1px**. Revised to a shared baseline row and re-measured:

| Viewport | Header without strip | Header with strip | Equal |
|---|---|---|---|
| 1024px | 56.2 | 56.2 | yes |
| 1100px | 56.2 | 56.2 | yes |
| 1280px | 56.2 | 56.2 | yes |
| 1440px | 56.2 | 56.2 | yes |

`lg` is 1024px, and the strip does not exist below it — that is the mobile
control in §5.7. So those four rows are the entire range in which the claim
has to hold, and it holds across all of it.

**Below 1024 the numbers diverge (768: 56.2 vs 108.2; 390: 108.2 vs 190.3), and
that is a preview artifact, not a result.** The preview renders the desktop
frame at every width so it can be inspected; the app swaps to the mobile
control. Recorded rather than omitted, because a table of measurements that
quietly drops its inconvenient rows is worse than no table.

**No horizontal page scroll at 390 / 768 / 1024 / 1280 / 1440px**, and no
console or page errors at any of them.

One preview bug found and fixed on the way, worth noting because it is a trap
the shipped page already knows about: the frames were written with bare `fr`
tracks, and a grid item's `min-width` is `auto`, so the longest word blew the
track out and dragged the whole page sideways — 517px of content in a 390px
viewport. `index.html` writes `minmax(0,13fr)` and friends for exactly this
reason. The preview now does too.

### 8.2 Contrast of the new control — passes, both themes

WCAG ratios, measured by converting each OKLCH token to sRGB through a canvas
and computing the real luminance ratio. (String-parsing the computed colour is
the obvious approach and it is wrong — `oklch(98.6% .003 255)` split on numbers
yields a nonsense RGB triple, which is what my first attempt did and why it
reported 1.00 for everything.)

| | Light | Dark | Floor |
|---|---|---|---|
| Active tab label | **14.88** | **15.52** | 4.5 |
| Idle tab label | **4.75** | **5.69** | 4.5 |
| Row count beside label | **4.75** | **5.69** | 4.5 |
| Active underline vs page | **5.40** | **7.62** | 3.0 (non-text) |

Every value clears its floor. The idle tab at 4.75 is the tightest and is
deliberate — idle tabs should recede — but it has no headroom, so it is a value
to re-measure rather than adjust casually.

### 8.3 A pre-existing defect the measurement exposed

Not caused by this feature, not in its scope, and reported because it is real
and I would rather you heard it from the measurement than not at all.

**"+ Add application" fails contrast in dark mode.** The button is `#fff` on
`var(--accent)`, and dark's accent is `oklch(72% .150 258)` — a light blue.

| | Light | Dark |
|---|---|---|
| White label on accent | 5.61 | **2.50** |

The floor for normal text is 4.5:1. Dark mode misses it by a wide margin, on
the single most important control in the interface. Light mode is fine.

Source: `index.html:4170-4174` sets `color: "#fff"` unconditionally;
`index.html:100` defines the dark accent. Nothing about pages touches either.

Two plausible fixes, neither applied here: darken the dark-mode accent enough
to carry white, or switch the label to a dark ink on the light accent in dark
mode only. The second keeps the accent hue consistent across themes and is
what §2.3 of the dossier implies — dark mode is a distinct design problem, not
an inversion — but it is a change to the app's most prominent control and
belongs in its own decision, not smuggled in with this one.

### 8.4 Switching genuinely does not animate

The preview's switch handler is nine lines: set `aria-selected`, toggle
`hidden`. No transition property is declared anywhere on `.pgtab`, `.pages` or
the panels, so there is nothing to remove under `prefers-reduced-motion` —
which is the strongest form of honouring it.

---

## 9. What is still unverified

Stated plainly, because the preview proves less than a build would.

- **The switch-cost budget (§5.2) is unmeasured.** The preview toggles
  `hidden` on static markup; the real thing re-renders a React list. One frame
  is the budget and it is met in the preview trivially, which is not evidence.
  It gets measured on the real build with ~50 rows per page.
- **The shadow probes have not run.** Nothing in the preview reproduces the
  full grid, subgrid and scroll container, so the corner and bottom-edge checks
  are listed as build gates (§5.9), not results.
- **No SQL has been executed.** The migration in §1.4 is written to be
  idempotent and additive and has been read carefully; it has not been run
  against a database with real rows on it. That happens before it is offered to
  anyone.
- **The ten inviolable behaviours have not been re-run.** They cannot be —
  there is no new build to run them against. They are a gate on Step 2.

---

# Multi-page support — built

Step 2. `index.html`, `setup.sql`, `migrations/003-pages.sql`.

## What shipped, against what was proposed

Everything in §1–§7 as written, including the four places §7 argued with the
brief: reply rate gated on all pages and labelled by population; view settings
not remembered per page; no digest change at all; reorder as menu items rather
than drag.

`PAGES_SQL` is defined once in `index.html` and generated into both
`setup.sql` and `003-pages.sql`, verified identical by normalised comparison —
three hand-maintained copies of the same DDL would drift, and the copy that
drifts is the one a stranger runs.

## Three claims that were wrong until they were measured

The preview said the header held at 56.2px. In the real app it did not, for
three separate reasons, each of which passed a test for the wrong reason first.

**1. The strip never rendered.** The wrapper was `hidden lg:flex`. This file's
Tailwind subset is hand-maintained because there is no build step, and it
defines `.lg\:block` and `.lg\:hidden` and no `.lg\:flex` — so the strip was
`display:none` at every width while sitting in the DOM. The contrast probe
still found the tabs and reported real numbers; the header-height check still
passed. **Both passed because nothing was there.** Same class of fault as
`min-w-[14rem]` two rounds ago, and the lesson did not transfer: a class that
does nothing looks exactly like a class that works.

**2. The underline reserved height.** 5px of `padding-bottom` on each tab made
its box taller than the wordmark's descender space. Now absolutely positioned
at `bottom:-6px`, out of flow, costing nothing. This turned out **not** to be
the main cause — it was fixed first, and the header stayed at +8.7px.

**3. The per-page menu trigger was a 36px icon button.** `OverflowMenu`
defaults to `.tk-iconbtn`, which is `--control-h` tall, and inside the strip
that set the height of the whole header. The tabs were never the problem. The
in-strip trigger now carries `.tk-pgmenu`, on the tab's own scale.

Measured after all three, at 1440px, two pages against one:

| | One page | Two pages |
|---|---|---|
| Header height | 65.5px | **65.5px** |
| Top of the grid | 697.6px | **697.6px** |
| Row card | 1312×61, r10px | **1312×61, r10px** |

The rows do not move. That is the claim §5.3 makes, and it is now true because
it was checked three times and was false the first two.

## The measurement instrument was wrong twice, too

**Switch cost, first attempt: two nested `requestAnimationFrame`s.** That waits
two frames whatever the work costs. It reported 8.3ms on one run and 28.5ms on
the next against identical code — it was measuring the browser's frame clock.

**Second attempt: click and read synchronously.** React 18 flushes a discrete
update in a microtask, so the read always saw pre-click DOM and reported a
confident **0.1ms for measuring nothing**. It also alternated `tabs[0]`/
`tabs[1]`, and clicking the *active* tab starts a rename rather than switching
— half the clicks did not switch at all.

Fixed: always click the inactive tab, `await` a microtask, then read, and
assert the row count actually alternates so a null measurement cannot pass.

**Median 2.4ms, worst 4.7ms over nine real switches** — inside one frame, with
the row count alternating 4↔2 as proof each click switched.

## Verification

**Pages, unmigrated database (9/9).** `tracker_pages` is **never requested** —
the ordering rule holds. Migration notice shown; all rows still render; no page
strip; no mobile control; the SQL on screen creates `tracker_pages` and adds
`page_id`; adding a row omits `page_id` from the insert; one failed request,
the probe, and no JS faults.

**Pages, migrated database (18/18).** Two tabs with per-page counts; only the
active page's rows visible; switching makes **no network request**; the active
page is remembered; add carries the active `page_id` and does not switch page;
the delete confirmation names the real count and destination and says nothing
is deleted; deleting a page destroys no applications and moves all of them,
including a row added after load; the strip disappears at one page.

**Ten inviolable behaviours: all pass.** 1–8 via `design/verify-inviolable.js`;
#9 (adding a row clears the stage filter) re-tested with two pages and
additionally asserting the page does not change; #10 (soft delete restores to
position) in the page harness, which also confirms the trash is per page.

Check 2 in that harness had to be rewritten: it matched a fixed 400-character
window inside `addRow`, and a comment growing inside the branch broke it. It
now locates each function that inserts and reads back and requires each to
guard the empty array — so `createPage` is covered by the same rule, and a
third such site without the guard fails.

**Shadow invariant re-verified**, since the header changed above the rows: the
row card still owns background, radius and shadow on one element with the
hairline as an inset ring, no clipping ancestor, and identical geometry with
and without the strip.

**Contrast**, measured by converting each OKLCH token through a canvas:

| | Light | Dark | Floor |
|---|---|---|---|
| Active tab | 14.88 | 15.52 | 4.5 |
| Idle tab | 4.75 | 5.69 | 4.5 |
| Underline | 5.40 | 7.62 | 3.0 |

## Two pre-existing defects fixed on the way

**`--cold-line` and `--warn-line` were never declared.** Four places used them,
so `border:1px solid var(--warn-line)` was invalid at computed-value time, the
whole shorthand unset, and the migration notice and database-error panel have
been rendering with **no border at all**. Now defined in all three palettes.

**Still not fixed, and still worth your decision:** `+ Add application` is
white on `var(--accent)`, which in dark mode is 2.50:1 against a 4.5 floor.
Documented in §8.3 with two candidate fixes. It is the most prominent control
in the app and belongs in its own decision.

## Not verified

No SQL has been run against a real database. The migration is idempotent and
additive by construction and has been read closely, but the only place it has
executed is in my head. Run it on your own project before trusting it.

---

# Moving an application between pages

A gap in the original build: pages could be created, but nothing could be put
in them except by creating it there.

## Where it lives

In the row's detail drawer, with the other per-application settings, as a
native `<select>` labelled **Page**.

- **The drawer, not the row.** Moving is low-frequency, and the row already
  carries the delete control; a second destructive-looking affordance beside it
  competes for the same glance.
- **Native `<select>`.** Keyboard-accessible for free, and on a phone it opens
  the platform picker rather than a bespoke sheet. No new primitive, and
  explicitly not drag — same argument as page reordering (§5.5).
- **Only when there are at least two pages.** With one page it is a control
  that can do nothing, which is worse than no control.
- **It shows the page the row is actually on.** A null `page_id` displays on
  the first page, so the select resolves the same way; otherwise a row visibly
  sitting under "Applications" would show a blank Page field.

The copy says what survives: *"Moving keeps everything — stage, notes, scores
and history."*

## The undo is not decoration

Moving a row makes it disappear from the page you are looking at, which is
indistinguishable from a deletion. So the move offers the same undo the delete
path does, naming both the row and its destination: *"Moved Northwind to
Internships."*

## A stale-closure bug the test caught

The undo did nothing, and the reason is worth recording because the codebase
already had the defence in place.

`moveRowToPage` read `all` — the component's state. The undo closure is created
during the render that performed the move, so it captures **that render's**
`all`, in which the row is still on its original page. Moving it "back" then
compared origin to destination, found them equal, and hit the early return.
Silently. The write never fired.

The fix is `allRef.current`, the mirror the file already maintains with the
comment *"so a mutation can read the pre-change value without a stale
closure"*. The defence existed; the new code just didn't use it.

## Verification

**23/23** in the page harness, including six new checks: the drawer offers a
selector listing every page; it shows the page the row is on; the moved row
leaves the current page; the move reaches the database; the tab counts follow
it; an undo is offered; and undo returns the row to where it came from.

One test assertion had to change too. The switch-cost check identified a page
by its row count, and after the move both pages held three rows — so it
reported "nothing switched" on a switch that worked. It now identifies the page
by its first company.

27/27 unmigrated-and-migrated behaviour and all ten inviolable behaviours still
pass.

---

# Six items — round 1 (items 1, 2, 3)

## 1. Contact email was unusable — root cause

Three faults compounding, in `Field` (`index.html:2979`). Fixing any one alone
would have left it reachable from the other two, which is how this class of bug
comes back from another angle.

1. **Controlled-input round trip.** No local draft. `value` came straight from
   `row.contactEmail` — shared state that realtime reconciles.
2. **Save-on-change.** `onChange` → `editField` → `patch` fired a database
   `UPDATE` per keystroke. **Measured: 21 writes for a 21-character address.**
3. **Realtime echo with no edit guard.** `merge` replaced the row wholesale on
   every `postgres_changes` event. Each of those 21 writes echoes back; the
   echoes arrive out of order and stale against real latency, and each one
   resets `value` mid-word — dropping characters and throwing the caret to the
   end.

**What was executed and what was read.** Faults 1 and 2 are proven by running
the app: 21 writes, and 0 after the fix. Fault 3 is established by reading
`merge` — a stubbed Supabase has no realtime WebSocket, so the echo never
arrives and the text survives all 21 writes intact in the harness. That is
exactly why the bug is worst on a real project with a second device syncing,
and why it could not have been found by the existing tests.

**Fixed at all three layers.** `Field` now owns a draft and writes once, on
blur or Enter, with Escape abandoning. `merge` skips any row with a write in
flight, because while a mutation is in flight the optimistic local row is the
newer truth — a genuine remote change is delayed one round trip, never lost.

**Result: 21 writes → 0 while typing, 1 on blur, value intact.**

**Other fields.** `Field` is also used by **salary** and **equity**, which had
the identical fault and are fixed by the same change. The grid cells — company,
role, location, replies, next steps, notes — use `EditableCell`, which already
kept a local draft and committed on blur, so typing there was never affected.
`DateField` likewise has its own draft.

## 2. Theme: one row, not two

A single `menuitemcheckbox` labelled **Dark mode**, carrying the moon glyph and
a tick when on. It names a MODE and its checkbox states whether that mode is
active — so the current theme is unambiguous from inside the menu, which is
what matters given the control is invisible from outside. Naming the ACTION
instead ("Switch to dark") would leave the current state unstated; mixing the
two is the classic way this control confuses people, so it does one thing.

**The menu stays open on toggle.** The point of flipping the theme is watching
it flip, and closing would hide the result and charge a re-open to undo — a
context switch (§1.1) levied on the one action most likely to be tried twice.
Everything else in the menu still closes, because everything else takes you
somewhere.

## 3. "Funnel" → "Your numbers"

What the panel actually shows: stage occupancy, mean days between stages, reply
rate, median days to a reply — and, below the threshold, progress toward 20
applications and no conversion at all.

**"Conversion" fails the locked state outright** — there is none to show.
**"Pipeline health"** implies a verdict the panel does not deliver, and
"pipeline" is the jargon being escaped. **"Progress"** collides with stage
progress, which is what the rows already show.

**"Your numbers"** is true in both states, uses no jargon, and sets the right
expectation: this panel is statistics about your own data, not another view of
the rows or a benchmark against anyone else.

Two labels inside were equally opaque and changed with it: the collapsed
summary read *"7 live in the funnel"* → **"7 live"**, and the open-state
subtitle read *"Live count of where each application sits now"* → **"Where each
application sits now, and how it is converting"**, which describes both halves
of the panel rather than only the top.

The `tracker.funnel` localStorage key is unchanged — renaming it would discard
everyone's expanded/collapsed preference for a string nobody sees.

## Verification

Item 1: **8/8** in the diagnosis harness, before and after. Item 2 and 3:
**9/9**. Plus **27/27** and **23/23** in the page harnesses and **8/8** source
checks of the inviolable behaviours, all unchanged.

## 4. Contact email in the row

**Placement: a second line under the company name**, not a ninth column.

The row carries eight columns. A ninth takes width from every field doing more
work, which is extraneous load charged to all rows to serve a field most rows
will not have (§1.1). Under the company name it costs no width at all, and it
belongs there on meaning as well as geometry: an email address identifies *who
you are dealing with*, and Company is the identity column.

Set at `--t--1` in `--ink-3` — one step down the scale and muted — so it reads
as subordinate to the name rather than competing with it. When empty it shows
**`+ contact email`**, an invitation rather than a blank.

**The cost, measured: row height 61px → 82.5px.** That is +35%, and it is the
real price of the brief's "prominent in the main body of the row" — a field
cannot be both prominent and free. Reported rather than buried, because the
cheaper alternative exists and is one line of code: render the second line only
for rows that have an address, leaving the rest at 61px. That trades discovery
for density, which is the wrong way round given the stated problem is that
people are missing the field entirely.

**The copy promises nothing.** Automatic filing needs deployed Edge Functions
and a configured mail provider, which almost nobody has, so the row says
`+ contact email` and nothing else — a contact address, useful on its own terms
to everyone. Of the three options in the brief, this is the recommendation:
detection is not possible without calling the function, and hedged wording in
the row would spend the row's scarcest resource, its width, on a caveat.

The drawer carries the one conditional sentence, for people who have read the
README: *"Who to chase at this company. If you have set up inbound email,
replies from this address also file themselves here."* It states the primary
use first and the secondary use as a condition, so it is true for everyone.

**Schema drift: nothing to do.** `contact_email` is in `setup.sql:29` and in
migration `001` — not only in `002` — so anyone who has run either has it, and
`SELECT_COLUMNS` already probes for it. A database predating it raises the
existing migration notice through the existing path. **No schema change.**

**Mobile** gets the identical treatment, under City in the card.

**Verified 14/14**, including that the row promises nothing about inbound
filing, and the shadow invariant re-checked because this changes content inside
the card: radius 10px, inset ring present, no clipping ancestor.

## 5. Drag to reorder (with item 6's rules built in)

**Pointer Events, not the HTML5 drag API.** HTML5 DnD does not fire on touch at
all — which is where most reordering will happen, and the case the brief calls
the harder one. It also cannot be styled and forces everything through
`dataTransfer`. Pointer events give one code path for mouse, touch and pen,
plus `setPointerCapture` so the gesture survives the pointer leaving the row.

**Activation.** `6px` of travel for mouse and pen — far enough to survive a
shaky click on a cell, short enough that a deliberate drag feels immediate.
`400ms` long press for touch, because any distance threshold on a finger
competes with scrolling. `touch-action:none` is set on the handle alone, so the
rest of the row still scrolls the page.

**Commits during the drag, confirmed.** Rows part as you pass their midpoint,
per §3.1's threshold rule: reversible actions trigger during the gesture,
destructive ones only on release. Reordering is reversible, so it is the former.
The *write* still happens once, on release, so a drag across ten rows is one
round of updates rather than ten.

**Persistence** is optimistic with rollback of the whole array, through the same
`inFlight` request-identity map every other mutation uses — a slow response
cannot resurrect an order the user has moved on from.

**Keyboard equivalent**, because drag-only is not accessible: focus the handle,
Space or Enter to pick up, arrows to move, Space/Enter to drop, Escape to put
it back where it was.

**Elevation in flight:** `--shadow-float` plus an accent inset ring, on the same
element that already owns background, radius and shadow. The invariant is
untouched; nothing new clips. Re-verified: radius 10px, inset ring present,
`auto|visible` overflow.

**Item 6's rules, as recommended and approved.** Manual order is the default and
already was. The handle is **absent** — not disabled — whenever a sort or a
grouping is active: an affordance that does nothing is worse than none, and
grouping makes an index across sections ambiguous anyway.

### A bug the test caught, and it would have been silent

`commitOrder` compared each row's `sortOrder` against its new index to decide
what to write. But `reorderLocal` renumbers `sortOrder` live during the drag so
the rows part under the finger — so by release, local `sortOrder` already
equalled the new index for every row. The comparison was local against local,
found nothing changed, and **wrote nothing at all**. The screen showed the new
order, the database kept the old one, and a reload would have quietly undone
the work. No error, nothing on screen.

Fixed by comparing against the order the drag *started* from, captured when the
gesture begins. **0 writes → 3 writes for a three-position move**, with
`sort_order` in the database matching the screen.

**Verified 13/13**: 3px of travel does not start a drag; the order changes
during the drag rather than on release; the row is lifted in flight; the write
happens once per moved row; the database matches the screen; Space picks up;
ArrowDown moves; Escape restores; the invariant survives; no JS faults.

## 6. Urgency and stage as sorts — the remainder

`SORTS` gains two options. Manual stays first and stays the default.

- **Needs chasing first** — live rows by days untouched, descending. Rows that
  are not live sink below them, because nothing is owed on an application not
  yet sent or already closed.
- **Furthest along first** — Offer, Interview, Replied, Applied, To apply,
  Closed. `sortOrder` breaks ties, so manual order survives inside each stage.

Neither is the default, and the reason is worth keeping written down: `patch`
stamps `activity` on every edit, so under urgency **the row you just touched
drops to the bottom**. Stage order has the milder form of the same fault. Manual
order is the only one that never moves under you, and the only one in which
dragging a row means anything.

No persistence, as recommended: `resetView` already clears sort, and a
remembered sort means returning to a list ordered by something set once and
forgotten — which is the "it resorts itself" problem wearing a different hat.

## The dark-mode contrast defect, fixed

Reported in §8.3 and left for a decision. Taking it now, since it is one token.

`+ Add application` was `#fff` on `var(--accent)`, and dark mode's accent has to
be *light* to read against a dark page — so the app's most important control was
its least legible: **2.50:1 against a 4.5 floor**.

Fixed with a new `--on-accent` token rather than by darkening the accent, which
keeps the accent hue identical across themes — §2.3, dark mode is a distinct
design problem, not an inversion. White in light mode, near-black in dark.

| | Before | After | Floor |
|---|---|---|---|
| Light | 5.61 | **5.61** | 4.5 |
| Dark | **2.50** | **7.24** | 4.5 |

All three accent buttons use the token; no `color: "#fff"` on an accent remains.

**Regression after both:** 13/13 drag, 27/27 and 23/23 pages, 16/16 theme and
sorts, 8/8 inviolable source checks, contact email still 0 writes while typing.

---

# Regression report — reorder and theme

Diagnosis only. No application code changed; the findings are the deliverable.

## What the last pass actually did

**The mobile drag was built and was unreachable by construction.** The touch
code exists — `pointerType === "touch"`, the 400ms `LONG_PRESS`,
`touch-action:none` — and it is attached to a handle rendered in exactly one
place: inside the container at `index.html:5576`, which is `hidden lg:block`.
Below 1024px that container is `display:none`. `MobileCard` contains no drag
handle at all. The touch branch has never executed.

It was then "verified" at 1440px with a mouse and reported done.

Measured in a real touch context (390×844, `hasTouch`, iPhone UA):

| | |
|---|---|
| mobile cards rendered | 4 |
| drag handles in DOM | 4 — all inside the hidden desktop table |
| drag handles visible | **0** |
| desktop grid visible | false |

Even if one were rendered on a card, `.tk-drag` is `opacity:0` revealed by
`.tk-rowcard:hover`, and there is no hover on a phone.

## Item 1 is not a persistence failure

Two signed-in devices against one shared database, device A dragging three
positions (`design/verify-reorder-sync.js`):

| | |
|---|---|
| writes sent | 3 |
| rows matched per write | 1, 1, 1 — not silent zero-row updates |
| database order after drag | Bravo, Charlie, Alpha, Delta |
| device A screen | Bravo, Charlie, Alpha, Delta |
| **device B, fresh load** | **Bravo, Charlie, Alpha, Delta** |

`sort_order` is written, each write matches its row, and a second device
loading fresh gets the new order. The first two hypotheses in the brief are
ruled out by execution.

That leaves realtime propagation, and **it remains unverified**. Every harness
in this project is HTTP-only: there is no WebSocket, so no `postgres_changes`
event has ever fired in any test here. Everything reported about realtime has
been read from source, never executed. That blind spot hid the contact-email
echo and now this.

**One real hazard found by reading**, which the brief predicted: `commitOrder`
calls `.update(…).eq("id", …)` with no `.select()`, so PostgREST returns
`error: null` even when zero rows match. It matches today; it would fail
silently the day it stopped.

## Item 3 works as built, which is the problem

The row is the fixed string `"Dark mode"` with a checkbox state; only a small
`✓` changes. The convention was "name the mode, let the checkbox carry the
state", argued for on the grounds that it makes the current theme unambiguous.
Read in use it registers as stuck — and a state change nobody notices is not a
state change, whatever the argument for it. It needs the state-reflecting
convention instead: label and glyph both changing.

## Open decision

Meeting "verified on a second signed-in device without a manual refresh"
requires a WebSocket server speaking Supabase's realtime protocol. That is a
substantial piece of work, and given it has now hidden two bugs it is probably
worth building before anything else here. Awaiting a decision rather than
spending the effort unannounced.

---

# Regression round — items 2, 3, 4 built and verified

## The verification bar, met

"Done" now means driven on a desktop pointer **and** a real touch device, and
cross-device sync exercised over an actual WebSocket. Four harnesses, all in
`design/`, all runnable:

| | |
|---|---|
| `verify-realtime.js` | two devices, live `postgres_changes` — **7/7** |
| `verify-touch-drag.js` | iPhone UA, `hasTouch`, real touch pointers — **8/8** |
| `verify-reorder-animation.js` | theme row + FLIP, sampled mid-drag — **15/15** |
| `verify-reorder-sync.js` | persistence and fresh-load sync — **8/8** |

## 2. Mobile drag — built, and exercised on touch

The handle now renders on the mobile card, permanently visible rather than
hover-revealed, since a phone has no hover — that alone made the desktop handle
unreachable even before the card lacked one. `touch-action:none` is scoped to
the handle so the rest of the card still scrolls the page. Long press 400ms;
pointer drag stays at 6px of travel.

Verified with genuine `pointerType: "touch"` events on a 390×844 iPhone
context: four cards, **four visible handles**, `touch-action: none` confirmed
computed, a tap does **not** start a drag, and a long press followed by a drag
reorders — `Alpha, Bravo, Charlie, Delta` → `Bravo, Charlie, Delta, Alpha`,
four writes, each matching exactly one row, database matching the phone.

## 3. Theme row — state, and both halves change

The row now states the current theme with its matching glyph, and toggling
changes label and glyph together. The previous convention named a fixed mode
and let a small tick carry the state; it was argued for and it failed in use,
because a state change nobody notices is not a state change.

The action lives in the accessible name and the tooltip — *"Dark mode. Switch
to light mode."* — so the visible text can stay a plain statement of where you
are. Verified: label changes, glyph changes (sun 167 chars of path → moon 72),
the interface actually re-themes, the menu stays open, and reopening it still
shows the right state.

## 4. Reorder animation

FLIP. Positions measured before and after the commit, the difference applied as
an inverse translate with no transition, released the next frame.

- **The dragged row does not animate.** It is attached to the pointer; any
  easing between the two reads as lag (§3.1).
- **Transform only** — nothing re-lays-out mid-flight, which is also why the
  corners and shadow survive: a transformed box paints its own
  `border-radius` and `box-shadow`. Sampled **mid-drag**: `radius=10px`,
  inset ring present.
- **`cubic-bezier(0.22, 1, 0.36, 1)` at 220ms** — the dossier's smooth
  approximated spring, under the ~300ms ceiling. The energetic
  `(0.34, 1.56, …)` curve overshoots, and four rows springing past their slots
  at once reads as sloppy.
- **`prefers-reduced-motion`**: nothing animates, the reorder still happens.

### The defect this round's test caught

The first run failed on "the dragged row does not animate": its
`transitionProperty` was `transform`. Excluding it from the FLIP was not
enough — a row displaced on an earlier pass still carried the inline transition
from that pass, so the moment it became the dragged row it eased toward the
pointer instead of tracking it. Exactly the lag item 4 warns about, and only
visible because the test samples mid-drag rather than at rest. Fixed by
clearing the transition explicitly on the dragged row.

## Two stale assertions, corrected not weakened

`drag.js` counted every `.tk-drag` on the page and expected four; there are now
eight, because the mobile handles exist in the DOM too. It now counts the
desktop grid's own. `theme.js` asserted `menuitemcheckbox` and `aria-checked`,
which item 3 deliberately replaced; it now asserts the state-label contract.

## Full regression

13/13 drag · 8/8 touch · 7/7 realtime · 15/15 animation · 27/27 and 23/23
pages · 14/14 theme and contact line · 8/8 inviolable source checks · contact
email still 0 writes while typing.

`design/preview.html` gains a live reorder demo — grab a handle and drag.

---

# Dragging was laggy — measured, and fixed

Reported as "ridiculously laggy". That is a measurable claim, so it was
measured before anything was changed: frame deltas and forced layouts during
one drag over eight rows, on a 60-row list.

## Root cause: three costs, all mine, all per pointermove

1. **The move handler re-measured the DOM every time.** `querySelectorAll` plus
   `getBoundingClientRect()` on every card, on every `pointermove` — a forced
   synchronous layout per event.
2. **`reorderLocal` called `setAll` on every crossing**, replacing every row
   object, so React re-rendered the entire list.
3. **The FLIP layout effect then ran after each of those renders** and measured
   every card again — a second forced layout per render, and it restarted the
   220ms transitions mid-gesture.

Measured, 60 rows, one drag:

| | Before | After |
|---|---|---|
| `getBoundingClientRect` calls | **15,480** | **240** |
| p90 frame | 31.0ms | **17.2ms** |
| worst frame | 433ms | 120ms |
| dropped frames (>33ms) | 9% | **2%** |

p90 is the number that matters: 31ms is a visibly stuttering ninetieth
percentile; 17.2ms is vsync.

## The fix: measure once, transform during, commit once

Geometry is read a single time when the gesture begins. Nothing is read from
the DOM after that. The dragged row tracks the pointer by transform with no
transition; displaced rows step aside by transform with the spring curve. The
target slot comes from cached midpoints — arithmetic, not measurement. React
state is touched exactly once, on release, and the layout effect is suppressed
for that commit because the rows are already where they belong, so there is
nothing left to animate and nothing to flash.

The keyboard path still goes through `reorderLocal`: one re-render per arrow
key is nothing.

**A note on the earlier metric.** The first run reported "41% of frames over
16.7ms" — but a frame at 60Hz *is* 16.7ms, so that counted healthy vsync as
failure. A dropped frame is one that took two intervals. Corrected to >33ms.

## Three bugs this exposed, in order

**`[data-row-card]` matched every row twice.** Both the desktop row and the
mobile card carry it, and the hidden one is still in the DOM — so an
unfiltered query returned 8 elements with duplicate ids and the reorder
arithmetic silently scrambled. Now filtered to cards with a non-zero height.

**The drag harness's stub returned `[]` from PATCH.** The app now asks for
`.select("id")` and treats an empty result as a zero-row update, so it
correctly rolled back a perfectly good write. The stub was wrong; it now
returns the matched rows. The guard working as designed is what surfaced it.

**Two assertions were stale by design change**, and were corrected rather than
relaxed: rows no longer reorder the DOM during a drag — they move by transform,
which is the whole point of the fix — so the check is that they are visibly
displaced, not that document order changed. And under `prefers-reduced-motion`
rows still move by transform; what disappears is the transition. Playwright's
own emulation forces `transition-duration: 1e-06s` on everything, so "not 0s"
was a false positive; the threshold is now 10ms.

## Regression

13/13 drag · 8/8 touch · 15/15 animation · 7/7 realtime · 27/27 and 23/23
pages · 14/14 theme and contact line · 8/8 inviolable · contact email still 0
writes while typing.

`design/verify-drag-performance.js` is now in the repo, so this is measurable
again rather than argued about.

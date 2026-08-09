# Short-row colorwork — project plan

A web app that turns a picture into a knittable short-row colorwork pattern:
charts, written instructions, a row tracker, and a preview of the finished
fabric. Successor to `planned_pooling`, and deliberately shaped by what that
project taught.

Nothing has been coded yet. This file is the agreed starting point.

---

## 1. Decisions already made

| Question | Answer |
|---|---|
| Technique | **Sculptural wedge-region short rows** — colour areas built as short-row wedges, unequal row counts per column, so the fabric flares and curves |
| Shape vs. picture | **Both modes**, chosen per project: shape-constrained, and image-driven |
| Technology | **Framework + build** — Vite |
| Who writes it | **I implement; you steer and correct** — with the knitting mathematics treated as your territory, and the plumbing (UI, canvas, files, persistence) as mine |
| Outputs | Written row-by-row instructions · printable chart · interactive row tracker · fabric preview — **all four** |
| Later | Other colorwork methods (stranded, intarsia, mosaic) |

### Framework recommendation: Svelte 5 + Vite + TypeScript

You chose "framework + build"; here is which one and why, so you can overrule it
before anything exists.

**Svelte over React.** A Svelte component is HTML with markup interpolated into
it — very close to what you already write by hand. React asks you to learn JSX,
hooks, and a render model that is genuinely surprising in a canvas-heavy app
(effects firing twice, refs, the reconciler). Svelte's reactive state is a plain
variable you assign to. Vite is its native build tool, so the toolchain is one
decision, not two.

**TypeScript for the core modules, at least.** This project is full of integer
indices that mean different things — needle position, wale index, global row
number, row-within-a-wedge, image pixel, chart cell. Mixing two of those up
produces a pattern that looks plausible and is wrong, which is the worst failure
mode a knitting app can have. Types catch that class of bug at the moment of
writing. It is a real cost in learning, and it is the single highest-value piece
of tooling for this particular problem.

**Publishing.** GitHub Pages still, but via a GitHub Actions workflow that runs
the build. One file, written once, never touched again.

---

## 2. The domain, written down

This section exists so that if I have misunderstood the craft, you can see
exactly where, and correct one paragraph rather than the whole plan.

### 2.1 Two spaces, and why everything hinges on the difference

**Construction space** is the needle's world. The needle holds a line of live
stitches, positions `1..N`. Working a row consumes some run of them and produces
new stitches directly above. Short rows do **not** change `N` — you turn early,
leaving stitches unworked, and come back later. So the stitch count across the
piece is constant while the *number of rows worked over each column* is not.

**Fabric space** is the blocked piece lying on the floor. Each stitch occupies
roughly a parallelogram: width `w`, height `h`, typically about `4.5 mm × 3.3 mm`
in stockinette — wider than tall, which is why every chart must be drawn on
non-square cells.

Call a column of stitches stacked on each other a **wale**. If wale `j` has been
worked over `R(j)` rows, its physical length is `R(j) · h`. Neighbouring wales
are sewn to each other along their whole length by construction. A strip of
ribbons of unequal length, joined edge to edge, cannot stay a rectangle — it
fans. **That flare is the entire point of sculptural short-row work, and it is
also the thing that distorts your picture.**

### 2.2 Wedges as darts

The tractable way to think about the geometry: each short-row pair worked over a
span of `s` stitches inserts a wedge into the fabric of angle roughly

```
θ ≈ 2h / (s · w)      radians
```

at that location. The finished shape is the accumulation of all those wedges.

- Wedges **nested around a common apex** → the piece opens into a flat fan
  (a circular sector). This is the classic triangular or half-circle shawl, and
  it lies flat.
- Wedges **spread evenly across the width** → curvature accumulates away from a
  point and the fabric cups or ruffles. It will not lie flat.

That distinction is a first-class thing the app must compute and warn about.
"This design will not lie flat" is one of the most useful sentences the app can
say, and it is cheap to derive once the geometry engine exists.

### 2.3 What makes a plan knittable — the rules

These are combinatorial. They are true the way "you cannot knit a stitch that is
not there" is true, and no swatch is going to overturn them. They are safe to
hard-code, and they belong to `methods/shortrow/topology`.

1. **Contiguity.** Every worked row is one unbroken run of live stitches. You
   cannot skip stitches in the middle of a row.
2. **Parent exists.** A stitch can only be worked if the stitch below it has
   been worked (or cast on).
3. **Needle order.** Stitches never reorder. From the current position you may
   work forward, or turn and work back.
4. **Every turn needs a technique.** German short rows, wrap-and-turn, or shadow
   wraps. The return pass has to close the gap ("work the double stitch together
   as one"). Which technique is a user choice; *that there must be one* is a rule.
5. **One attachment per region.** A contiguous single-colour area is one join of
   yarn: two ends to weave in. **Number of regions is a headline quality metric.**
   A design with forty regions has eighty ends and nobody will knit it.
6. **RS / WS alternate.** Garter is the usual ground for sculptural short-row
   work — it lies flat and reads the same on both sides — so garter is the
   default, with stockinette available.

### 2.4 What we are guessing — the model

These are claims about how yarn behaves, and **every one is a guess until
something has been knitted and measured.** They live in one module,
`model/physical`, as named parameters with stated defaults — never as constants
sprinkled through the planner.

| Parameter | First guess | What settles it |
|---|---|---|
| Stitch width `w`, height `h` | 4.5 mm × 3.3 mm | an ordinary gauge swatch |
| Flare per short-row pair | `θ ≈ 2h/(s·w)` | knit one wedge, measure its angle |
| Row gauge near a turn | same as elsewhere | the same wedge — compare its two edges |
| Steepest join before it gapes | unknown | a two-colour test piece |
| Edge stitches consumed by a join | 1 per row | the same two-colour piece |
| Whether a height profile lies flat | residual energy threshold | comparing predictions against real pieces |

Two consequences for the code:

- **The planner asks the model; it never assumes.** Any line of planner code that
  wants to know how far a wedge flares calls into `model/physical`. Then changing
  our mind is one edit, not an archaeology expedition.
- **The model is measurable, not merely adjustable.** `planned_pooling` got this
  right and it is the single most valuable thing to carry over: it never asked
  you to *tune* yarn consumption, it asked you to knit a swatch, measure it, and
  derived the number. Same here — "knit this wedge, tell me its two edge lengths
  and the angle between them" and the app corrects its own flare model. Iteration
  is then something the app does from your knitting, not something I do by
  editing constants between sessions.
- **Model parameters are saved inside the project file**, so improving the model
  never silently changes a pattern you are halfway through knitting. Old projects
  keep the numbers they were planned with, and say so.

### 2.5 Joining wedges — currently the weakest part

When a new wedge butts against a finished one, the row-end stitch is worked
together with the neighbour's edge stitch. I am fairly confident of the shape of
this and not at all confident of the details: how many edge stitches it eats, how
steep the boundary can get before it gapes, whether it needs picking up instead
past some angle. Flagged here because it is the assumption most likely to be
wrong, and it is why the two-colour test piece (§5, M2) comes before any region
planner exists.

### 2.6 The two project modes

These map cleanly onto two different geometry engines, which is why supporting
both is less than twice the work.

**Shape-constrained** (build first). You choose the finished object — triangular
shawl, crescent, half-circle, sleeve cap, wedge skirt. The shape determines the
wedge schedule, therefore the mesh, analytically. Then the image is positioned
over the shape and **sampled** at each stitch's physical centroid. There is no
inverse problem at all: shape → mesh → colours. It is fast, exact, and always
produces something wearable.

**Image-driven** (build second). The inverse. The picture is given, and the app
must choose where to put short rows so the result expresses it. This is a genuine
optimisation problem with no clean closed form, and I want to be honest that full
automation may not be achievable. The realistic target is **assisted**: the app
proposes a wedge placement, shows you the resulting shape and the resulting
distortion of your image, and you drag boundaries while it re-simulates. Geometry
here needs the general solver (§3.4), not the analytic one.

### 2.7 The distortion problem — the most important thing on screen

You chose sculptural. That means the fabric flares, which means **your picture
will be stretched by the flare**, and the amount depends on where in the piece it
sits. If the app only ever shows the picture on a neat rectangular chart, it is
lying to you and you will find out after fifty hours of knitting.

So: the preview always renders the image **as warped onto the actual fabric
geometry**, side by side with the original. Everything else in the UI is
negotiable; this is not.

---

## 3. Architecture

Same instinct as `planned_pooling` — strict layers, each future feature landing
in exactly one of them — but with the boundaries made explicit in types, and with
the pipeline memoised because the work per stage is now expensive.

### 3.1 Shape of the pipeline

```
  image ─┐
         ├─► [resample] ─► [quantise] ─► [clean] ─┐
palette ─┘                                        │
                                                  ├─► [assign colours to mesh]
  shape ────► [wedge schedule] ─► [build mesh] ───┘         │
                                       │                    ▼
                                       │             [decompose regions]
                                       │                    │
                                       ▼                    ▼
                                 [lay out flat]      [order + schedule turns]
                                       │                    │
                                       ▼                    ▼
                                  fabric preview       chart · instructions · tracker
```

Every stage has the signature

```ts
(input: In, params: P) => { value: Out; problems: Problem[] }
```

Stages are pure and memoised on `(input identity, params)`. Changing the turn
technique re-runs instruction generation and nothing else. Changing the palette
re-runs from quantisation down. This is `planned_pooling`'s "one regeneration
path" lesson, upgraded: one path, but it knows what it can skip.

Heavy stages (quantise, clean, decompose, relax) run in a **Web Worker** so the
UI never freezes. Budget for meshes of 20 000–100 000 stitches.

### 3.2 Modules

Pure core — no DOM, all unit-tested:

| Module | Responsibility |
|---|---|
| `model/physical` | **every parameter we are guessing** (§2.4) — flare, gauge, turn and join allowances — with defaults, provenance, and the solver that corrects them from a measured test piece |
| `color/` | sRGB ↔ Lab, ΔE, palette matching |
| `palette/` | yarn palette model — owned colours, quantisation to them, or free choice |
| `image/` | decode, crop, gauge-aware resample, posterise, morphological cleanup |
| `shape/` | shape library; each shape yields a wedge schedule analytically |
| `mesh/` | the stitch mesh: wales, rows, adjacency; flat layout (analytic and relaxed) |
| `chart/` | the mesh plus a colour per stitch; editing operations |
| `methods/shortrow/topology` | the rules of §2.3 — combinatorial, hard-coded, heavily tested |
| `methods/shortrow/plan` | region decomposition, dependency ordering, turn scheduling, validation. **Asks `model/physical` for every physical quantity; contains no constants of its own** |
| `instructions/` | plan → written pattern text |
| `estimate/` | yarn consumption and quantity per colour — **ported from `planned_pooling`** |
| `project/` | the state object, versioning, migration, save/load |

UI, in Svelte:

| Module | Responsibility |
|---|---|
| `views/fabric` | canvas: the piece in fabric space, stitch glyphs, warped image |
| `views/needle` | canvas: construction space (see §3.3) |
| `views/chart` | printable chart, print stylesheet |
| `views/tracker` | row-by-row knitting mode |
| `panels/` | the controls |

**Module size budget: 400 lines.** `planned_pooling`'s `app.js` reached 1770 and
`controls.js` 1011, and both got hard to move around in. Splitting is cheap when
the split is forced early and expensive when it is deferred.

### 3.3 Two views, because there are two spaces

This falls straight out of §2.1 and I think it is the key UI idea.

- **Fabric view** — physical space. The fanned, curving piece as it will block.
  For judging the design and seeing the distortion.
- **Needle view** — construction space. A plain rectangle: `x` = needle position
  `1..N`, `y` = global row counter. Short rows show up as partial bars, and the
  wedges read as a staircase. This is where you actually read turns off, and it
  is the view that makes the construction comprehensible.

Selecting a stitch in one highlights it in the other. The mapping between them is
a core function of `mesh/` and gets its own tests.

### 3.4 Geometry, in two stages

**Analytic** (shape-constrained mode). For the shapes in the library, wedge
schedule and flat layout have closed forms. Instant, exact, no solver.

**Relaxed** (image-driven mode, arbitrary designs). Treat the mesh as a 2D
mass-spring system: vertical edges rest at `h`, horizontal edges at `w`, solve
for positions that minimise energy. A few hundred iterations in a worker. The
residual energy after convergence is itself the answer to "will this lie flat?" —
low residual means flat, high residual means it is cupping, and the app says so.

Build analytic first. The relaxed solver is only needed for mode two.

### 3.5 Region decomposition

The heart of the short-row method module.

1. **Quantise** the sampled colours to the palette. **Do not dither.**
   Floyd–Steinberg produces beautiful gradients and shatters them into thousands
   of one-stitch regions, which is unknittable. Posterise, then clean.
2. **Clean** each colour mask morphologically — open and close — to remove
   specks and thin necks that would each cost a yarn join.
3. **Enforce contiguity.** For each region and each row of that region, keep the
   largest interval; reassign the rest to a neighbour or split off a new region.
4. **Build the dependency graph.** Region `B` depends on `A` if any stitch at the
   bottom of `B` sits on a stitch of `A`. Topologically sort.
   **Cycles are the interesting failure**: they mean two regions each need the
   other knitted first, and the fix is to cut one horizontally. Detecting and
   breaking cycles is a named, tested piece of work, not an afterthought.
5. **Schedule turns** inside each region: per row, the interval `[l, r]`, and
   whether that sequence of intervals is reachable by short rows from one yarn
   attachment. If not, split the region.
6. **Emit the plan**: ordered regions, each with its rows, intervals, turn points,
   joins, and yarn.

Objective to minimise: number of regions (ends to weave), plus boundary
roughness, against fidelity to the image. **That trade-off becomes a slider in the
UI** — "faithful ↔ simple to knit" — rather than a constant buried in the code.
Making the trade-off visible and adjustable is the single best interface decision
available here.

---

## 4. Lessons from `planned_pooling`, and what changes

Drawn from that codebase and its commit history.

**1. Layer separation paid off. Keep it.**
Yarn / consumption / construction / render held up across a year of features.
Promoted here into explicit pipeline stages with typed boundaries.

**2. The DOM as the source of truth did not scale.**
`settings.js` read forty-five fields by element id; `controls.js` was a thousand
lines of hand-built rows. Every new control had to be added in four places.
→ One state object is the truth; the UI is a function of it. This is the main
reason a framework is worth its cost here.

**3. "One regeneration path" was learned the hard way.**
The commit *"Route every control through one regeneration path"* came near the
end, after the bug it fixes had been hit repeatedly.
→ Built in from the first commit. But memoised per stage, because unlike
redrawing 7 000 rectangles, re-segmenting 60 000 stitches on every keystroke is
not free.

**4. Problems were surfaced late.**
The stale badge — *"Say when the fabric on screen is out of date"* — arrived at
the very end.
→ `problems[]` is part of every stage's return type from day one. A pattern that
cannot be knitted must never be presented as if it can.

**5. Mode flags multiplied and then had to be undone.**
*"Ask per section what is in force, not per mode"*, *"Take the mode out"*,
*"Let three sections answer for themselves"* — three commits spent removing a
global mode concept that had spread.
→ Whether a capability is in force is derived, in one place. The colorwork method
is a **module boundary**, not a set of `if` branches sprinkled through the code.

**6. There were almost no tests, and the one algorithm that needed them got a
bespoke HTML page.**
`test-calibration.html` exists because the least-squares solver was impossible to
trust by eye. Every algorithm in *this* project is in that category.
→ Vitest from commit one. Region decomposition, cycle breaking, turn scheduling
and the two-space coordinate mapping get real test suites.

**7. Settings versioning was manual and per-field.**
`SETTINGS_VERSION` plus forty-five hand-written reads and writes.
→ One serialisable state object, versioned migrations, and a **project file** you
can export and re-import. Images are far too large for `localStorage`, so images
live in IndexedDB and the last session restores automatically.

**8. Files grew past the point of easy navigation.** See §3.2's line budget.

**9. The prose was the best thing about that codebase — keep it.**
Comments that explain *why* ("Stop before touching the canvas, not after…"), and
UI hints written in plain English for a knitter rather than a programmer. That is
a genuine strength and an explicit convention here.

**10. Canvas per cell was fast enough. Keep canvas; budget for ten times more.**
7 000 cells before, plausibly 60 000 now, plus glyph shapes rather than
rectangles. Canvas 2D should still hold. WebGL only if measurement says so.

**11. Measurement beat guessing.**
The calibration solver — swatches in, real per-stitch consumption out — is what
made predictions trustworthy. That code ports directly for yarn quantities per
colour. The same discipline applies to gauge, with one addition specific to this
project: **short rows change row gauge near turns**, so the app should ask you to
knit a small test wedge and report it before committing to a large piece.

---

## 5. Milestones

Each ends with something visible and usable.

Reordered around one principle: **the model cannot be settled by reasoning, so
every guess in §2.4 gets tested by something knitted as early as it possibly can
be.** The first two milestones exist only to produce test pieces. Nothing about
pictures happens until the geometry has been checked against yarn.

| | Milestone | Ends with |
|---|---|---|
| **M0** | Scaffold: Vite, Svelte, TS, Vitest, Pages workflow, `model/physical` with its defaults written down | A deployed page, and every guess named in one file |
| **M1** | One wedge: predict its shape, print instructions for it, take back the measurements | **Knit one wedge.** Cast on, turn every other row, bind off — an evening. Tests flare and turn gauge in isolation, and the app corrects itself from what you measured |
| **M2** | Two wedges in two colours, joined | **Knit the join.** Tests §2.5, the assumption most likely to be wrong, while it is still cheap to be wrong about |
| **M3** | `shape/` + `mesh/` + analytic layout + fabric view + needle view | A whole shawl's geometry on screen, in both spaces, now built on a model that has met yarn |
| **M4** | `image/` + `color/` + `palette/`, sampling onto the mesh | Drop in a photo, see it warped onto the shawl in yarn colours — first *"oh"* moment |
| **M5** | `methods/shortrow/`: decomposition, dependency order, cycle breaking, turn scheduling, validation | A full plan: regions numbered, turns marked, honest warnings |
| **M6** | `instructions/` + printable chart | A complete pattern for a real piece |
| **M7** | Tracker, persistence, project files | Knit from a phone without losing your place |
| **M8** | `estimate/` ported from `planned_pooling` | "You need 340 m of the blue" |
| **M9** | Image-driven mode: relaxation solver, assisted wedge placement | The second, harder project mode |
| **M10** | A second colorwork method — stranded is the easiest | Proof the method boundary is real |

**Why M1 and M2 look so small.** Each tests exactly one guess, with nothing else
in the way. If a wedge comes out at 40° when the app predicted 55°, that is
unambiguous — there is only one thing it could be. Discovering the same error at
M6, inside a hundred-region pattern, tells you almost nothing about its cause.
Cheap tests, run early, in isolation.

**Keep a prediction log.** Every test piece records what the app predicted, what
you measured, and what changed as a result. It is a few lines of JSON, and it is
the only way to see whether the model is actually getting better rather than just
getting different.

**On the method plugin interface:** I will *not* design it up front. An interface
with one implementation is invariably the wrong interface. Short-row code stays
behind a module boundary so extraction is mechanical, and the actual interface
gets written at M8 when there is a second case to generalise from.

---

## 6. Risks, ranked

1. **My model of the fabric in §2 is wrong or partial.** Certainly true in
   places. Not mitigated by trying harder to be right up front — the physical
   half of the model cannot be settled by reading, only by knitting. Mitigated
   instead by *structure*: guesses isolated in `model/physical`, the planner
   forbidden from holding constants of its own, and M1/M2 testing each guess
   against yarn before anything is built on top of it. Reading a published
   pattern is still worth an hour, but as a source of hypotheses, not as proof.
2. **Image-driven mode may not be fully automatable.** Planned as assisted rather
   than automatic, and scheduled late so the app is already valuable without it.
3. **Designs that will not lie flat.** Inherent to sculptural work. Handled by
   detecting it and saying so, not by preventing it — sometimes cupping is what
   you wanted.
4. **Gauge near turns differs from swatch gauge.** Handled by measurement at M6,
   and by the test piece at M4.
5. **Region count explodes on photographic input.** Mitigated by no dithering,
   morphological cleanup, and the faithful↔simple slider. Photographs of faces
   will never work well; graphic images with flat colour areas will work
   beautifully. The app should be honest about that in its example gallery.
6. **Performance on large meshes.** Mitigated by workers and memoisation, and by
   measuring at M2 rather than assuming.

---

## 7. Conventions

- Comments explain **why**, not what. Follow `planned_pooling`'s voice.
- UI text is written for a knitter, in plain English, no jargon that a pattern
  would not use.
- Pure core modules never touch the DOM and are always tested.
- Every stage returns its problems; nothing fails silently.
- Not in a cloud-synced folder — Git and sync tools race and corrupt repositories.
  GitHub is the backup.
- Units: metric internally (millimetres, metres), displayed in whatever the user
  picked. Same approach as `planned_pooling`, which got this right.

---

## 8. Immediate next steps

1. **Me**: finish M0 — test runner, publishing workflow, and `model/physical`
   with every guess from §2.4 written down as a named default.
2. **Me**: M1 — the single-wedge predictor, its printed instructions, and the
   form that takes your measurements back.
3. **You**: knit that wedge. That is the first real data this project has.
4. **You**, whenever convenient: name the shapes you want in the library at M3,
   in priority order.

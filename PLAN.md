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
| Audience | **Other knitters, publicly** — strangers arrive from a link and use it without us there |
| Technique | **Balanced short-row colorwork in garter** — every stitch ends up with the same number of rows; motifs come from *when* and *in which yarn* each part of a row is knitted. Ridges wave locally, but the overall depth is even. Corrected 2026-10-10 by the textbook (§2.5); this replaced "sculptural, unequal rows" |
| Balanced or not | **Both, in one model** (2026-10-13). Balance is a *result*, not a rule: every pattern makes a shape — a rectangle, a fan, or something that won't lie flat — and the app says which. Balanced came first only because the textbook teaches it. Replaces "flaring later" |
| Turn technique | **German short rows** by default — what the textbook uses |
| Shape vs. picture | **Both modes**, chosen per project: shape-constrained, and image-driven |
| Technology | **Svelte 5 + Vite + TypeScript** |
| The model | **Ours to work out, never the user's** — §2.4. They get parameters and options; we get the physics |
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
are joined along their whole length, so if their lengths differed, the fabric
would have to fan out or pucker.

**In balanced short-row colorwork they don't differ.** That's the core rule the
textbook teaches (§2.5): by the end of every repeat, every wale has been worked
the same number of times. Different parts of a row are knitted at different
times and in different yarns, and *that* is what draws the picture. The fabric
stays even in depth; what moves is the garter ridges, which bend into waves near
turns.

### 2.2 The core model: height and colour per stitch

Everything in balanced short-row colorwork can be tracked with two things per
stitch:

- its **height** — how many rows it has been worked so far, and
- its **colour stack** — which yarn worked each of those rows, bottom to top.

A pattern is an ordered list of **passes**. Each pass is one yarn knitting one
unbroken run of stitches in one direction, ending at a turn or an edge. Every
stitch in the run gets one more row of height, in that pass's yarn.

- **Balanced** means every stitch has the same height at the end of each repeat.
- **The picture** is each wale's colour stack, read bottom to top.
- **The chart** in a short-row pattern is just this list of passes, drawn in
  knitting order — what §2.1 calls construction space. The textbook draws its
  charts exactly this way.

This is the model the first code builds (`methods/shortrow/passes`), checked
against the textbook's own patterns before anything else is built on it.

#### Balanced or not: what shape a pattern makes

Balance is one possible result, not a rule. Short rows never add stitches, so
every full row keeps its length. What unequal columns change is the rows'
*direction*:

- **Every column the same length:** a rectangle, with ridges waving around
  motifs.
- **Columns longer on one side:** the full rows tilt apart on that side, like
  ribs of a fan. The columns become arcs and the rows spokes. It still lies flat.
  The opening angle is the difference in column length divided by the distance
  between the columns — the old flare relation `θ ≈ 2h/(s·w)`, now confirmed by
  the drawing.
- **Columns longer in the middle:** no flat shape fits. The next full row has to
  arch over the bump with the same stitches, so it stretches; real yarn pops up
  instead, as in a short-row heel. This is the case worth warning about.

`mesh/settle.ts` works out which. It fits a straight line through the column
lengths: the slope gives the fan, and whatever the line can't explain is a bump
or dip that forces a row to stretch. The local ridge waves come from
`mesh/relax.ts`, run inside that shape. For balanced fabric the result is
identical to before.

An earlier attempt solved every stitch's position as one free net of springs.
It didn't settle, took 13 s on Harvest, and made balanced fabric fan by up to
23°. It was dropped.

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
4. **Every turn needs a technique.** German short rows by default; wrap-and-turn
   and shadow wraps are alternatives. The return pass closes the gap ("work the
   double stitch together as one"). The textbook draws a turn as `∞` in the
   chart cell just past the last stitch of the pass.
5. **Yarns wait where they stopped.** Yarns are not carried across the back. A
   pass in a yarn can only start where that yarn's last pass ended. This is why
   the textbook's catch-up rows happen when and where they do.
6. **Balance is something you ask for, not a rule.** If the target is a
   rectangle — the textbook's swatches — every stitch must reach the same height
   by the end of each repeat, and a missed catch-up row is a mistake: the edge
   pulls in. If the target is a wedge or a fan, unequal columns are the point.
   What is always a problem is a shape that can't lie flat: a bump or dip that
   forces a row to stretch. Picture → pattern (M5) will take a **target shape**
   as input, and a rectangle is simply the target that yields balance.
7. **Ends to weave = yarn attachments, not regions.** A yarn that waits at an
   edge can make many motifs without being cut — the textbook's stripe patterns
   use one B yarn for every stripe. **Number of attachments is a headline quality
   metric.** A design that needs a fresh join per region has two ends per region,
   and nobody will knit it.
8. **RS / WS alternate.** Garter is the ground — it lies flat and reads the same
   on both sides.

### 2.4 What we are guessing, and who is allowed to see it

The rules above are combinatorial and certain. Everything in this section is a
claim about how yarn behaves, and **every one is a guess until something has been
knitted and measured.**

The important decision is not what the guesses are. It is **who has to care about
them.** Every quantity the app needs falls into exactly one of three categories,
and the category decides where it lives and whether a user ever sees it.

**Parameters — the user supplies them.** These genuinely vary from project to
project and from knitter to knitter, and every one is something an ordinary
knitting pattern already asks for. Nothing here is novel or intimidating:

> gauge (stitches and rows per 10 cm) · yarn colours · the picture · finished
> size · shape · garter or stockinette · preferred turn technique

**Options — the user chooses, because there is no correct answer.** These are
genuine design trade-offs, and it would be presumptuous for the app to decide
them:

> faithful to the picture ↔ simple to knit · how many ends they are willing to
> weave in

**The model — ours to work out, and never the user's problem.** This is the
category that does not exist yet, and it is important to be precise about how
little we know:

| Quantity | Current hypothesis | Confidence | What settles it |
|---|---|---|---|
| **Height of a German double stitch** | counts as a full row for both passes it sits between | consistent with the three textbook stripe patterns, which balance under it | measure a test stripe: do the turn columns sit level? |
| **How far ridges bend near turns** | the fabric relaxes until the yarn in each pass and the spacing of each column balance (`mesh/relax.ts`); one ratio, `yarnPull` ≈ 0.3, decides how far | **documented**: fitted by eye to the book's Harvest and Shoal photos (2026-10-11) — motifs come out pointed and curved both ways, stems wave round them | a finer fit against more book photos, then the M1 test stripe photographed and compared the same way |
| Stiffness of a German double stitch | half an ordinary row | invented; should explain the tapered stripe ends in the book's photos | compare stripe ends against Short / Alternating Stripes photos |
| Steepest staircase before a turn line gapes | — | the textbook uses steps of 1–4 stitches per pass | a test piece with increasing steps |
| Flare per short-row pair | `θ ≈ 2h/(s·w)` | **derived**; the fan drawing reproduces it independently (Wedge example: 56° vs 52° predicted) | knit the Wedge example, measure its angle |
| Won't-lie-flat threshold | a row stretched more than 10% | invented; the measure is now row stretch, not "residual energy" | knit the Bump example and bumps of other sizes; see which lie flat |
| Smallest bump that matters | 4 stitches; narrower unevenness is absorbed by the double stitches | invented | bumps of a few widths, knitted |
| Stitch shape | 2 rows to a stitch's width (garter) | derived from typical gauge | the knitter's own gauge, once the app asks for it |

This table has two ways to earn confidence, not one. **Measured** — we knit a
test piece ourselves and read it under our own gauge — sits above
**documented** — pulled from a real, published, working example somebody else
made, extracted by us but without our own conditions to control. Both outrank
reasoning from geometry alone. See §2.5.

#### The categories will move, and the code must let them

`θ ≈ 2h/(s·w)` is not a law with an unknown coefficient. It is a guess at the
*shape of the relation*, and knitting a wedge may tell us the relation is
different in kind — that it bends with the size of the wedge, or depends on the
turn technique, or on the yarn.

That has a consequence people usually get wrong. **Once we understand the model,
some of what sits in this table stops being a fixed constant and becomes an
ordinary parameter** — a number the user supplies, or one that falls out of their
gauge, or one that follows from which turn technique they picked. We cannot say
now which will land where. So:

- **A quantity's category is data, not architecture.** Each entry in
  `model/physical` declares whether it is fixed, derived from gauge, or supplied
  by the user. Moving one between categories is editing a field — never a
  refactor, never a change to the planner.
- **The relation is a function, not a coefficient.** `flare(span, w, h, technique)`
  can be replaced wholesale when we learn its shape is wrong. Nothing that calls
  it has to change.
- **Confidence is recorded next to the value**, because a number we fitted from a
  measured wedge and a number I invented while writing this plan should not look
  alike in the code.

What does *not* change with any of this: none of it is the user's problem. Before
we understand the model they are protected from our uncertainty; afterwards they
are given whichever few quantities genuinely vary, in the ordinary language of a
knitting pattern. The boundary moves; the principle does not.

#### Consequences for the code

- **The planner asks the model; it never assumes.** Any line of planner code that
  wants to know how far a wedge flares calls into `model/physical`. Changing our
  mind is then one edit rather than an archaeology expedition. Enforced by a test
  that fails if a planner module contains a bare numeric constant — because this
  rule dies the first time somebody hardcodes a `0.7` at eleven at night.
- **`model/physical` holds relations, not just numbers.** Each entry carries its
  current form, its category, its provenance — which test piece produced it and
  when — and how much we trust it. Read-only at runtime, and expected to be
  rewritten several times before it settles.
- **Learning happens in development, not in the app.** `planned_pooling` derived
  yarn consumption from swatches the user measured, which was right — there, the
  user and the developer were the same person. Here they are not, so the same
  machinery moves into a workbench (§3.6) that only we ever open. The app ships
  already knowing.
- **Model constants are stamped into each project file**, so improving the model
  never silently changes a pattern somebody is halfway through knitting.

#### When the model is wrong for somebody

It will be, eventually, and they will have no knob to reach for. So the pattern
states **checkable predictions** at a few points — *"after the first wedge your
top edge should measure about 34 cm"* — and a knitter whose work disagrees finds
out early, cheaply, and can tell us. They verify; they do not configure.

Behind that sits exactly **one hidden page** listing the constants, with import
and export of a model file. It is one page rather than controls scattered through
the interface, and nothing in the normal flow mentions or links to it. It exists
for the determined, and for us when diagnosing a report.

### 2.5 Learning from what already exists, before knitting to find out

M1 and M2 are the method of last resort: discover the model by knitting it from
nothing. It isn't the cheapest method available — a great many short-row
colorwork pieces have already been made and published, and some of that is
photographable or watchable. Before either test piece, a research pass over
whatever patterns and tutorials we can get hold of, in two passes, always in
that order:

**Pass A — does a real example break the model?** Checked against §2.3's rules
and §2.2's model, one at a time. A genuine disagreement here
outweighs any number Pass B could extract, because it's the one outcome that
would actually change the plan rather than fill in a table.

**Pass B — extract what's measurable.** For sources that survive Pass A: span in
stitches, row count, a photographed angle, which turn technique, how a join is
described — in our own words, our own counts, never the source image or its
text reproduced into the repo. Each becomes a **reference observation**,
logged in `research/observations.md`.

A photo or a paused video frame is the reliable channel — read directly and
extracted with reasonable confidence. A bare video link is weaker than it
looks: the video cannot be watched end to end, only fetched for its page text
or jumped to a timestamp that's been pointed out. A link plus a timestamp is a
source; a bare link mostly isn't yet.

Confirmed, extracted numbers move the relevant row in §2.4's table from
`invented`/`derived` to `documented`, citing the observation. M1 then goes in
testing an informed guess instead of discovering one from nothing, and may
shrink accordingly. `research/` is deliberately outside git — see §7.

#### What the first pass found (2026-10-10)

Source: nine photos of a short-row colorwork stitch dictionary (title to come).
Notes in `research/observations.md`.

- **It contradicted the plan's core.** The book's central rule is *balance*:
  every stitch gets the same number of rows. Unbalanced fabric is the mistake.
  The plan's "sculptural, unequal rows" target was wrong for this technique, and
  §1, §2.1–2.3 have been rewritten around balance. Flaring is now a later mode.
- **The book's charts are construction-space charts** — one line per pass, in
  knitting order. That matches §2.2's model and §3.3's needle view.
- **Balance checked by hand** on three stripe patterns: every stitch gets 6, 8
  and 16 rows per repeat respectively. The catch-up row length is
  `total stitches − previous motif stripe`.
- **Two rules were missing** and are now in §2.3: yarns wait where they stopped,
  and ends to weave count yarn attachments, not regions.
- **One written row can hold many passes** — a zigzag of shrinking turns in one
  yarn (the Harvest pattern builds a leaf this way).

Second batch, same day (Harvest and Shoal, upright photos):

- **The forward simulator reproduces all five patterns read so far**: every
  stitch at equal height (6, 8, 16, 28 and 22 rows per repeat), and every pass
  starting exactly where its yarn was waiting. That includes Harvest's 74 passes
  and Shoal's 60. The turning-stitch counting rule is confirmed directly by a
  chart label (Harvest row 10, "38sts").
- **Two yarns can share a row.** In Shoal, A knits a few stitches and *stops
  mid-row*; B takes over, zigzags, comes back, and A finishes the row. A colour
  boundary within a row can be a handoff, not only a turn.
- **One colour can need several strands.** Shoal's two motifs start in different
  columns, so each keeps its own strand of B waiting in place. Strands, not
  colours, are what "yarns wait where they stopped" is about — and each strand
  is an attachment, with two ends to weave in (§2.3 rule 7).

### 2.6 Joining colours — now much simpler than feared

This section used to say joining wedges was the weakest part of the model: a new
wedge's row-end stitch worked together with a finished neighbour's edge stitch,
with no idea how many edge stitches that eats.

The textbook removes most of that worry. In balanced short-row colorwork, the
boundary between two colours *is* a turn. One yarn works up to a point and turns
— a German short row — and a later pass in the other yarn knits across the
double stitch as one. No stitches are eaten, nothing is picked up.

What's left uncertain is physical, not combinatorial: how steep a staircase of
turns can get before it gapes, and how far the ridges bend near turns (§2.4).

### 2.7 The two project modes

> **Written for the old flaring model (before 2026-10-10).** Both modes still
> stand — a shape chosen first, or a picture driving the design — but the
> geometry below assumed unequal rows. With balanced fabric, the "shape" is
> mostly the outline of the piece, and the hard part moves to choosing passes so
> each wale's colour stack matches the picture. This section gets rewritten once
> the forward simulator works and the first test stripe has been measured.

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

### 2.8 The distortion problem — the most important thing on screen

Balanced fabric doesn't flare, but it doesn't stay a neat grid either. Every
photo in the textbook shows garter ridges bending into waves near turns —
stripe ends taper, backgrounds ripple around motifs. So **the picture will still
be distorted**, locally rather than globally, and the amount depends on where the
turns are. If the app only ever shows the picture on a neat rectangular chart,
it is lying to you, and you will find out after fifty hours of knitting.

So the preview always renders the design **with the ridges bent the way the
fabric will bend them**, side by side with the original. How far they bend is
the top unknown in §2.4, and the first thing the M1 test stripe measures.
Everything else in the UI is negotiable; this is not.

---

## 3. Architecture

> **Note (2026-10-10):** the geometry parts of this section — wedge schedules,
> the mesh, analytic layout, the relaxation solver — were designed for flaring
> fabric. The layering, the pipeline and the conventions still stand. The
> geometry gets redesigned around balanced fabric once the forward simulator
> (§2.2) is working and the first test stripe has been measured.

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
| `model/physical` | **everything we are guessing** (§2.4) — flare, turn gauge, join allowances — each with its current relation, category, provenance and confidence. Read-only at runtime |
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

Development only, and **excluded from the production build**:

| Module | Responsibility |
|---|---|
| `dev/calibrate` | the workbench of §3.6 — measurements in, fitted relations out |
| `dev/model` | the one hidden page listing the constants, with model import/export |

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

### 3.6 The calibration workbench — ours, not the user's

A page in the repository that is not part of the app. Its own route,
`/calibrate`, excluded from the production build and unreachable from the
interface. `planned_pooling`'s `test-calibration.html` was the same idea.

What it does:

1. Prints the instructions for a test piece — "cast on 60, turn every second row
   3 stitches short, 20 pairs, bind off".
2. Records what the app **predicted** that piece would measure.
3. Takes what it **actually** measured.
4. Fits the relation, and emits a TypeScript file we read, sanity-check and
   commit.

It also carries the **prediction log** — predicted, measured, and what changed as
a result, one entry per test piece. Cheap to keep, and the only way to see
whether the model is genuinely improving rather than merely changing.

The output of this page is source code. The app itself never runs it.

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

**11. Measurement beat guessing — but the measuring moves to us.**
The calibration solver made predictions trustworthy because it derived numbers
from swatches instead of asking anyone to tune them. Keep the discipline; change
who performs it. There, the user and the developer were the same person, so
asking for measurements was asking the developer to do development. Here they are
strangers, so the measuring happens at M1 and M2 in the workbench, and what
reaches them is an app that already knows. The solver code itself still ports
directly, for yarn quantities per colour at M8.

---

## 5. Milestones

Each ends with something visible and usable.

Reordered around one principle: **the model cannot be settled by reasoning, so
every guess in §2.4 gets tested against reality as early as it possibly can be
— published examples first, knitting second, since a photo is cheaper than an
evening's yarn.** The first two milestones exist only to produce test pieces,
and a research pass (§2.5) precedes them. Nothing about pictures happens until
the geometry has been checked against something real.

| | Milestone | Ends with |
|---|---|---|
| **M0** | Scaffold: Vite, Svelte, TS, Vitest, Pages workflow, `model/physical` | A deployed page, and every guess named in one file with its category and confidence |
| *before M1* | Research pass (§2.5) over whatever patterns and tutorials we have. **First pass done 2026-10-10** | §2.4's table has as many rows moved to `documented` as the material allows |
| *before M1* | **Forward simulator** — `methods/shortrow/passes`: a list of passes in, each stitch's height and colour stack out, with balance and rule checks (§2.2) | Reproduces the textbook's stripe patterns exactly: balanced, with the right colours in every column |
| **M1** | One two-colour test stripe, its printed instructions, and the workbench (§3.6) | **We knit one stripe.** An evening. Measures how far ridges bend near a turn and whether the double stitch sits level — the two top unknowns in §2.4 |
| **M2** | A staircase of turns in two colours | **We knit a diagonal.** Tests how steep a staircase can get before it gapes (§2.6) |
| **M3** | `shape/` + `mesh/` + analytic layout + fabric view + needle view | A whole shawl's geometry on screen, in both spaces, on a model that has now met yarn. **First end-user-facing work** |
| **M4** | `image/` + `color/` + `palette/`, sampling onto the mesh | Drop in a picture, see it warped onto the shawl in yarn colours — first *"oh"* moment. Decide here whether end users get the needle view |
| **M5** | `methods/shortrow/`: decomposition, dependency order, cycle breaking, turn scheduling, validation | A full plan: regions numbered, turns marked, honest warnings |
| **M6** | `instructions/` + printable chart + checkpoint predictions | A complete pattern for a real piece |
| **M7** | Tracker, persistence, project files | Knit from a phone without losing your place |
| **M8** | `estimate/` ported from `planned_pooling` | "You need 340 m of the blue" |
| **M9** | Onboarding, example gallery, image guidance, mobile, accessibility | **Fit to be found by a stranger** (§8) |
| **M10** | Image-driven mode: relaxation solver, assisted wedge placement | The second, harder project mode |
| **M11** | A second colorwork method — stranded is the easiest | Proof the method boundary is real |

**M1 and M2 are not features.** They exist to produce two knitted objects and the
numbers that come off them. Nobody but us will ever see either page. The
end-user-facing app begins at M3, standing on a model that has been measured
rather than imagined.

**Why they look so small.** Each tests one guess with nothing else in the way. If
a wedge comes out at 40° when the app predicted 55°, that is unambiguous — there
is only one thing it could be. The same discrepancy discovered at M6, inside a
hundred-region pattern, tells you almost nothing about its cause.

**On the method plugin interface:** I will *not* design it up front. An interface
with one implementation is invariably the wrong interface. Short-row code stays
behind a module boundary so extraction is mechanical, and the actual interface
gets written at M11 when there is a second case to generalise from.

---

## 6. Risks, ranked

1. **The model is wrong in kind, not merely in its numbers.** This already
   happened once. The first textbook pass showed the plan aimed at the wrong
   technique entirely: flaring instead of balanced (§2.5). It was caught by
   reading before any geometry was built, which is what the research pass is
   for. What's left: the physical relations in §2.4 (double-stitch height, ridge
   bend) may depend on things they don't currently mention. Mitigated by
   *structure*: relations as replaceable functions, categories stored as data,
   the planner forbidden from holding constants, and early test pieces measuring
   each guess before anything is built on top.
2. **Image-driven mode may not be fully automatable.** Planned as assisted rather
   than automatic, and scheduled late so the app is already valuable without it.
3. **Unbalanced designs.** In balanced mode this is a planner error, never a
   design choice: the forward simulator flags any pattern that leaves stitches
   at different heights. In the later flaring mode, uneven height becomes
   deliberate, and the warning becomes "this will not lie flat".
4. **Gauge near turns differs from swatch gauge.** Measured at M1, and absorbed
   into the model rather than into the user's lap.
5. **Region count explodes on photographic input.** Mitigated by no dithering,
   morphological cleanup, and the faithful↔simple slider. Photographs of faces
   will never work well; graphic images with flat colour areas will work
   beautifully. The app should be honest about that in its example gallery.
6. **Performance on large meshes.** Mitigated by workers and memoisation, and by
   measuring at M4 rather than assuming.

---

## 7. Conventions

**The governing UI rule.** The user never configures the model. They give the app
what a knitting pattern would ask for anyway, and choose where a design choice
genuinely exists. Anything we can work out once, we work out once and ship the
answer. Where we have not worked it out yet, they are shielded from the fact
rather than enlisted to help.

- Comments explain **why**, not what. Follow `planned_pooling`'s voice.
- UI text is written for a knitter, in plain English, no jargon that a pattern
  would not use.
- Pure core modules never touch the DOM and are always tested.
- Every stage returns its problems; nothing fails silently.
- Not in a cloud-synced folder — Git and sync tools race and corrupt repositories.
  GitHub is the backup.
- Units: metric internally (millimetres, metres), displayed in whatever the user
  picked. Same approach as `planned_pooling`, which got this right.
- Research material — pattern photos, video frames, our notes on them — lives in
  `research/` and is never committed (§2.5). Only what we derive from it, cited
  and confidence-tagged, crosses into `src/model/physical.ts`. Because that
  folder sits outside git, it also sits outside "GitHub is the backup" above —
  the one deliberate exception to that rule.

---

## 8. Shipping it to strangers

`planned_pooling` was for one person who could ask its author what a control
meant. This one is for knitters who will arrive from a link, alone, and give it
about a minute. That changes real things, and M9 exists to pay for them.

**Nothing leaves the browser.** No backend, no accounts, no uploads — the picture
is decoded and processed locally and never sent anywhere. That keeps hosting
free, leaves nothing to breach, and is worth stating plainly on the page, because
people are right to hesitate before handing their artwork to a website.

**The technique needs explaining, not just the app.** A visitor may never have
seen sculptural short-row colorwork. The landing page has to show what the thing
*is* before asking anyone to upload anything.

**Be honest about what works.** A photograph of a face will produce hundreds of
regions and a pattern nobody could knit. A flat graphic image with a handful of
colours will produce something lovely. The app should lead with examples that say
so, rather than let people find out through failure and conclude the app is
broken.

**Bad input has to be survivable** — enormous images, single-colour images,
transparency, animated GIFs, an absurd gauge, a shape smaller than one wedge.

**It will be opened on a phone**, at a yarn shop, to check something mid-project.
Mobile and accessibility are requirements, not polish.

**Rights.** People will feed in artwork they do not own. One short, non-preachy
line saying they are responsible for what they upload, and no more than that.

---

## 9. Picture → pattern: the first steps

Agreed 2026-10-23. The pattern → fabric direction is done: reading patterns,
counting rows, drawing the shape (balanced or not), comparing with photos. This
section plans the reverse, starting small.

### Why it starts with motifs, not pictures

Going backwards has many answers. In short-row colorwork *how* a shape is built
is part of its look: the book's fish are fish because B works a zigzag of turns
that shrink then grow. The same colours stacked row by row would look different
and need far more yarn ends. So the first generator builds shapes the way the
book does — from motifs — and painting a free grid comes second.

### Words used here

- **Pass** — one trip of the needle in one yarn: from where it starts to where it
  turns, reaches an edge, or hands over to another yarn. One line of the chart.
  The app works in passes.
- **Written row** — how a pattern groups passes for the knitter to read. Shoal's
  row 7 is twelve passes; Short Stripes' row 2 is one.

### Rules every pattern must keep

**1. No turning stitch directly on top of another.** A turn may not land in the
same column as a turn just below it with no ordinary row between them. Once an
ordinary row has been knitted over it, a turn in that column is fine again. The
app checks this on every pattern — generated, typed or from the book.

**2. Every stop is someone else's start.** The needle never jumps. Wherever one
colour stops, the next stitch is worked by another colour — either a **new
yarn** joined there (two more ends), or a **yarn already waiting there**: the one
put down earlier. To pick that one up again, the current colour must come back
to the exact stitch where it was left. Two kinds of hand-over occur:

- **at an edge** — the next colour starts on the same stitch and goes back the
  other way (a row end);
- **mid-row** — the next colour starts on the next stitch and carries on the same
  way (Shoal: A stops at stitch 4, B starts at 5).

**3. A colour goes out and comes back.** From picking a yarn up to putting it
down, it makes an even number of passes, so it ends where it began and is
waiting there next time. The colours nest like brackets: A goes out and hands to
B; B goes and returns; A picks up and returns. An odd trip is possible, but then
the next colour has to be *brought* to where it ended — the mechanism is left for
later, and the first generator keeps to even trips.

Checked against the book (2026-10-23): all five patterns, two repeats each — no
odd trips anywhere, and every hand-over is one of the two kinds above.

### Stage A — Writer: passes → written rows

Turns a list of passes back into rows in the book's style: "(A) K4, (B) K14, SR,
K12, SR…". Mid-row yarn changes stay in one row; zigzags are grouped as the book
groups them.

- **Check:** round trip. Write any pattern out, read it back with the reader, and
  the passes must be identical. All five book patterns, privately.
- **Done 2026-10-23** (`methods/shortrow/writer.ts`). All five book patterns
  write out **identical to the book's own text** — same row breaks, same "Rows 4
  to 5" merges, same "SR, knit to end" — and read back pass for pass. The book's
  row-break rule, worked out from its patterns: a row ends at an edge, or at a
  turn whose next pass runs all the way back to an edge, and only after a pass
  that went the row's own way.

### Stage B — Catch-up solver (development tool for now)

Given a pattern that leaves some columns short, it adds background short-row
pairs to level them.

- **Step size is free.** Pairs may shorten by one stitch or several.
- **Choices per motif:** which edge to work from, whether the catch-ups come
  before or after the motif, and the step size. The book says placement changes
  the look, so this is a design choice, not a fixed rule.
- **The turn rule holds.** Where the tidy answer would stack turns — a flat
  stretch several rows short — it staggers them across neighbouring columns,
  leaving at most a stitch or so of unevenness, which the shape engine already
  treats as absorbed.
- **It says when it can't.** Short columns in the middle, out of reach from the
  edges, are reported, not guessed at.
- **Check against the book:** remove the catch-up rows from Alternating Stripes,
  Leaning Stripes, Harvest and Shoal, and let the solver put them back with the
  book's settings. It should reproduce the book's own rows; where it doesn't,
  that shows exactly what's misunderstood.
- **Done 2026-10-23** (`methods/shortrow/balance.ts`, `rules.ts`, and a
  development-only "Balance it" tool on the page). What the book check showed:
  - All 14 catch-up groups in the five patterns are rebuilt with the right pair
    lengths. In 13, one of the three orders (longest first, shortest first,
    alternate) matches the book exactly. Harvest row 16 uses an order outside
    them (K10, K8, K11) — a custom order would cover it.
  - The stripe patterns' catch-ups come out exactly even from "level everything
    from here". Harvest and Shoal don't level all at once: the book spreads
    their catch-ups through the repeat, some *before* the motif to shape its bed.
    That is the before/after choice Stage C will offer.
  - Rule 1 holds in all five book patterns: no stacked turns. It caught one of
    our own examples breaking it (the first Bump), which was redesigned.
  - Building it also caught a rule 3 slip: carrying the yarn to the other edge
    with one full row and not bringing it back left the repeat an odd number of
    rows. The solver now always brings the yarn home.

### Stage C — One motif on a background

You choose the motif (stripe, or lens/fish), its width and position, the number
of turns and their step, and the catch-up choices from Stage B. The app builds
the whole pattern:

1. the base rows;
2. A knits to the motif and hands over to B;
3. B's zigzag;
4. A finishes the row;
5. the Stage B catch-ups.

- **Check:** the reader, counter and shape engine must say "lies flat — a
  rectangle"; the turn rule must hold; and the drawing must show the motif asked
  for.
- **Done 2026-10-23** (`methods/shortrow/motif.ts`), not yet on the page (that
  is Stage D). The motif's zigzag is Shoal's construction: turns in two
  staircases going in, then two coming out, offset by a stitch so no turn lands
  on another — which is why a step must be at least 2. No steps makes a stripe.
  What it reproduces from a few numbers:
  - **the book's Short Stripes, identical row for row** (25 sts, start 1, width
    24, no steps, catch-up after from the left);
  - **Shoal's fish rows 7–8, identical to the book's** (start 5, width 14, 3
    steps of 2);
  - our own Stripe and Lens examples, word for word.
  Every design is checked before it's returned: it must read back, lie flat as
  a rectangle, repeat cleanly with one strand of each yarn, and keep rules 1–3.
  Requests that can't be knitted are refused with the reason: one-stitch steps,
  a motif wider than the fabric, more steps than the width allows, an even
  number of base rows.

### Stage D — On the page

A "Design" panel. Its output is written rows, placed straight into the
written-rows box, so the chart, fabric, verdict and photo comparison all work on
generated patterns with nothing extra.

- **Done 2026-10-23** (`views/DesignPanel.svelte`, at the top of the page, for
  everyone). Lens or stripe; stitches, start, first leg, steps and step; rows
  below and above; catch-ups before or after, edge, order and stagger. It says
  whether the design can be knitted as you change it — with the reason when it
  can't — before "Make pattern" writes it into the box. Starts as Shoal's fish.

### After D: from a drawing (agreed 2026-10-23)

The goal: **draw on a canvas → rasterize to a grid of stitches and rows →
construct the short rows → write the pattern → show how it will really look.**
Each stage can fail, and failures come in three kinds:

- **fine as drawn** — it knits as is;
- **soft** — a small automatic adjustment makes it knittable, changing the look
  a little; the app makes it and *shows* what changed;
- **hard** — it can't be knitted; the app highlights *where* and says *why*, and
  you redraw.

How the built pieces fit: the writer (A) is the last step; the reader, counter,
shape drawing, rule checker and verdict judge every result; catch-ups (B) are
the background half of construction; one-motif design (C) is the first recipe
in a library of shapes we know how to knit, and a test case for the general
constructor.

| Step | What |
|---|---|
| **E** | **The limitations list, and probe grids** — in [LIMITS.md](LIMITS.md) — **done 2026-10-24**: all 16 limitations marked by you. Key decisions: up to 10 colours; unlimited yarn ends but always the fewest possible, with a cut-off set at the end of the project; you set the gauge; and **intarsia only on vertical edges** (hand-overs); sloped and curved edges are always short rows, and horizontal edges are a change of yarn. When a grid can be knitted several ways, the app shows them side by side and you pick. Draft the hard and soft limits from what's proven, and a set of small test grids — a diagonal, a circle, two touching blobs, a vertical bar, a ring, a checkerboard, a single dot — each aimed at one question. You mark each limit: fine / adjust automatically / adjust and ask / redraw. This list is the spec for F. |
| **F** | **Construct from any grid** — the real inverse. In three parts: **F1** a baseline that knits any grid with intarsia alone — **done 2026-10-24**, it knits all 18 probes correctly, proving that anything drawn in whole ridges can be knitted; the cost is yarn, cheap on vertical edges and high wherever an edge moves sideways (P3 diagonal 6 balls, P7 lens 7, where the book uses 2). With **short carries allowed (up to 2 stitches, your decision)** the cost drops sharply: the diagonal from 6 balls to 2, the lens and circle from 7 to 3, the checkerboard from 14 to 8 — and the book's patterns are untouched. **F2** short rows on every sloped or curved edge, and intarsia only on vertical ones — the fused plan below, **done 2026-10-24**. **F3** where both work, show them side by side for you to pick. Regions of colour → passes, strands, catch-ups, following E's rules and reporting what it adjusted or refused. Check: given the grid a Stage C design produces, it finds an equally good pattern. |
| **G** | **Rasterize** — canvas pixels to a stitch grid at the knitter's gauge (two rows to a stitch's width in garter), with clean-up of specks and ragged edges. |
| **H** | **Draw on a canvas** — the end goal. |

#### F2: the fused plan (agreed 2026-10-24)

The old F2 idea was a *library of shapes* (lens, peak, leaf, wedge). The
newer idea was *a rule per edge*. They are fused: edges decide the method,
and the shapes become shortcuts and tests.

**1. Sort every edge of every colour region** (your rule, LIMITS.md):

| Edge | How it's knitted |
|---|---|
| Horizontal | change yarn at that row |
| Vertical | intarsia hand-over — **only** here |
| Sloped or curved | short rows, always; intarsia is not a fallback |

A slope steeper than short rows can make: ask each time, showing the steepest
short-row slope next to snapping it to vertical (L12).

**2. One recipe per edge kind:**

- **horizontal change** — the new yarn starts across the row; a base shared by
  several colours is handed over side by side in one row, as in Shoal row 7;
- **vertical hand-over** — today's F1 intarsia, for that edge only;
- **one-sided slope** — short-row pairs from one side (the Wedge), step ≥ 1;
- **two-sided slope (peak)** — a zigzag turning one stitch further in each
  time, alternating sides, then home (the Shoal construction,
  `zigzagTurns`). No column turns twice, so it can step **1 stitch per ridge**;
- **shrink then grow (lens, circle)** — turns come back out past earlier ones,
  so steps must be **at least 2** stitches to keep rule 1.

**3. Build regions inside out.** Knit the innermost region first; each
enclosing colour's zigzag goes wider and climbs over it; the background levels
the top with catch-up pairs from both edges (Stage B). Colours nest like
brackets (rule 3). Every result goes through the existing checks: reader,
rules, shape verdict, writer.

**4. Named shapes** — lens, peak, leaf, wedge — stay as ready-made recipes
and as tests: given the grid of a Stage C design, F2 must find a pattern as
good as the design's.

**Build order — all done 2026-10-24** (`construct.ts`, `round.ts`, `steep.ts`,
in the grid editor's "Knit it"):

1. Two-sided peak. **Done**: your three nested triangles knit with 4 balls
   (intarsia alone: 7), every colour out and home once; green's passes are
   exactly the sketch. Lies flat as a rectangle.
2. Several peaks nested, plus the background catch-up. **Done**: any depth of
   nesting; a 60 × 40 drawing of five nested peaks builds in about 30 ms. A
   colour cut in two by a shape reaching the top gets a second ball, knitted
   inside that shape's trip.
3. One-sided slopes, then shrink-then-grow. **Done**: slopes against an edge
   are catch-up pairs (P3, 2 balls). A lens whose top and bottom step out at the
   same stitch can't be turned as drawn — two turns would share a stitch — so
   it's **rounded** (L13): P7 moves 4 stitches and knits with 2 balls
   (intarsia: 3). The moved stitches are outlined over the drawing.
4. Mixed regions. **Done**: a vertical edge 2 ridges or taller cuts the
   patches either side into one-ridge pieces, each its own trip — so they hand
   over like intarsia, inside the same tree of trips. A ball can be lent to a
   nested piece when it comes back within a short carry. **All 18 probes now
   build**, each with no more balls than intarsia alone except the circle (P8,
   one more — worth improving).
5. The steep-slope question (L12). **Done**: an edge moving steadily one way,
   slower than a stitch per ridge, shows both ways side by side — snapped to
   vertical (as drawn, hand-overs) or rounded to a stitch per ridge (short
   rows) — and "Knit it" waits for your pick, every time. Only P4 among the
   probes.

Still to look at: the circle's extra ball; colours that wrap round another
(a C shape) are handled only where the probes needed it.

A first entry for the list, already known: you draw in *picture* space, but
construction works in *stitch-and-row* space, and knitted ridges bend between
the two — so the knitted result won't look exactly like the drawing. Soft; the
relaxed preview shows it. **Superseded by "Draw the look" below.**

### Draw the look: from picture to needle (decided 2026-10-30)

**The point of the app:** you draw how the *finished, relaxed fabric* should
look, and the app finds the knitting that bends into it. Until now a grid was
read literally — each cell a stitch and a ridge on the needle — so the knitted
fabric looked different from the drawing once its ridges bent, and shapes like
P7's lens needed rounding. The book does it the other way round: it knits a
lens as a plain peak and lets the bending make the curve.

**The key observation.** In fabric that lies flat as a rectangle, columns stay
upright: bending only moves rows up and down within their own column. It never
moves a colour sideways or changes the order of colours in a column. So for
every column, the drawing and the needle plan have the same colours in the same
order, bottom to top; only how many ridges each colour gets differs. The whole
conversion is: **choose the ridges of each colour in each column**, so that
once knitted and relaxed, every colour boundary lands where it was drawn.

**The approach — guess, predict, correct, repeat:**

1. Start with the drawing read literally.
2. Predict where each colour boundary ends up after bending.
3. Compare with the drawing. Where a boundary lands too high, give the colour
   below it fewer ridges in that column; too low, more.
4. Keep it knittable while correcting: every column the same total length,
   whole ridges, and neighbouring columns differing by at most one ridge per
   colour, so turns never crowd.
5. Repeat until the boundaries stop moving; then build the final plan with the
   F2 builder, relax it with the full preview, and show what's left of the
   mismatch.

Early guesses may not be buildable yet, and the full preview needs a built
plan, so step 2 uses a **quick predictor** working from the column counts
alone: each colour patch's rows want to sit level across its columns, against
each column's rows wanting to sit one above another — the same two pulls as
mesh/relax.ts, at patch level. The builder and the full preview are the final
check.

**Decided with you (2026-10-30):**

1. Aim for a rectangle — balanced fabric — always, for now. Fans and wedges
   are a later option.
2. One drawing cell is one stitch wide and one ridge tall, for now. Your gauge
   (G) can change that later.
3. When the look can't be matched exactly, get as close as possible and
   outline the differences on the drawing — no question asked.
4. Keep "draw the needle" — today's literal reading — as an advanced switch.
   The builder's tests use it.

**Build order:**

| Step | What |
|---|---|
| **L1** | **Plan → look.** Render a knitted plan's relaxed fabric back onto the drawing's grid: for each cell, the colour that fills most of it. Useful at once — the editor can show "what you'll get" beside the drawing, even before any conversion exists. |
| **L2** | **The quick predictor**, checked against the full preview on the existing examples and probes. |
| **L3** | **The conversion**: guess, predict, correct, repeat, within the knittable limits. |
| **L4** | **Round-trip tests.** Take plans known to be good — the book-way Lens, the nested triangles — render their looks, convert the looks back into plans, and check the new plans make the same looks. The test that matters most: a drawn lens comes back as a peak, like the book's. |
| **L5** | **The editor loop.** Three views side by side: your drawing, the predicted look at the same scale, and the needle chart with written rows. Where the predicted look differs from the drawing, the cells are outlined on it. "Draw the needle" stays as an advanced switch. |
| **L6** | **Re-read the probes as looks**, and update LIMITS.md: rounding (L13) mostly gives way to this. |

**What changes elsewhere:** the F2 builder becomes the back end — it no longer
reads the drawing directly, but the plan the conversion makes. G (rasterize)
then turns a drawing into a *look* grid, not a needle grid. Rounding's fixes
(rounding never creating a vertical edge; avoiding edits altogether) are on
hold, likely overtaken by this.

**The limit:** the conversion is only as good as the bending prediction, which
rests on the guesses in §2.4. The app keeps labelling its result a prediction.

### Later (planned separately)

- Several motifs at once, and more shapes: a leaf with a stem, a wedge — as
  recipes F can use.

### Also outstanding

- **Me:** check whether GitHub Pages is switched on. The latest commits are local
  only until you say push.

### Last todo: calibrate the parameters

After everything else. Knit test pieces — the Wedge and Bump examples, a test
stripe — and measure them, to turn the guesses in §2.4 (ridge bend, double-stitch
stiffness, smallest bump, won't-lie-flat stretch) into measured values. Until
then the app labels its predicted look as a prediction.

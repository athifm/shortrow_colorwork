# Short-row colorwork — project plan

A web app for **short-row colorwork in garter, the way the textbook does it**:
you draw how the finished fabric should look, and the app works out how to knit
it — written rows, a chart, a row tracker, and a preview of the fabric as it
will really lie.

**Now:** the pattern lab (read a pattern, see its chart and fabric) is done.
Drawing → knitting works in the "Draw (in development)" tab. Next: the short-row
units plan (§6).

The full history of this plan, with every decision's reasoning and the old
designs it replaced, is in [docs/plan-archive-2026-10-31.md](docs/plan-archive-2026-10-31.md);
the old limitations list, with its drafts, in
[docs/limits-archive-2026-10-31.md](docs/limits-archive-2026-10-31.md). What can
and can't be drawn is §8.

---

## 1. Decisions

| | |
|---|---|
| **The point of the app** | You draw **the look** of the finished, relaxed fabric; the app finds the knitting that bends into it (2026-10-30). "Draw the needle" — each cell knitted literally — stays as an advanced switch |
| **What it's for** | Short-row colorwork as in the book: stripes, wedges, lenses and fish, zigzags, plus curved, blobby shapes. Not general colourwork — shapes that only knit as intarsia aren't the target (2026-10-31) |
| **How drawings become knitting** | Fit them to **short-row units** the app knows how to knit the book's way (§6) |
| **Fabric** | Garter. Balance is a result, not a rule: every pattern makes a rectangle, a fan, or something that won't lie flat, and the app says which. Drawings aim for a rectangle |
| **Turns** | German short rows |
| **Edges** | Sloped or curved → short rows, always. Straight vertical → intarsia hand-over, only there. Horizontal → change yarn at the row |
| **A drawing cell** | One stitch wide, one ridge (two rows) tall — for now; the knitter's gauge later |
| **When a drawing can't be matched** | Get as close as possible and show the differences, no question asked. Exceptions you decide each time: steep diagonals (L12), softening a shape with extra stitches |
| **Yarn ends** | No limit, but always the fewest possible, and shown. Up to 10 colours. Carrying a yarn up to 2 stitches across the back is allowed |
| **The model** | Ours to work out, never the user's (§3) |
| **Who does what** | I implement; you steer, and the knitting is your territory |
| **Audience** | Other knitters, publicly — strangers arriving from a link |
| **Technology** | Svelte 5, Vite, TypeScript, Vitest; GitHub Pages via Actions |

---

## 2. The knitting model

**Passes.** A pattern is an ordered list of passes. A pass is one yarn knitting
one unbroken run of stitches in one direction, ending at a turn, an edge, or a
hand-over to another yarn. A written row can hold many passes (Shoal's row 7 is
twelve). The book's charts draw exactly this: one line per pass, in knitting
order. Columns are numbered from 1 at the right edge, as in the book.

**Each stitch has a height and a colour stack** — how many rows it has been
worked, and which yarn worked each, bottom to top. Every stitch a pass covers
gets one more row, including the turning stitch, which counts in both passes.
The picture is each column's colour stack.

**Shape.** Short rows never add stitches, so full rows keep their length. Every
column the same length: a rectangle. Longer on one side: a fan, which still
lies flat. Longer in the middle: the next full row must stretch over the bump —
it won't lie flat, and the app warns. Within a rectangle, ridges bend near
turns: each pass's stitches pull level, each column's rows stack one on another,
and the fabric settles between the two. **Bending only moves rows up and down
their own column** — it never moves a colour sideways or changes the order of
colours in a column.

**Rules every pattern keeps:**

1. **No turn on a turn.** A turning stitch can't sit directly on another in the
   same column with no ordinary row between — including "turn, knit 1, turn on
   that stitch".
2. **Every stop is someone else's start.** The needle never jumps. Where one
   yarn stops, the next stitch is worked by another: a new yarn joined there, or
   a yarn waiting there (or up to 2 stitches away, carried across the back). At
   an edge the next yarn goes back the other way; mid-row it carries on.
3. **A yarn goes out and comes back.** An even number of passes, so it's waiting
   where it began. Yarns nest like brackets: A hands to B, B goes and returns, A
   carries on.
4. **Every stitch's rows come from below.** A pass covers an unbroken run, and a
   stitch is worked only on top of the one below it.
5. **Ends count balls, not shapes.** One ball can make many motifs if it waits
   at an edge; each ball is two ends to weave in.

---

## 3. What we're guessing

The rules are certain. How yarn behaves is not: every number below is a guess
until it's measured.

| Quantity | Now | How sure |
|---|---|---|
| How far ridges bend (`yarnPull`) | 0.3 | fitted by eye to the book's Harvest and Shoal photos |
| A double stitch's stiffness | half an ordinary row | invented |
| A double stitch's height | a full row for both passes | consistent with every book pattern |
| Won't lie flat | a row stretched over 10% | invented |
| Smallest bump that matters | 4 stitches | invented |
| A stitch's shape | 2 rows to a stitch's width | from typical garter gauge |
| Fan angle | `θ ≈ 2h/(s·w)` | derived; the fan drawing reproduces it |

**Principles:**

- **The user never configures the model.** They give what a pattern would ask
  for anyway (gauge, colours, the drawing) and choose where a real design choice
  exists. Uncertain results are labelled "a prediction".
- **Every guess lives in `src/model/physical.ts`**, with its category, source and
  confidence; planner code may not hold numbers of its own (a test enforces it).
  A guess can become a user parameter later by editing a field.
- **Learn from what exists before knitting.** Book photos and patterns first
  (`research/`, private, never committed); test knitting last.
- **Calibration is the last todo** (§7): knit test pieces, measure them, and
  turn these guesses into measured values — in a development-only workbench.

---

## 4. Code and conventions

| Where | What |
|---|---|
| `methods/shortrow/passes.ts` | the forward model: passes → heights and colour stacks |
| `methods/shortrow/written.ts`, `writer.ts` | reading and writing the book's written rows |
| `methods/shortrow/rules.ts` | rule checks (turns on turns) |
| `methods/shortrow/balance.ts` | catch-up pairs from the edges |
| `methods/shortrow/motif.ts` | one motif on a background (stripe, lens/fish) |
| `methods/shortrow/intarsia.ts` | any grid with hand-overs alone |
| `methods/shortrow/construct.ts` | any grid with short rows: a tree of trips, one per patch |
| `methods/shortrow/round.ts`, `steep.ts` | rounding where turns crowd; the steep-diagonal choice |
| `methods/shortrow/units.ts` | blobs fitted to short-row units, three ways (§6) |
| `methods/shortrow/laws.ts` | the laws of short-row construction, checked on a drawing (§6) |
| `methods/shortrow/scale.ts` | a drawing made bigger or wider, edges redrawn smoothly (§6) |
| `methods/shortrow/grid.ts`, `probes.ts` | the grid notation; the probe drawings |
| `mesh/settle.ts`, `relax.ts` | the fabric's shape and its bent ridges |
| `mesh/look.ts`, `convert.ts` | a plan's look on the drawing's grid; look → plan, cell by cell |
| `mesh/fit.ts` | the ways to knit a drawing, each knitted, counted and predicted (§6) |
| `model/physical.ts` | every guess (§3) |
| `views/` | chart, fabric, design panel, the Draw tab |

**Conventions:** comments explain why; UI text is plain English for a knitter;
pure code never touches the page and is tested; every step reports its problems
rather than failing quietly; modules stay under about 400 lines; nothing leaves
the browser; the published site never contains book material (the deploy
refuses to publish if it does).

---

## 5. What's built

| | Done | Where |
|---|---|---|
| Pattern lab | Read written rows, chart, fabric (straight and relaxed), shape verdict, hover links, photo compare, row counts | `App.svelte`, `views/` |
| A — Writer | Passes → written rows; all five book patterns come out identical to the book | `writer.ts` |
| B — Catch-ups | Level a pattern with pairs from the edges; rebuilds all 14 catch-up groups in the book | `balance.ts` |
| C, D — One motif | Stripe or lens/fish on a background, from a few numbers, on the page; reproduces the book's Short Stripes and Shoal's fish rows | `motif.ts`, `DesignPanel` |
| E — Limits | What can be drawn, marked by you; 18 probe grids | §8, `probes.ts` |
| F1 — Intarsia | Any grid with hand-overs alone | `intarsia.ts` |
| F2 — Short rows | Any grid: nested peaks, slopes, wavy layers, edge fills; vertical edges as hand-overs; rounding (L13); steep-diagonal choice (L12). All 18 probes build | `construct.ts`, `round.ts`, `steep.ts` |
| Draw the look, L1–L3 | A plan's predicted look on the drawing's grid; a cell-by-cell conversion from look to plan | `look.ts`, `convert.ts` |
| Draw tab | Its own tab, "in development": draw, then "Work out the knitting"; what to knit and what you'll get side by side | `GridEditor.svelte` |

**What testing showed (2026-10-31):** with the current bending guess, a boundary
moves only a third to half a ridge on shapes this size, so cell-by-cell
conversion only fine-tunes a drawing — a drawn lens doesn't come back as the
book's peak. And the probes that matter least (checkerboard, rectangle, lines)
were the ones that got most attention. Hence §6.

---

## 6. Now: short-row units

**The idea** (yours, from the nested triangles, 2026-10-24): map a drawing onto
**short-row units** — shapes the app knows how to knit the book's way — and knit
those. A unit is chosen and sized by how close its predicted look comes to your
drawing.

**Step 1 — New probes.** Shapes this app is for, each asking one question:

- the book's kind: stripe; short stripe from an edge; wedge; leaning stripe;
  lens or fish; zigzag band;
- blobby: oval; teardrop; leaf; wave band; a blob touching an edge; two blobs
  side by side; a blob inside a blob;
- your drawings: the nested triangles; the blob with two colours inside; the
  fish with a tail (fails today); the T (all intarsia today).

The old intarsia-type probes stay as quiet regression tests only.

**Done 2026-10-31:** 17 shapes, S1–S17, in `probes.ts` (`SHAPES`), and in the
Draw tab's "Start from" list. Look them over and redraw any that aren't how
you'd draw such a shape. Baseline with today's builder (tested in
`construct.test.ts`):

| Shape | Builds as drawn? | Rounding | Draw the look | Intarsia |
|---|---|---|---|---|
| S1 stripe | yes, 2 balls | – | exact | 2 balls |
| S2 short stripe from an edge | yes, 2 balls, 6 turns | – | exact | 3 |
| S3 wedge | yes, 2 balls, 10 turns | – | exact | 3 |
| S4 leaning stripe | yes, 2 balls, 14 turns | – | 10 cells off | 3 |
| S5 fish with a tail | stuck (col 6) | doesn't help | fails | 4 |
| S6 zigzag band | stuck (col 5) | doesn't help | 8 cells off | 8 |
| S7 oval | stuck (col 4) | 4 changes | 4 cells off | 3 |
| S8 teardrop | yes, 3 balls, 4 turns | – | exact | 3 |
| S9 leaf | yes, 2 balls, 14 turns | – | 2 cells off | 7 |
| S10 wave band | yes, 4 balls, 10 turns | – | 2 cells off | 8 |
| S11 blob at the edge | stuck (col 5) | 2 changes | 2 cells off | 3 |
| S12 two blobs side by side | stuck (col 2) | doesn't help | 4 cells off | 5 |
| S13 blob inside a blob | stuck (col 3) | doesn't help | 11 cells off | 5 |
| S14 your nested triangles | yes, 4 balls, 25 turns | – | 18 cells off | 7 |
| S15 your blob, two colours inside | stuck (col 7) | 2 changes | 10 cells off | 8 |
| S16 your fish | stuck (col 11) | doesn't help | fails | 7 |
| S17 your T | yes, but all hand-overs: 5 balls, 0 turns | – | exact | 5 |

Read: 8 of 17 can't be built as drawn; 2 can't be built at all in "draw the
look"; the T builds but isn't short-row colorwork. "Cells off" is where the
predicted look differs from the drawing.

**Step 2 — The units. Done 2026-10-31** (`units.ts`). One rule turned out to
make every unit in the book. Read column by column, a shape knits with short
rows when it is one run of its colour in each column, and from one column to
the next:

- the layer under it, the layer over it and its own thickness each change by
  a ridge at most — every turn a stitch further on, so no two stack;
- none of them makes a bump one stitch wide (two turns on one stitch);
- short of the fabric's edge, it ends in a tip one ridge thick (not a
  vertical edge, which is intarsia's).

Under and over are measured within whatever the shape sits in, so nested
shapes follow the same rule. Stripe, short stripe, wedge, leaning stripe,
peak, lens and nested peaks are all special cases; the app names each unit it
finds ("a lens in B").

**Step 3 — Fitting. Done 2026-10-31** (`units.ts`, `mesh/fit.ts`). Each blob
is fitted to the nearest shape that keeps the rule — exactly, by trying every
bottom and top column by column — outermost first, then the ones inside it.
"Nearest" three ways, which are L19's versions: **the shape grows** (stitches
added in its colour), **the background gives way** (stitches taken from the
shape), **either, fewest changes**. Alongside: the drawing **as drawn**, and
**nudged** (L13's rounding) when it can't be knitted as drawn. Each version is
knitted for real, counted, and given its predicted look.

The builder (`construct.ts`) learned more ways to lay the background around
shapes — free columns raised to suit, bumps on the way home, a plain turn
between hand-overs — tried only after the old ways, so patterns that knitted
before knit the same. A shape that is one run per column is no longer cut up
at forks (the zigzag band). A patch that wraps round the shape it sits beside —
the background under a T's crossbar tip and over it — is cut in two at that
level, each part its own trip (L18).

**Step 4 — The editor shows the fit. Done 2026-10-31.** In the Draw tab, "Work
out the knitting" now shows the ways side by side, each with stitches changed,
balls, ends, turns, how many cells of its look differ from your drawing, and
the units found. The closest short-row way is picked to start with; pick
another and the big panels follow. Changed cells keep a small square of the
colour you drew. Where the way picked gets stuck, the spot is ringed on your
drawing; a shape no unit fits is outlined.

**What you'll get, redone 2026-11-11.** For the way picked: the relaxed fabric
itself, drawn as the pattern lab draws it, and your drawing with lines where
the colour edges will land. Both tabs use one prediction (`predictionOf` in
`mesh/fit.ts`: the pattern written out, read back, settled). Found on the way:
the cell look (`look.ts`) was reading the fabric half a row too high, which
skewed every "cells differ" count — fixed; and turns were under-counted where
another yarn's pass came between a turn and the way back — now counted as the
reader counts them.

**Intarsia-style rows flagged, 2026-11-11** (your call: flag, then fix the
cause). A written row that uses two balls of one colour — a colour stops for
another and carries on beyond it from a second ball — is counted on each card
and listed by row number for the way picked; the suggestion prefers ways with
fewer. Handing over into a nested shape isn't flagged: the colour comes back
over the finished shape with the same ball, the book's way. Today: your blob
nudged has 6 such rows, grown 1; the teardrop as drawn 10, fitted 0; your T
fitted 2 (its crossbar reaches the top, L18).

**Where the shapes stand now** (the best short-row way for each):

| Shape | Before units | Now |
|---|---|---|
| S1–S4, S14 | knit as drawn | the same |
| S6 zigzag band | stuck | knits as drawn, 2 balls |
| S7 oval | stuck | 4 stitches change (background gives way) |
| S8 teardrop, S9 leaf | knit as drawn | the same, plus fitted versions |
| S10 wave band | 4 balls | 2 balls, look 3 cells off (the "11" first reported came from the half-row error) |
| S11 blob at the edge | stuck | 2 stitches change |
| S12 two blobs side by side | stuck | knits as drawn |
| S13 blob inside a blob | stuck | 6 stitches change (background gives way) |
| S15 your blob, two colours | stuck | nudged: 2 stitches change, 7 balls |
| S5 fish with a tail | stuck | still stuck (queued below) |
| S16 your fish | stuck | one rough way: the shape grows, 40 stitches change, 9 balls |
| S17 your T | all hand-overs | 4 stitches change: 3 balls, 11–12 turns, or 4 balls, 15 turns |

**One page, 2026-11-11.** The Draw tab shows everything about the way picked
without leaving it: needle chart beside the relaxed fabric (pointing at one
lights up the other), the lies-flat verdict, and the written rows with a Copy
button. "Knit it" became "Open in pattern lab", for editing rows by hand.

**Review bar, 2026-11-11** (development only). Over the drawing in the Draw
tab: "Looks right", "Save my redraw", "Add note", "Next shape", and saving a
drawing of your own under a name. Each is written at once to
`review/review.json` (not published), which Claude reads when you say so — no
screenshots. A redraw changes the test set only once the review has been read.

**Your review, 2026-11-11** (`review/review.json`). Looks right, no redraws:
S1–S7, S9, S10, S12, S13, S14 — these are now the safety net: they must keep
knitting as they do. Open, with your notes:

| Shape | Your note |
|---|---|
| S5 fish with a tail | too small to verify; needs a scaled-up version |
| S8 teardrop | why can't it be made as drawn? Find the reason, to learn |
| S15 your blob | colour changes in the same rows; needs construction that gives the look drawn |
| S16 your fish | doesn't replicate the design; needs investigation |
| S17 your T | needs improved logic |
| S11 blob at the edge | (approved in effect) a good one to knit and test the physics — see §7, calibrate |

### The plan from here (agreed 2026-11-11)

**The goal:** work out the logic of short-row construction. Not more recipes:
a few laws that say whether a drawing can be knitted the book's way, and a
builder that knits whatever keeps them.

**The laws, as understood today** — from what the fitter and builder needed,
not the book's own wording; working the open shapes may add or change one:

1. **Slope.** A shape gets thicker or thinner by a ridge per stitch at most
   (each turn a stitch further on). So a shape growing from both ends is at
   most about half as tall as it is wide. This is why the teardrop (7 wide, 7
   tall) and your fish's body can't be knitted as drawn.
2. **No one-stitch bumps.** A bump one stitch wide is two turns on one stitch.
3. **Tips.** A shape ends in a point one ridge thick, unless at the fabric's
   edge. No vertical sides (those are intarsia's).
4. **One ball per shape.** A colour is handed over once; the shape is finished
   with its own short rows; the colour around it then knits across it with the
   same ball. No row uses two balls of one colour.
5. **Balance.** The background fills in until every stitch has the same rows.
6. **One piece.** A shape has one stretch of its colour in each column (found
   while building the checker, 2026-11-12: a fork or a "C" has two).

**Step 2 done, 2026-11-12** (`laws.ts`). The Draw tab checks laws 1, 2, 3 and
6 on the drawing: a box says which are broken and in how many places, and each
place is marked on the drawing with the law's number. Laws 4 and 5 are about
the knitting; the builder keeps them and the cards count rows that don't.
What the checker showed:

- It agrees with the fitter on all 17 shapes: a drawing keeps the laws exactly
  when the fitter has nothing to change. And every drawing that keeps them
  knits as it stands.
- **The laws are stricter than the truth in places.** The leaf (S9) breaks
  "bump" twice and "tip" once, yet knits as drawn with no intarsia rows. So
  keeping the laws is enough, but not always needed.
  **Why, from you (2026-11-12):** the bump works because it is one stitch from
  where that colour was last used — the yarn is waiting there. The leaf's
  written rows bear it out: each ridge is one trip out and back, the pink
  comes home to its right-hand end and waits, and the next ridge starts a
  stitch or two away, carried. So the two ends of a shape differ: the **far
  end**, where the yarn turns, needs the tip and no-bump laws; the **near
  end**, where the yarn waits, can be straight, stepped or a one-stitch bump,
  so long as each ridge starts within a short carry (2 stitches) of the last.
  **Todo, later:** make laws 2 and 3 near/far-aware in the checker and the
  fitter (which changes 3 stitches of the leaf for nothing), after testing the
  idea on all 17 shapes — so far confirmed on the leaf only.
- **Fitted shapes inside shapes break the laws themselves** (S13, S15, S16):
  the inner shape can poke out of the outer or cut it in two. A known gap,
  held by a test marked as failing, for step 3.

**Step 3 mostly done, 2026-11-12.** The book's way — no row with two balls of
one colour — is the only way suggested; the others carry a label ("Intarsia
in part — not the book's way"), and if there is none the Draw tab says so.
Fewest balls wins, then nearest look.

- **Fitter** (`units.ts`): a shape inside another stays inside it, never
  fills a whole column of it, and leaves its layers over and under in one
  piece — side to side, not corner to corner.
- **Builder** (`construct.ts`): each side of a shape may be raised its own way
  (`bySide`); and before anything is tried, each row is limited to the
  stretches whose yarn can actually reach it — a row beyond a nested colour,
  with nothing to cross that colour on, is knitted before it.
- **Result:** the blob inside a blob (S13) knits the book's way all three
  ways, 3 balls. **Your blob with two colours inside (S15) knits with 4 balls,
  one per colour**, 8 stitches changed, where it took 7 balls and 6
  intarsia-style rows. 14 of 17 shapes now have a book's way.
- **Still open:** S5 fish with a tail (stuck; tails, step 5), S16 your fish
  (too steep throughout — 40 stitches to change, and still stuck), S17 your T
  (the crossbar reaching the top splits the background: 2 intarsia-style
  rows, step 5). Two of S15's three fitted ways, and S16's, still break the
  laws themselves (test marked failing).

**Step 4 done, 2026-11-12** (`scale.ts`). Under the drawing: **Bigger ×2**
and **Wider ×2**. Edges are redrawn smoothly, not doubled cell by cell — a
slope stays a slope, a point stays a point. The laws box says whether more
room would cure a drawing ("Wider ×2: helps — 2 places left"). The builder
now gives up after about six seconds on one drawing, so a big one can't freeze
the page.

What scaling showed, law by law:

| Cure | What it cures | Shapes |
|---|---|---|
| Wider ×2 | **slope** (too steep), and with it blunt ends and one-stitch bumps | cures outright: oval, blob at the edge, blob inside a blob, leaf. Teardrop: 7 broken places → 2, then knits the book's way with 6 of 252 stitches changed |
| Wider ×2 | not enough when more than twice too steep | your fish: 15 places → 7, still no book's way |
| Bigger ×2 | nothing that is too steep (as expected); keeps the laws where they were kept | the 12 approved shapes; cures none of the open ones |
| neither | a shape made of pieces that touch corner to corner | fish with a tail: still stuck |
| neither | **a shape touching the top edge** | your T, widened, keeps every law on the list and still has no book's way: the crossbar splits the background in two (L18). A law is missing here — step 5 |

Open, found here: your blob with two colours inside, **widened**, fits with
2–4 stitches changed but the builder gets stuck on it (two turns on one
stitch, column 25) — it knits at its drawn size. A clean case for the builder.

**The edge map, 2026-11-12** (`oracle.ts`, probes `EDGES` in `probes.ts`). The
try-everything checker proves, for a small drawing, the least a yarn must be
carried for it to knit with one ball to each colour — 0 is the book's own way
(every yarn starting where it stopped); 1 or 2 is allowed by L17 but isn't the
book's. Certain for drawings up to about 10 stitches by 5 ridges; bigger ones
it can't settle, so each question is asked with the smallest drawing that
shows it. "Near end" is a shape's right-hand end, where its rows start and its
yarn waits; "far end" its left, where it turns.

| Feature | Least carry | Probe |
|---|---|---|
| blunt near end | 0 | E1 |
| blunt far end | 2 | E2 |
| far end straight for two ridges | 2 | E4 |
| far side stepping 2 stitches a ridge | 0 | E21 |
| far side stepping a stitch every 2 ridges (steeper) | 2 | E22 |
| far side widening upwards | 0 | E3 |
| notch in the far side; a C open on the near side | 2 | E5, E20 |
| lens, a stitch a ridge both ends; the same upside down | 0 | E6, E7 |
| peak one stitch wide | 1 | E8 |
| touching the top edge | 2 | E9 |
| …with a ridge of background above | 0 | E10 |
| touching the cast-on; far end at the fabric's left edge | 0 | E18, E19 |
| a one-ridge bar inside a shape one ridge thick around it (three ways tried) | 1 | E11–E13 |
| …with the outer shape two stitches wide each side | 1 | E23 |
| a small lens inside a shape | 1 | E24 |
| two shapes one above the other | 0, one ball | E15 |
| two shapes side by side | impossible with one ball; 0 with a ball each | E14 |
| a tail, at either end | 2 | E16, E17 |

What it says about the laws:

- **The far end carries the laws; the near end is free** — your leaf insight,
  now proven (E1 against E2). The tip and bump laws must apply to the far end
  only.
- **Slope** is a far-end law: steeper than a stitch a ridge costs a carry of 2
  (E22); shallower is free (E21).
- **Top edge** is a real law, cured by a ridge of background above (E9, E10).
- **A shape inside a shape is not, of itself, a cost**: your blob inside a blob
  (S13) knits with one ball each and no carry at all. The three small probes
  that need a carry of 1 (E11–E13) all have a one-ridge inner bar inside an
  outer shape one ridge thick around it; which of those features costs the
  carry is not yet known. (First written as "always costs a carry of 1" —
  wrong; corrected 2026-11-12 after you pointed at S13.)
  Changing one thing at a time from E11 didn't find it: a wider outer shape
  (E23) and a lens for the inner shape (E24) still need a carry of 1, for
  certain. An inner shape two ridges tall, or the outer two ridges thick
  above or below, needs at most 2 — whether 0 or 1 would do, those drawings
  (six ridges) are too big to settle. So the free knitting of S13 comes from
  something else it has: it is bigger in every direction at once. Next: work
  down from S13, shrinking it until the carry appears.
- **One ball can serve shapes stacked one above the other, never side by
  side** (E14, E15). New.
- **The builder misses ways that exist**: it gets stuck on E11, E15, E16 and
  E17, where the checker found a knitting. Builder gaps, not edges.

Open question for you: is a carry of 1 or 2 stitches good enough to count as
short-row colorwork, or only as a fallback? It may not matter for shapes inside
shapes like yours, which need none — to be settled by the probes first.

**Back to the big picture, 2026-11-13.** Tiny probes throw up problems that
come from being tiny — everything one ridge from everything else — not from
short rows (your call: lost in the weeds). The checker stays, for a real
drawing that's stuck; no more probes for their own sake. Two edge-map
findings hold at real size, and are now built in:

- **The near end may be blunt.** The checker no longer asks for a point at a
  shape's near end, and the fitter offers both: near end tapered, or left as
  drawn. The Draw tab keeps whichever comes closer.
- **A ridge of background on top.** For a shape touching the top edge, a card
  "A ridge of background on top" with the closest fit of the taller drawing.

Each card now says how close its look is: the share of the drawing's shape
cells that come out the colour drawn. Closeness of the best book's way:

| Shape | Before | Now |
|---|---|---|
| S8 teardrop | 55% | 71% |
| S13 blob inside a blob | 82% | 86% |
| S17 your T | no book's way | 85%, ridge on top, 3 balls |
| every other shape | — | unchanged |
| S5 fish with a tail, S16 your fish | no book's way | still none |

Worth knowing: several shapes knitted exactly as drawn are well short of 100%
— the leaning stripe 72%, the zigzag band 75%, your nested triangles 66%.
That's bending: the fabric relaxing pulls the ridges flatter. Closer than that
means knitting a plan that bends into the drawing — the old "draw the look"
conversion (L3), set aside earlier. With today's guessed physics, so a
prediction.

**What a found knitting taught, 2026-11-13** — seen on one drawing so far
(your peak with a narrow base row, 14 × 9). The builder said "stuck"; the
try-everything checker found it knits exactly as drawn, one ball each, no
carry (rows in `review/found-peak.txt`; you judged it a reasonable
approximation). Read backwards, it shows:

1. **The bottom of a shape is the background's job.** Grey's short rows from
   both edges dip the floor under the narrow base; one row of pink then lands
   lower in the middle than at the sides, making the base and the wider row
   above it at once. So top and bottom edges stepping at the same stitch is no
   problem: two yarns make them. The slope law, judging thickness, was wrong.
2. **The zigzag goes in and out.** Pink's turns: 12, 3, 11, 5, 9, 4, 10, 5, 9,
   7, 8, 6, 7. It turns twice at columns 5, 9 and 7, but a pass crosses each
   in between as an ordinary row, so no turn lands on a turn. A one-way zigzag
   can't do this (the sketch "why one ridge per stitch" holds only for that).
   This is how the one-stitch tip is made.
3. **One ball, one trip** for the whole shape.

So the real limit looks like how often the same stitch is turned on, not how
steep an edge is. Not yet a law: to be checked on more drawings first.

Seen again on the blob at the edge (S11): the checker found it knits as
drawn, one ball each, no carry, pink turning 7, 8, 5, 7, 5 — in and out
(`review/found-blob-edge.txt`).

**The builder learned the in-and-out walk, 2026-11-13** (`inAndOut` in
`construct.ts`): one yarn's rows searched for, free to turn back outwards and
to turn again on a stitch once an ordinary row has crossed it. Tried after all
the other recipes, inside the builder's time limit. Your peak now knits as
drawn in the builder (2 balls, no carry). Still stuck as drawn, though the
checker found S11 knits: the builder's own habits get in the way there —
likely its rule of no turn on a straight vertical edge, which isn't a law of
knitting. Next to look at. The fish with a tail now has a short-row way, not
yet the book's.

**Round 2 review, 2026-11-13** (`review/review.json`; round 1 kept in
`review/review-round1-2026-11-11.json`). Your peak: looks right — "a success,
a learnable thing". S14 nested triangles: good. Notes:

- S8 teardrop: why no alternative, e.g. one more stitch on each side of a
  repeated row? (In needle mode no fitted cards show. Your fix changes 2
  stitches; the fitter's best changes 8, held back by the over-strict slope
  law.)
- S11 blob at the edge: the height rises a ridge at a time, so the slope is
  fine — the length grows 2 stitches a ridge. (Right: proven free; the builder
  is stuck by its own habits.)
- S15 your blob: reasonably successful — what changed, and why did it make it
  knittable? (To be shown.)
- S17 your T: in the book's way, how does the right side have two stacked
  rows? (Likely the near end, where the yarn waits and needs no turn — to be
  confirmed from its rows.)

**Ideas from the review:**

- **Shape and background as equals** (option b): for shapes that need it, the
  background's short rows shape the floor first — as under your peak's narrow
  base — and the fitter may adjust the background's edges too.
- **Adjust the shape before it becomes a grid** (your main point): draw a
  smooth outline; the app turns it into cells that keep the laws while staying
  closest to the curve. Many "problems" today are only pixel stairs. Waits
  until the laws are learned (agreed).

### Order from here (agreed 2026-11-13)

1. Correct the slope law: each edge judged on its own; 2 stitches a ridge is
   free (S8, S11).
2. Why the builder is stuck on S11, which the checker proved knittable —
   likely its own rule of no turn on a straight vertical edge.
3. Show S15's changes and the reasons for them.
4. Confirm how the T's right side works, from its written rows.
5. Option b: the background shaped as an equal, for shapes that need it.
6. Review rounds, until the laws stop changing.
7. **Smooth outlines turned into knittable cells.** Rules decide, early: for
   each column the fitter picks the cells closest to the curve that keep every
   law — the same exact method as now, measured against the curve instead of
   drawn cells. Fast, predictable, and it can say why. Then one check with the
   builder and the prediction. If that fails, a law is missing or wrong: it
   goes back into the learning, and only then a few rounds of
   build-measure-adjust as a fallback. This is why step 7 waits: learning the
   laws now is what lets step 7 be rule-based. Bending (the knitted look
   matching the curve once relaxed) sits on top, on guessed physics until
   calibration. Needs a way to draw smooth shapes (H, in §7).

**Step 1 done, 2026-11-13: the slope law judges each edge on its own.** The
layer under a shape and the layer over it each move a ridge at most; the
shape's thickness may change by two where both edges step at one stitch
(your S8 and S11 notes; your peak proved it). A one-stitch tip of the shape
itself is no longer a breach. The fitter offers both: thickness free, or held
to a ridge a stitch (the old way, which the builder knits more often); the
Draw tab keeps the closer that knits.

| Shape | Before | After |
|---|---|---|
| S8 teardrop | 71% close, 8 changed | 81%, 4 changed |
| S15 your blob | 76%, 8 changed | 78%, 5 changed |
| your peak, S11 | laws said broken | laws kept — matching the proofs |
| all others | — | unchanged |

What it showed: the laws are now a necessary check, not a guarantee. Four
shapes keep every law but the builder can't knit them as drawn — S11
(proven knittable: the builder's fault), S7 and S13 (unknown), S5 fish with a
tail (likely a law missing for pieces touching corner to corner). Step 2,
the builder on S11, comes next.

**Step 2 done, 2026-11-13: why the builder was stuck on S11.** Not its rule
about vertical edges, as guessed. The in-and-out search had a bug: there is
one order that works (turns at 7, 8, 5, 7, 5), and the search tried the
longest first row first, spent its whole budget proving that branch hopeless,
and gave up; positions abandoned for lack of budget were also wrongly
remembered as dead. Now each first row gets its own budget, and only
positions searched to the end are remembered. S11 knits exactly as drawn in
the builder: 2 balls, no carry, the checker's own order. Also: the drawing as
it is gets a third of the Draw tab's six seconds, so a hopeless one can't
crowd out the other ways; nudging runs whenever it fails.

Still keeping every law but stuck in the builder: S7 oval, S13 blob inside a
blob (unknown — too big for the checker), S5 fish with a tail (a law likely
missing).

**Step 4 done, 2026-11-13: how the T's right side works** (your note: "how
does the right side have two stacked rows?"). Confirmed from its written rows
(the "ridge on top" version): the crossbar's right end is its near end. Each
ridge, grey knits to it and hands over; pink knits out, turns at the far
(left) end, comes back to the same stitch and hands back to grey — "(A) K3,
(B) K8, SR / (B) K8, (A) knit to end". The pink yarn waits at that stitch from
one ridge to the next, so there is no turn there, and nothing stacks: a
straight side is free at a near end. The stem is shortened to one ridge: its
left (far) side was a straight side two ridges tall. The stem and the
crossbar each take their own ball of pink — the stem's ends 3 stitches from
where the bar starts, beyond a carry.

**Step 5 (a), 2026-11-13: background between shapes — rule not loosened.**
Tested on your blob (S15): the green's point fixed (2 stitches), then the
three disputed one-stitch bumps in the green between the blue and the purple
fixed in every combination. The builder knits it only with all three fixed
(the 5-stitch version); the try-everything checker can't settle the whole
blob (too big). No evidence the background rule is too strict, so it stays.
Also seen: with the point and two of the three fixed, the drawing keeps every
law yet the builder is stuck — the laws are a check, not a guarantee, again.
(c), moving the fabric's outer edges, stays an option for when a shape needs
it.

**Round 3 review, 2026-11-13** (`review/review.json`; round 2 kept as
`review-round2-2026-11-13.json`). Looks right: your peak, S11, S13, S15.
Notes: S8 — "when editing to find a closer look, always make it look
symmetrical if the actual image is symmetrical"; why can't adding stitches
rescue it? S7 — why is the nudged version not symmetrical, why one stitch
added in row 3, and is a gap in the needle chart a 3-stitch carry? S11 — why
isn't the knitted chart symmetric about its middle, when the drawing is? S17
your T — intarsia only; drop it from short-row testing.

Your call on symmetry: **(c) both, side by side** — for a symmetric drawing,
the closest symmetric version as its own labelled card next to the
asymmetric ones; you pick.

Round 3 work, in order:
1. Symmetric versions (the call above).
2. A symmetric knitting order: for S11, turns at 5, 7, 8, 7, 5 — in, then
   out, the book's lens — instead of 7, 8, 5, 7, 5.
3. S7: the stitch added in row 3, and whether that gap is a 3-stitch carry
   (the limit is 2: a bug if so).
4. S8: why adding stitches can't rescue the teardrop.
5. Drop S17 from the short-row set as intarsia-only.

**Round 3, a new note on S8 (2026-11-13):** "symmetric looks the best — I
think symmetry is a special case of when the drawing and the actual output
look the same shape. What is a good way to parameterise this shape
similarity? I don't mind more stitches changed if we can get the similar look."
So the measure changes: not cells that differ, but **does it look like the
same shape** — and more stitches changed is fine for that. Your call: **a
blend** — how far the knitted outline lies from the drawn one (on average,
and at its worst, in stitches), plus symmetry, plus the number of points.

Round 3 work, re-ordered:
1. Shape similarity: the blend above, to rank the cards and choose fits.
2. A proper symmetric fitter (the oval): shapes fitted symmetric from the
   start — both ends pointed — not one half mirrored. (A first shortcut, one
   half of each fit mirrored, gives the teardrop a symmetric card that knits,
   77%; for the oval and the blob inside a blob it only finds intarsia.)
3. A symmetric knitting order (S11's turns).
4. S7: the stitch added in row 3, and whether that gap is a 3-stitch carry.
5. S8: why adding stitches can't rescue it — may be answered by step 1.
6. Drop S17 as intarsia-only.

**Round 3, step 1 done (2026-11-13): shape similarity** (`mesh/similarity.ts`).
Each card now says how near its look is to the drawing's shape — "outline
off by 0.3 stitches on average, 1.0 at worst · symmetric, as drawn · its 2
points kept" — and the cards are ranked by it, book's way first, then shape,
then fewest balls, then fewest stitches changed. The blend: average outline
distance, plus a quarter of the worst, plus one for a symmetric drawing
knitted lopsided, plus half for each point lost or gained — weights to tune
by your reviews. Also in: the symmetric card (one half of each fit mirrored).

What it showed: the teardrop's symmetric card now ranks first. Several
drawings that are symmetric come out lopsided in the *predicted fabric* even
when knitted exactly as drawn (your nested triangles) — the ridges bend more
on one side, from the order of the turns: step 3, the symmetric knitting
order, matters more than it looked.

**Round 3, step 3 done (2026-11-13): the knitting order.** The same stitches
can be knitted in several orders, and the order changes how the fabric bends.
The builder now keeps looking briefly after the first way it finds, and each
card keeps the order whose look comes nearest the drawing's shape — on a tie,
the order that goes in and then out. A walk made of trips out from home and
back is also offered re-ordered into a pyramid, farthest trip in the middle:
S11's pink turns 5, 7, 8, 7, 5 now, the book's lens, not 7, 8, 5, 7, 5.

| Shape | Shape penalty before | After |
|---|---|---|
| S14 your nested triangles, as drawn | 2.01, lopsided | 0.79, symmetric |
| S8 teardrop, symmetric card | 1.51 | 1.03 |
| S4 leaning stripe | 0.47 | 0.41 |

Still lopsided in every book's way: S7 oval, S13 blob inside a blob — step 2,
the proper symmetric fitter.

**Round 3, step 2 done (2026-11-13): the symmetric fitter** (`units.ts`,
`mirror`). For a shape symmetric as drawn, only one half is fitted, each
column scored together with its mirror image, and the other half is its
image — both ends pointed alike, the same rules on both sides. The Symmetric
card tries these first, then the mirrored halves, and offers only short-row
knittings.

What it showed: the symmetric fits are good — the oval and the blob inside a
blob come out as drawn (they keep every law), the teardrop as a neat
symmetric teardrop. But the builder still can't knit the oval or the blob
inside a blob as drawn (the builder gap of step 2 in the earlier order), so
their Symmetric cards fall back to crude shapes, ranked last.

The shape measure, corrected on the way: a shape's outline includes where it
meets the fabric's edge (a band running off both sides was passing for a
blob), and a fourth part was added to the blend — **area**, the share of the
shape's stitches that come out the wrong colour, weighted as two stitches
out all round. With it the ranking matches your calls: the teardrop's
symmetric card first; the blob's real fits ahead of a symmetric band.

**Round 3, step 4 done (2026-11-13): the oval's puzzles.** The stitch added in
row 3 is the old nudging: it moves one stitch at a time, at the first place
the builder gets stuck, until the builder succeeds — the first fix that works,
never looking for symmetry. Here it lined up ridge 3's right end with ridge
4's. Lopsided because of the method, not the knitting.
The gap in the needle chart is **not a carry** (the only carry in that
version is 1 stitch, row 13): it is a **second ball of pink** joined 3
stitches along from where the first one's rows ended ("Row 9: (A) K2, (B) K11,
SR" starts a new ball). Both balls are drawn pink, so it looks like a carry.
What it teaches — a limit on the near end's freedom: a near end may be blunt
or stepped only while each ridge starts within the carry (2 stitches) of where
the yarn waits; a step of 3 takes a new ball. To add to the laws.

**Round 3, step 5 done (2026-11-13): why adding stitches can't rescue the
teardrop.** The teardrop breaks two laws: its point at the top climbs 2 ridges
in one stitch, beside the tip (slope), and its left side is a straight side 2
ridges tall (tip). The slope is the hard one. A point at the top has to be
built from both sides, a ridge per stitch at most, so a tip 3 ridges above its
shoulders needs 3 stitches of slope on each side. Adding stitches can fix
that: raise the shoulders a stitch, and the steep step moves out a column;
raise that one, and it moves out again, until it reaches the sides — which
end up as points:

```
drawn            grown only, symmetric (6 stitches added)
. . . . B . . .      . . . . B . . . .
. . . B B B . .      . . . B B B . . .
. . . B B B . .      . . B B B B B . .
. . B B B B B .      . B B B B B B B .
. B B B B B B B      B B B B B B B B B
. B B B B B B B      . B B B B B B B .
. . B B B B B .      . . B B B B B . .
```

That shape **keeps every law** — a lemon, one stitch wider each side — and on
paper it is the nearest of all (shape penalty 0.95; the best card today,
Symmetric, is 1.35). **But the builder can't knit it**, and the try-everything
checker ran out of time without an answer. It is the same shape of problem as
the oval and the blob inside a blob: **pointed at both ends**. So adding
stitches does rescue the teardrop as a drawing; the builder is what fails.
That makes three shapes stuck on one builder gap, which is now the most
useful thing to fix. (The fitter's grow card also never offers the lemon: it
counts changed stitches, so it settles on 5 changes, lopsided, that the
builder can knit.)

**Round 3, step 6 done (2026-11-13): your T is out of the short-row set.**
It moved to its own list (`INTARSIA_SHAPES` in `probes.ts`): the short-row
tests and the review bar no longer count it, and the Draw tab still offers it
under "Intarsia only". Its two tests of the "ridge on top" card stay, as tests
of that card. The shapes this app is for are now S1–S16.

**Next: the builder gap** — shapes pointed at both ends that keep every law
but the builder can't knit: the oval (S7), the blob inside a blob (S13), and
the teardrop grown into a lemon (step 5).

**The builder gap, found (2026-11-13): not the builder — a missing law, the
near-end point.** All three have the same right-hand end: a point one ridge
thick, then 3 ridges in the next column. Take that one stitch off and the
lemon and the oval knit at once, one ball each.

Why. Each stitch's rows go left, right, left, right in turn. Under the point,
the background has knitted whole ridges, so the point's next row must head
left — it can only come in from the right, so it is the shape's first row,
where its ball joins; and its second row is the shape's last. Every pass
through the next column in, between those two, must turn there, and two
turns in a column need an ordinary row between: room for one turn only. So
**beside a right-hand point, at most 2 ridges.** At the left-hand point the
point is a turn partway through the trip, with ordinary rows either side, so
3 ridges fit there. (Joining the shape a stitch in from its point was tried
in the builder and can't work, for the same reason.)

Settled for certain by the try-everything checker, on a small lens:

| Small lens | Book's way? | Least carry |
|---|---|---|
| as drawn, right-hand point 1 → 3 ridges | no, ruled out | 1 stitch |
| right-hand point eased, 1 → 2 → 3 | yes | 0 |
| left-hand point eased instead | no | 1 stitch |

Your call: **(c) both.** The law goes in, and the fitter eases a right-hand
point a stitch for the book's-way cards (both points alike on a symmetric
card): the oval eased at column 4 knits, one ball each. And a labelled extra
card keeps the shape as drawn with the yarn carried 1 stitch — not the book's
way.

**Done (2026-11-13): the near point law, and the fitter keeps it.** Law 7 on
the Draw tab (`laws.ts`, "near point"); the fitter carries a flag "still on
a near point" and won't let the shape grow by more than 2 there (`units.ts`).
What it showed:
- **The laws are a guarantee again for every shape here:** S5 fish with a
  tail, S7 oval and S13 blob inside a blob all break this law — the three
  that kept every law yet couldn't be knitted. (The fish's body comes to a
  point at its right-hand end and grows to 3.) The edge probe E8, "peak one
  stitch wide, points at both ends — needs a carry of 1", is the same law.
- **The oval now knits the book's way,** one stitch eased (column 4, ridge
  2), 2 balls — and its predicted look is exactly the drawing: the ridges
  bend over the eased stitch (guessed physics until calibration).
- **Symmetric both ways and a right-hand point can't go together:** an oval
  symmetric top to bottom is an odd number of ridges thick in every column,
  so beside its point it can't be 2. The Symmetric card now also tries left
  to right only, and top to bottom only; the shape measure counts each
  symmetry lost as half of "lopsided", and the card says "symmetric left to
  right only".

**The carry card (b), not built yet.** How the try-everything checker knits
the small lens with a 1-stitch carry: the pink joins where the shape grows,
not at its point; it knits the point in separate small pieces later, with
the grey knitting single stitches between, and the pink carried a stitch
twice. A real extension of the builder.

**The blob inside a blob, found (2026-11-13): another missing law, the
narrow peak.** Eased at both right-hand points, it kept every law and was
still stuck — always at column 9 of the inner colour, eased whichever way.
There the inner colour runs 1, 1, 2, 3, 1, 1 ridges from its point: 3 ridges
between 2 and 1. Every pass over a column carries on into one of its
neighbours (a pass of one stitch would turn on a turn), and the yarn crosses
it out and back at least once. So **a column is at most a ridge less thick
than its two neighbours together.** Settled by the try-everything checker:

| Profile, right to left | Law says | Checker, certain |
|---|---|---|
| 1, 2, 1 | no | carry of 1 |
| 1, 2, 4, 2, 1 | no | carry of 1 |
| 1, 2, 3, 1 | no | carry of 1 |
| 1, 2, 3, 2, 1 | fine | the book's way |
| 1, 2, 3, 3, 2, 1 | fine | the book's way |

Law 8 on the Draw tab (`laws.ts`), kept by the fitter (`units.ts`: it
remembers how much the last column rose, and the next must be at least that
plus one thick). Checked only on shapes with nothing inside them: a shape
with one inside also hands over, so its passes can stop without a turn. New
edge probes, proven in the tests: E25 and E26 (near point, with and without),
E27 and E28 (narrow peak, with and without). Every shape that keeps the laws
still knits; the blob inside a blob's cards all knit the book's way.

**Round 4 review, set up 2026-11-13** (`review/review.json`, fresh; round 3
kept as `review-round3-2026-11-13.json`; your Peak carried over). What to
look at, in order:
1. S7 oval — the book's way now, one stitch eased; its predicted look is the
   drawing.
2. S13 blob inside a blob — both new laws; its best card, Symmetric, changes 6.
3. S5 fish with a tail — breaks the near point law; its nearest card still
   isn't the book's way (4 balls).
4. S8 teardrop — the Symmetric card, and whether the lemon (step 5) is
   wanted.
5. S16 your fish — still no book's way (8 balls).
The rest keep every law and knit as drawn.

**Round 4 review, read 2026-11-14.** S7 oval: "symmetric is better" (than
the suggested give-way card). S8 teardrop: "symmetric is decent enough". S13
blob inside a blob: looks right — "shape grows" looks more symmetric than the
Symmetric card in the fully relaxed fabric simulation. S5 fish with a tail:
intarsia only, drop it from short-row testing. (S16 not reviewed.)

What it says about the shape measure: it reads the predicted fabric back onto
the grid, cell by cell, and judges that. By that reading the oval's give-way
card is exactly the drawing (0.00) and the blob's grow card is lopsided —
but in the relaxed fabric, which is what you look at, you see the opposite
both times. The cell reading throws away the bends you see. So the measure
should judge the relaxed fabric's own outline, and the Symmetric card should
be the one whose relaxed fabric is symmetric, not whose plan is.

Next, proposed:
1. Shape measure on the relaxed fabric's outline, not the cell reading.
2. The Symmetric card chosen by its relaxed fabric's symmetry (follows 1).
3. Drop S5 as intarsia only, like the T.

**Done (2026-11-14): 1 and 3.** S5 moved to the intarsia-only list. The shape
measure now judges the relaxed fabric itself: each column as stretches of
colour at the heights its rows settle to (`look.ts`, `runsOf`), outline,
points and area compared at those heights. Looking at the two blob cards as
you saw them taught two more things about symmetry:
- **The eye forgives a tilt.** The Grow card's shape sits a little higher at
  one end; its form, both ends pointed, is symmetric, and you read it so. So
  symmetry is judged after taking out the best straight line through the
  middles of the columns.
- **About the shape's own middle,** not the drawing's: a shape half a stitch
  over is still symmetric (being off is the outline's business).
- **Left to right counts for more** where a drawing has both symmetries:
  two-thirds of "lopsided", top to bottom one third (your oval note; and
  short rows bow the fabric top to bottom anyway). A judgement to tune.

Results: the blob's Grow card now measures more symmetric than its Symmetric
card, as you saw it (its shape is still further from the drawing overall).
Each card picks its knitting order by this measure, so the oval's give-way
card now gets an order whose look is symmetric left to right, and it ranks
first (0.78; Symmetric 0.90). Your nested triangles come out nearly, not
exactly, symmetric once relaxed (6% of the shape).

**Steps:**

1. **Commit and push** what exists.
2. **Laws on the page.** A checker that marks on your drawing where a law is
   broken, and says which — the answer to "why can't this be made" for any
   shape.
3. **The book's method only.** The builder knits any drawing that keeps the
   laws, shapes inside shapes with one ball included (S15). It is the only way
   suggested; an intarsia version may be shown as a labelled extra, never the
   suggestion.
4. **Scale buttons.** "Bigger ×2" cures *too small* (a one-stitch detail: the
   fish's tail, your blob's bump) — expected, to be tested. "Wider ×2" cures
   *too steep* (the teardrop, your fish's body), at the price of the drawing's
   proportions; bigger alone keeps the same steepness. The app says which a
   drawing needs. Then the five open shapes are run at larger sizes, and which
   law each cure answers is written down.
5. **What's left.** Tails (S5: a tail is wider at its end than at the joint,
   the opposite of a tip — a body unit plus a tail unit?) and the T (S17 —
   first, what "improved" means to you). Each asked the same way: which law
   does it break, and does the book have a construction for it?
6. **Another round of review**, with the review bar, on the open shapes and
   anything new.

**How we know it's working:** each open shape ends one of two ways — it knits
the book's way and looks like the drawing, or the app names the law that stops
it and the change that cures it. Either teaches the logic.

**Set aside:** the old "draw the look" conversion (L3, `convert.ts`) is no
longer used by the editor; round shapes from ridges bending wait for
calibration.

---

## 7. Queue and later

**Parked** (expected to fall away with units; rechecked then): rounding that
creates vertical edges; preferring an even shape; avoiding edits; changes
bunching on one side of a symmetric drawing; the circle's extra ball; "C" shapes.

**Outstanding:** GitHub Pages is off (checked 2026-11-11): pushing publishes
no site. Push when you say.

**Later:**

- G — turn a drawn picture into a look grid at your gauge, with specks cleaned up.
- H — draw freehand on a canvas.
- Compare ways (F3): when a drawing can be knitted several ways, show them side
  by side and let you pick (L15).
- Fans and wedges as drawing targets, not only rectangles.
- Row tracker, saving projects, yarn quantities per colour.
- Fit for strangers: onboarding, examples, mobile, accessibility.
- Other colourwork methods.

**Last todo: calibrate the parameters.** After everything else: knit test pieces
— the Wedge and Bump examples, a test stripe, and the blob at the edge (S11,
your pick in the review) — measure them, and turn §3's
guesses into measured values. Until then the app labels its predicted look a
prediction.

---

## 8. What can be drawn

Your calls, marked 2026-10-24 and brought up to date 2026-10-31. **fine** —
knit as drawn; **auto** — adjust, and show what changed; **ask** — offer the
adjustment, you accept it; **redraw** — refuse, point at the spot, say why.

**Proven** (F1, 2026-10-24): any drawing made of whole ridges can be knitted
somehow, with enough hand-overs. So nothing is truly impossible; the real limits
are **cost** (ends to weave in) and **style** (whether it still looks like
short-row colorwork).

| # | Limitation | Your call | Status |
|---|---|---|---|
| L1 | Detail smaller than a cell is lost | auto, at your gauge: the grid shown over the drawing | later (G) |
| L2 | Specks and ragged edges from pixels | auto: clean up, show what was removed | later (G) |
| L3 | Each colour is a yarn | up to 10 colours | built |
| L4 | A colour patch one row tall | auto: work in ridges; round anything that slips through | built: cells are ridges |
| L5 | A vertical edge made with turns would stack them | intarsia instead; a 1-stitch sawtooth would also be fine | built: straight edges 2+ ridges tall hand over |
| L6 | A hand-over needs a yarn waiting on each side | auto, fewest ends | built |
| L7 | An island needs its own ball (Shoal's two fish: two balls of B) | auto: no limit on ends, but always the fewest, and shown; a cut-off decided at the end | built: balls and ends shown |
| L8 | A ring: inside and outside need their own yarn | as L7 | built |
| L9 | One colour touching only at a corner | as L7 | built |
| L10 | A thin vertical line | intarsia, ends counted | built; not a target (§6) |
| L11 | A fine texture, like a checkerboard | intarsia, ends counted | built; not a target (§6) |
| L12 | A steep diagonal, steeper than a stitch per ridge | ask each time: rounded to a stitch per ridge, or snapped to vertical | built for "draw the needle"; for units, step 4 |
| L13 | Turns crowd where a shape steps two ridges at one stitch | auto: nearest allowed steps, shown over the drawing | built (`round.ts`); gives way to unit fitting — it can create vertical edges (parked, §7) |
| L14 | The knitted shape isn't the drawn shape: ridges bend | auto: the predicted look always shown beside the drawing | built (Draw tab). With today's guesses bends are small — a third to half a ridge — so few cells differ |
| L15 | A drawing can be knitted several ways that look different | ask: side by side, you pick | later (F3) |
| L16 | Bending and flatness are guesses | fine: labelled a prediction | built |
| L17 | Carrying a yarn across the back to start a stitch or two away | allowed up to 2 stitches; an exact start preferred | built |
| L18 | A shape running from cast-on to top splits the background: each side needs its own ball (the T; a peak reaching the top) | as L7: allowed, fewest ends, shown (decided 2026-10-31) | built: counted as L7; a background wrapping round the shape is cut in two (§6) |
| L19 | Softening a shape with extra stitches so it knits with short rows instead of hand-overs (the T) | ask, showing **every** version side by side, each with its balls, ends and turns: the shape grows, the background gives way, a mix, and unsoftened (decided 2026-10-31) | built (§6, Draw tab) |

**Probes.** The 18 drawings of Stage E live in `src/methods/shortrow/probes.ts`,
each asking one question — P1 full-width band, P2 band from the edge, P3 gentle
diagonal, P4 steep diagonal, P5 vertical edge, P6 floating rectangle, P7
floating lens, P8 circle, P9 islands side by side, P10 islands one above the
other, P11 ring, P12 thin vertical line, P13 thin horizontal line, P14
checkerboard, P15 single dot, P16 two colours touching, P17 mushroom, P18 cup.
They stay as regression tests; the new probe set (§6, step 1) is what the app is
measured against.

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
| `methods/shortrow/grid.ts`, `probes.ts` | the grid notation; the probe drawings |
| `mesh/settle.ts`, `relax.ts` | the fabric's shape and its bent ridges |
| `mesh/look.ts`, `convert.ts` | a plan's look on the drawing's grid; look → plan, cell by cell |
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

**Step 2 — The units.** Each knitted the book's way, with a few settings
(width, height, steps, position), and each knowing its stitch plan and
predicted look:

| Unit | Knitted as | Built? |
|---|---|---|
| Stripe | out, turn, back | yes (`motif.ts`) |
| Short stripe | from an edge, caught up with pairs | yes (`motif.ts`, `balance.ts`) |
| Wedge, leaning stripe | pairs from one edge | yes (`construct.ts`) |
| Peak | a zigzag going in | yes (`construct.ts`) |
| Lens, fish | a zigzag in then out (Shoal), steps of 2+ | yes (`motif.ts`) |
| Nested peaks | inner first | yes (`construct.ts`) |
| Background | catch-up pairs, full rows to cross | yes (`balance.ts`) |

**Step 3 — Fitting.** Find each blob of colour in the drawing; for each, the
unit and settings whose predicted look is closest. Put them together, inner
first, the background catching up around them; check with the full builder and
prediction. Stitches added or removed to fit are shown, not hidden.

**Step 4 — The editor shows the fit.** Your drawing; the units found, each
named; what you'll get; differences marked clearly, with the colour you drew
still visible; softening offered as a choice with its ball and turn count (the
T); a blob that fits no unit marked on the drawing, not only named in a message.

**Softening (L19):** every version is shown side by side — the shape grows into
the background, the background gives way into the shape, a mix, and the shape
left as drawn — each with its balls, ends and turns. You pick.

---

## 7. Queue and later

**Parked** (expected to fall away with units; rechecked then): rounding that
creates vertical edges; preferring an even shape; avoiding edits; changes
bunching on one side of a symmetric drawing; the circle's extra ball; "C" shapes.

**Outstanding:** check whether GitHub Pages is switched on; push when you say.

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
— the Wedge and Bump examples, a test stripe — measure them, and turn §3's
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
| L18 | A shape running from cast-on to top splits the background: each side needs its own ball (the T; a peak reaching the top) | as L7: allowed, fewest ends, shown (decided 2026-10-31) | built: counted as L7 |
| L19 | Softening a shape with extra stitches so it knits with short rows instead of hand-overs (the T) | ask, showing **every** version side by side, each with its balls, ends and turns: the shape grows, the background gives way, a mix, and unsoftened (decided 2026-10-31) | planned (§6, steps 3–4) |

**Probes.** The 18 drawings of Stage E live in `src/methods/shortrow/probes.ts`,
each asking one question — P1 full-width band, P2 band from the edge, P3 gentle
diagonal, P4 steep diagonal, P5 vertical edge, P6 floating rectangle, P7
floating lens, P8 circle, P9 islands side by side, P10 islands one above the
other, P11 ring, P12 thin vertical line, P13 thin horizontal line, P14
checkerboard, P15 single dot, P16 two colours touching, P17 mushroom, P18 cup.
They stay as regression tests; the new probe set (§6, step 1) is what the app is
measured against.

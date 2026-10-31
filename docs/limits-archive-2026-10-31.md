# What can be drawn — limitations of drawing → short-row pattern

Stage E of PLAN.md §5. **Marked by you on 2026-10-24** — the "Your call" column is
settled. For each limitation: my reading of it, my draft, and your call. This is
the spec the grid constructor (Stage F) follows.

The calls:

- **fine** — knit it as drawn;
- **auto** — adjust automatically, and show what changed;
- **ask** — offer the adjustment, let you accept it;
- **redraw** — refuse, point at the spot, say why.

---

## Two things everything else rests on

**1. A drawing's pixel is one stitch wide and one ridge (2 rows) tall.**
Every colour goes out and comes back (rule 3), so a yarn covers each stitch an
even number of times: in every column, each patch of colour is a whole number of
ridges. A single row of colour can't happen. In garter a ridge is about as tall as
a stitch is wide, so the drawing grid's cells come out roughly square.

**2. A colour edge is made one of two ways.**

| | A **turn** (short rows) | A **hand-over** (Shoal's "(A) K4, (B) K14") |
|---|---|---|
| Good for | diagonal and curved edges | vertical edges |
| Look | the short-row look — ridges sweep and bend | straight, like intarsia |
| Cost | none beyond the yarn already there | an enclosed shape needs extra balls: 2 ends each |
| Limit | can't be vertical: turning in the same column every time stacks turns (rule 1) | each piece needs a yarn waiting at its edge |

**Your principle: which way to make each edge** (2026-10-24, made stricter the
same day). **Intarsia is used only for vertical lines and edges.** Every edge in a
drawing is one of three kinds:

| Edge | How it's knitted |
|---|---|
| **Horizontal** — colour changes from one ridge to the next | nothing special: change yarn at the row |
| **Vertical** | intarsia (hand-overs) — and *only* here |
| **Sloped or curved** | short rows, always — fitted from templates of shapes we know how to knit (PLAN.md §5, F2) |

Intarsia is not a fallback for shapes that don't fit a template.

**A claim to prove in F:** any grid made of whole ridges can be knitted somehow,
if enough hand-overs are allowed. If that holds, nothing drawn is truly
*impossible* — the real limits are **cost** (how many ends to weave in) and
**style** (whether it still looks like short-row colorwork).

---

## The limitations

### Turning a drawing into a grid (Stage G)

| # | Limitation | Why | My draft | Your call |
|---|---|---|---|---|
| L1 | Detail smaller than one stitch × one ridge is lost | That's the finest the fabric can hold | auto: show the grid over the drawing | **auto, at your gauge**: you set the stitch and row size; the drawing is converted at that size and the grid shown over it |
| L2 | Specks and ragged edges from turning pixels into cells | Each stray cell could cost a yarn change | auto: clean up, show what was removed | **auto**: clean up, show what was removed |
| L3 | Each colour is a yarn | More colours, more balls and ends | — | **Up to 10 colours** (decided 2026-10-24) |

### Building it (Stage F)

| # | Limitation | Why | My draft | Your call |
|---|---|---|---|---|
| L4 | A colour patch one row tall | Rule 3: patches are whole ridges | auto: round to a ridge (already avoided if G draws in ridges) | **auto**: work in ridges from the start; round anything that slips through |
| L5 | A vertical edge made with turns | Turns in the same column stack (rule 1) | auto: stagger into a 1-stitch sawtooth — or use a hand-over (L6) | **auto**: a 1-stitch sawtooth is fine — but vertical edges are better as intarsia (see the principle above) |
| L6 | A vertical edge made with a hand-over | Needs a yarn waiting on each side | — | auto, counted with the fewest-ends rule of L7 |
| L7 | An island — a shape not touching an edge | Its yarn can't get there without its own ball (Shoal's two fish = two balls of B) | — | **auto: no limit on ends, but always use the fewest possible, and show the count.** A cut-off is decided at the end of the project (decided 2026-10-24) |
| L8 | A shape with a hole (a ring) | Inside and outside each need their own yarn | — | as L7 |
| L9 | Shapes of one colour touching only at a corner | Probably two separate yarns | — | as L7 |
| L10 | A thin vertical line, 1–2 stitches | A hand-over on every ridge, both sides | ask: thicken, or accept the ends | **intarsia**: thin vertical lines are plain intarsia, ends counted |
| L11 | A fine texture — checkerboard, dots | A yarn change for nearly every cell | redraw (or simplify automatically) | **intarsia — because a texture like a checkerboard is only vertical and horizontal edges**, ends counted |
| L12 | A steep diagonal, steeper than a stitch per ridge | Turns crowd one column (rule 1) | auto: stagger; it gets slightly jagged | **ask each time**: show it rounded to the steepest short-row slope and snapped to vertical (intarsia), and you choose (changed 2026-10-24 from "switch to intarsia") |
| L13 | Turn-built edges come in steps of whole stitches; a zigzag needs steps of at least 2 | The in-and-out turns must not land on each other | auto: round the edge to the nearest allowed step | **auto**: nearest allowed steps, knitted edge shown over the drawing |
| L17 | Carrying a yarn a short way across the back, so it starts a stitch or two from where it stopped | Saves a new ball every time an edge shifts — intarsia does this routinely; the book never needs it | — | **allowed up to 2 stitches** (decided 2026-10-24); an exact start is always preferred |

### How it will look (the preview)

| # | Limitation | Why | My draft | Your call |
|---|---|---|---|---|
| L14 | The knitted shape isn't exactly the drawn shape | Ridges bend where short rows turn | auto: show the relaxed preview beside the drawing | **auto**: the predicted knitted look always shown beside the drawing |
| L15 | The same grid can be knitted several ways, and they look different | Turns and hand-overs bend ridges differently | auto: pick the one closest to the drawing; say which it chose | **ask**: show the ways it could be knitted side by side, and you pick |
| L16 | How much ridges bend, and what stretch won't lie flat, are guesses | Not yet measured with yarn (PLAN.md §3) | fine for now, but say it's a prediction | **fine**: use the current numbers, labelled as a prediction |

---

## Probe grids

What they're for: test cases, the way the book's five patterns were for the
reader and writer. Each asks one question. While F is built, every probe is run
through it to see what it does — knits, adjusts (and how), the ends it needs, or
refuses and why — so your calls are made on real results, not descriptions. They
then stay as permanent tests.

Small test drawings, each asking one question. `.` is background (A), `#` is the
motif (B), `o` a third colour (C). Each character is one stitch × one ridge. Top
of the drawing is the top of the fabric; the right edge is where the knitting
starts.

**P1 — full-width band.** Baseline: must be trivial.
```
..............
##############
..............
```

**P2 — band from the right edge.** The book's Short Stripes.
```
..............
....##########
..............
```

**P3 — gentle diagonal**, one stitch per ridge. A wedge of turns. (L13)
```
.............#
............##
...........###
..........####
.........#####
```

**P4 — steep diagonal**, one stitch every three ridges. (L12)
```
...........###
...........###
..........####
..........####
..........####
.........#####
```

**P5 — vertical edge**, a tall block at the right. Turns or a hand-over? (L5, L6)
```
.........#####
.........#####
.........#####
.........#####
.........#####
```

**P6 — floating rectangle.** An island with vertical sides. (L5–L7)
```
..............
....######....
....######....
....######....
..............
```

**P7 — floating lens.** Shoal's fish; should come out as the book's.
```
..............
......##......
....######....
...########...
....######....
......##......
..............
```

**P8 — circle.** Curves both ways.
```
.....####.....
...########...
..##########..
..##########..
...########...
.....####.....
```

**P9 — two islands side by side.** Two balls of B? (L7)
```
..............
.###......###.
.###......###.
..............
```

**P10 — two islands one above the other.** Can one ball of B do both? (L7)
```
.....####.....
..............
..............
.....####.....
```

**P11 — ring.** A hole inside. (L8)
```
....######....
...##....##...
...##....##...
....######....
```

**P12 — thin vertical line.** (L10)
```
.......#......
.......#......
.......#......
.......#......
```

**P13 — thin horizontal line,** one ridge, part width. (Should be easy.)
```
..............
...#######....
..............
```

**P14 — checkerboard.** Worst case. (L11)
```
##..##..##..##
##..##..##..##
..##..##..##..
..##..##..##..
```

**P15 — single dot.** (L7, L11)
```
..............
.......#......
..............
```

**P16 — two colours touching.** Three yarns at once. (L3)
```
..............
...####oooo...
...####oooo...
..............
```

**P17 — mushroom**: wider at the top than the bottom. Overhang.
```
...########...
...########...
......##......
......##......
```

**P18 — cup**: a notch cut in from the top.
```
...##....##...
...##....##...
...########...
...########...
```

---

## Still open

- ~~Is a 1-stitch sawtooth acceptable?~~ — decided: fine; and straight vertical
  edges are intarsia anyway. What the sawtooth is: a vertical
  edge built with turns can't turn in the same column every ridge (rule 1), so it
  alternates — column 10, then 11, then 10 — and the edge wiggles by a stitch:

  ```
  what you drew   built with turns        built with hand-overs
  .....#####      .....#####  turn at 10   .....#####
  .....#####      ....######  turn at 11   .....#####
  .....#####      .....#####  turn at 10   .....#####
  .....#####      ....######  turn at 11   .....#####
  ```
- ~~How many ends is too many~~ — decided: no limit while designing, always the
  fewest possible, cut-off at the end of the project.
- ~~More than two colours~~ — decided: up to 10.
- The claim that everything is knittable with enough hand-overs — I'll try to
  prove or break it at the start of F.

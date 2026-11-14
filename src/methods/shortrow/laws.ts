/**
 * The laws of short-row construction, checked on a drawing — PLAN.md §6, "the
 * plan from here". A drawing that keeps them can be knitted the book's way as
 * it stands; where it breaks one, this says which, and where, so the reason a
 * shape "can't be made" is on the page instead of in the builder's silence.
 *
 * Checked here, shape by shape, reading each as one stretch of colour per
 * column — its own colour and anything drawn inside it:
 *
 *  - **one piece**: a shape has one stretch in each column. Two, with another
 *    colour between (a forked tail, a "C"), can't come from one ball working
 *    back and forth.
 *  - **slope**: from one column to the next, each edge — the layer under the
 *    shape and the layer over it — moves a ridge at most: every turn a stitch
 *    further on. Each edge on its own; the shape's thickness may change by
 *    two, where both step at one stitch. Under and over are measured within
 *    whatever the shape sits in.
 *  - **bump**: neither of those layers is thicker in one column than in both
 *    its neighbours — a bump one stitch wide in the background, two turns on
 *    one stitch. A one-stitch tip of the shape itself is fine.
 *  - **tip**: at its far end — the left, where its yarn turns — short of the
 *    fabric's edge, a shape ends one ridge thick. A straight side there is
 *    intarsia's. Its near end may be blunt.
 *  - **near point**: where its near end is a point one ridge thick, the shape
 *    is at most 2 ridges thick where it first grows. The point's two rows are
 *    the shape's first and last, so the turns between have room for one.
 *  - **narrow peak**: a column is at most a ridge less thick than its two
 *    neighbours together. Every pass over it carries on into one of them (a
 *    pass of one stitch would turn on a turn), and the yarn crosses it out
 *    and back at least once. Checked on shapes with nothing inside them,
 *    whose rows all turn; a shape with one inside also hands over.
 *
 * These are the same conditions units.ts fits a shape to. The other two laws —
 * one ball per shape, and balance — are about the knitting, not the drawing:
 * the builder keeps them, and mesh/fit.ts counts the rows that don't.
 */
import type { Yarn } from "./passes";
import type { Grid } from "./grid";
import { blobsOf } from "./units";

export type Law = "one piece" | "slope" | "bump" | "tip" | "near point" | "narrow peak";

export interface Breach {
  law: Law;
  /** The shape's colour. */
  colour: Yarn;
  /** The cells that show it, to mark on the drawing. Ridge 0 is the cast-on,
   *  column 1 the right edge. */
  cells: { ridge: number; column: number }[];
  /** What is wrong here, in a sentence. */
  why: string;
}

/** A shape's stretch in one column: its lowest ridge, and one above its highest. */
interface Span {
  bottom: number;
  top: number;
}

export function checkLaws(grid: Grid): Breach[] {
  const { width: N, height: H } = grid;
  const { blobs, ownerOf } = blobsOf(grid);
  const breaches: Breach[] = [];

  const family = (id: number): Set<number> => {
    const out = new Set<number>([id]);
    for (const k of blobs[id].children) for (const d of family(k)) out.add(d);
    return out;
  };
  const depth = (id: number): number => (blobs[id].parent === null ? 0 : 1 + depth(blobs[id].parent!));
  const order = [...blobs].sort((x, y) => depth(x.id) - depth(y.id) || x.id - y.id);

  // Each shape's stretch in each column, parents before the shapes inside them.
  const spans = new Map<number, (Span | null)[]>();
  for (const blob of order) {
    const fam = family(blob.id);
    const colour = blob.colour;
    const cellsOf = (c: number, from: number, to: number) => Array.from({ length: to - from }, (_, k) => ({ ridge: from + k, column: c + 1 }));

    const span: (Span | null)[] = [];
    for (let c = 0; c < N; c++) {
      const runs: Span[] = [];
      for (let r = 0; r < H; r++) {
        if (!fam.has(ownerOf[r * N + c])) continue;
        const last = runs[runs.length - 1];
        if (last && last.top === r) last.top = r + 1;
        else runs.push({ bottom: r, top: r + 1 });
      }
      if (runs.length === 0) {
        span.push(null);
        continue;
      }
      // The tallest stretch is the shape here; the rest are the breach.
      const main = runs.reduce((a, b) => (b.top - b.bottom > a.top - a.bottom ? b : a));
      if (runs.length > 1) {
        breaches.push({
          law: "one piece",
          colour,
          cells: runs.filter((run) => run !== main).flatMap((run) => cellsOf(c, run.bottom, run.top)),
          why: `Yarn ${colour} comes twice in column ${c + 1}, with another colour between. One ball, working back and forth, makes one stretch per column.`,
        });
      }
      span.push(main);
    }
    spans.set(blob.id, span);

    const from = span.findIndex((s) => s !== null);
    const to = span.length - 1 - [...span].reverse().findIndex((s) => s !== null);
    // What it sits in: the shape around it, or the whole height of the fabric.
    const around = blob.parent === null ? null : spans.get(blob.parent)!;
    const floor = (c: number) => around?.[c]?.bottom ?? 0;
    const ceiling = (c: number) => around?.[c]?.top ?? H;
    const at = (c: number) => span[c]!;
    const thick = (c: number) => at(c).top - at(c).bottom;
    const under = (c: number) => at(c).bottom - floor(c);
    const over = (c: number) => ceiling(c) - at(c).top;

    // Tips: at its far end — the left, where its yarn turns — short of the
    // fabric's edge. Its near end, where the rows start and its yarn waits,
    // needs no turn, and may be blunt (proven: PLAN.md §6, edge map).
    for (const [end, edge] of [[to, N - 1]]) {
      if (end === edge || thick(end) === 1) continue;
      breaches.push({
        law: "tip",
        colour,
        cells: cellsOf(end, at(end).bottom, at(end).top),
        why: `Yarn ${colour} ends in a straight side ${thick(end)} ridges tall at column ${end + 1}. Short rows end a shape in a point one ridge thick; a straight side takes intarsia.`,
      });
    }

    // The near point: a shape that comes to a point one ridge thick at its
    // near end, short of the fabric's edge, is at most 2 ridges thick where
    // it first grows (PLAN.md §6, the builder gap). The point's two rows are
    // the shape's first and last; every row between must turn short of it,
    // in the column where it grows, and two turns there would stack.
    if (from > 0 && thick(from) === 1) {
      let c = from + 1;
      while (c <= to && span[c] !== null && thick(c) === 1) c++;
      if (c <= to && span[c] !== null && thick(c) > 2) {
        breaches.push({
          law: "near point",
          colour,
          cells: cellsOf(c, at(c).bottom, at(c).top),
          why: `Yarn ${colour} comes to a point at its right-hand end, then grows to ${thick(c)} ridges at column ${c + 1}. Beside a right-hand point, 2 at most: the point's rows are the shape's first and last, so the turns between would land on each other.`,
        });
      }
    }

    for (let c = from + 1; c <= to; c++) {
      if (span[c] === null || span[c - 1] === null) continue;
      // Slope: each edge on its own — the layer under it and the layer over
      // it — a ridge at most. Not its thickness: where both edges step at one
      // stitch, two yarns make them (PLAN.md §6, "what a found knitting
      // taught"; your S8 and S11).
      const steps = [under(c) - under(c - 1), over(c) - over(c - 1)];
      if (steps.some((d) => Math.abs(d) > 1)) {
        const a = at(c - 1);
        const b = at(c);
        // The cells that stick out past the next column, top and bottom.
        const cells = [
          ...cellsOf(b.top > a.top ? c : c - 1, Math.min(a.top, b.top), Math.max(a.top, b.top)),
          ...cellsOf(b.bottom < a.bottom ? c : c - 1, Math.min(a.bottom, b.bottom), Math.max(a.bottom, b.bottom)),
        ];
        const most = Math.max(...steps.map(Math.abs));
        breaches.push({
          law: "slope",
          colour,
          cells: cells.length > 0 ? cells : cellsOf(c, b.bottom, b.top),
          why: `Too steep between columns ${c} and ${c + 1}: an edge of yarn ${colour} moves ${most} ridges in one stitch. Short rows manage one — each turn a stitch further on.`,
        });
      }
    }

    // Narrow peaks: thicker than its two neighbours together, less a ridge.
    if (blob.children.length === 0) {
      for (let c = from + 1; c < to; c++) {
        if (span[c - 1] === null || span[c] === null || span[c + 1] === null) continue;
        if (thick(c) <= thick(c - 1) + thick(c + 1) - 1) continue;
        breaches.push({
          law: "narrow peak",
          colour,
          cells: cellsOf(c, at(c).bottom, at(c).top),
          why: `Yarn ${colour} is ${thick(c)} ridges thick at column ${c + 1}, between ${thick(c - 1)} and ${thick(c + 1)}. A column can be at most a ridge less than its two neighbours together: every pass over it carries on into one of them, and the yarn must cross it out and back.`,
        });
      }
    }

    // Bumps: a layer thicker in one column than in both its neighbours.
    for (let c = from + 1; c < to; c++) {
      if (span[c - 1] === null || span[c] === null || span[c + 1] === null) continue;
      const peak = (layer: (c: number) => number) => layer(c) > layer(c - 1) && layer(c) > layer(c + 1);
      const { bottom, top } = at(c);
      const cells: { ridge: number; column: number }[] = [];
      // A tip one stitch wide in the shape itself is fine: the in-and-out
      // walk turns twice there with a row between (your peak).
      // The layer under it, or over it, poking one stitch into the shape.
      if (peak(under) && bottom > 0) cells.push({ ridge: bottom - 1, column: c + 1 });
      if (peak(over) && top < H) cells.push({ ridge: top, column: c + 1 });
      if (cells.length === 0) continue;
      breaches.push({
        law: "bump",
        colour,
        cells,
        why: `A bump one stitch wide at column ${c + 1}, in yarn ${colour} or the layer beside it: out and back over one stitch is two turns on that stitch.`,
      });
    }
  }
  return breaches;
}

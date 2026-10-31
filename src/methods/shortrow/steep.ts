/**
 * Steep diagonals — PLAN.md §8, L12: "ask each time: show it rounded to the
 * steepest short-row slope and snapped to vertical (intarsia), and you choose".
 *
 * Short rows can make an edge lean at most a stitch per ridge: one turn a
 * stitch further in each ridge. An edge steeper than that — a stitch every two
 * or three ridges — is a staircase of short vertical pieces. Two ways to knit
 * it, and they look different:
 *
 *  - snapped to vertical: as drawn, each vertical piece a hand-over (intarsia),
 *    stepping across a stitch where the drawing does;
 *  - rounded to the steepest short-row slope: the edge redrawn at a stitch per
 *    ridge, through the middle of the drawn one, and turned like any slope.
 *
 * Which edges count: a boundary between two colours, followed up the fabric,
 * that moves steadily one way, but by fewer stitches than it climbs ridges, less
 * one. A boundary that doesn't move at all is simply vertical (a rectangle's
 * side); one that goes out and back is a curve with a flat side (a circle's
 * widest point) — both are intarsia without asking.
 */
import type { Column, Yarn } from "./passes";
import type { Grid } from "./grid";
import type { Change } from "./round";

export interface SteepEdge {
  /** Colour on the right of the edge, and on the left. */
  right: Yarn;
  left: Yarn;
  /** Lowest and highest ridge it spans, from 0 at the cast-on. */
  from: number;
  to: number;
  /** For each ridge from `from`, the last column of the right-hand colour. */
  at: Column[];
}

export function steepEdges(grid: Grid): SteepEdge[] {
  const { width: N, height: H, cells } = grid;
  const used = new Set<string>();
  // Is there an edge between column c (right) and c + 1 (left), between these
  // colours, on ridge r?
  const edge = (r: number, c: Column, right: Yarn, left: Yarn) =>
    r < H && c >= 1 && c < N && cells[r][c - 1] === right && cells[r][c] === left;

  const out: SteepEdge[] = [];
  for (let r = 0; r < H; r++) {
    for (let c = 1; c < N; c++) {
      const right = cells[r][c - 1];
      const left = cells[r][c];
      if (right === left || used.has(`${r},${c}`)) continue;
      // Follow it up, staying put where it does, else a stitch either way.
      const at: Column[] = [c];
      let k = r;
      for (;;) {
        const here = at[at.length - 1];
        const next = [here, here - 1, here + 1].find((x) => edge(k + 1, x, right, left));
        if (next === undefined) break;
        at.push(next);
        k++;
      }
      at.forEach((x, i) => used.add(`${r + i},${x}`));

      const moves = at.slice(1).map((x, i) => x - at[i]);
      const steady = moves.every((m) => m >= 0) || moves.every((m) => m <= 0);
      const shift = Math.abs(at[at.length - 1] - at[0]);
      if (steady && shift > 0 && shift < at.length - 1) out.push({ right, left, from: r, to: k, at });
    }
  }
  return out;
}

/** The drawing with every steep edge redrawn at a stitch per ridge, through
 *  the middle of the drawn edge — and the stitches that changed. */
export function roundSteep(grid: Grid, edges: SteepEdge[] = steepEdges(grid)): { grid: Grid; changed: Change[] } {
  const cells = grid.cells.map((row) => [...row]);
  const changed: Change[] = [];
  for (const e of edges) {
    const ridges = e.at.length;
    const middleRidge = (ridges - 1) / 2;
    const middle = e.at.reduce((a, b) => a + b, 0) / ridges;
    const way = Math.sign(e.at[ridges - 1] - e.at[0]);
    e.at.forEach((drawn, i) => {
      const r = e.from + i;
      const want = Math.max(0, Math.min(grid.width, Math.round(middle + way * (i - middleRidge))));
      // Between where the edge was drawn and where it should be, stitches
      // change sides — but only stitches of the edge's own two colours.
      const lo = Math.min(drawn, want) + 1;
      const hi = Math.max(drawn, want);
      const to = want > drawn ? e.right : e.left;
      for (let c = lo; c <= hi; c++) {
        const from = cells[r][c - 1];
        if (from === to || (from !== e.left && from !== e.right)) continue;
        cells[r][c - 1] = to;
        changed.push({ ridge: r, column: c, from, to });
      }
    });
  }
  return { grid: { ...grid, cells }, changed };
}

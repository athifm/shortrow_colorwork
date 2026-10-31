/**
 * Rounding a drawing so short rows can knit it (LIMITS.md L13: "auto: nearest
 * allowed steps, knitted edge shown over the drawing").
 *
 * Some sloped edges can't be turned exactly as drawn. A lens whose top and
 * bottom both step out at the same stitch asks for two more rows' worth of
 * turns in that column than the column has room for: the two turns would sit
 * one on the other (rule 1). Moving one stitch — the lens a stitch shorter at
 * the bottom there, say — gives each turn its own column.
 *
 * The builder says where it got stuck. Rounding tries the smallest changes
 * there — one stitch of the colour that couldn't turn, given to its neighbour
 * above or below, or one stitch added beside it — keeps the change that lets the
 * builder get furthest, and repeats until the drawing knits. The drawing itself
 * is never changed; the changed stitches are reported so they can be shown
 * over it.
 */
import type { Column, Yarn } from "./passes";
import type { Grid } from "./grid";
import { knitShortRows, type Built } from "./construct";

export interface Change {
  /** Ridge, from 0 at the cast-on, and column, from 1 at the right edge. */
  ridge: number;
  column: Column;
  from: Yarn;
  to: Yarn;
}

export interface Rounded {
  grid: Grid;
  changed: Change[];
  built: Built;
}

type Kind = "shorter below" | "shorter above" | "longer beside";

/** The orders to try the changes in. Each finds a different rounding; the one
 *  with the fewest changed stitches wins. */
const ORDERS: Kind[][] = [
  ["shorter below", "shorter above", "longer beside"],
  ["shorter above", "shorter below", "longer beside"],
  ["longer beside", "shorter below", "shorter above"],
];

/** The nearest drawing short rows can knit, or null if rounding doesn't help:
 *  when the builder is stuck on something other than crowded turns, or it would
 *  take more changes than the drawing has stitches along an edge and a side. */
export function roundForShortRows(grid: Grid): Rounded | null {
  let best: Rounded | null = null;
  for (const order of ORDERS) {
    const r = roundIn(grid, order);
    if (r && (!best || r.changed.length < best.changed.length)) best = r;
  }
  return best;
}

function roundIn(grid: Grid, order: Kind[]): Rounded | null {
  let current = grid;
  let built = knitShortRows(current);
  const changed: Change[] = [];
  const limit = grid.width + grid.height;

  while (built.problems.length > 0) {
    const stuck = built.stuck;
    if (!stuck || changed.length >= limit) return null;

    let best: { grid: Grid; built: Built; change: Change } | null = null;
    const options = nearby(current, stuck);
    const ranked = order.flatMap((kind) => options.filter((o) => o.kind === kind).map((o) => o.change));
    for (const change of ranked) {
      // Never undo a change already made: that way lies going round in circles.
      if (changed.some((c) => c.ridge === change.ridge && c.column === change.column)) continue;
      const next = withChange(current, change);
      const tried = knitShortRows(next);
      if (tried.problems.length === 0) {
        best = { grid: next, built: tried, change };
        break;
      }
      const moved =
        tried.stuck !== undefined &&
        (tried.stuck.column !== stuck.column || tried.stuck.ridge !== stuck.ridge || tried.stuck.colour !== stuck.colour);
      if (!moved && tried.reached <= built.reached) continue;
      if (!best || tried.reached > best.built.reached) best = { grid: next, built: tried, change };
    }
    if (!best) return null;
    current = best.grid;
    built = best.built;
    changed.push(best.change);
  }
  return { grid: current, changed, built };
}

/** The single-stitch changes worth trying where the builder got stuck: the
 *  stuck colour a stitch shorter at the bottom or the top of its run in that
 *  column, or a stitch longer in a neighbouring column. */
function nearby(grid: Grid, stuck: NonNullable<Built["stuck"]>): { kind: Kind; change: Change }[] {
  const { width: N, height: H, cells } = grid;
  const at = (r: number, c: Column) => (r >= 0 && r < H && c >= 1 && c <= N ? cells[r][c - 1] : null);
  const X = stuck.colour;

  // The run of the stuck colour in this column nearest the stuck ridge.
  const runIn = (c: Column, near: number): [number, number] | null => {
    let r = -1;
    for (let d = 0; d < H && r < 0; d++) {
      if (at(near - d, c) === X) r = near - d;
      else if (at(near + d, c) === X) r = near + d;
    }
    if (r < 0) return null;
    let b = r;
    let t = r;
    while (at(b - 1, c) === X) b--;
    while (at(t + 1, c) === X) t++;
    return [b, t];
  };
  // What a stitch of X becomes when X gives it up: the colour beyond it in the
  // column, or — at the cast-on or the top — the colour beside it.
  const instead = (r: number, c: Column, beyond: number): Yarn | null => {
    for (const y of [at(beyond, c), at(r, c - 1), at(r, c + 1)]) if (y !== null && y !== X) return y;
    return null;
  };

  const out: { kind: Kind; change: Change }[] = [];
  const c = stuck.column;
  const run = runIn(c, stuck.ridge);
  if (run) {
    const [b, t] = run;
    if (t > b) {
      const below = instead(b, c, b - 1);
      if (below) out.push({ kind: "shorter below", change: { ridge: b, column: c, from: X, to: below } });
      const above = instead(t, c, t + 1);
      if (above) out.push({ kind: "shorter above", change: { ridge: t, column: c, from: X, to: above } });
    }
    for (const n of [c - 1, c + 1]) {
      const beside = runIn(n, stuck.ridge);
      if (!beside) continue;
      const [nb, nt] = beside;
      for (const r of [nb - 1, nt + 1]) {
        const y = at(r, n);
        if (y !== null && y !== X) out.push({ kind: "longer beside", change: { ridge: r, column: n, from: y, to: X } });
      }
    }
  }
  return out;
}

function withChange(grid: Grid, change: Change): Grid {
  const cells = grid.cells.map((row) => [...row]);
  cells[change.ridge][change.column - 1] = change.to;
  return { ...grid, cells };
}

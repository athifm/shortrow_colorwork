/**
 * Short-row units — PLAN.md §6, steps 2 and 3. Every shape the book knits with
 * short rows, read column by column, is one run of its colour in each column,
 * and from one column to the next:
 *
 *  - its bottom edge moves at most a ridge: the colour below fills up to it
 *    with catch-up pairs, a turn a stitch further in each ridge;
 *  - its top edge moves at most a ridge: the colour above levels it the same way;
 *  - its thickness changes by at most a ridge: its own zigzag, in or out, turns
 *    a stitch further each ridge — so no two turns stack (rule 1);
 *  - where it ends, short of an edge of the fabric, it ends one ridge thick:
 *    a tip, not a vertical edge (which is intarsia's).
 *
 * That one rule makes every unit in the book: a stripe (edge to edge), a short
 * stripe and a wedge (from an edge), a leaning stripe, a peak (flat bottom), a
 * lens or fish (in, then out, steps of two). So fitting a drawing means: for
 * each blob of colour, the nearest shape that keeps the rule — found column by
 * column, exactly, by trying every bottom and top (dynamic programming).
 *
 * "Nearest" three ways, which are the softening versions of L19: the shape
 * only grows (stitches added in its colour), the background only gives way
 * (stitches taken from the shape), or both, whichever changes fewest stitches.
 * Every changed stitch is reported.
 */
import type { Column, Yarn } from "./passes";
import type { Grid } from "./grid";
import type { Change } from "./round";

export type Softening = "grow" | "give way" | "both";

/** A connected patch of one colour, drawn. */
export interface Blob {
  id: number;
  colour: Yarn;
  /** Its cells, as ridge × width + column − 1. */
  cells: number[];
  /** The blob it sits inside, or null for the background. */
  parent: number | null;
  children: number[];
}

/** A blob fitted to a unit: one run of its colour in each column it spans. */
export interface Unit {
  blob: number;
  colour: Yarn;
  kind: UnitKind;
  /** Columns it spans, from 1 at the right edge. */
  from: Column;
  to: Column;
  /** For each column from `from`: its lowest ridge, and one above its highest. */
  bottom: number[];
  top: number[];
}

export type UnitKind = "stripe" | "edge shape" | "peak" | "lens" | "leaning stripe";

export interface Fitted {
  softening: Softening;
  /** The plan for the needle: the units drawn in, outermost first. */
  plan: Grid;
  units: Unit[];
  /** Stitches the plan changes from the drawing. */
  changed: Change[];
  /** Blobs no unit fits under this softening; they stay as drawn. */
  unfitted: number[];
}

// --- Blobs ---------------------------------------------------------------------

/** The blobs of a drawing, and the background colour they sit on: the colour
 *  most of the fabric's edge is. Background patches touching the edge aren't
 *  blobs; one cut off from the edge (inside a ring) is. */
export function blobsOf(grid: Grid): { background: Yarn; blobs: Blob[]; ownerOf: number[] } {
  const { width: N, height: H, cells } = grid;
  const count = new Map<Yarn, number>();
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < N; c++) {
      if (r === 0 || r === H - 1 || c === 0 || c === N - 1) count.set(cells[r][c], (count.get(cells[r][c]) ?? 0) + 1);
    }
  }
  const background = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];

  // Patches, four ways connected. -1 marks the background.
  const ownerOf = Array.from({ length: N * H }, () => -1);
  const seen = Array.from({ length: N * H }, () => false);
  const blobs: Blob[] = [];
  for (let start = 0; start < N * H; start++) {
    if (seen[start]) continue;
    const colour = cells[Math.floor(start / N)][start % N];
    const patch = [start];
    seen[start] = true;
    for (let k = 0; k < patch.length; k++) {
      const at = patch[k];
      const r = Math.floor(at / N);
      const c = at % N;
      for (const [nr, nc] of [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ]) {
        if (nr < 0 || nr >= H || nc < 0 || nc >= N) continue;
        const n = nr * N + nc;
        if (seen[n] || cells[nr][nc] !== colour) continue;
        seen[n] = true;
        patch.push(n);
      }
    }
    const atEdge = patch.some((at) => {
      const r = Math.floor(at / N);
      const c = at % N;
      return r === 0 || r === H - 1 || c === 0 || c === N - 1;
    });
    if (colour === background && atEdge) continue;
    const id = blobs.length;
    for (const at of patch) ownerOf[at] = id;
    blobs.push({ id, colour, cells: patch, parent: null, children: [] });
  }

  // A blob sits inside the smallest neighbouring blob whose bounds hold it.
  const bounds = blobs.map((b) => {
    const rs = b.cells.map((at) => Math.floor(at / N));
    const cs = b.cells.map((at) => at % N);
    return { r0: Math.min(...rs), r1: Math.max(...rs), c0: Math.min(...cs), c1: Math.max(...cs) };
  });
  const area = (i: number) => (bounds[i].r1 - bounds[i].r0 + 1) * (bounds[i].c1 - bounds[i].c0 + 1);
  for (const b of blobs) {
    const near = new Set<number>();
    for (const at of b.cells) {
      const r = Math.floor(at / N);
      const c = at % N;
      for (const [nr, nc] of [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ]) {
        if (nr < 0 || nr >= H || nc < 0 || nc >= N) continue;
        const o = ownerOf[nr * N + nc];
        if (o >= 0 && o !== b.id) near.add(o);
      }
    }
    const me = bounds[b.id];
    const holders = [...near].filter((o) => {
      const it = bounds[o];
      const holds = it.r0 <= me.r0 && it.r1 >= me.r1 && it.c0 <= me.c0 && it.c1 >= me.c1;
      // Two blobs with the same bounds: the bigger holds the smaller.
      return holds && (area(o) > area(b.id) || blobs[o].cells.length > b.cells.length);
    });
    holders.sort((x, y) => area(x) - area(y));
    b.parent = holders[0] ?? null;
  }
  for (const b of blobs) if (b.parent !== null) blobs[b.parent].children.push(b.id);
  return { background, blobs, ownerOf };
}

// --- Fitting one blob ---------------------------------------------------------------

/**
 * The nearest unit to one blob. `mine` says which cells are drawn as the blob
 * (or as anything inside it); `allowed` which cells the unit may cover. The
 * cost is the number of stitches changed, plus a hair for each step of an edge,
 * so that of two equally close shapes the smoother wins.
 */
function fitOne(
  N: number,
  H: number,
  mine: (r: number, c: number) => boolean,
  allowed: (r: number, c: number) => boolean,
  softening: Softening,
  strict: boolean,
  floor: number[],
  ceiling: number[],
): { from: Column; to: Column; bottom: number[]; top: number[] } | null {
  const INF = Number.POSITIVE_INFINITY;
  const STEP = 1 / (N * H + 1);
  // Prefix counts of my cells, and of cells I may not cover, per column.
  const mineBelow = Array.from({ length: N }, (_, c) => {
    const out = [0];
    for (let r = 0; r < H; r++) out.push(out[r] + (mine(r, c) ? 1 : 0));
    return out;
  });
  const barredBelow = Array.from({ length: N }, (_, c) => {
    const out = [0];
    for (let r = 0; r < H; r++) out.push(out[r] + (allowed(r, c) || mine(r, c) ? 0 : 1));
    return out;
  });
  const absent = (c: number) => {
    const lost = mineBelow[c][H];
    return softening === "grow" && lost > 0 ? INF : lost;
  };
  const cost = (c: number, b: number, t: number) => {
    if (barredBelow[c][t] - barredBelow[c][b] > 0) return INF;
    const kept = mineBelow[c][t] - mineBelow[c][b];
    const added = t - b - kept;
    const lost = mineBelow[c][H] - kept;
    if (softening === "grow" && lost > 0) return INF;
    if (softening === "give way" && added > 0) return INF;
    return added + lost;
  };

  // dp[c][state]: the least cost for columns up to c, with c spanned by
  // [b, t), and which layers just got thicker: the one under it, the one
  // over it, its own. Under and over are measured within what it
  // sits in — `floor` and `ceiling`, the parent's bottom and top — since
  // those layers are the parent's own zigzag. Each changes by a ridge at most
  // from one column to the next, and none may thicken and straight away
  // thin again: a bump one stitch wide is two turns on one stitch. (Unless not `strict`: the builder sometimes
  // finds its way round one, and the shape is then nearer the drawing.)
  const UNDER = 1;
  const OVER = UNDER * 2;
  const OWN = OVER * 2;
  const FLAGS = OWN * 2;
  const S = (H + 1) * (H + 1) * FLAGS;
  const at = (b: number, t: number, f: number) => (b * (H + 1) + t) * FLAGS + f;
  const dp = Array.from({ length: N }, () => new Float64Array(S).fill(INF));
  const from = Array.from({ length: N }, () => new Int32Array(S).fill(-1));
  const before: number[] = [0];
  for (let c = 0; c < N; c++) before.push(before[c] + absent(c));
  const after: number[] = Array.from({ length: N + 1 }, () => 0);
  for (let c = N - 1; c >= 0; c--) after[c] = after[c + 1] + absent(c);

  let best = INF;
  let bestEnd: { c: number; s: number } | null = null;
  for (let c = 0; c < N; c++) {
    for (let b = 0; b < H; b++) {
      for (let t = b + 1; t <= H; t++) {
        const here = cost(c, b, t);
        if (here === INF) continue;
        const k = t - b;
        // Start here: at the fabric's edge any thickness, else a tip.
        if (c === 0 || k === 1) dp[c][at(b, t, 0)] = before[c] + here;
        if (c > 0) {
          for (let db = -1; db <= 1; db++) {
            for (let dt = -1; dt <= 1; dt++) {
              const pb = b - db;
              const pt = t - dt;
              if (pb < 0 || pt > H || pt - pb < 1) continue;
              const dk = k - (pt - pb);
              // The layers under and over, within the parent.
              const du = b - floor[c] - (pb - floor[c - 1]);
              const dv = ceiling[c] - t - (ceiling[c - 1] - pt);
              if (Math.abs(dk) > 1 || Math.abs(du) > 1 || Math.abs(dv) > 1) continue;
              const f = (du > 0 ? UNDER : 0) | (dv > 0 ? OVER : 0) | (dk > 0 ? OWN : 0);
              for (let pf = 0; pf < FLAGS; pf++) {
                if (strict && ((pf & UNDER && du < 0) || (pf & OVER && dv < 0) || (pf & OWN && dk < 0))) continue;
                const prev = dp[c - 1][at(pb, pt, pf)];
                if (prev === INF) continue;
                const w = prev + here + STEP * (Math.abs(db) + Math.abs(dt));
                if (w < dp[c][at(b, t, f)]) {
                  dp[c][at(b, t, f)] = w;
                  from[c][at(b, t, f)] = at(pb, pt, pf);
                }
              }
            }
          }
        }
        // End here: at the fabric's edge any thickness, else a tip.
        if (c === N - 1 || k === 1) {
          for (let f = 0; f < FLAGS; f++) {
            const v = dp[c][at(b, t, f)];
            if (v < INF && v + after[c + 1] < best) {
              best = v + after[c + 1];
              bestEnd = { c, s: at(b, t, f) };
            }
          }
        }
      }
    }
  }
  if (!bestEnd) return null;

  const bottom: number[] = [];
  const top: number[] = [];
  let c = bestEnd.c;
  let s = bestEnd.s;
  for (;;) {
    const bt = Math.floor(s / FLAGS);
    bottom.unshift(Math.floor(bt / (H + 1)));
    top.unshift(bt % (H + 1));
    const p = from[c][s];
    if (p < 0) break;
    s = p;
    c--;
  }
  return { from: c + 1, to: bestEnd.c + 1, bottom, top };
}

function kindOf(N: number, H: number, u: { from: Column; to: Column; bottom: number[]; top: number[] }): UnitKind {
  if (u.from === 1 && u.to === N) {
    const thick = u.top.map((t, i) => t - u.bottom[i]);
    const level = u.bottom.every((b) => b === u.bottom[0]) && u.top.every((t) => t === u.top[0]);
    if (level) return "stripe";
    return thick.every((k) => k === thick[0]) ? "leaning stripe" : "edge shape";
  }
  if (u.from === 1 || u.to === N) return "edge shape";
  if (u.bottom.every((b) => b === u.bottom[0]) && u.bottom[0] > 0 && H > 0) return "peak";
  if (u.bottom.every((b) => b === 0)) return "peak";
  return "lens";
}

// --- Fitting a drawing ----------------------------------------------------------------

/** Every blob fitted to its nearest unit, outermost first, under one softening. */
export function fitUnits(grid: Grid, softening: Softening, { strict = true }: { strict?: boolean } = {}): Fitted {
  const { width: N, height: H, cells } = grid;
  const { background, blobs, ownerOf } = blobsOf(grid);

  const depth = (b: Blob): number => (b.parent === null ? 0 : 1 + depth(blobs[b.parent]));
  const family = (id: number): Set<number> => {
    const out = new Set<number>([id]);
    for (const k of blobs[id].children) for (const d of family(k)) out.add(d);
    return out;
  };
  const order = [...blobs].sort((x, y) => depth(x) - depth(y) || x.id - y.id);

  // The plan, built up: the background, then each unit painted over its parent.
  const plan: Yarn[][] = cells.map((row) => row.map(() => background));
  // Which unit covers each cell so far (-1: the background).
  const taken = Array.from({ length: N * H }, () => -1);
  const units: Unit[] = [];
  const unfitted: number[] = [];

  for (const blob of order) {
    const fam = family(blob.id);
    const inParent = (at: number) => (blob.parent === null ? true : taken[at] === blob.parent || isInside(at, blob.parent));
    // Cells covered by a unit that is the parent's or an ancestor's.
    function isInside(at: number, parent: number): boolean {
      let o = taken[at];
      while (o !== -1) {
        if (o === parent) return true;
        o = blobs[o].parent ?? -1;
      }
      return false;
    }
    const mine = (r: number, c: number) => fam.has(ownerOf[r * N + c]);
    // Another blob of the same colour, drawn or fitted, right beside: growing
    // into touch would make the two one patch, and break the rule.
    const twin = (o: number) => o >= 0 && !fam.has(o) && blobs[o].colour === blob.colour;
    const touchesTwin = (r: number, c: number) =>
      [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ].some(([nr, nc]) => nr >= 0 && nr < H && nc >= 0 && nc < N && (twin(ownerOf[nr * N + nc]) || twin(taken[nr * N + nc])));
    const allowed = (r: number, c: number) => {
      const at = r * N + c;
      if (mine(r, c)) return blob.parent === null ? true : inParent(at) || taken[at] === -1;
      // Not mine: free background or the parent's own stitches, and nobody
      // else's unit — siblings keep their space.
      const owner = ownerOf[at];
      const free = owner === -1 || owner === blob.parent;
      if (!free || touchesTwin(r, c)) return false;
      return blob.parent === null ? taken[at] === -1 : inParent(at) && taken[at] === blob.parent;
    };
    // What it sits in, column by column: the parent unit's bottom and top,
    // or the whole height of the fabric.
    const floor = Array.from({ length: N }, () => 0);
    const ceiling = Array.from({ length: N }, () => H);
    const parentUnit = units.find((u) => u.blob === blob.parent);
    if (parentUnit) {
      parentUnit.bottom.forEach((b, i) => {
        floor[parentUnit.from - 1 + i] = b;
        ceiling[parentUnit.from - 1 + i] = parentUnit.top[i];
      });
    }
    const fit = fitOne(N, H, mine, allowed, softening, strict, floor, ceiling);
    if (!fit) {
      // Left as drawn.
      unfitted.push(blob.id);
      for (const at of blob.cells) {
        plan[Math.floor(at / N)][at % N] = blob.colour;
        taken[at] = blob.id;
      }
      continue;
    }
    fit.bottom.forEach((b, i) => {
      const c = fit.from - 1 + i;
      for (let r = b; r < fit.top[i]; r++) {
        plan[r][c] = blob.colour;
        taken[r * N + c] = blob.id;
      }
    });
    units.push({ blob: blob.id, colour: blob.colour, kind: kindOf(N, H, fit), ...fit });
  }

  const changed: Change[] = [];
  plan.forEach((row, ridge) =>
    row.forEach((y, i) => {
      if (y !== cells[ridge][i]) changed.push({ ridge, column: i + 1, from: cells[ridge][i], to: y });
    }),
  );
  return { softening, plan: { width: N, height: H, cells: plan }, units, changed, unfitted };
}

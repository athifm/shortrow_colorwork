/**
 * Where each stitch actually sits once the fabric relaxes.
 *
 * The straight drawing stacks every stitch's rows from a flat bottom, one row
 * high each, so any extra rows in a column all pile *upward*. Real fabric
 * doesn't do that. Two things hold it together, and they disagree:
 *
 *  - Within a column, each stitch sits about one row above the one below it.
 *  - Within a pass, the yarn is one continuous strand, so neighbouring stitches
 *    in that pass want to be level with each other.
 *
 * Where a motif crams extra rows into some columns, those two pulls fight, and
 * the fabric settles somewhere between them: lines above the motif bow up, lines
 * below bow down, and the strain is shared both ways. That is the
 * curves-in-both-directions shape in every photo in the textbook.
 *
 * This finds that settling point. Every stitch gets a height that can move.
 * Each round, every stitch is nudged towards where its neighbours want it,
 * until nothing moves any more. Only heights move: balanced fabric doesn't fan
 * out, so columns stay upright. The cast-on edge is held flat, and so is the
 * top edge when the fabric balances (PLAN.md §2.2).
 *
 * How hard each pull is lives in model/physical — these are guesses to be fitted
 * against real fabric, and nothing here hard-codes them.
 */
import type { Fabric, Pass } from "../methods/shortrow/passes";

export interface RelaxOptions {
  /** Pull levelling stitches within a pass, relative to a column's row spacing. */
  yarnPull: number;
  /** Stiffness of a German double stitch, as a fraction of an ordinary row. */
  doubleStitch: number;
  /** For each pass, whether it ends in a turn. Its last stitch is then a double
   *  stitch, joined to the return pass's stitch above it. */
  endsInTurn: readonly boolean[];
}

export interface Relaxed {
  /** Height of each stitch's centre, in rows above the cast-on edge. Same shape
   *  as `fabric.stacks`. */
  centres: number[][];
  /** Each stitch's lower and upper edge, in rows. Neighbours in a column share
   *  an edge, so the column has no gaps. */
  lower: number[][];
  upper: number[][];
  /** The tallest point, in rows. */
  height: number;
  iterations: number;
  converged: boolean;
}

// Numerical settings for the solver, not knitting physics: how hard each nudge
// overshoots (successive over-relaxation, which settles far faster than plain
// averaging), when to call it settled, and when to give up.
const OVERSHOOT = 1.7;
const SETTLED = 1e-4;
const MAX_ROUNDS = 4000;

// How firmly the cast-on edge (and the top edge, when balanced) is held
// straight. Not a guess about yarn so much as what the textbook says of a
// balanced piece — "the depth of the project will be the same at any point" —
// so the edges are all but pinned, many times stiffer than anything inside.
const EDGE_HOLD = 50;

interface Link {
  other: number;
  /** Where this stitch wants to be, relative to the other: +1 sits a row above. */
  offset: number;
  weight: number;
}

export function relax(fabric: Fabric, passes: readonly Pass[], options: RelaxOptions): Relaxed {
  const heights = fabric.heights;

  // Every stitch gets a number. `start[i]` is the first stitch of column i.
  const start: number[] = [];
  let count = 0;
  for (const h of heights) {
    start.push(count);
    count += h;
  }
  const id = (column: number, row: number) => start[column] + row;

  // Start from the straight drawing: row r of every column at height r + 1.
  const y = new Float64Array(count);
  heights.forEach((h, i) => {
    for (let r = 0; r < h; r++) y[id(i, r)] = r + 1;
  });

  const links: Link[][] = Array.from({ length: count }, () => []);
  const anchor = new Float64Array(count); // pull towards a fixed height…
  const anchorWeight = new Float64Array(count); // …and how hard

  const link = (a: number, b: number, offset: number, weight: number) => {
    links[a].push({ other: b, offset, weight });
    links[b].push({ other: a, offset: -offset, weight });
  };

  // Where each stitch was made: pass p made row `rowOf[p][i]` of column i.
  const rowOf = new Map<number, Map<number, number>>();
  fabric.madeBy.forEach((col, i) =>
    col.forEach((p, r) => {
      if (!rowOf.has(p)) rowOf.set(p, new Map());
      rowOf.get(p)!.set(i, r);
    }),
  );

  // Column springs: each row one row above the one below. A double stitch —
  // the turning stitch, stretched over its own row and the return pass's — is
  // softer.
  const isDoubleStitch = (i: number, r: number): boolean => {
    const p = fabric.madeBy[i][r];
    const pass = passes[p];
    return (
      options.endsInTurn[p] === true &&
      pass !== undefined &&
      pass.to - 1 === i &&
      fabric.madeBy[i][r + 1] === p + 1
    );
  };
  heights.forEach((h, i) => {
    for (let r = 0; r + 1 < h; r++) {
      link(id(i, r + 1), id(i, r), 1, isDoubleStitch(i, r) ? options.doubleStitch : 1);
    }
  });

  // Yarn: neighbouring stitches in one pass pulled level.
  for (const columnsOfPass of rowOf.values()) {
    const cols = [...columnsOfPass.keys()].sort((a, b) => a - b);
    for (let k = 0; k + 1 < cols.length; k++) {
      const a = cols[k];
      const b = cols[k + 1];
      if (b !== a + 1) continue;
      link(id(a, columnsOfPass.get(a)!), id(b, columnsOfPass.get(b)!), 0, options.yarnPull);
    }
  }

  // Edges: the cast-on holds every column's first row one row up. When the
  // fabric balances, the top edge is held flat too; when it doesn't, the top is
  // left free, because the short columns really would pull down there.
  const tallest = Math.max(0, ...heights);
  heights.forEach((h, i) => {
    if (h === 0) return;
    anchor[id(i, 0)] = 1;
    anchorWeight[id(i, 0)] = EDGE_HOLD;
    if (fabric.balanced) {
      const top = id(i, h - 1);
      // A column of one row is anchored at both ends; average the two.
      anchor[top] = h === 1 ? (1 + tallest) / 2 : tallest;
      anchorWeight[top] = EDGE_HOLD;
    }
  });

  let rounds = 0;
  let converged = count === 0;
  while (!converged && rounds < MAX_ROUNDS) {
    rounds++;
    let biggest = 0;
    for (let n = 0; n < count; n++) {
      let sum = anchor[n] * anchorWeight[n];
      let weight = anchorWeight[n];
      for (const l of links[n]) {
        sum += (y[l.other] + l.offset) * l.weight;
        weight += l.weight;
      }
      if (weight === 0) continue;
      const step = OVERSHOOT * (sum / weight - y[n]);
      y[n] += step;
      biggest = Math.max(biggest, Math.abs(step));
    }
    converged = biggest < SETTLED;
  }

  // Each stitch's edges sit halfway to its column neighbours, so a column is a
  // gap-free stack. The ends of a column extend half a row.
  const centres: number[][] = [];
  const lower: number[][] = [];
  const upper: number[][] = [];
  let height = 0;
  heights.forEach((h, i) => {
    const c = Array.from({ length: h }, (_, r) => y[id(i, r)]);
    const lo = c.map((v, r) => (r === 0 ? v - 1 / 2 : (c[r - 1] + v) / 2));
    const hi = c.map((v, r) => (r === h - 1 ? v + 1 / 2 : (v + c[r + 1]) / 2));
    centres.push(c);
    lower.push(lo);
    upper.push(hi);
    if (h > 0) height = Math.max(height, hi[h - 1]);
  });

  return { centres, lower, upper, height, iterations: rounds, converged };
}

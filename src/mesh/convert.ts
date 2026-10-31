/**
 * From the look you drew to a plan for the needle — steps L2 and L3 of "Draw
 * the look" (PLAN.md §5).
 *
 * In fabric that lies flat as a rectangle, bending only moves rows up and down
 * their own column. So the plan keeps every column's colours, in the drawn
 * order, and only chooses how many ridges each gets: enough that once knitted
 * and relaxed, every colour boundary lands where it was drawn.
 *
 * L2, the quick predictor. The full prediction (mesh/look.ts) needs a knitted
 * plan, and a plan halfway through being worked out may not knit yet. So the
 * quick one invents rough passes instead: every patch of colour knitted as one
 * zigzag of its own, the way a peak is (methods/shortrow/construct.ts), with
 * no hand-overs. Each stitch then pulls level with its neighbours in the same
 * invented pass, as in mesh/relax.ts. Rough, but it bends the same way.
 *
 * L3, the conversion. Guess, predict, correct, repeat: start from the drawing
 * read literally; predict where each boundary lands; move each boundary that
 * lands half a ridge or more from where it was drawn by one ridge the other
 * way; again, until nothing moves. Every plan along the way is knitted for real
 * and given the full prediction, and the one closest to the drawing is kept.
 */
import { simulate, type Fabric, type Pass, type Yarn } from "../methods/shortrow/passes";
import { knitShortRows, type Built } from "../methods/shortrow/construct";
import { roundForShortRows, type Change } from "../methods/shortrow/round";
import { turnsOf } from "../methods/shortrow/rules";
import { colourOfStrand } from "../methods/shortrow/writer";
import type { Grid } from "../methods/shortrow/grid";
import { relax, type Relaxed } from "./relax";
import { lookOf } from "./look";

export interface Physics {
  yarnPull: number;
  doubleStitch: number;
}

// --- L2: the quick predictor ----------------------------------------------------

/** A plan's relaxed rows, from invented passes: one zigzag per patch. */
export function quickRelax(plan: Grid, physics: Physics): Relaxed {
  const { width: N, height: H, cells } = plan;

  // Patches: cells of one colour touching side by side or above and below.
  const patchOf = cells.map((row) => row.map(() => -1));
  let patches = 0;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < N; c++) {
      if (patchOf[r][c] !== -1) continue;
      const stack: [number, number][] = [[r, c]];
      patchOf[r][c] = patches;
      while (stack.length > 0) {
        const [rr, cc] = stack.pop()!;
        for (const [nr, nc] of [
          [rr + 1, cc],
          [rr - 1, cc],
          [rr, cc + 1],
          [rr, cc - 1],
        ]) {
          if (nr < 0 || nr >= H || nc < 0 || nc >= N) continue;
          if (patchOf[nr][nc] !== -1 || cells[nr][nc] !== cells[rr][cc]) continue;
          patchOf[nr][nc] = patches;
          stack.push([nr, nc]);
        }
      }
      patches++;
    }
  }

  // Each column: two rows per cell, bottom up. Which pass made each row is
  // filled in patch by patch.
  const madeBy: number[][] = Array.from({ length: N }, () => Array.from({ length: 2 * H }, () => -1));
  const passes: Pass[] = [];
  for (let p = 0; p < patches; p++) {
    // This patch's rows in each column, bottom up.
    const rowsIn: number[][] = Array.from({ length: N }, () => []);
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < N; c++) if (patchOf[r][c] === p) rowsIn[c].push(2 * r, 2 * r + 1);
    }
    const next = rowsIn.map(() => 0);
    const work = (from: number, to: number) => {
      const id = passes.length;
      passes.push({ yarn: `p${p}`, from: from + 1, to: to + 1 });
      for (let c = Math.min(from, to); c <= Math.max(from, to); c++) {
        if (next[c] < rowsIn[c].length) madeBy[c][rowsIn[c][next[c]++]] = id;
      }
    };
    for (const [from, to] of walk(rowsIn.map((rows) => rows.length / 2))) work(from, to);
  }

  const stacks = madeBy.map((col, c) => col.map((_, k) => cells[Math.floor(k / 2)][c]));
  const fabric: Fabric = {
    stitches: N,
    heights: Array.from({ length: N }, () => 2 * H),
    stacks,
    madeBy,
    balanced: true,
    carries: [],
    problems: [],
  };
  return relax(fabric, passes, { ...physics, endsInTurn: passes.map(() => false) });
}

/**
 * The invented passes for one patch, given how many ridges it has in each
 * column (index 0 is column 1). A zigzag, as for a peak: out along the bottom
 * layer, back to one stitch in, out again… Where a layer is in pieces — the
 * patch thicker in several places — each piece is its own pass, bottom layer
 * first. Only for predicting: turns may crowd here, it doesn't matter.
 */
function walk(ridges: number[]): [number, number][] {
  const top = Math.max(0, ...ridges);
  const layers: [number, number][][] = [];
  for (let j = 1; j <= top; j++) {
    const runs: [number, number][] = [];
    ridges.forEach((n, c) => {
      if (n < j) return;
      const last = runs[runs.length - 1];
      if (last && last[1] === c - 1) last[1] = c;
      else runs.push([c, c]);
    });
    layers.push(runs);
  }
  if (layers.length === 0) return [];
  const out: [number, number][] = [];
  if (layers.every((runs) => runs.length === 1)) {
    // A peak: out to the far end of each layer and back to the near end of the
    // next, then home.
    const home = layers[0][0][0];
    const points: number[] = [];
    for (const [[L, R]] of layers) points.push(L, R);
    for (let k = 0; k + 1 < points.length; k++) out.push([points[k], points[k + 1]]);
    out.push([points[points.length - 1], home]);
    return out;
  }
  // Otherwise each piece of each layer, out and back.
  for (const runs of layers) for (const [L, R] of runs) out.push([L, R], [R, L]);
  return out;
}

// --- L3: the conversion -----------------------------------------------------------

export interface Converted {
  /** The plan for the needle: what to knit, read literally. */
  plan: Grid;
  /** Cells where the plan differs from the drawing. */
  planChanges: Change[];
  /** The plan knitted, if it could be. */
  built: Built;
  /** What it will look like, and where that still differs from the drawing. */
  look: Yarn[][] | null;
  mismatch: Change[];
}

/** A column's colours as runs, bottom up: the colour and how many ridges. */
type Runs = { colour: Yarn; ridges: number }[];

const runsOf = (g: Grid, c: number): Runs => {
  const runs: Runs = [];
  for (let r = 0; r < g.height; r++) {
    const colour = g.cells[r][c];
    const last = runs[runs.length - 1];
    if (last && last.colour === colour) last.ridges++;
    else runs.push({ colour, ridges: 1 });
  }
  return runs;
};

const fromRuns = (columns: Runs[], height: number): Grid => {
  const cells: Yarn[][] = Array.from({ length: height }, () => []);
  columns.forEach((runs) => {
    let r = 0;
    for (const run of runs) for (let k = 0; k < run.ridges; k++) cells[r++].push(run.colour);
  });
  return { width: columns.length, height, cells };
};

const differences = (a: Yarn[][], b: Yarn[][]): Change[] => {
  const out: Change[] = [];
  a.forEach((row, ridge) => row.forEach((y, i) => y !== b[ridge][i] && out.push({ ridge, column: i + 1, from: b[ridge][i], to: y })));
  return out;
};

/** Knit a plan for real — rounding it if its turns crowd — and predict its look. */
function knitAndLook(plan: Grid, physics: Physics): { plan: Grid; built: Built; look: Yarn[][] | null } {
  let built = knitShortRows(plan);
  let knitted = plan;
  if (built.problems.length > 0 && built.stuck) {
    const rounded = roundForShortRows(plan);
    if (rounded) {
      built = rounded.built;
      knitted = rounded.grid;
    }
  }
  if (built.problems.length > 0) return { plan: knitted, built, look: null };
  const fabric = simulate(plan.width, built.passes);
  const look = lookOf(fabric, built.passes, { ...physics, endsInTurn: turnsOf(built.passes, plan.width) }, colourOfStrand);
  return { plan: knitted, built, look: look?.cells ?? null };
}

/** How far, in all, the plan's boundaries land from where they were drawn —
 *  by the quick prediction, squared so that one big miss counts more than
 *  several small ones. */
function missBy(columns: Runs[], drawnAt: number[][], height: number, physics: Physics): { total: number; off: number[][] } {
  const relaxed = quickRelax(fromRuns(columns, height), physics);
  let total = 0;
  const off = columns.map((runs, c) => {
    let at = 0;
    return runs.slice(0, -1).map((run, j) => {
      at += run.ridges;
      const o = drawnAt[c][j] - relaxed.lower[c][2 * at] / 2;
      total += o * o;
      return o;
    });
  });
  return { total, off };
}

/** Where boundary j of column c is in the plan, in ridges from the cast-on. */
const boundaryAt = (runs: Runs, j: number) => runs.slice(0, j + 1).reduce((t, x) => t + x.ridges, 0);

/** The plan whose knitted look comes closest to the drawing. */
export function convert(drawing: Grid, physics: Physics): Converted {
  const { width: N, height: H } = drawing;
  const target = Array.from({ length: N }, (_, c) => runsOf(drawing, c));
  const drawnAt = target.map((runs) => runs.slice(0, -1).map((_, j) => boundaryAt(runs, j)));

  // The same boundary in the next column: the same two colours, the same
  // place in the order.
  const sameBoundary = (c: number, d: number, j: number) =>
    d >= 0 && d < N && j + 1 < target[d].length && target[d][j].colour === target[c][j].colour && target[d][j + 1].colour === target[c][j + 1].colour;

  // Search: move one boundary one ridge at a time, towards where it should
  // land, keeping each move that brings the prediction closest. A move may
  // not make a boundary jump more than a ridge further from its neighbour
  // than drawn — that's how spikes and crowded turns creep in.
  let columns: Runs[] = target.map((runs) => runs.map((x) => ({ ...x })));
  let current = missBy(columns, drawnAt, H, physics);
  const plans: Grid[] = [fromRuns(columns, H)];
  // Each move takes a boundary a ridge nearer where it lands right; it can't
  // need more moves than there are cells.
  for (let step = 0; step < N * H; step++) {
    let best: { columns: Runs[]; miss: ReturnType<typeof missBy> } | null = null;
    current.off.forEach((offs, c) =>
      offs.forEach((o, j) => {
        // Only boundaries that land half a ridge or more out are worth a move.
        if (Math.abs(o) < 0.5) return;
        const way = Math.sign(o);
        const runs = columns[c];
        if (way > 0 ? runs[j + 1].ridges <= 1 : runs[j].ridges <= 1) return;
        const at = boundaryAt(runs, j) + way;
        for (const d of [c - 1, c + 1]) {
          if (!sameBoundary(c, d, j)) continue;
          const drawnGap = Math.abs(drawnAt[c][j] - drawnAt[d][j]);
          if (Math.abs(at - boundaryAt(columns[d], j)) > Math.max(1, drawnGap)) return;
        }
        const next = columns.map((r) => r.map((x) => ({ ...x })));
        next[c][j].ridges += way;
        next[c][j + 1].ridges -= way;
        const miss = missBy(next, drawnAt, H, physics);
        if (miss.total < current.total && (!best || miss.total < best.miss.total)) best = { columns: next, miss };
      }),
    );
    if (!best) break;
    columns = (best as { columns: Runs[] }).columns;
    current = (best as { miss: ReturnType<typeof missBy> }).miss;
    plans.push(fromRuns(columns, H));
  }

  // The real test: knit each plan along the way and give it the full
  // prediction. Keep the one that looks most like the drawing — the earliest,
  // so the fewest changes, when two tie.
  let chosen: Converted | null = null;
  for (const plan of plans) {
    const result = knitAndLook(plan, physics);
    const mismatch = result.look ? differences(result.look, drawing.cells) : null;
    const better =
      !chosen ||
      (mismatch !== null && (chosen.look === null || mismatch.length < chosen.mismatch.length));
    if (better) {
      chosen = {
        plan: result.plan,
        planChanges: differences(result.plan.cells, drawing.cells),
        built: result.built,
        look: result.look,
        mismatch: mismatch ?? [],
      };
    }
  }
  return chosen!;
}

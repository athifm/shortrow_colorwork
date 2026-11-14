/**
 * Does the knitted look have the same shape as the drawing? (PLAN.md §6,
 * round 3, your call: a blend.) Not how many cells differ — a shape shifted
 * half a stitch would count as badly as one that lost its point — but:
 *
 *  - **outline**: how far the knitted outline of each colour lies from the
 *    drawn one, on average and at its worst, in stitches;
 *  - **symmetry**: where the drawing is mirror-symmetric, whether the look is
 *    too, about the same axis;
 *  - **points**: how many peaks and troughs each colour's outline has — the
 *    teardrop's tip, a lens's two ends — drawn, and kept;
 *  - **area**: the share of the shape that comes out the wrong colour — so a
 *    crude band can't pass for a blob by lining up with its top and bottom.
 *
 * Judged on the relaxed fabric itself (round 4, your notes on the oval and
 * the blob inside a blob): each column as stretches of colour at the heights
 * its rows settle to, bends and all — not read back onto the grid cell by
 * cell, which threw the bends away. A grid of cells is the same thing with
 * every height whole, so a drawing, or a look given as cells, is judged alike.
 *
 * Blended into one penalty to rank by: lower is the same shape more nearly.
 * More stitches changed is fine if the shape comes out nearer.
 */
import type { Yarn } from "../methods/shortrow/passes";
import type { Grid } from "../methods/shortrow/grid";
import { blobsOf } from "../methods/shortrow/units";
import { gridRuns, type Run } from "./look";

export interface Similarity {
  /** Distance from each outline point to the nearest on the other outline, in
   *  stitches: averaged both ways, and the worst. */
  meanOff: number;
  worstOff: number;
  /** Whether the look keeps the drawing's symmetry; null if the drawing has
   *  none. And the share of the shape that doesn't match its mirror. */
  symmetric: boolean | null;
  asymmetry: number;
  /** For a drawing symmetric both ways: which the look keeps. */
  kept: { columns: boolean; ridges: boolean } | null;
  /** Peaks and troughs of the outlines, drawn and knitted. */
  points: { drawn: number; got: number };
  /** The share of the shape, drawn or knitted, that is the wrong colour. */
  wrongArea: number;
  /** All of it in one number: lower is nearer. */
  penalty: number;
}

/** How much each part counts in the penalty. The outline's average is the
 *  unit; the worst spot counts a quarter as much (it catches a lost tip); a
 *  symmetric drawing knitted lopsided costs as much as being a stitch out
 *  all round; a point lost or gained, half a stitch. Judgements of what the
 *  eye minds, to be tuned by your reviews. */
const WORST_WEIGHT = 1 / 4;
const LOPSIDED = 1;
const PER_POINT = 1 / 2;
/** A shape entirely the wrong colour costs as much as being two stitches out
 *  all round. */
const AREA_WEIGHT = 2;
/** The outline is sampled every half stitch or ridge. */
const STEP = 1 / 2;
/** Heights nearer than this, in ridges, are level: a flat top stays one
 *  point in the relaxed fabric, where nothing is exactly level. */
const LEVEL = 1 / 4;
/** A look whose mirror differs by less than this share of the shape is
 *  symmetric: the relaxed fabric is never exactly so. */
const SYMMETRIC_WITHIN = 1 / 32;
/** How far the look's own axis may sit from the drawn one: up to 4 half-steps,
 *  2 stitches or ridges, each way. */
const SHIFTS = 4;
/** Of "lopsided", the share that left-to-right symmetry carries when the
 *  drawing has both; top to bottom carries the rest. */
const LEFT_RIGHT_SHARE = 2 / 3;

/** Where a drawing is mirror-symmetric, across its columns (left and right)
 *  and across its ridges (top and bottom): each as the sum of a cell's index
 *  and its mirror's — the only axis that can work maps the shapes' outermost
 *  cells onto each other. Null where it isn't. Beyond the fabric counts as
 *  background. */
export function mirrorAxes(g: Grid): { columns: number | null; ridges: number | null } {
  const background = blobsOf(g).background;
  const cells: [number, number][] = [];
  g.cells.forEach((row, r) => row.forEach((y, c) => y !== background && cells.push([r, c])));
  if (cells.length === 0) return { columns: null, ridges: null };
  const at = (r: number, c: number) => (r >= 0 && r < g.height && c >= 0 && c < g.width ? g.cells[r][c] : background);
  const cols = Math.min(...cells.map(([, c]) => c)) + Math.max(...cells.map(([, c]) => c));
  const rows = Math.min(...cells.map(([r]) => r)) + Math.max(...cells.map(([r]) => r));
  const holds = (mirror: (r: number, c: number) => [number, number]) => g.cells.every((row, r) => row.every((y, c) => y === at(...mirror(r, c))));
  return {
    columns: holds((r, c) => [r, cols - c]) ? cols : null,
    ridges: holds((r, c) => [rows - r, c]) ? rows : null,
  };
}

// --- Stretches of colour -----------------------------------------------------

type Span = [number, number];

const spansOf = (column: readonly Run[] | undefined, colour: Yarn): Span[] =>
  (column ?? []).filter((r) => r.colour === colour && r.to > r.from).map((r) => [r.from, r.to]);
const length = (spans: Span[]) => spans.reduce((t, [a, b]) => t + b - a, 0);
/** Where exactly one of two sets of spans is: the stretch of an edge. */
function eitherNotBoth(a: Span[], b: Span[]): Span[] {
  const cuts = [...new Set([...a, ...b].flat())].sort((x, y) => x - y);
  const inside = (spans: Span[], h: number) => spans.some(([lo, hi]) => lo <= h && h < hi);
  const out: Span[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const mid = (cuts[k] + cuts[k + 1]) / 2;
    if (inside(a, mid) === inside(b, mid)) continue;
    const last = out[out.length - 1];
    if (last && last[1] === cuts[k]) last[1] = cuts[k + 1];
    else out.push([cuts[k], cuts[k + 1]]);
  }
  return out;
}
const overlap = (a: Span[], b: Span[]) => (length(a) + length(b) - length(eitherNotBoth(a, b))) / 2;

/** Points along one colour's outline, every half stitch: across each column
 *  where its stretch starts and stops, and up each line between columns where
 *  it is on one side only. The fabric's own edges count. */
function outline(cols: Run[][], colour: Yarn): [number, number][] {
  const out: [number, number][] = [];
  const quarter = STEP / 2;
  cols.forEach((col, i) => {
    for (const [a, b] of spansOf(col, colour)) for (const x of [i + quarter, i + 1 - quarter]) out.push([x, a], [x, b]);
  });
  for (let i = 0; i <= cols.length; i++) {
    for (const [a, b] of eitherNotBoth(spansOf(cols[i - 1], colour), spansOf(cols[i], colour))) {
      if (b - a < STEP) out.push([i, (a + b) / 2]);
      else for (let y = a + quarter; y < b; y += STEP) out.push([i, y]);
    }
  }
  return out;
}

/** Peaks of a colour's top edge and troughs of its bottom edge, column by
 *  column; a level top counts once. */
function pointsOf(cols: Run[][], colour: Yarn): number {
  const top: (number | null)[] = [];
  const bottom: (number | null)[] = [];
  for (const col of cols) {
    const spans = spansOf(col, colour);
    top.push(spans.length ? Math.max(...spans.map(([, b]) => b)) : null);
    bottom.push(spans.length ? Math.min(...spans.map(([a]) => a)) : null);
  }
  const extremes = (profile: (number | null)[], beyond: (a: number, b: number) => boolean) => {
    let count = 0;
    let c = 0;
    while (c < profile.length) {
      const v = profile[c];
      if (v === null) {
        c++;
        continue;
      }
      let end = c;
      while (end + 1 < profile.length && profile[end + 1] !== null && Math.abs(profile[end + 1]! - v) < LEVEL) end++;
      const left = c > 0 ? profile[c - 1] : null;
      const right = end + 1 < profile.length ? profile[end + 1] : null;
      if ((left === null || beyond(v, left)) && (right === null || beyond(v, right))) count++;
      c = end + 1;
    }
    return count;
  };
  return extremes(top, (a, b) => a > b) + extremes(bottom, (a, b) => a < b);
}

/** The look with its tilt taken out: each column moved up or down so the
 *  best straight line through the middles of the shape's columns (weighted
 *  by how tall each is) lies level at height 0. */
function straightened(cols: Run[][], background: Yarn): Run[][] {
  const middles: { i: number; m: number; w: number }[] = [];
  cols.forEach((col, i) => {
    const shape = col.filter((r) => r.colour !== background);
    if (shape.length === 0) return;
    const lo = Math.min(...shape.map((r) => r.from));
    const hi = Math.max(...shape.map((r) => r.to));
    middles.push({ i, m: (lo + hi) / 2, w: hi - lo });
  });
  const W = middles.reduce((t, p) => t + p.w, 0);
  if (W === 0) return cols;
  const mi = middles.reduce((t, p) => t + p.w * p.i, 0) / W;
  const mm = middles.reduce((t, p) => t + p.w * p.m, 0) / W;
  const spread = middles.reduce((t, p) => t + p.w * (p.i - mi) ** 2, 0);
  const lean = spread === 0 ? 0 : middles.reduce((t, p) => t + p.w * (p.i - mi) * (p.m - mm), 0) / spread;
  return cols.map((col, i) => {
    const shift = mm + lean * (i - mi);
    return col.map((r) => ({ colour: r.colour, from: r.from - shift, to: r.to - shift }));
  });
}

/**
 * How near the look's shape is to the drawing's. The look is the relaxed
 * fabric's stretches of colour (look.ts, `runsOf`) or a grid of cells.
 */
export function similarity(drawing: Grid, look: Yarn[][] | Run[][]): Similarity {
  const background = blobsOf(drawing).background;
  const colours = [...new Set(drawing.cells.flat())].filter((c) => c !== background);
  const drawn = gridRuns(drawing.cells);
  const got: Run[][] = look.length > 0 && look.every((row) => row.every((x) => typeof x === "string")) ? gridRuns(look as Yarn[][]) : (look as Run[][]);

  // Outline distance, both ways, every colour together.
  let sum = 0;
  let count = 0;
  let worst = 0;
  for (const colour of colours) {
    const a = outline(drawn, colour);
    const b = outline(got, colour);
    if (a.length === 0) continue;
    if (b.length === 0) {
      // The colour is gone: as far off as the fabric is wide.
      const far = Math.max(drawing.width, drawing.height);
      sum += far * a.length;
      count += a.length;
      worst = Math.max(worst, far);
      continue;
    }
    const nearest = (from: [number, number][], to: [number, number][]) =>
      from.map(([x, y]) => Math.min(...to.map(([xx, yy]) => Math.hypot(x - xx, y - yy))));
    for (const d of [...nearest(a, b), ...nearest(b, a)]) {
      sum += d;
      count++;
      worst = Math.max(worst, d);
    }
  }
  const meanOff = count ? sum / count : 0;

  // Symmetry, about the drawing's own axes: the share of the look's shape
  // that its mirror image doesn't cover the same way.
  const axes = mirrorAxes(drawing);
  let symmetric: boolean | null = null;
  let asymmetry = 0;
  let broken = 0;
  let kept: Similarity["kept"] = null;
  if (axes.columns !== null || axes.ridges !== null) {
    // Judged on the look straightened first (round 4, your note on the blob
    // inside a blob): short rows can tilt a whole shape a little, one end
    // higher, and the eye still reads it as symmetric — its form is. So the
    // best straight line through the middles of its columns is taken out;
    // where it sits and how it leans are the outline's business.
    const level = straightened(got, background);
    const total = level.reduce((t, col) => t + colours.reduce((u, colour) => u + length(spansOf(col, colour)), 0), 0);
    /** The share of the shape its mirror image doesn't cover alike. */
    const off = (mirror: (i: number, spans: Span[], colour: Yarn) => Span[]) =>
      total === 0
        ? 0
        : level.reduce((t, col, i) => t + colours.reduce((u, colour) => u + length(eitherNotBoth(spansOf(col, colour), mirror(i, spansOf(col, colour), colour))), 0), 0) /
          (2 * total);
    // About the look's own middle, not the drawing's: a shape half a stitch
    // over is still symmetric to the eye. So the axis near the drawn one,
    // within a few half-steps, that fits best — and, straightened, the middle
    // height is near 0.
    const nearby = (axis: number, step: number) => Array.from({ length: 2 * SHIFTS + 1 }, (_, k) => axis + (k - SHIFTS) * step);
    const offColumns =
      axes.columns === null
        ? 0
        : Math.min(...nearby(axes.columns, 1).map((A) => off((i, _spans, colour) => spansOf(level[A - i], colour))));
    const offRidges =
      axes.ridges === null
        ? 0
        : Math.min(...nearby(0, STEP / 2).map((m) => off((_i, spans) => spans.map(([a, b]): Span => [2 * m - b, 2 * m - a]).sort((x, y) => x[0] - y[0]))));
    const keptColumns = offColumns < SYMMETRIC_WITHIN;
    const keptRidges = offRidges < SYMMETRIC_WITHIN;
    // Each of the drawing's symmetries lost costs its share of LOPSIDED (the
    // near point law can rule out both at once — PLAN.md §6). Left to right
    // counts for more where both are drawn: it is what the eye reads in a
    // lens or a teardrop (your oval, round 4), and short rows bow the fabric
    // top to bottom anyway.
    const both = axes.columns !== null && axes.ridges !== null;
    const shareColumns = axes.columns === null ? 0 : both ? LEFT_RIGHT_SHARE : 1;
    const shareRidges = axes.ridges === null ? 0 : both ? 1 - LEFT_RIGHT_SHARE : 1;
    broken = (keptColumns ? 0 : shareColumns) + (keptRidges ? 0 : shareRidges);
    asymmetry = shareColumns * offColumns + shareRidges * offRidges;
    symmetric = broken === 0;
    if (axes.columns !== null && axes.ridges !== null) kept = { columns: keptColumns, ridges: keptRidges };
  }

  const points = {
    drawn: colours.reduce((t, c) => t + pointsOf(drawn, c), 0),
    got: colours.reduce((t, c) => t + pointsOf(got, c), 0),
  };

  // Area: of everything that is shape in the drawing or the look, the share
  // that comes out the wrong colour.
  let union = 0;
  let right = 0;
  drawn.forEach((col, i) => {
    const shapeOf = (runs: Run[] | undefined) => (runs ?? []).filter((r) => r.colour !== background).map((r): Span => [r.from, r.to]);
    const d = shapeOf(col);
    const g = shapeOf(got[i]);
    union += (length(d) + length(g) + length(eitherNotBoth(d, g))) / 2;
    for (const colour of colours) right += overlap(spansOf(col, colour), spansOf(got[i], colour));
  });
  const wrongArea = union ? Math.max(0, (union - right) / union) : 0;

  const penalty =
    meanOff +
    WORST_WEIGHT * worst +
    (symmetric === false ? LOPSIDED * broken + asymmetry : 0) +
    PER_POINT * Math.abs(points.drawn - points.got) +
    AREA_WEIGHT * wrongArea;
  return { meanOff, worstOff: worst, symmetric, asymmetry, kept, points, wrongArea, penalty };
}

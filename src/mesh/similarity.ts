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
 *  - **area**: the share of the shape's stitches that come out the wrong
 *    colour — so a crude band can't pass for a blob by lining up with its top
 *    and bottom.
 *
 * Blended into one penalty to rank by: lower is the same shape more nearly.
 * More stitches changed is fine if the shape comes out nearer.
 */
import type { Yarn } from "../methods/shortrow/passes";
import type { Grid } from "../methods/shortrow/grid";
import { blobsOf } from "../methods/shortrow/units";

export interface Similarity {
  /** Distance from each outline cell to the nearest on the other outline, in
   *  stitches: averaged both ways, and the worst. */
  meanOff: number;
  worstOff: number;
  /** Whether the look keeps the drawing's symmetry; null if the drawing has
   *  none. And the share of shape cells that don't match their mirror. */
  symmetric: boolean | null;
  asymmetry: number;
  /** For a drawing symmetric both ways: which the look keeps. */
  kept: { columns: boolean; ridges: boolean } | null;
  /** Peaks and troughs of the outlines, drawn and knitted. */
  points: { drawn: number; got: number };
  /** The share of the drawing's shape cells, and of the look's, that are
   *  the wrong colour. */
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

/** Cells of one colour on its outline: next to a different colour, or on the
 *  fabric's own edge — so a band running off both sides has ends to compare,
 *  and a shape that grows to the edge, where it wasn't drawn to, shows it. */
function outline(cells: Yarn[][], colour: Yarn): [number, number][] {
  const out: [number, number][] = [];
  cells.forEach((row, r) =>
    row.forEach((y, c) => {
      if (y !== colour) return;
      const beside = [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ].some(([nr, nc]) => nr < 0 || nr >= cells.length || nc < 0 || nc >= row.length || cells[nr][nc] !== colour);
      if (beside) out.push([r, c]);
    }),
  );
  return out;
}

/** Peaks of a colour's top edge and troughs of its bottom edge, column by
 *  column; a flat top counts once. */
function pointsOf(cells: Yarn[][], colour: Yarn): number {
  const width = cells[0]?.length ?? 0;
  const top: (number | null)[] = [];
  const bottom: (number | null)[] = [];
  for (let c = 0; c < width; c++) {
    const rows = cells.flatMap((row, r) => (row[c] === colour ? [r] : []));
    top.push(rows.length ? Math.max(...rows) : null);
    bottom.push(rows.length ? Math.min(...rows) : null);
  }
  /** Runs of equal values, then count the runs higher than both neighbours. */
  const extremes = (profile: (number | null)[], higher: (a: number, b: number) => boolean) => {
    let count = 0;
    let c = 0;
    while (c < profile.length) {
      if (profile[c] === null) {
        c++;
        continue;
      }
      let end = c;
      while (end + 1 < profile.length && profile[end + 1] === profile[c]) end++;
      const left = c > 0 ? profile[c - 1] : null;
      const right = end + 1 < profile.length ? profile[end + 1] : null;
      const v = profile[c]!;
      if ((left === null || higher(v, left)) && (right === null || higher(v, right))) count++;
      c = end + 1;
    }
    return count;
  };
  return extremes(top, (a, b) => a > b) + extremes(bottom, (a, b) => a < b);
}

export function similarity(drawing: Grid, look: Yarn[][]): Similarity {
  const background = blobsOf(drawing).background;
  const colours = [...new Set(drawing.cells.flat())].filter((c) => c !== background);

  // Outline distance, both ways, every colour together.
  let sum = 0;
  let count = 0;
  let worst = 0;
  for (const colour of colours) {
    const drawn = outline(drawing.cells, colour);
    const got = outline(look, colour);
    if (drawn.length === 0) continue;
    if (got.length === 0) {
      // The colour is gone: as far off as the fabric is wide.
      const far = Math.max(drawing.width, drawing.height);
      sum += far * drawn.length;
      count += drawn.length;
      worst = Math.max(worst, far);
      continue;
    }
    const nearest = (from: [number, number][], to: [number, number][]) =>
      from.map(([r, c]) => Math.min(...to.map(([rr, cc]) => Math.hypot(r - rr, c - cc))));
    for (const d of [...nearest(drawn, got), ...nearest(got, drawn)]) {
      sum += d;
      count++;
      worst = Math.max(worst, d);
    }
  }
  const meanOff = count ? sum / count : 0;

  // Symmetry, about the drawing's own axes.
  const axes = mirrorAxes(drawing);
  let symmetric: boolean | null = null;
  let asymmetry = 0;
  let broken = 0;
  let kept: Similarity["kept"] = null;
  if (axes.columns !== null || axes.ridges !== null) {
    let shape = 0;
    let off = 0;
    const offBy = { columns: 0, ridges: 0 };
    look.forEach((row, r) =>
      row.forEach((y, c) => {
        if (y === background) return;
        shape++;
        const at = ([mr, mc]: [number, number]) => (mr >= 0 && mr < look.length && mc >= 0 && mc < row.length ? look[mr][mc] : background);
        const across = axes.columns !== null && at([r, axes.columns - c]) !== y;
        const upDown = axes.ridges !== null && at([axes.ridges - r, c]) !== y;
        if (across) offBy.columns++;
        if (upDown) offBy.ridges++;
        if (across || upDown) off++;
      }),
    );
    asymmetry = shape ? off / shape : 0;
    symmetric = off === 0;
    // Each of the drawing's symmetries lost costs its share of LOPSIDED: one
    // kept of two is half as lopsided (the near point law can rule out both
    // at once — PLAN.md §6).
    const axesDrawn = (axes.columns !== null ? 1 : 0) + (axes.ridges !== null ? 1 : 0);
    broken = ((offBy.columns > 0 ? 1 : 0) + (offBy.ridges > 0 ? 1 : 0)) / axesDrawn;
    if (axes.columns !== null && axes.ridges !== null) kept = { columns: offBy.columns === 0, ridges: offBy.ridges === 0 };
  }

  const points = {
    drawn: colours.reduce((t, c) => t + pointsOf(drawing.cells, c), 0),
    got: colours.reduce((t, c) => t + pointsOf(look, c), 0),
  };

  // Area: cells that are shape in the drawing or the look, and wrong.
  let shapeCells = 0;
  let wrong = 0;
  drawing.cells.forEach((row, r) =>
    row.forEach((y, c) => {
      if (y === background && look[r][c] === background) return;
      shapeCells++;
      if (look[r][c] !== y) wrong++;
    }),
  );
  const wrongArea = shapeCells ? wrong / shapeCells : 0;

  const penalty =
    meanOff +
    WORST_WEIGHT * worst +
    (symmetric === false ? LOPSIDED * broken + asymmetry : 0) +
    PER_POINT * Math.abs(points.drawn - points.got) +
    AREA_WEIGHT * wrongArea;
  return { meanOff, worstOff: worst, symmetric, asymmetry, kept, points, wrongArea, penalty };
}

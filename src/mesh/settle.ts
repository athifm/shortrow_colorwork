/**
 * Where every stitch sits once the fabric settles — balanced or not.
 *
 * A pattern doesn't have to be balanced. Every pattern makes *some* shape:
 *
 *  - every column the same length → a rectangle;
 *  - columns longer on one side → the full rows tilt apart on that side and the
 *    piece fans, like a wedge shawl;
 *  - columns longer (or shorter) in the middle → no flat shape fits: the next
 *    full row has to arch over the bump with the same stitches, so it stretches.
 *    Real yarn pops up out of the plane instead, the way a short-row heel cups.
 *
 * Rows never change length; they tilt. That gives a clean way to split the job
 * in two:
 *
 *  1. The overall shape comes from the column lengths alone. A straight line is
 *     fitted through them. Its slope is the fan: a fan is exactly the shape
 *     whose column lengths rise in a straight line across it, with the columns
 *     as arcs and the rows as spokes. For balanced fabric the slope is zero.
 *     Whatever the line can't explain is a bump or dip, and the row arching
 *     over it has to stretch by roughly 8/3·(sag/width)².
 *
 *  2. The local detail — ridges waving round motifs — comes from mesh/relax.ts,
 *     with its fitted pull, run inside that shape. For balanced fabric that is
 *     exactly the drawing it already made.
 *
 * An earlier attempt solved for every stitch's position as one big net of
 * springs. It never settled, and it made balanced fabric fan by up to 23°: a
 * free net has too many ways to wobble. This version has none.
 *
 * Units: one row height. A stitch is `stitchAspect` row heights wide.
 */
import type { Fabric, Pass } from "../methods/shortrow/passes";
import { relax } from "./relax";

export interface SettleOptions {
  /** Pull levelling stitches within a pass (model: yarnPull). */
  yarnPull: number;
  /** Stiffness of a German double stitch, as a fraction of a row (model). */
  doubleStitch: number;
  /** A stitch's width, in row heights (model; eventually the knitter's gauge). */
  stitchAspect: number;
  /** Bumps and dips narrower than this many stitches are absorbed (model). */
  smallestBump: number;
  /** For each pass, whether it ends in a turn. */
  endsInTurn: readonly boolean[];
}

export interface Shape {
  /** Each stitch's centre, same shape as `fabric.stacks`. Column 1 sits at the
   *  right, as in the charts; y grows upward from the cast-on edge. */
  x: number[][];
  y: number[][];
  /** The direction up the column through each stitch, as a unit vector. */
  upX: number[][];
  upY: number[][];
  /** How far each stitch reaches below and above its centre, along `up`. */
  below: number[][];
  above: number[][];
  /** How far the row over each stitch has to stretch, as a fraction. Zero
   *  except over a bump or dip that can't lie flat. */
  stretch: number[][];
  stitchWidth: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** The fan's opening angle, in degrees. Positive when the left edge (the last
   *  column) is the longer one. */
  fanDegrees: number;
  maxStretch: number;
  iterations: number;
  converged: boolean;
}

/** Below this, the slope through the column lengths is just rounding. */
const NO_FAN = 1e-6;

export function settle(fabric: Fabric, passes: readonly Pass[], options: SettleOptions): Shape {
  const heights = fabric.heights;
  const columns = heights.length;
  const A = options.stitchAspect;

  // Column 1 at the right: column i sits at x = (columns − 1 − i) · A.
  const xOf = (i: number) => (columns - 1 - i) * A;

  // 1a. A straight line through the column lengths: L ≈ α + β·x.
  const used = heights.map((h, i) => [xOf(i), h] as const).filter(([, h]) => h > 0);
  let alpha = used.length ? used.reduce((t, [, h]) => t + h, 0) / used.length : 0;
  let beta = 0;
  if (used.length > 1) {
    const mx = used.reduce((t, [x]) => t + x, 0) / used.length;
    const my = alpha;
    const sxx = used.reduce((t, [x]) => t + (x - mx) * (x - mx), 0);
    const sxy = used.reduce((t, [x, h]) => t + (x - mx) * (h - my), 0);
    beta = sxx > 0 ? sxy / sxx : 0;
    alpha = my - beta * mx;
  }
  const fan = !fabric.balanced && Math.abs(beta) > NO_FAN;
  const phi = fan ? Math.abs(beta) : 0; // opening angle, radians

  // 1b. What the line can't explain: the worst bump or dip, measured over every
  // stretch of columns at least `smallestBump` wide, as the extra length a row
  // needs to arch over it.
  // Unevenness narrower than `smallestBump` is absorbed — a staircase of short
  // rows stepping two stitches at a time is how a diagonal is made, and lies
  // flat. So the leftovers are averaged over that many columns first, which
  // irons out the steps and leaves only bumps wider than that.
  const minSpan = Math.max(1, Math.round(options.smallestBump));
  const raw = heights.map((h, i) => h - (alpha + beta * xOf(i)));
  const half = Math.floor(minSpan / 2);
  const residual = raw.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(columns - 1, i + half);
    let sum = 0;
    for (let k = from; k <= to; k++) sum += raw[k];
    return sum / (to - from + 1);
  });
  let archStretch = 0;
  let bumpColumns: number[] = [];
  for (let a = 0; a < columns; a++) {
    for (let b = a + minSpan; b < columns; b++) {
      let sag = 0;
      for (let k = a + 1; k < b; k++) {
        const chord = residual[a] + ((residual[b] - residual[a]) * (k - a)) / (b - a);
        sag = Math.max(sag, Math.abs(residual[k] - chord));
      }
      const width = (b - a) * A;
      const stretch = (8 / 3) * (sag / width) ** 2;
      if (stretch > archStretch) {
        archStretch = stretch;
        bumpColumns = [];
        for (let k = a + 1; k < b; k++) {
          const chord = residual[a] + ((residual[b] - residual[a]) * (k - a)) / (b - a);
          if (Math.abs(residual[k] - chord) >= sag / 2) bumpColumns.push(k);
        }
      }
    }
  }

  // 2. Local detail. In a fan, each column is an arc of radius R about the fan's
  // centre, and heights are measured as angle round it (scaled by the average
  // radius so the numbers stay row-sized). An outer column, being longer, spends
  // less angle per row.
  const centreX = fan ? -alpha / beta : 0;
  const side = beta < 0 ? -1 : 1; // which way the centre lies from the columns
  const radius = heights.map((_, i) => (fan ? Math.max(A / 2, side * (xOf(i) - centreX)) : 1));
  const meanRadius = fan ? radius.reduce((t, r) => t + r, 0) / columns : 1;
  const spacing = fan ? radius.map((r) => meanRadius / r) : undefined;

  const relaxed = relax(fabric, passes, {
    yarnPull: options.yarnPull,
    doubleStitch: options.doubleStitch,
    endsInTurn: options.endsInTurn,
    spacing,
  });

  const shape: Shape = {
    x: [],
    y: [],
    upX: [],
    upY: [],
    below: [],
    above: [],
    stretch: [],
    stitchWidth: A,
    bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    fanDegrees: fan ? ((side < 0 ? 1 : -1) * phi * 180) / Math.PI : 0,
    maxStretch: archStretch,
    iterations: relaxed.iterations,
    converged: relaxed.converged,
  };

  const bump = new Set(bumpColumns);
  heights.forEach((h, i) => {
    const xs: number[] = [];
    const ys: number[] = [];
    const uxs: number[] = [];
    const uys: number[] = [];
    const lo: number[] = [];
    const hi: number[] = [];
    const st: number[] = [];
    // Angle units → real length along this column.
    const toLength = fan ? radius[i] / meanRadius : 1;
    const castOn = fan ? spacing![i] / 2 : 0;
    for (let r = 0; r < h; r++) {
      const c = relaxed.centres[i][r];
      let px: number;
      let py: number;
      let ux: number;
      let uy: number;
      if (fan) {
        const angle = (c - castOn) / meanRadius;
        px = centreX + side * radius[i] * Math.cos(angle);
        py = radius[i] * Math.sin(angle);
        ux = -side * Math.sin(angle);
        uy = Math.cos(angle);
      } else {
        px = xOf(i);
        py = c;
        ux = 0;
        uy = 1;
      }
      const down = (c - relaxed.lower[i][r]) * toLength;
      const upward = (relaxed.upper[i][r] - c) * toLength;
      xs.push(px);
      ys.push(py);
      uxs.push(ux);
      uys.push(uy);
      lo.push(down);
      hi.push(upward);
      st.push(bump.has(i) ? archStretch : 0);
      for (const sx of [-A / 2, A / 2]) {
        for (const sy of [-down, upward]) {
          // Corner = centre + sx across the column + sy along it.
          const cx = px + sx * uy + sy * ux;
          const cy = py - sx * ux + sy * uy;
          shape.bounds.minX = Math.min(shape.bounds.minX, cx);
          shape.bounds.maxX = Math.max(shape.bounds.maxX, cx);
          shape.bounds.minY = Math.min(shape.bounds.minY, cy);
          shape.bounds.maxY = Math.max(shape.bounds.maxY, cy);
        }
      }
    }
    shape.x.push(xs);
    shape.y.push(ys);
    shape.upX.push(uxs);
    shape.upY.push(uys);
    shape.below.push(lo);
    shape.above.push(hi);
    shape.stretch.push(st);
  });

  return shape;
}

export type Verdict =
  | { kind: "rectangle" }
  | { kind: "fan"; degrees: number; longer: "left" | "right" }
  | { kind: "stretched"; percent: number; fromColumn: number; toColumn: number };

/** Below this, a fan reads as a rectangle: a few degrees is within what any
 *  blocked piece of knitting does anyway. A display judgement, not physics. */
const FAN_NOTICEABLE = 3;

/**
 * Say what shape the fabric makes. A row stretched past `threshold` (model:
 * flatnessThreshold) means it won't lie flat, whatever else is going on.
 */
export function describeShape(shape: Shape, threshold: number): Verdict {
  if (shape.maxStretch > threshold) {
    let from = Infinity;
    let to = -Infinity;
    shape.stretch.forEach((col, i) => {
      if (col.some((s) => s > 0)) {
        from = Math.min(from, i + 1);
        to = Math.max(to, i + 1);
      }
    });
    return { kind: "stretched", percent: Math.round(shape.maxStretch * 100), fromColumn: from, toColumn: to };
  }
  const degrees = Math.abs(shape.fanDegrees);
  if (degrees >= FAN_NOTICEABLE) {
    return { kind: "fan", degrees: Math.round(degrees), longer: shape.fanDegrees > 0 ? "left" : "right" };
  }
  return { kind: "rectangle" };
}

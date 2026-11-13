/**
 * The ways to knit a drawing with short-row units — PLAN.md §6, step 3, and
 * the softening versions of L19, side by side: the drawing as it is; nudged,
 * a stitch or two moved where turns would crowd (L13), when it can't be
 * knitted as it is; and fitted to units three ways — the shape grows, the
 * background gives way, or both. Each is knitted for real, counted (balls,
 * ends, turns) and given the full prediction of its look, so you can pick.
 *
 * The prediction is the pattern lab's own (mesh/settle.ts): the pattern is
 * written out and read back, as "Knit it" does, so both tabs show the very
 * same fabric.
 */
import { simulate, type Fabric, type Pass, type Yarn } from "../methods/shortrow/passes";
import { knitShortRows, type Built } from "../methods/shortrow/construct";
import { roundForShortRows } from "../methods/shortrow/round";
import { turnsOf } from "../methods/shortrow/rules";
import { colourOfStrand, writeRows } from "../methods/shortrow/writer";
import { readWritten, type PassInfo } from "../methods/shortrow/written";
import { blobsOf, fitUnits, type Softening, type Unit } from "../methods/shortrow/units";
import type { Change } from "../methods/shortrow/round";
import type { Grid } from "../methods/shortrow/grid";
import { edgesOf, lookOf, type Edge } from "./look";
import { similarity, mirrorAxes, type Similarity } from "./similarity";
import { settle, type Shape } from "./settle";
import type { Physics } from "./convert";

/** The model's guesses the prediction rests on (model/physical.ts). */
export interface FabricPhysics extends Physics {
  stitchAspect: number;
  smallestBump: number;
}

/** A pattern's fabric once it relaxes, as the pattern lab draws it. */
export interface Prediction {
  /** The written rows, and the passes as a knitter reads them back — with
   *  what the reader knows of each (its row, side, yarn, turn), for the needle
   *  chart. `info` is empty if the rows couldn't be written. */
  written: string;
  passes: Pass[];
  info: PassInfo[];
  endsInTurn: boolean[];
  fabric: Fabric;
  /** Where every stitch settles. */
  shape: Shape;
  /** Where the edges between colours land, on the drawing's grid; none when
   *  the fabric doesn't lie flat as a rectangle. */
  edges: Edge[];
  /** Written rows knitted intarsia-style: a colour stops for another and then
   *  carries on beyond it from a second ball, so the row uses two balls of one
   *  colour. (Handing over into a shape is the book's way: the colour comes
   *  back over the finished shape with the same ball.) */
  intarsiaRows: number[];
}

export function predictionOf(stitches: number, built: readonly Pass[], physics: FabricPhysics): Prediction {
  // Written out and read back: the reader knows every turn from the SRs, even
  // where another yarn's pass comes between a turn and the way back.
  const written = writeRows(built, stitches, "RS");
  const read = written.problems.length === 0 ? readWritten(written.text, stitches) : null;
  const passes = read && read.problems.length === 0 ? read.passes : [...built];
  const info = read && read.problems.length === 0 ? read.info : [];
  const endsInTurn = read && read.problems.length === 0 ? read.info.map((i) => i.endsInTurn) : turnsOf(passes, stitches);
  const fabric = simulate(stitches, passes);
  const intarsiaRows: number[] = [];
  if (read && read.problems.length === 0) {
    const strandsOf = new Map<number, Set<Yarn>>();
    for (const i of read.info) strandsOf.set(i.row, (strandsOf.get(i.row) ?? new Set()).add(i.strand));
    for (const [row, strands] of strandsOf) {
      if (new Set([...strands].map(colourOfStrand)).size < strands.size) intarsiaRows.push(row);
    }
  }
  const shape = settle(fabric, passes, { ...physics, endsInTurn });
  const upright = fabric.balanced && shape.fanDegrees === 0;
  const lower = shape.y.map((col, i) => col.map((y, r) => y - shape.below[i][r]));
  const upper = shape.y.map((col, i) => col.map((y, r) => y + shape.above[i][r]));
  return { written: written.text, passes, info, endsInTurn, fabric, shape, edges: upright ? edgesOf(fabric, lower, upper, colourOfStrand) : [], intarsiaRows };
}

export type Way = "as drawn" | "nudged" | Softening | "ridge on top" | "symmetric";

export interface Version {
  way: Way;
  /** What it is compared against: the drawing — with a ridge added on top,
   *  for "ridge on top". */
  drawing: Grid;
  /** What to knit, and where it differs from the drawing. */
  plan: Grid;
  changed: Change[];
  /** The units found, when fitted, and the cells of any blob no unit fits. */
  units: Unit[];
  unfitted: { ridge: number; column: number }[];
  built: Built;
  /** Counts, when it knits. */
  turns: number;
  balls: number;
  /** The fabric it makes, when it knits. */
  prediction: Prediction | null;
  /** Its look on the drawing's grid, where that differs from the drawing,
   *  and how nearly it has the drawing's shape (similarity.ts). */
  look: Yarn[][] | null;
  mismatch: Change[];
  shape: Similarity | null;
  /** The earlier version with the very same plan, if any. */
  sameAs?: Way;
}

const differences = (a: Yarn[][], b: Yarn[][]): Change[] => {
  const out: Change[] = [];
  a.forEach((row, ridge) => row.forEach((y, i) => y !== b[ridge][i] && out.push({ ridge, column: i + 1, from: b[ridge][i], to: y })));
  return out;
};

function version(
  way: Way,
  drawing: Grid,
  plan: Grid,
  units: Unit[],
  built: Built,
  physics: FabricPhysics,
  unfitted: Version["unfitted"] = [],
): Version {
  const changed = differences(plan.cells, drawing.cells);
  if (built.problems.length > 0) {
    return { way, drawing, plan, changed, units, unfitted, built, turns: 0, balls: 0, prediction: null, look: null, mismatch: [], shape: null };
  }
  const prediction = predictionOf(plan.width, built.passes, physics);
  const { passes, endsInTurn, fabric } = prediction;
  const look = lookOf(fabric, passes, { ...physics, endsInTurn }, colourOfStrand)?.cells ?? null;
  return {
    way,
    drawing,
    plan,
    changed,
    units,
    unfitted,
    built,
    turns: endsInTurn.filter(Boolean).length,
    balls: built.strands.length,
    prediction,
    look,
    mismatch: look ? differences(look, drawing.cells) : [],
    shape: look ? similarity(drawing, look) : null,
  };
}

/** How long the builder may spend on all the ways of one drawing before
 *  giving up on those left: the Draw tab waits for every way, and a big
 *  drawing can take the search many seconds. And the least any one way gets. */
const ALLOW_MS = 6000;
const ALLOW_EACH_MS = 500;

/** The book's way first, then the look nearest the drawing's shape, then the
 *  fewest stitches changed: how one version beats another. */
function better(a: Version, b: Version): boolean {
  const rank = (v: Version) => [
    v.built.problems.length === 0 ? 0 : 1,
    v.built.problems.length === 0 && (v.prediction?.intarsiaRows.length ?? 0) === 0 ? 0 : 1,
    v.shape?.penalty ?? Infinity,
    v.changed.length,
  ];
  const [x, y] = [rank(a), rank(b)];
  for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k];
  return false;
}

/** The drawing with a ridge of background added along the top — for a shape
 *  touching the top edge, which can't be knitted the book's way without one
 *  (PLAN.md §6, edge map). Null when nothing touches the top. */
export function withRidgeOnTop(drawing: Grid): Grid | null {
  const background = blobsOf(drawing).background;
  const top = drawing.cells[drawing.height - 1];
  if (top.every((c) => c === background)) return null;
  return { width: drawing.width, height: drawing.height + 1, cells: [...drawing.cells, top.map(() => background)] };
}

/** The drawing as it is, then fitted to units each of three ways — and, when
 *  a shape touches the top edge, the closest fit with a ridge added above. */
export function versionsOf(drawing: Grid, physics: FabricPhysics): Version[] {
  const deadline = performance.now() + ALLOW_MS;
  const allowMs = () => Math.max(ALLOW_EACH_MS, deadline - performance.now());
  // The drawing as it is gets a third of the time: when it can't be knitted,
  // the builder may search long before it gives up, and the other ways need
  // theirs.
  const drawn = knitShortRows(drawing, { allowMs: ALLOW_MS / (1 + 2) });
  const out: Version[] = [version("as drawn", drawing, drawing, [], drawn, physics)];
  // Nudging tries the builder on many drawings: only while there's time.
  // (It finds its own places to move: the drawing as it is may have run out of
  // time without saying where it was stuck.)
  if (drawn.problems.length > 0 && performance.now() < deadline - ALLOW_MS / 2) {
    const rounded = roundForShortRows(drawing);
    if (rounded) out.push(version("nudged", drawing, rounded.grid, [], rounded.built, physics));
  }

  // Every plan tried, to mirror into symmetric ones.
  const seen: Grid[] = out.map((v) => v.plan);

  /** The closest version of one softening, of the fits on offer: strict or
   *  loose about one-stitch bumps; the near end — where a shape's rows start,
   *  and its yarn waits — tapered or left as drawn; and the shape's thickness
   *  free to change by two where both edges step at one stitch, or held to
   *  one, which the builder can knit more often. */
  const fitted = (target: Grid, softening: Softening, way: Way): Version => {
    let best: Version | null = null;
    for (const strict of [true, false]) {
      for (const [nearFree, steadyThickness] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ]) {
        const fit = fitUnits(target, softening, { strict, nearFree, steadyThickness });
        if (target === drawing) seen.push(fit.plan);
        if (best && differences(best.plan.cells, fit.plan.cells).length === 0) continue;
        const built = knitShortRows(fit.plan, { allowMs: allowMs() });
        const unfitted = blobsOf(target)
          .blobs.filter((b) => fit.unfitted.includes(b.id))
          .flatMap((b) => b.cells.map((at) => ({ ridge: Math.floor(at / target.width), column: (at % target.width) + 1 })));
        const v = version(way, target, fit.plan, fit.units, built, physics, unfitted);
        if (!best || better(v, best)) best = v;
      }
    }
    return best!;
  };

  for (const softening of ["grow", "give way", "both"] as Softening[]) {
    const v = fitted(drawing, softening, softening);
    const twin = out.find((o) => o.changed.length === v.changed.length && differences(o.plan.cells, v.plan.cells).length === 0);
    if (twin) v.sameAs = twin.sameAs ?? twin.way;
    out.push(v);
  }

  // A ridge of background on top, when a shape touches the top edge: the
  // closest of its fits, compared against the drawing with that ridge added.
  const taller = withRidgeOnTop(drawing);
  if (taller) {
    const tries = (["grow", "give way", "both"] as Softening[]).map((softening) => fitted(taller, softening, "ridge on top"));
    out.push(tries.reduce((a, b) => (better(b, a) ? b : a)));
  }

  // A symmetric drawing gets a symmetric version too, beside the others, to
  // pick from (your call, 2026-11-13): every plan tried, with one half
  // mirrored onto the other — left and right, top and bottom, or both — and
  // the closest of those that knits.
  const symmetric = symmetricVersion(drawing, seen, physics);
  if (symmetric) {
    const twin = out.find((o) => differences(o.plan.cells, symmetric.plan.cells).length === 0);
    if (twin) symmetric.sameAs = twin.sameAs ?? twin.way;
    out.push(symmetric);
  }
  return out;
}

/** Time for the symmetric version, in all, and for any one try of it: a try
 *  that knits does so in milliseconds; one that doesn't mustn't hold up the rest. */
const SYMMETRIC_MS = 2500;
const SYMMETRIC_EACH_MS = 300;

/** The plan with one half mirrored onto the other, about the given axis. */
function mirrored(plan: Grid, background: Yarn, axis: number, across: "columns" | "ridges", keepLow: boolean): Grid {
  const at = (r: number, c: number) => (r >= 0 && r < plan.height && c >= 0 && c < plan.width ? plan.cells[r][c] : background);
  const cells = plan.cells.map((row, r) =>
    row.map((y, c) => {
      const k = across === "columns" ? c : r;
      const kept = keepLow ? 2 * k <= axis : 2 * k >= axis;
      if (kept) return y;
      return across === "columns" ? at(r, axis - c) : at(axis - r, c);
    }),
  );
  return { ...plan, cells };
}

function symmetricVersion(drawing: Grid, plans: Grid[], physics: FabricPhysics): Version | null {
  const axes = mirrorAxes(drawing);
  if (axes.columns === null && axes.ridges === null) return null;
  const background = blobsOf(drawing).background;
  const deadline = performance.now() + SYMMETRIC_MS;

  // Every plan, mirrored every way the drawing is symmetric; fewest stitches
  // changed first, so the closest are tried while there's time.
  const candidates = new Map<string, Grid>();
  for (const plan of plans) {
    let ways: Grid[] = [plan];
    for (const across of ["columns", "ridges"] as const) {
      const axis = axes[across];
      if (axis === null) continue;
      ways = ways.flatMap((g) => [mirrored(g, background, axis, across, true), mirrored(g, background, axis, across, false)]);
    }
    for (const g of ways) candidates.set(g.cells.map((row) => row.join("")).join("/"), g);
  }
  const ordered = [...candidates.values()].sort((a, b) => differences(a.cells, drawing.cells).length - differences(b.cells, drawing.cells).length);

  let best: Version | null = null;
  for (const plan of ordered) {
    if (performance.now() > deadline) break;
    const built = knitShortRows(plan, { allowMs: SYMMETRIC_EACH_MS });
    if (built.problems.length > 0) continue;
    const v = version("symmetric", drawing, plan, [], built, physics);
    if (!best || better(v, best)) best = v;
  }
  return best;
}

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

export type Way = "as drawn" | "nudged" | Softening;

export interface Version {
  way: Way;
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
  /** Its look on the drawing's grid, and where that differs from the drawing. */
  look: Yarn[][] | null;
  mismatch: Change[];
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
    return { way, plan, changed, units, unfitted, built, turns: 0, balls: 0, prediction: null, look: null, mismatch: [] };
  }
  const prediction = predictionOf(plan.width, built.passes, physics);
  const { passes, endsInTurn, fabric } = prediction;
  const look = lookOf(fabric, passes, { ...physics, endsInTurn }, colourOfStrand)?.cells ?? null;
  return {
    way,
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
  };
}

/** The drawing as it is, then fitted to units each of three ways. */
export function versionsOf(drawing: Grid, physics: FabricPhysics): Version[] {
  const drawn = knitShortRows(drawing);
  const out: Version[] = [version("as drawn", drawing, drawing, [], drawn, physics)];
  if (drawn.problems.length > 0 && drawn.stuck) {
    const rounded = roundForShortRows(drawing);
    if (rounded) out.push(version("nudged", drawing, rounded.grid, [], rounded.built, physics));
  }
  for (const softening of ["grow", "give way", "both"] as Softening[]) {
    // The strict fit first; the looser one, nearer the drawing, if the
    // builder can't knit the strict one.
    let chosen: { fitted: ReturnType<typeof fitUnits>; built: Built } | null = null;
    for (const strict of [true, false]) {
      const fitted = fitUnits(drawing, softening, { strict });
      const built = knitShortRows(fitted.plan);
      if (!chosen || built.problems.length === 0) chosen = { fitted, built };
      if (built.problems.length === 0) break;
    }
    const { fitted, built } = chosen!;
    const unfitted = blobsOf(drawing)
      .blobs.filter((b) => fitted.unfitted.includes(b.id))
      .flatMap((b) => b.cells.map((at) => ({ ridge: Math.floor(at / drawing.width), column: (at % drawing.width) + 1 })));
    const v = version(softening, drawing, fitted.plan, fitted.units, built, physics, unfitted);
    const twin = out.find((o) => o.changed.length === v.changed.length && differences(o.plan.cells, v.plan.cells).length === 0);
    if (twin) v.sameAs = twin.sameAs ?? twin.way;
    out.push(v);
  }
  return out;
}

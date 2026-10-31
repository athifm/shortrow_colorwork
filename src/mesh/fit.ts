/**
 * The ways to knit a drawing with short-row units — PLAN.md §6, step 3, and
 * the softening versions of L19, side by side: the drawing as it is; nudged,
 * a stitch or two moved where turns would crowd (L13), when it can't be
 * knitted as it is; and fitted to units three ways — the shape grows, the
 * background gives way, or both. Each is knitted for real, counted (balls,
 * ends, turns) and given the full prediction of its look, so you can pick.
 */
import { simulate, type Yarn } from "../methods/shortrow/passes";
import { knitShortRows, type Built } from "../methods/shortrow/construct";
import { roundForShortRows } from "../methods/shortrow/round";
import { turnsOf } from "../methods/shortrow/rules";
import { colourOfStrand } from "../methods/shortrow/writer";
import { blobsOf, fitUnits, type Softening, type Unit } from "../methods/shortrow/units";
import type { Change } from "../methods/shortrow/round";
import type { Grid } from "../methods/shortrow/grid";
import { lookOf } from "./look";
import type { Physics } from "./convert";

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
  /** What it will look like, and where that differs from the drawing. */
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
  physics: Physics,
  unfitted: Version["unfitted"] = [],
): Version {
  const changed = differences(plan.cells, drawing.cells);
  if (built.problems.length > 0) return { way, plan, changed, units, unfitted, built, turns: 0, balls: 0, look: null, mismatch: [] };
  const endsInTurn = turnsOf(built.passes, plan.width);
  const fabric = simulate(plan.width, built.passes);
  const look = lookOf(fabric, built.passes, { ...physics, endsInTurn }, colourOfStrand)?.cells ?? null;
  return {
    way,
    plan,
    changed,
    units,
    unfitted,
    built,
    turns: endsInTurn.filter(Boolean).length,
    balls: built.strands.length,
    look,
    mismatch: look ? differences(look, drawing.cells) : [],
  };
}

/** The drawing as it is, then fitted to units each of three ways. */
export function versionsOf(drawing: Grid, physics: Physics): Version[] {
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

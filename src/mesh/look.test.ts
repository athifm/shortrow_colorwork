import { describe, it, expect } from "vitest";
import { lookOf, needleOf } from "./look";
import { knitShortRows } from "../methods/shortrow/construct";
import { knitIntarsia } from "../methods/shortrow/intarsia";
import { parseGrid, type Grid } from "../methods/shortrow/grid";
import { simulate, type Pass } from "../methods/shortrow/passes";
import { turnsOf } from "../methods/shortrow/rules";
import { colourOfStrand } from "../methods/shortrow/writer";
import { PROBES } from "../methods/shortrow/probes";
import { yarnPull, doubleStitchStiffness } from "../model/physical";

/**
 * Step L1 of "Draw the look" (PLAN.md §5): a plan's relaxed fabric, painted
 * back onto the drawing's grid.
 */

const grid = (text: string) => parseGrid(text).grid!;

function look(g: Grid, passes: Pass[]) {
  const fabric = simulate(g.width, passes);
  const options = {
    yarnPull: yarnPull.compute({}),
    doubleStitch: doubleStitchStiffness.compute({}),
    endsInTurn: turnsOf(passes, g.width),
  };
  return { fabric, look: lookOf(fabric, passes, options, colourOfStrand) };
}

/** A column's colours bottom to top, with repeats run together. */
const order = (cells: string[][], i: number) =>
  cells.map((row) => row[i]).filter((c, k, all) => k === 0 || c !== all[k - 1]);

/** Is `a` what's left of `b` with some entries taken out? */
const within = (a: string[], b: string[]) => {
  let k = 0;
  for (const x of b) if (k < a.length && a[k] === x) k++;
  return k === a.length;
};

const FLOATING_PEAK = [
  "AAAAAAAAAAAAAAAA",
  "AAAAAAAAAAAAAAAA",
  "AAAAAAABBAAAAAAA",
  "AAAAAABBBBAAAAAA",
  "AAAAABBBBBBAAAAA",
  "AAAABBBBBBBBAAAA",
  "AAAAAAAAAAAAAAAA",
  "AAAAAAAAAAAAAAAA",
].join("\n");

describe("the look of a plan", () => {
  it("is the drawing itself when there are no short rows", () => {
    // Intarsia alone: every column gets every ridge in step, nothing bends.
    for (const probe of PROBES) {
      const g = grid(probe.grid);
      const { look: l } = look(g, knitIntarsia(g).passes);
      expect(l!.cells, probe.id).toEqual(g.cells);
    }
  });

  it("starts from the drawing on the needle", () => {
    // The short-row builder knits the drawing literally ("draw the needle"),
    // so read off the needle, the plan is the drawing.
    const g = grid(FLOATING_PEAK);
    const { fabric } = look(g, knitShortRows(g).passes);
    expect(needleOf(fabric, colourOfStrand)).toEqual(g.cells);
  });

  it("bends where short rows turn", () => {
    const g = grid(FLOATING_PEAK);
    const { look: l } = look(g, knitShortRows(g).passes);
    expect(l!.cells).not.toEqual(g.cells);
    for (const row of l!.share) {
      for (const s of row) {
        expect(s).toBeGreaterThan(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });

  it("only moves colours up and down their own column", () => {
    // Flat fabric keeps its columns upright: a colour can be squeezed out of a
    // cell, but never moves sideways or swaps places with another.
    for (const probe of PROBES) {
      const g = grid(probe.grid);
      const built = knitShortRows(g);
      if (built.problems.length > 0) continue;
      const { look: l } = look(g, built.passes);
      for (let i = 0; i < g.width; i++) {
        expect(within(order(l!.cells, i), order(g.cells, i)), `${probe.id} column ${i + 1}`).toBe(true);
      }
    }
  });

  it("has none on this grid when the fabric won't lie flat as a rectangle", () => {
    // The plan aims for a rectangle (decided 2026-10-30); a wedge fans out.
    const passes: Pass[] = [
      { yarn: "A", from: 1, to: 6 },
      { yarn: "A", from: 6, to: 1 },
      { yarn: "B", from: 1, to: 3 },
      { yarn: "B", from: 3, to: 1 },
    ];
    const wedge = simulate(6, passes);
    expect(wedge.balanced).toBe(false);
    const options = { yarnPull: yarnPull.compute({}), doubleStitch: doubleStitchStiffness.compute({}), endsInTurn: turnsOf(passes, 6) };
    expect(lookOf(wedge, passes, options, colourOfStrand)).toBeNull();
  });
});

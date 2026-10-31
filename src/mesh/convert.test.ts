import { describe, it, expect } from "vitest";
import { convert, quickRelax } from "./convert";
import { relax } from "./relax";
import { knitShortRows } from "../methods/shortrow/construct";
import { parseGrid } from "../methods/shortrow/grid";
import { simulate } from "../methods/shortrow/passes";
import { turnsOf } from "../methods/shortrow/rules";
import { PROBES } from "../methods/shortrow/probes";
import { yarnPull, doubleStitchStiffness } from "../model/physical";

/**
 * Steps L2 and L3 of "Draw the look" (PLAN.md §5): the quick predictor, and
 * the conversion from the look you drew to a plan for the needle.
 */

const physics = { yarnPull: yarnPull.compute({}), doubleStitch: doubleStitchStiffness.compute({}) };
const grid = (text: string) => parseGrid(text).grid!;

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

describe("the quick predictor (L2)", () => {
  it("puts the peak's edges within a fifth of a ridge of the full prediction", () => {
    const g = grid(FLOATING_PEAK);
    const built = knitShortRows(g);
    const full = relax(simulate(g.width, built.passes), built.passes, { ...physics, endsInTurn: turnsOf(built.passes, g.width) });
    const quick = quickRelax(g, physics);
    for (let c = 0; c < g.width; c++) {
      const column = g.cells.map((row) => row[c]);
      const bottom = column.indexOf("B");
      if (bottom < 0) continue;
      const top = column.lastIndexOf("B") + 1;
      for (const row of [2 * bottom, 2 * top]) {
        expect(Math.abs(quick.lower[c][row] - full.lower[c][row]) / 2, `column ${c + 1}`).toBeLessThan(0.2);
      }
    }
  });
});

describe("the conversion (L3)", () => {
  it("leaves alone a drawing whose look already matches", () => {
    // Without short-row bends that show at this size, the plan is the drawing.
    for (const probe of PROBES) {
      if (probe.id === "P7") continue;
      const g = grid(probe.grid);
      const c = convert(g, physics);
      expect(c.planChanges, probe.id).toEqual([]);
      expect(c.mismatch, probe.id).toEqual([]);
    }
  });

  it("brings the floating peak's look closer to the drawing", () => {
    const g = grid(FLOATING_PEAK);
    const c = convert(g, physics);
    expect(c.built.problems).toEqual([]);
    expect(c.mismatch.length).toBeLessThan(4); // 4 when knitted as drawn
  });

  it("finds a knittable plan for the lens that can't be knitted as drawn", () => {
    const g = grid(PROBES.find((p) => p.id === "P7")!.grid);
    expect(knitShortRows(g).problems).not.toEqual([]);
    const c = convert(g, physics);
    expect(c.built.problems).toEqual([]);
    expect(c.look).not.toBeNull();
    expect(c.mismatch.length).toBeLessThanOrEqual(4);
  });
});

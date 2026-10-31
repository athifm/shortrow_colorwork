import { describe, it, expect } from "vitest";
import { versionsOf } from "./fit";
import { parseGrid } from "../methods/shortrow/grid";
import { SHAPES } from "../methods/shortrow/probes";
import { yarnPull, doubleStitchStiffness } from "../model/physical";

/** The ways to knit a drawing, side by side (PLAN.md §6, step 3; §8, L19). */

const physics = { yarnPull: yarnPull.compute({}), doubleStitch: doubleStitchStiffness.compute({}) };
const shape = (id: string) => parseGrid(SHAPES.find((s) => s.id === id)!.grid).grid!;

describe("versions", () => {
  it("gives the drawing as it is, then the three softenings", () => {
    expect(versionsOf(shape("S7"), physics).map((v) => v.way)).toEqual(["as drawn", "nudged", "grow", "give way", "both"]);
    expect(versionsOf(shape("S3"), physics).map((v) => v.way)).toEqual(["as drawn", "grow", "give way", "both"]);
  });

  it("says when a version is the same as an earlier one", () => {
    const [drawn, ...fitted] = versionsOf(shape("S3"), physics);
    expect(drawn.built.problems).toEqual([]);
    for (const v of fitted) expect(v.sameAs).toBe("as drawn");
  });

  it("knits the oval, which can't be knitted as drawn, every fitted way — with its look", () => {
    const [drawn, ...fitted] = versionsOf(shape("S7"), physics);
    expect(drawn.built.problems).not.toEqual([]);
    for (const v of fitted) {
      expect(v.built.problems, v.way).toEqual([]);
      expect(v.look).not.toBeNull();
      expect(v.turns).toBeGreaterThan(0);
    }
  });

  // Where things stand, 2026-10-31: the shapes with at least one way to knit
  // them with short rows. The rest are the next work.
  it("has a short-row way for most of the shapes", () => {
    const knits = SHAPES.filter((s) => versionsOf(shape(s.id), physics).some((v) => v.built.problems.length === 0 && v.turns > 0)).map((s) => s.id);
    expect(knits).toEqual(["S2", "S3", "S4", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15", "S16", "S17"]);
  });
});

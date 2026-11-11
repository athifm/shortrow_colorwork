import { describe, it, expect } from "vitest";
import { predictionOf, versionsOf } from "./fit";
import { knitShortRows } from "../methods/shortrow/construct";
import { turnsOf } from "../methods/shortrow/rules";
import { parseGrid } from "../methods/shortrow/grid";
import { SHAPES } from "../methods/shortrow/probes";
import { yarnPull, doubleStitchStiffness, stitchAspect, smallestBump } from "../model/physical";

/** The ways to knit a drawing, side by side (PLAN.md §6, step 3; §8, L19). */

const physics = {
  yarnPull: yarnPull.compute({}),
  doubleStitch: doubleStitchStiffness.compute({}),
  stitchAspect: stitchAspect.compute({}),
  smallestBump: smallestBump.compute({}),
};
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

describe("the fabric a pattern makes: the pattern lab's own prediction", () => {
  it("puts a plain stripe's edges exactly where they were drawn", () => {
    const g = shape("S1");
    const { edges, fabric } = predictionOf(g.width, knitShortRows(g).passes, physics);
    expect(fabric.balanced).toBe(true);
    // Two edges across every column, at ridges 1 and 3; none up between columns.
    expect(edges.filter((e) => e.kind === "up")).toEqual([]);
    for (const e of edges) if (e.kind === "across") expect(Math.min(Math.abs(e.at - 1), Math.abs(e.at - 3))).toBeLessThan(0.01);
    expect(edges).toHaveLength(2 * g.width);
  });

  it("shows the leaning stripe pulled flatter: lower at its high end, higher at its low end", () => {
    const g = shape("S4");
    const { edges } = predictionOf(g.width, knitShortRows(g).passes, physics);
    const lowerEdge = (column: number) => Math.min(...edges.flatMap((e) => (e.kind === "across" && e.column === column ? [e.at] : [])));
    // Drawn: the stripe's lower edge is at ridge 1 in column 1, ridge 8 in column 16.
    expect(lowerEdge(0)).toBeGreaterThan(1.2);
    expect(lowerEdge(g.width - 1)).toBeLessThan(7.8);
  });

  it("counts turns as a knitter reads them back, never fewer than passes alone show", () => {
    for (const id of ["S10", "S12", "S14"]) {
      const g = shape(id);
      const built = knitShortRows(g);
      const { endsInTurn } = predictionOf(g.width, built.passes, physics);
      expect(endsInTurn.filter(Boolean).length, id).toBeGreaterThanOrEqual(turnsOf(built.passes, g.width).filter(Boolean).length);
    }
  });
});

describe("intarsia-style rows (PLAN.md §6): two balls of one colour in the same row", () => {
  const rows = (id: string, way: string) => versionsOf(shape(id), physics).find((v) => v.way === way)!.prediction!.intarsiaRows;

  it("finds none in the book's kind of shape — handing over into a nested shape is fine", () => {
    for (const id of ["S2", "S4", "S6", "S14"]) expect(rows(id, "as drawn"), id).toEqual([]);
  });

  it("finds them in your blob with two colours inside, nudged", () => {
    expect(rows("S15", "nudged").length).toBeGreaterThan(0);
  });
});

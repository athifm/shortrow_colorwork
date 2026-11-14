import { describe, it, expect } from "vitest";
import { predictionOf, versionsOf } from "./fit";
import { knitShortRows } from "../methods/shortrow/construct";
import { turnsOf } from "../methods/shortrow/rules";
import { parseGrid } from "../methods/shortrow/grid";
import { SHAPES, INTARSIA_SHAPES } from "../methods/shortrow/probes";
import { yarnPull, doubleStitchStiffness, stitchAspect, smallestBump } from "../model/physical";

/** The ways to knit a drawing, side by side (PLAN.md §6, step 3; §8, L19). */

const physics = {
  yarnPull: yarnPull.compute({}),
  doubleStitch: doubleStitchStiffness.compute({}),
  stitchAspect: stitchAspect.compute({}),
  smallestBump: smallestBump.compute({}),
};
const shape = (id: string) => parseGrid([...SHAPES, ...INTARSIA_SHAPES].find((s) => s.id === id)!.grid).grid!;

describe("versions", () => {
  it("gives the drawing as it is, then the three softenings", { timeout: 60_000 }, () => {
    // The oval is symmetric, so it gets a symmetric version too.
    expect(versionsOf(shape("S7"), physics).map((v) => v.way)).toEqual(["as drawn", "nudged", "grow", "give way", "both", "symmetric"]);
    expect(versionsOf(shape("S3"), physics).map((v) => v.way)).toEqual(["as drawn", "grow", "give way", "both"]);
  });

  it("says when a version is the same as an earlier one", { timeout: 60_000 }, () => {
    const [drawn, ...fitted] = versionsOf(shape("S3"), physics);
    expect(drawn.built.problems).toEqual([]);
    for (const v of fitted) expect(v.sameAs).toBe("as drawn");
  });

  it("knits the oval, which can't be knitted as drawn, every fitted way — with its look", { timeout: 60_000 }, () => {
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
  it("has a short-row way for most of the shapes", { timeout: 120_000 }, () => {
    const knits = SHAPES.filter((s) => versionsOf(shape(s.id), physics).some((v) => v.built.problems.length === 0 && v.turns > 0)).map((s) => s.id);
    expect(knits).toEqual(["S2", "S3", "S4", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15", "S16"]);
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

  it("finds them in your blob with two colours inside, nudged", { timeout: 60_000 }, () => {
    expect(rows("S15", "nudged").length).toBeGreaterThan(0);
  });
});

describe("the book's way (PLAN.md §6, step 3): no row with two balls of one colour", () => {
  // Where things stand, 2026-11-14. Open: your fish. (The fish with a tail is
  // intarsia only, your call in round 4.)
  // Your T has one, with a ridge of background added on top.
  it("exists for every shape but one", { timeout: 120_000 }, () => {
    const without = SHAPES.filter(
      (s) => !versionsOf(shape(s.id), physics).some((v) => v.built.problems.length === 0 && v.prediction!.intarsiaRows.length === 0),
    ).map((s) => s.id);
    expect(without).toEqual(["S16"]);
  });
});

describe("a ridge of background on top (PLAN.md §6, edge map)", () => {
  it("is offered for your T, whose crossbar touches the top edge, and knits it the book's way", { timeout: 60_000 }, () => {
    const ridge = versionsOf(shape("S17"), physics).find((v) => v.way === "ridge on top")!;
    expect(ridge.drawing.height).toBe(shape("S17").height + 1);
    expect(ridge.built.problems).toEqual([]);
    expect(ridge.prediction!.intarsiaRows).toEqual([]);
  });

  it("isn't offered when nothing touches the top", { timeout: 60_000 }, () => {
    expect(versionsOf(shape("S7"), physics).some((v) => v.way === "ridge on top")).toBe(false);
  });
});

describe("the knitting order (PLAN.md §6, round 3, step 3)", () => {
  it("knits the blob at the edge in, then out — turns at 5, 7, 8, 7, 5, the book's lens", { timeout: 60_000 }, () => {
    const v = versionsOf(shape("S11"), physics).find((x) => x.way === "as drawn")!;
    const turns = v.prediction!.passes.filter((p) => p.yarn === "B" && p.to > p.from).map((p) => p.to);
    expect(turns).toEqual([5, 7, 8, 7, 5]);
  });

  it("keeps your nested triangles nearly symmetric once knitted", { timeout: 60_000 }, () => {
    // Judged on the relaxed fabric (round 4), it isn't exact: the layers
    // settle a little differently on each side. Under a tenth of the shape.
    const v = versionsOf(shape("S14"), physics).find((x) => x.way === "as drawn")!;
    expect(v.shape!.asymmetry).toBeLessThan(0.1);
  });
});

import { describe, it, expect } from "vitest";
import { checkLaws } from "./laws";
import { blobsOf, fitUnits, type Softening } from "./units";
import { knitShortRows } from "./construct";
import { parseGrid } from "./grid";
import { SHAPES, EDGES } from "./probes";

/** The laws of short-row construction, checked on a drawing (PLAN.md §6). */

const shape = (id: string) => parseGrid(SHAPES.find((s) => s.id === id)!.grid).grid!;
const laws = (id: string) => checkLaws(shape(id)).map((b) => b.law);

describe("the laws", () => {
  it("are kept by the book's kind of shape", () => {
    for (const id of ["S1", "S2", "S3", "S4", "S6", "S10", "S12", "S14"]) expect(laws(id), id).toEqual([]);
  });

  it("say why the oval can't be made as drawn: beside its right-hand point, 3 ridges", () => {
    const found = checkLaws(shape("S7"));
    expect(found.map((b) => b.law)).toEqual(["near point"]);
    expect(found[0].cells.every((c) => c.column === 4)).toBe(true);
  });

  it("name the two laws the try-everything checker proved, on its edge probes", () => {
    // E25 and E27 need a carry; E26 and E28, eased, are the book's way.
    const edge = (id: string) => checkLaws(parseGrid(EDGES.find((e) => e.id === id)!.grid).grid!).map((b) => b.law);
    expect(edge("E25")).toEqual(["near point"]);
    expect(edge("E26")).toEqual([]);
    expect(edge("E27")).toEqual(["narrow peak"]);
    expect(edge("E28")).toEqual([]);
  });

  it("say why the teardrop can't be made as drawn: too steep, and straight-sided", () => {
    const found = checkLaws(shape("S8"));
    // Its one-stitch tip is no breach: the in-and-out walk makes it.
    expect(new Set(found.map((b) => b.law))).toEqual(new Set(["slope", "tip"]));
    // Every breach points at cells of the drawing, and says something.
    for (const b of found) {
      expect(b.cells.length).toBeGreaterThan(0);
      expect(b.why).not.toBe("");
    }
  });

  it("are kept exactly when the fitter has nothing to change", () => {
    for (const s of SHAPES) {
      const grid = shape(s.id);
      // The fitter set to the laws as they stand: near end free, thickness free.
      const fitted = fitUnits(grid, "both", { nearFree: true, steadyThickness: false });
      expect(checkLaws(grid).length === 0, s.id).toBe(fitted.changed.length === 0);
    }
  });

  it("are kept by every shape the fitter makes, where no shape sits inside another", () => {
    for (const s of SHAPES) {
      const grid = shape(s.id);
      if (blobsOf(grid).blobs.some((b) => b.parent !== null)) continue;
      for (const softening of ["grow", "give way", "both"] as Softening[]) {
        const fitted = fitUnits(grid, softening);
        if (fitted.unfitted.length > 0) continue;
        expect(checkLaws(fitted.plan).map((b) => `${b.law}: ${b.why}`), `${s.id} ${softening}`).toEqual([]);
      }
    }
  });

  it("are kept by a fitted shape inside a shape: the blob inside a blob, every way", () => {
    for (const softening of ["grow", "give way", "both"] as Softening[]) {
      const fitted = fitUnits(shape("S13"), softening);
      expect(checkLaws(fitted.plan), softening).toEqual([]);
      // One ball each: the background, the blob, the blob inside it.
      const built = knitShortRows(fitted.plan);
      expect(built.problems, softening).toEqual([]);
      expect(built.strands.map((b) => b.id).sort(), softening).toEqual(["A", "B", "C"]);
    }
  });

  it("your blob with two colours inside, fitted, knits with one ball to each colour", () => {
    const fitted = fitUnits(shape("S15"), "both");
    expect(checkLaws(fitted.plan)).toEqual([]);
    const built = knitShortRows(fitted.plan);
    expect(built.problems).toEqual([]);
    expect(built.strands.map((b) => b.id).sort()).toEqual(["A", "C", "E", "F"]);
  });

  // Still open (2026-11-12): two shapes stacked inside a third, fitted the
  // other two ways, and your fish — the fitted plan breaks the laws itself.
  it.fails("are kept by every fitted shape inside a shape", () => {
    for (const id of ["S15", "S16"]) {
      for (const softening of ["grow", "give way", "both"] as Softening[]) {
        const fitted = fitUnits(shape(id), softening);
        if (fitted.unfitted.length > 0) continue;
        expect(checkLaws(fitted.plan), `${id} ${softening}`).toEqual([]);
      }
    }
  });

  // A guarantee again (2026-11-13), for every shape here: the three that
  // kept every law yet couldn't be knitted — S5 fish with a tail, S7 oval,
  // S13 blob inside a blob — all break the near point law (PLAN.md §6, the
  // builder gap). (The laws are still a check, not a proof: a new shape may
  // find another one missing.)
  it("when kept, the drawing knits as it stands", { timeout: 120_000 }, () => {
    const failing: string[] = [];
    for (const s of SHAPES) {
      const grid = shape(s.id);
      if (checkLaws(grid).length === 0 && knitShortRows(grid, { allowMs: 10_000 }).problems.length > 0) failing.push(s.id);
    }
    expect(failing).toEqual([]);
  });
});

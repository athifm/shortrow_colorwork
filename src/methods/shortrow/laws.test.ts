import { describe, it, expect } from "vitest";
import { checkLaws } from "./laws";
import { blobsOf, fitUnits, type Softening } from "./units";
import { knitShortRows } from "./construct";
import { parseGrid } from "./grid";
import { SHAPES } from "./probes";

/** The laws of short-row construction, checked on a drawing (PLAN.md §6). */

const shape = (id: string) => parseGrid(SHAPES.find((s) => s.id === id)!.grid).grid!;
const laws = (id: string) => checkLaws(shape(id)).map((b) => b.law);

describe("the laws", () => {
  it("are kept by the book's kind of shape", () => {
    for (const id of ["S1", "S2", "S3", "S4", "S6", "S10", "S12", "S14"]) expect(laws(id), id).toEqual([]);
  });

  it("say why the teardrop can't be made as drawn: too steep, straight-sided, and a one-stitch tip", () => {
    const found = checkLaws(shape("S8"));
    expect(new Set(found.map((b) => b.law))).toEqual(new Set(["slope", "tip", "bump"]));
    // Every breach points at cells of the drawing, and says something.
    for (const b of found) {
      expect(b.cells.length).toBeGreaterThan(0);
      expect(b.why).not.toBe("");
    }
  });

  it("are kept exactly when the fitter has nothing to change", () => {
    for (const s of SHAPES) {
      const grid = shape(s.id);
      expect(checkLaws(grid).length === 0, s.id).toBe(fitUnits(grid, "both").changed.length === 0);
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

  // Known gap, found by this checker (2026-11-12): fitting a shape inside a
  // shape, the inner one can poke out of the outer or cut it in two, so the
  // fitted plan breaks the laws itself. For "the book's method only"
  // (PLAN.md §6, step 3).
  it.fails("are kept by fitted shapes inside shapes too", () => {
    for (const id of ["S13", "S15", "S16"]) {
      for (const softening of ["grow", "give way", "both"] as Softening[]) {
        const fitted = fitUnits(shape(id), softening);
        if (fitted.unfitted.length > 0) continue;
        expect(checkLaws(fitted.plan), `${id} ${softening}`).toEqual([]);
      }
    }
  });

  it("when kept, the drawing knits as it stands", () => {
    for (const s of SHAPES) {
      const grid = shape(s.id);
      if (checkLaws(grid).length === 0) expect(knitShortRows(grid).problems, s.id).toEqual([]);
    }
  });
});

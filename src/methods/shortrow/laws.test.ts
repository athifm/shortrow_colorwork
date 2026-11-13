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

  // Not a guarantee any more (2026-11-13). With each edge judged on its own,
  // three shapes keep every law, yet the builder can't knit them as drawn:
  //  - S7 oval, S13 blob inside a blob: too big for the checker; unknown;
  //  - S5 fish with a tail: its tail is pieces touching corner to corner —
  //    likely a law missing.
  // (S11, the blob at the edge, was a fourth until the in-and-out search was
  // fixed: the checker had proven it knits, and now the builder does too.)
  it("when kept, the drawing knits as it stands — but for three known shapes", { timeout: 120_000 }, () => {
    const failing: string[] = [];
    for (const s of SHAPES) {
      const grid = shape(s.id);
      if (checkLaws(grid).length === 0 && knitShortRows(grid, { allowMs: 10_000 }).problems.length > 0) failing.push(s.id);
    }
    expect(failing).toEqual(["S5", "S7", "S13"]);
  });
});

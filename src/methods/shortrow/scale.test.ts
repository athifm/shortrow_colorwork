import { describe, it, expect } from "vitest";
import { widen, enlarge } from "./scale";
import { checkLaws } from "./laws";
import { parseGrid } from "./grid";
import { SHAPES } from "./probes";

/** A drawing made wider, or bigger (PLAN.md §6, step 4). */

const shape = (id: string) => parseGrid(SHAPES.find((s) => s.id === id)!.grid).grid!;
const laws = (id: string, how: typeof widen) => checkLaws(how(shape(id))).map((b) => b.law);
const count = (found: string[], law: string) => found.filter((l) => l === law).length;

describe("wider ×2", () => {
  it("doubles the stitches, keeps the ridges and the colours", () => {
    for (const s of SHAPES) {
      const g = shape(s.id);
      const wide = widen(g);
      expect([wide.width, wide.height], s.id).toEqual([g.width * 2, g.height]);
      expect(new Set(wide.cells.flat()), s.id).toEqual(new Set(g.cells.flat()));
    }
  });

  it("keeps the laws wherever the drawing kept them — slopes stay smooth, no staircases", () => {
    for (const id of ["S1", "S2", "S3", "S4", "S6", "S10", "S12", "S14"]) expect(laws(id, widen), id).toEqual([]);
  });

  it("cures the leaf, and halves the teardrop's steepness", () => {
    expect(laws("S9", widen)).toEqual([]);
    const before = checkLaws(shape("S8")).map((b) => b.law);
    const after = laws("S8", widen);
    expect(count(after, "slope")).toBeLessThan(count(before, "slope"));
    // Its blunt ends and its one-stitch tip are gone.
    expect(count(after, "tip") + count(after, "bump")).toBe(0);
  });

  it("cures the oval, the blob at the edge and the blob inside a blob outright", () => {
    for (const id of ["S7", "S11", "S13"]) expect(laws(id, widen), id).toEqual([]);
  });

  it("helps your fish, but not enough: it is more than twice too steep", () => {
    const before = checkLaws(shape("S16")).length;
    const after = laws("S16", widen).length;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });
});

describe("bigger ×2", () => {
  it("doubles the stitches and the ridges, keeps the colours", () => {
    for (const s of SHAPES) {
      const g = shape(s.id);
      const big = enlarge(g);
      expect([big.width, big.height], s.id).toEqual([g.width * 2, g.height * 2]);
      expect(new Set(big.cells.flat()), s.id).toEqual(new Set(g.cells.flat()));
    }
  });

  it("keeps the laws for stripes, wedges, bands and your nested triangles: a point stays a point", () => {
    for (const id of ["S1", "S2", "S3", "S4", "S6", "S10", "S14"]) expect(laws(id, enlarge), id).toEqual([]);
  });

  it("does not cure steepness: the teardrop is as steep as before, or worse", () => {
    expect(count(laws("S8", enlarge), "slope")).toBeGreaterThanOrEqual(count(checkLaws(shape("S8")).map((b) => b.law), "slope"));
  });
});

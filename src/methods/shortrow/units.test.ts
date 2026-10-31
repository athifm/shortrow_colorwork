import { describe, it, expect } from "vitest";
import { blobsOf, fitUnits, type Softening } from "./units";
import { knitShortRows } from "./construct";
import { parseGrid } from "./grid";
import { SHAPES } from "./probes";

/** Short-row units (PLAN.md §6, steps 2 and 3). */

const shape = (id: string) => parseGrid(SHAPES.find((s) => s.id === id)!.grid).grid!;
const SOFTENINGS: Softening[] = ["grow", "give way", "both"];

describe("blobs", () => {
  it("finds the background, and a blob inside a blob", () => {
    const { background, blobs } = blobsOf(shape("S13"));
    expect(background).toBe("A");
    expect(blobs.map((b) => b.colour)).toEqual(["B", "C"]);
    expect(blobs[1].parent).toBe(0);
    expect(blobs[0].parent).toBeNull();
  });

  it("keeps two blobs side by side apart", () => {
    const { blobs } = blobsOf(shape("S12"));
    expect(blobs).toHaveLength(2);
    expect(blobs.every((b) => b.parent === null)).toBe(true);
  });
});

describe("fitting", () => {
  it("leaves the book's own shapes as drawn", () => {
    for (const id of ["S1", "S2", "S3", "S4", "S14"]) {
      for (const softening of SOFTENINGS) expect(fitUnits(shape(id), softening).changed, `${id} ${softening}`).toEqual([]);
    }
  });

  it("keeps the rule: edges and thickness move a ridge at most, and tips are one ridge", () => {
    for (const s of SHAPES) {
      const grid = shape(s.id);
      for (const softening of SOFTENINGS) {
        for (const u of fitUnits(grid, softening).units) {
          const k = u.top.map((t, i) => t - u.bottom[i]);
          for (let i = 1; i < k.length; i++) {
            expect(Math.abs(u.bottom[i] - u.bottom[i - 1]), s.id).toBeLessThanOrEqual(1);
            expect(Math.abs(u.top[i] - u.top[i - 1]), s.id).toBeLessThanOrEqual(1);
            expect(Math.abs(k[i] - k[i - 1]), s.id).toBeLessThanOrEqual(1);
          }
          if (u.from > 1) expect(k[0], s.id).toBe(1);
          if (u.to < grid.width) expect(k[k.length - 1], s.id).toBe(1);
        }
      }
    }
  });

  it("grows only by adding stitches of the shape, gives way only by taking them", () => {
    for (const s of SHAPES) {
      const grid = shape(s.id);
      const { background } = blobsOf(grid);
      // Growing never turns a stitch of a shape into the background; giving
      // way never covers the background with a shape.
      for (const c of fitUnits(grid, "grow").changed) expect(c.to, s.id).not.toBe(background);
      for (const c of fitUnits(grid, "give way").changed) expect(c.from, s.id).not.toBe(background);
    }
  });

  it("makes the oval and the blob at the edge knittable, a few stitches changed", () => {
    for (const id of ["S7", "S11"]) {
      for (const softening of SOFTENINGS) {
        const fitted = fitUnits(shape(id), softening);
        expect(knitShortRows(fitted.plan).problems, `${id} ${softening}`).toEqual([]);
        expect(fitted.changed.length).toBeLessThanOrEqual(6);
      }
    }
  });
});

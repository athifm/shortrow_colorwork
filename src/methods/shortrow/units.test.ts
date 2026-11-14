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

  it("keeps the rule, by default: edges and thickness move a ridge at most, and tips are one ridge", () => {
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

describe("fitting symmetric (PLAN.md §6, round 3, step 2)", () => {
  const mirror = (g: ReturnType<typeof shape>) => {
    // The oval's axes, as similarity.ts finds them: the sum of the outermost
    // shape cells' indices.
    const cells = g.cells.flatMap((row, r) => row.flatMap((y, c) => (y !== "A" ? [[r, c]] : [])));
    return {
      columns: Math.min(...cells.map(([, c]) => c)) + Math.max(...cells.map(([, c]) => c)),
      ridges: Math.min(...cells.map(([r]) => r)) + Math.max(...cells.map(([r]) => r)),
    };
  };

  it("eases the oval's two points alike, left to right, and it knits: 2 stitches", () => {
    // Symmetric top to bottom as well, it can't keep the near point law: it
    // is an odd number of ridges thick everywhere (PLAN.md §6).
    const g = shape("S7");
    const fitted = fitUnits(g, "both", { steadyThickness: false, mirror: { columns: mirror(g).columns, ridges: null } });
    expect(fitted.changed).toHaveLength(2);
    expect(fitted.changed.map((c) => c.column).sort((x, y) => x - y)).toEqual([4, 13]);
    expect(knitShortRows(fitted.plan).problems).toEqual([]);
  });

  it("makes every fitted teardrop symmetric left to right", () => {
    const g = shape("S8");
    const m = mirror(g);
    for (const softening of SOFTENINGS) {
      const plan = fitUnits(g, softening, { steadyThickness: false, mirror: { columns: m.columns, ridges: null } }).plan;
      plan.cells.forEach((row, r) =>
        row.forEach((y, c) => {
          const p = m.columns - c;
          expect(p >= 0 && p < plan.width ? plan.cells[r][p] : "A", `${softening} r${r} c${c}`).toBe(y);
        }),
      );
    }
  });
});

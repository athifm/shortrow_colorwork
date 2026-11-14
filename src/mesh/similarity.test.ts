import { describe, it, expect } from "vitest";
import { similarity, mirrorAxes } from "./similarity";
import { parseGrid } from "../methods/shortrow/grid";
import { gridRuns } from "./look";

/** Does the look have the drawing's shape? (PLAN.md §6, round 3.) */

const grid = (text: string) => parseGrid(text).grid!;
const LENS = grid(`AAAAAAAAAA
AAAABBAAAA
AAABBBBAAA
AABBBBBBAA
AAAAAAAAAA`);

describe("shape similarity", () => {
  it("is perfect for the drawing itself", () => {
    const s = similarity(LENS, LENS.cells);
    expect(s.penalty).toBe(0);
    expect(s.symmetric).toBe(true);
  });

  it("counts a shape shifted one stitch as a small miss, not a big one", () => {
    // The whole lens one stitch to the left: every cell of its outline is a
    // stitch off, yet it is the same shape.
    const shifted = LENS.cells.map((row) => [...row.slice(1), "A"]);
    const s = similarity(LENS, shifted);
    expect(s.meanOff).toBeLessThanOrEqual(1);
    expect(s.points.got).toBe(s.points.drawn);
  });

  it("notices a lens knitted lopsided", () => {
    const lopsided = grid(`AAAAAAAAAA
AAAAABBAAA
AAABBBBAAA
AABBBBBBAA
AAAAAAAAAA`);
    const s = similarity(LENS, lopsided.cells);
    expect(s.symmetric).toBe(false);
    expect(s.penalty).toBeGreaterThan(similarity(LENS, LENS.cells).penalty + 1 - Number.EPSILON);
  });

  it("notices a point lost", () => {
    // The lens's top point flattened into a plateau as wide as its base row.
    const flat = grid(`AAAAAAAAAA
AAAAAAAAAA
AAABBBBAAA
AABBBBBBAA
AAAAAAAAAA`);
    const s = similarity(LENS, flat.cells);
    expect(s.worstOff).toBeGreaterThanOrEqual(1);
  });

  it("judges the shape's own form: a lens tilted, one end higher, is still symmetric", () => {
    // Round 4, your note on the blob inside a blob: the eye forgives a tilt.
    const tilted = gridRuns(LENS.cells).map((col, i) => col.map((r) => ({ ...r, from: r.from + i / 20, to: r.to + i / 20 })));
    expect(similarity(LENS, tilted).symmetric).toBe(true);
  });

  it("judges symmetry about the shape's own middle: a lens a stitch over is still symmetric", () => {
    const shifted = LENS.cells.map((row) => [...row.slice(1), "A"]);
    expect(similarity(LENS, shifted).symmetric).toBe(true);
  });

  it("finds a drawing's axes of symmetry", () => {
    expect(mirrorAxes(LENS)).toEqual({ columns: 9, ridges: null });
  });
});

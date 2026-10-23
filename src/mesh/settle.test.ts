import { describe, it, expect } from "vitest";
import { settle, describeShape, type Shape } from "./settle";
import { relax } from "./relax";
import { simulate } from "../methods/shortrow/passes";
import { readWritten } from "../methods/shortrow/written";
import { PRESETS } from "../presets";

/**
 * One drawing for balanced and unbalanced patterns alike (PLAN.md §2.2). The
 * examples here are our own; the textbook's are checked the same way,
 * privately, in research/.
 */

const OPTIONS = { yarnPull: 0.3, doubleStitch: 0.5, stitchAspect: 2, smallestBump: 4 };
const THRESHOLD = 0.1;

function shapeOf(text: string, stitches: number, repeats = 2) {
  const read = readWritten(text, stitches, repeats);
  const fabric = simulate(stitches, read.passes);
  const endsInTurn = read.info.map((i) => i.endsInTurn);
  const shape = settle(fabric, read.passes, { ...OPTIONS, endsInTurn });
  return { read, fabric, shape, endsInTurn, verdict: describeShape(shape, THRESHOLD) };
}

const preset = (name: string) => PRESETS.find((p) => p.name === name)!;
const fromPreset = (name: string, repeats = 2) => {
  const p = preset(name);
  return shapeOf(p.text, p.stitches, repeats);
};

describe("plain fabric", () => {
  const { shape, verdict } = shapeOf("Row 1 (WS): (A) Knit all sts\nRows 2 to 6: (A) Knit all sts", 8, 1);

  it("is a rectangle, with nothing stretched", () => {
    expect(verdict).toEqual({ kind: "rectangle" });
    expect(shape.maxStretch).toBe(0);
  });

  it("keeps every stitch where the straight drawing puts it", () => {
    shape.y.forEach((col) => col.forEach((y, r) => expect(y).toBeCloseTo(r + 1, 3)));
    shape.x.forEach((col, i) => col.forEach((x) => expect(x).toBeCloseTo((8 - 1 - i) * 2, 6)));
  });
});

describe("balanced patterns", () => {
  for (const name of ["Stripe with catch-up", "Lens"]) {
    it(`draws ${name} exactly as the balanced-only solver did`, () => {
      const { read, fabric, shape, endsInTurn, verdict } = fromPreset(name);
      expect(verdict).toEqual({ kind: "rectangle" });
      const before = relax(fabric, read.passes, { yarnPull: OPTIONS.yarnPull, doubleStitch: OPTIONS.doubleStitch, endsInTurn });
      before.centres.forEach((col, i) => col.forEach((y, r) => expect(shape.y[i][r]).toBeCloseTo(y, 6)));
    });
  }
});

describe("a wedge — short rows on one side, no catch-up", () => {
  const { fabric, shape, verdict } = fromPreset("Wedge");

  it("fans, with the left edge longer", () => {
    expect(verdict.kind).toBe("fan");
    if (verdict.kind === "fan") expect(verdict.longer).toBe("left");
  });

  it("opens by about the angle the column lengths predict", () => {
    // A fan's columns are arcs and its rows spokes, so the opening angle is the
    // difference in length between the outer columns over the distance between
    // them — the same flare relation the plan started with.
    const h = fabric.heights;
    const predicted = ((h[h.length - 1] - h[0]) / ((h.length - 1) * OPTIONS.stitchAspect)) * (180 / Math.PI);
    expect(Math.abs(shape.fanDegrees - predicted) / predicted).toBeLessThan(0.15);
  });

  it("lies flat: a staircase of two-stitch steps doesn't stretch anything", () => {
    expect(shape.maxStretch).toBeLessThan(THRESHOLD);
  });

  it("keeps rows square to the columns — the full rows tilt, they don't stretch", () => {
    // Neighbouring columns in a fan sit one stitch width apart along every row.
    const spoke = (s: Shape, i: number) => Math.hypot(s.x[i][0] - s.x[i + 1][0], s.y[i][0] - s.y[i + 1][0]);
    for (let i = 0; i + 1 < shape.x.length; i++) expect(spoke(shape, i)).toBeCloseTo(OPTIONS.stitchAspect, 1);
  });
});

describe("a bump — short rows in the middle", () => {
  const { verdict } = fromPreset("Bump");

  it("won't lie flat, and says where", () => {
    expect(verdict.kind).toBe("stretched");
    if (verdict.kind === "stretched") {
      // The zigzag covers columns 5–10, tallest at 7–8.
      expect(verdict.fromColumn).toBeLessThanOrEqual(7);
      expect(verdict.toColumn).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("a missing catch-up row", () => {
  it("pulls the short edge in: a slight fan, the other edge longer", () => {
    // The three short columns are on the left, so the right edge is the longer.
    const { verdict } = fromPreset("Stripe, catch-up missing");
    expect(verdict.kind).toBe("fan");
    if (verdict.kind === "fan") expect(verdict.longer).toBe("right");
  });
});

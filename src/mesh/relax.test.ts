import { describe, it, expect } from "vitest";
import { relax } from "./relax";
import { simulate } from "../methods/shortrow/passes";
import { readWritten } from "../methods/shortrow/written";
import { PRESETS } from "../presets";

const lens = PRESETS.find((p) => p.name === "Lens")!;

function relaxedLens(repeats: number, yarnPull = 1, doubleStitch = 1 / 2) {
  const read = readWritten(lens.text, lens.stitches, repeats);
  const fabric = simulate(lens.stitches, read.passes);
  const endsInTurn = read.info.map((i) => i.endsInTurn);
  return { read, fabric, relaxed: relax(fabric, read.passes, { yarnPull, doubleStitch, endsInTurn }) };
}

/** The lower edge of the first B stitch in a column, counting from `fromRow` up. */
function bottomOfB(fabric: ReturnType<typeof simulate>, lower: number[][], column: number, fromRow: number) {
  const stack = fabric.stacks[column - 1];
  const r = stack.findIndex((yarn, i) => i >= fromRow && yarn === "B");
  return lower[column - 1][r];
}

describe("plain fabric", () => {
  it("stays exactly where the straight drawing puts it", () => {
    // Four full rows: nothing to fight about, so nothing moves.
    const read = readWritten("Row 1 (WS): (A) Knit all sts\nRows 2 to 4: (A) Knit all sts", 6);
    const fabric = simulate(6, read.passes);
    const r = relax(fabric, read.passes, { yarnPull: 1, doubleStitch: 1 / 2, endsInTurn: read.info.map((i) => i.endsInTurn) });
    expect(r.converged).toBe(true);
    for (const col of r.centres) {
      col.forEach((y, row) => expect(y).toBeCloseTo(row + 1, 3));
    }
  });
});

describe("a motif in balanced fabric", () => {
  const { fabric, relaxed } = relaxedLens(2);

  it("settles", () => {
    expect(relaxed.converged).toBe(true);
  });

  it("keeps the cast-on edge and the top edge level", () => {
    const bottoms = relaxed.lower.map((col) => col[0]);
    const tops = relaxed.upper.map((col) => col[col.length - 1]);
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThan(0.3);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(0.3);
  });

  it("bows the motif's bottom edge downwards in the middle — the curve the straight drawing can't make", () => {
    // In the straight drawing the second lens sits on a flat bottom: its first
    // B row is at the same height in the middle (column 9) and near the side
    // (column 5). Relaxed, the middle sinks below the side.
    const fromRow = 12; // past the first repeat
    const middle = bottomOfB(fabric, relaxed.lower, 9, fromRow);
    const side = bottomOfB(fabric, relaxed.lower, 5, fromRow);
    expect(middle).toBeLessThan(side);
  });

  // Row 10 is knitted all the way across, but straight-stacked it sits at very
  // different heights in different columns. It's one strand of yarn, so relaxed
  // it should be nearer level — and nearer still the harder the yarn pulls. How
  // near is the guessed ratio talking, so only the direction is pinned here.
  function spreadOfRow10(yarnPull: number | null) {
    const read = readWritten(lens.text, lens.stitches, 1);
    const one = simulate(lens.stitches, read.passes);
    const row10 = read.info.findIndex((i) => i.row === 10);
    const r =
      yarnPull === null
        ? null
        : relax(one, read.passes, { yarnPull, doubleStitch: 1 / 2, endsInTurn: read.info.map((i) => i.endsInTurn) });
    const heights: number[] = [];
    one.madeBy.forEach((col, i) =>
      col.forEach((p, row) => {
        if (p === row10) heights.push(r ? r.centres[i][row] : row + 1);
      }),
    );
    return Math.max(...heights) - Math.min(...heights);
  }

  it("brings a full-width pass nearer level than the straight drawing does", () => {
    expect(spreadOfRow10(1)).toBeLessThan(spreadOfRow10(null));
  });

  it("keeps passes more level, and squashes columns instead, when the yarn pulls harder", () => {
    expect(spreadOfRow10(5)).toBeLessThan(spreadOfRow10(1));
    expect(spreadOfRow10(1)).toBeLessThan(spreadOfRow10(0.2));
  });
});

describe("unbalanced fabric", () => {
  it("leaves the top free, so the short side stays short", () => {
    const missing = PRESETS.find((p) => p.name === "Stripe, catch-up missing")!;
    const read = readWritten(missing.text, missing.stitches);
    const fabric = simulate(missing.stitches, read.passes);
    const r = relax(fabric, read.passes, { yarnPull: 1, doubleStitch: 1 / 2, endsInTurn: read.info.map((i) => i.endsInTurn) });
    const topOf = (column: number) => r.upper[column - 1][r.upper[column - 1].length - 1];
    expect(r.converged).toBe(true);
    expect(topOf(12)).toBeLessThan(topOf(1));
  });
});

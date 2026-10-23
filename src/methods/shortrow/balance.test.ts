import { describe, it, expect } from "vitest";
import { fill, levelOut, type CatchUpOptions } from "./balance";
import { readWritten } from "./written";
import { simulate, type Pass } from "./passes";
import { stackedTurns, turnsOf } from "./rules";
import { writeRows } from "./writer";
import { PRESETS } from "../../presets";

/**
 * Catch-up rows (PLAN.md §9, Stage B). Our own examples here; the textbook's
 * catch-ups are rebuilt privately in research/ — the solver reproduces the
 * pairs of all fourteen groups in the book's five patterns.
 */

const LEFT: CatchUpOptions = { yarn: "A", side: "left", order: "longest-first", step: 1 };
const preset = (name: string) => PRESETS.find((p) => p.name === name)!;
const passesOf = (name: string) => readWritten(preset(name).text, preset(name).stitches).passes;

/** After the catch-up: is everything level, and are the turns unstacked? */
function check(stitches: number, before: Pass[], after: Pass[]) {
  const all = [...before, ...after];
  const fabric = simulate(stitches, all);
  return { fabric, stacked: stackedTurns(fabric, all, turnsOf(all, stitches)) };
}

describe("levelling after a stripe", () => {
  it("puts back exactly the catch-up row the stripe was missing", () => {
    const before = passesOf("Stripe, catch-up missing");
    const result = levelOut(12, before, LEFT);
    expect(result.problems).toEqual([]);
    // Columns 10–12 are two rows short: one pair of three from the left edge.
    expect(result.left).toEqual([3]);
    expect(result.passes).toEqual([
      { yarn: "A", from: 12, to: 10 },
      { yarn: "A", from: 10, to: 12 },
    ]);
    const { fabric, stacked } = check(12, before, result.passes);
    expect(fabric.balanced).toBe(true);
    expect(stacked).toEqual([]);
    expect(result.uneven.every((u) => u === 0)).toBe(true);
  });

  it("matches what was written by hand in the balanced version", () => {
    // "Stripe with catch-up" is the same stripe with its catch-up in place.
    const balanced = passesOf("Stripe with catch-up");
    const result = levelOut(12, balanced.slice(0, 4), LEFT);
    expect(result.passes).toEqual(balanced.slice(4, 6));
  });
});

describe("levelling a wedge", () => {
  const before = passesOf("Wedge");

  it("works pairs from the right edge, after a full row carries the yarn across", () => {
    const result = levelOut(12, before, { ...LEFT, side: "right" });
    expect(result.problems).toEqual([]);
    expect(result.right).toEqual([10, 8, 6, 4, 2]);
    expect(result.notes.some((n) => /full row/.test(n))).toBe(true);
    const { fabric, stacked } = check(12, before, result.passes);
    expect(fabric.balanced).toBe(true);
    expect(stacked).toEqual([]);
  });

  it("brings the yarn home again, so the pattern still repeats (rule 3)", () => {
    // Crossing to the right edge is one full row; coming back is another. An
    // odd trip would leave A on the wrong side and the repeat an odd number of
    // rows long, starting the next repeat on the wrong side.
    const result = levelOut(12, before, { ...LEFT, side: "right" });
    expect(result.endsAt).toBe(12);
    const text = writeRows([...before, ...result.passes], 12, "WS").text;
    const twice = readWritten(text, 12, 2);
    expect(twice.problems).toEqual([]);
    expect(simulate(12, twice.passes).balanced).toBe(true);
  });

  it("can't do it from the left edge, where the short columns aren't", () => {
    const result = levelOut(12, before, LEFT);
    expect(result.problems.some((p) => /can't be reached from the left edge/.test(p))).toBe(true);
  });
});

describe("levelling a bump", () => {
  it("fills both sides when the middle is the tall part", () => {
    const before = passesOf("Bump");
    const result = levelOut(12, before, { ...LEFT, side: "both" });
    expect(result.problems).toEqual([]);
    const { fabric, stacked } = check(12, before, result.passes);
    expect(fabric.balanced).toBe(true);
    expect(stacked).toEqual([]);
  });
});

describe("what can't be done", () => {
  it("says so when short columns sit in the middle, out of reach", () => {
    const result = fill(8, [0, 0, 2, 2, 0, 0, 0, 0], 8, { ...LEFT, side: "both" });
    expect(result.problems[0]).toMatch(/Columns 3–4 can't be reached from either edge/);
  });

  it("says so when a column is short by an odd number of rows", () => {
    const result = fill(8, [1, 0, 0, 0, 0, 0, 0, 0], 1, { ...LEFT, side: "right" });
    expect(result.problems[0]).toMatch(/odd number/);
  });

  it("refuses to start away from the background yarn", () => {
    // After this, B is at the right edge but A was last left at the left.
    const before: Pass[] = [
      { yarn: "A", from: 1, to: 8 },
      { yarn: "B", from: 8, to: 1 },
    ];
    const result = levelOut(8, before, LEFT);
    expect(result.problems[0]).toMatch(/waiting at column 8/);
  });
});

describe("the turning-stitch rule", () => {
  it("staggers pairs that would turn in the same column, and reports the unevenness", () => {
    // Columns 1–3 each need two pairs: two pairs of three would turn one on the
    // other in column 3, so the second is moved in a stitch.
    const result = fill(8, [4, 4, 4, 0, 0, 0, 0, 0], 1, { ...LEFT, side: "right" });
    expect(result.right).toEqual([3, 2]);
    expect(result.notes.some((n) => /shortened to 2/.test(n))).toBe(true);
    expect(result.uneven[2]).toBe(2); // column 3 ends two rows short
    expect(check(8, [], result.passes).stacked).toEqual([]);
  });

  it("finds stacked turns when a pattern has them", () => {
    // Two pairs of three from the right edge: both turn in column 3, one on the other.
    const passes: Pass[] = [
      { yarn: "A", from: 1, to: 3 },
      { yarn: "A", from: 3, to: 1 },
      { yarn: "A", from: 1, to: 3 },
      { yarn: "A", from: 3, to: 1 },
    ];
    const stacked = stackedTurns(simulate(8, passes), passes, turnsOf(passes, 8));
    expect(stacked).toEqual([{ column: 3, row: 3, passes: [1, 3] }]);
  });

  it("finds none in any of our examples", () => {
    for (const p of PRESETS) {
      const read = readWritten(p.text, p.stitches, 2);
      const fabric = simulate(p.stitches, read.passes);
      expect(stackedTurns(fabric, read.passes, read.info.map((i) => i.endsInTurn)), p.name).toEqual([]);
    }
  });
});

describe("orders", () => {
  it("works the book's Harvest order — every other pair going in, the rest coming out", () => {
    // Pairs of 11 down to 3 from the left edge of 46 stitches.
    const add = Array.from({ length: 46 }, (_, i) => 2 * Math.max(0, Math.min(9, i + 1 - 35)));
    const result = fill(46, add, 46, { ...LEFT, order: "alternate" });
    expect(result.left).toEqual([11, 9, 7, 5, 3, 4, 6, 8, 10]);
  });
});

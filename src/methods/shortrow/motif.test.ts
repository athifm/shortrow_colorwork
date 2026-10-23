import { describe, it, expect } from "vitest";
import { designMotif, zigzagTurns, type MotifDesign } from "./motif";
import { writeRows } from "./writer";
import { readWritten } from "./written";
import { simulate } from "./passes";
import { stackedTurns } from "./rules";
import { settle, describeShape } from "../../mesh/settle";
import { PRESETS } from "../../presets";

/**
 * One motif on a background (PLAN.md §9, Stage C). The strongest check is that
 * designing from a few numbers reproduces patterns written by hand: our
 * Stripe and Lens examples here, the textbook's Short Stripes and Shoal's fish
 * privately in research/.
 */

const base = (over: Partial<MotifDesign>): MotifDesign => ({
  stitches: 12,
  background: "A",
  motif: "B",
  start: 1,
  width: 9,
  steps: 0,
  step: 2,
  catchUp: { when: "after", side: "left", order: "longest-first", step: 1 },
  rowsBelow: 1,
  rowsAbove: 1,
  ...over,
});

const preset = (name: string) => PRESETS.find((p) => p.name === name)!;
const normalise = (t: string) =>
  t
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean)
    .map((l) => l.replace(/^(rows? (\d+)(?: to \d+)?) \((rs|ws)\):/, (a, h, n) => (Number(n) > 2 ? `${h}:` : a)))
    .join("\n");

function written(design: MotifDesign) {
  const result = designMotif(design);
  return { ...result, text: writeRows(result.passes, design.stitches, "WS").text };
}

describe("reproducing patterns written by hand", () => {
  it("a stripe from the right edge, caught up from the left, is our Stripe example", () => {
    const { problems, text } = written(base({}));
    expect(problems).toEqual([]);
    expect(normalise(text)).toBe(normalise(preset("Stripe with catch-up").text));
  });

  it("a zigzag of two steps, caught up from both edges, is our Lens example", () => {
    const { problems, text } = written(
      base({ stitches: 16, start: 5, width: 8, steps: 2, catchUp: { when: "after", side: "both", order: "longest-first", step: 1 } }),
    );
    expect(problems).toEqual([]);
    expect(normalise(text)).toBe(normalise(preset("Lens").text));
  });
});

describe("the zigzag", () => {
  it("turns where Shoal's fish turns", () => {
    // Start 5, first leg 14, three steps of two: the book's own turn columns.
    expect(zigzagTurns(5, 14, 3, 2)).toEqual([18, 7, 16, 9, 14, 11, 15, 10, 17, 8, 19]);
  });

  it("never turns twice in one column", () => {
    for (const [w, n, s] of [[14, 3, 2], [20, 4, 2], [21, 3, 3], [9, 1, 2]] as const) {
      const turns = zigzagTurns(5, w, n, s);
      expect(new Set(turns).size).toBe(turns.length);
    }
  });
});

describe("whatever the settings, the repeat is sound", () => {
  const designs: [string, Partial<MotifDesign>][] = [
    ["lens, catch-ups after", { stitches: 24, start: 6, width: 12, steps: 3, catchUp: { when: "after", side: "both", order: "alternate", step: 1 } }],
    ["lens, catch-ups before", { stitches: 24, start: 6, width: 12, steps: 3, catchUp: { when: "before", side: "both", order: "longest-first", step: 1 } }],
    ["wide steps", { stitches: 30, start: 4, width: 20, steps: 2, step: 4, catchUp: { when: "after", side: "both", order: "shortest-first", step: 1 } }],
    ["stripe mid-row", { stitches: 20, start: 6, width: 10, rowsBelow: 3, rowsAbove: 3, catchUp: { when: "after", side: "both", order: "longest-first", step: 1 } }],
  ];

  for (const [name, over] of designs) {
    it(`${name}: reads back, lies flat, repeats, and keeps every rule`, () => {
      const design = base(over);
      const { problems, text } = written(design);
      expect(problems).toEqual([]);

      const twice = readWritten(text, design.stitches, 2);
      expect(twice.problems).toEqual([]);
      const fabric = simulate(design.stitches, twice.passes);
      expect(fabric.balanced).toBe(true);
      expect(fabric.problems).toEqual([]);
      const turns = twice.info.map((i) => i.endsInTurn);
      expect(stackedTurns(fabric, twice.passes, turns)).toEqual([]);
      // One background strand and one motif strand: the motif yarn waits at its
      // start for the next repeat, the background at the edge.
      expect(twice.strands.map((s) => s.id)).toEqual(["A", "B"]);

      const shape = settle(fabric, twice.passes, { yarnPull: 0.3, doubleStitch: 0.5, stitchAspect: 2, smallestBump: 4, endsInTurn: turns });
      expect(describeShape(shape, 0.1)).toEqual({ kind: "rectangle" });
    });
  }
});

describe("asking for something that can't be knitted", () => {
  it("refuses one-stitch steps, which would stack the turns", () => {
    expect(designMotif(base({ stitches: 20, start: 5, width: 10, steps: 2, step: 1 })).problems[0]).toMatch(/at least 2/);
  });

  it("refuses a motif wider than the fabric", () => {
    expect(designMotif(base({ stitches: 12, start: 5, width: 10 })).problems[0]).toMatch(/only 12 stitches/);
  });

  it("refuses a zigzag with more steps than its width allows", () => {
    expect(designMotif(base({ stitches: 30, start: 5, width: 8, steps: 4 })).problems[0]).toMatch(/closes up/);
  });

  it("refuses an even number of base rows, which would start the motif on the wrong side", () => {
    expect(designMotif(base({ rowsBelow: 2 })).problems[0]).toMatch(/odd number/);
  });
});

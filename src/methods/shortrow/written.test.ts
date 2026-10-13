import { describe, it, expect } from "vitest";
import { readWritten } from "./written";
import { simulate } from "./passes";
import { PRESETS } from "../../presets";

/**
 * The reader's job is to know where each pass *starts*, which patterns never
 * say. These tests pin that down on small patterns of our own. The textbook's
 * patterns are checked the same way, privately, in research/.
 */

const preset = (name: string) => {
  const p = PRESETS.find((x) => x.name === name);
  if (!p) throw new Error(`no preset called ${name}`);
  return p;
};

describe("reading a stripe with its catch-up row", () => {
  const { stitches, text } = preset("Stripe with catch-up");
  const read = readWritten(text, stitches);

  it("finds where every pass starts and stops", () => {
    expect(read.passes).toEqual([
      { yarn: "A", from: 12, to: 1 }, // row 1, WS: right along the chart
      { yarn: "B", from: 1, to: 9 }, // row 2, RS: B joined at the right edge
      { yarn: "B", from: 9, to: 1 }, // row 3: back over the turning stitch
      { yarn: "A", from: 1, to: 12 },
      { yarn: "A", from: 12, to: 10 }, // the catch-up
      { yarn: "A", from: 10, to: 12 },
      { yarn: "A", from: 12, to: 1 },
      { yarn: "A", from: 1, to: 12 },
    ]);
  });

  it("marks the turn where a chart draws ∞ — the cell just past the last stitch", () => {
    expect(read.info[1].turnAt).toBe(10);
    expect(read.info[4].turnAt).toBe(9);
    expect(read.info[0].turnAt).toBeNull();
  });

  it("reads each row's side from row 1", () => {
    expect(read.info.map((i) => i.side)).toEqual(["WS", "RS", "WS", "RS", "WS", "RS", "WS", "RS"]);
  });

  it("has nothing to complain about", () => {
    expect(read.problems).toEqual([]);
    expect(read.notes).toEqual([]);
  });

  it("makes a balanced fabric", () => {
    const fabric = simulate(stitches, read.passes);
    expect(fabric.balanced).toBe(true);
    expect(fabric.heights[0]).toBe(6);
  });
});

describe("the same stripe, catch-up missing", () => {
  const { stitches, text } = preset("Stripe, catch-up missing");

  it("reads cleanly but doesn't balance", () => {
    const read = readWritten(text, stitches);
    expect(read.problems).toEqual([]);
    const fabric = simulate(stitches, read.passes);
    expect(fabric.balanced).toBe(false);
    expect(fabric.heights).toEqual([6, 6, 6, 6, 6, 6, 6, 6, 6, 4, 4, 4]);
  });
});

describe("the lens", () => {
  const { stitches, text } = preset("Lens");
  const read = readWritten(text, stitches);

  it("hands over from A to B mid-row, carrying on from the next stitch", () => {
    // Row 2: A works columns 1–4, then B picks up at 5.
    expect(read.passes[1]).toEqual({ yarn: "A", from: 1, to: 4 });
    expect(read.passes[2]).toEqual({ yarn: "B", from: 5, to: 12 });
  });

  it("takes A back from where it was left waiting", () => {
    // Row 3: B comes home to column 5, then A carries on from 4.
    const row3 = read.passes.filter((_, i) => read.info[i].row === 3);
    expect(row3).toEqual([
      { yarn: "B", from: 13, to: 5 },
      { yarn: "A", from: 4, to: 1 },
    ]);
  });

  it("balances, over several repeats too", () => {
    for (const repeats of [1, 2, 3]) {
      const r = readWritten(text, stitches, repeats);
      expect(r.problems).toEqual([]);
      const fabric = simulate(stitches, r.passes);
      expect(fabric.problems).toEqual([]);
      expect(fabric.balanced).toBe(true);
      expect(fabric.heights[0]).toBe(12 * repeats);
    }
  });
});

describe("strands", () => {
  it("joins a second strand when a colour is needed where none is waiting", () => {
    // B makes a motif starting at column 3, then another starting at column 7.
    // One strand of B can't be in both places.
    const text = `Row 1 (RS): (A) K2, (B) K2, SR
Row 2: (B) K2, (A) Knit to end
Row 3: (A) K6, (B) K2, SR
Row 4: (B) K2, (A) Knit to end`;
    const read = readWritten(text, 10);
    expect(read.strands.map((s) => s.id)).toEqual(["A", "B", "B2"]);
    expect(read.notes).toHaveLength(1);
    expect(read.notes[0].message).toMatch(/another strand of B/);
  });
});

describe("mistakes in the text", () => {
  it("flags an instruction it can't read", () => {
    const read = readWritten("Row 1 (RS): (A) K3, P2", 10);
    expect(read.problems.some((p) => /don't know "P2"/.test(p.message))).toBe(true);
  });

  it("flags a row that stops mid-row without a turn", () => {
    const read = readWritten("Row 1 (RS): (A) K3", 10);
    expect(read.problems.some((p) => /without a turn/.test(p.message))).toBe(true);
  });

  it("flags a missing row number", () => {
    const read = readWritten("Row 1 (WS): (A) Knit all sts\nRow 3: (A) Knit all sts", 10);
    expect(read.problems.some((p) => /missing/.test(p.message))).toBe(true);
  });

  it("skips a pasted page's other lines quietly, but mentions them", () => {
    const read = readWritten("NOTES\nWorked over 10 sts\nRow 1 (WS): (A) Knit all sts\nRow 2: (A) Knit all sts\nRepeat rows 1 to 2.", 10);
    expect(read.problems).toEqual([]);
    expect(read.passes).toHaveLength(2);
    expect(read.notes.length).toBe(3);
  });
});

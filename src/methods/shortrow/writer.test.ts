import { describe, it, expect } from "vitest";
import { writeRows } from "./writer";
import { readWritten } from "./written";
import { PRESETS } from "../../presets";

/**
 * The writer's test is the round trip: write passes out as rows, read them back,
 * and the passes must be identical. Our own examples here; the textbook's,
 * privately, in research/.
 *
 * The text itself should also come out as a knitter would write it — for our
 * examples, the same text we wrote by hand, give or take capital letters and the
 * side noted on rows after the second.
 */

/** Same pattern, ignoring case, spacing, and RS/WS notes after row 2. */
function normalise(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((line) => line !== "")
    .map((line) => line.replace(/^(rows? (\d+)(?: to \d+)?) \((rs|ws)\):/, (all, head, n) => (Number(n) > 2 ? `${head}:` : all)))
    .join("\n");
}

describe("round trip through our own examples", () => {
  for (const preset of PRESETS) {
    it(`writes ${preset.name} so it reads back pass for pass`, () => {
      const read = readWritten(preset.text, preset.stitches);
      const out = writeRows(read.passes, preset.stitches, read.info[0].side);
      expect(out.problems).toEqual([]);

      const back = readWritten(out.text, preset.stitches);
      expect(back.problems).toEqual([]);
      expect(back.passes).toEqual(read.passes);
    });

    it(`writes ${preset.name} the way it was written by hand`, () => {
      const read = readWritten(preset.text, preset.stitches);
      const out = writeRows(read.passes, preset.stitches, read.info[0].side);
      expect(normalise(out.text)).toBe(normalise(preset.text));
    });
  }
});

describe("the book's conventions", () => {
  it("keeps a zigzag in one row and puts the run home in the next", () => {
    // B out 6, back 3, out 3, back to the edge: the zigzag is one row, and the
    // pass that runs home to the edge is the next.
    const read = readWritten(
      "Row 1 (WS): (A) Knit all sts\nRow 2 (RS): (B) K6, SR, K3, SR, K3, SR\nRow 3: (B) Knit to end\nRow 4: (A) Knit all sts",
      10,
    );
    const out = writeRows(read.passes, 10, "WS");
    expect(out.text.split("\n")[1]).toBe("Row 2 (RS): (B) K6, SR, K3, SR, K3, SR");
    expect(out.text.split("\n")[2]).toBe("Row 3: (B) Knit to end");
  });

  it("merges identical rows", () => {
    const read = readWritten("Row 1 (WS): (A) Knit all sts\nRows 2 to 6: (A) Knit all sts", 8);
    expect(writeRows(read.passes, 8, "WS").text).toBe(
      "Row 1 (WS): (A) Knit all sts\nRow 2 (RS): (A) Knit all sts\nRows 3 to 6: (A) Knit all sts",
    );
  });

  it("writes a second strand of a colour under the colour's own name", () => {
    const read = readWritten(
      "Row 1 (RS): (A) K2, (B) K2, SR\nRow 2: (B) K2, (A) Knit to end\nRow 3: (A) K6, (B) K2, SR\nRow 4: (B) K2, (A) Knit to end",
      10,
    );
    const out = writeRows(read.passes, 10, "RS");
    expect(out.text).not.toMatch(/B2/);
    expect(readWritten(out.text, 10).passes).toEqual(read.passes);
  });
});

describe("passes the needle can't make", () => {
  it("refuses a pass that starts away from the needle", () => {
    const out = writeRows(
      [
        { yarn: "A", from: 10, to: 1 },
        { yarn: "B", from: 5, to: 8 }, // the needle is at 1
      ],
      10,
      "WS",
    );
    expect(out.problems).toHaveLength(1);
    expect(out.problems[0]).toMatch(/can't jump/);
  });

  it("refuses a pass running the wrong way", () => {
    // A works a WS row from 10 to 5 and hands over; B starts in the right place,
    // column 4, but heads back the way A came.
    const out = writeRows(
      [
        { yarn: "A", from: 10, to: 5 },
        { yarn: "B", from: 4, to: 8 },
      ],
      10,
      "WS",
    );
    expect(out.problems[0]).toMatch(/wrong way/);
  });
});

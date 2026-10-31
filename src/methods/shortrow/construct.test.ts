import { describe, it, expect } from "vitest";
import { knitShortRows } from "./construct";
import { knitIntarsia } from "./intarsia";
import { roundForShortRows } from "./round";
import { steepEdges, roundSteep } from "./steep";
import { parseGrid, type Grid } from "./grid";
import { PROBES, SHAPES } from "./probes";
import { writeRows } from "./writer";
import { readWritten } from "./written";
import { simulate } from "./passes";
import { stackedTurns } from "./rules";

/**
 * Stage F2: short rows on sloped edges (PLAN.md §5, "the fused plan"). Every
 * pattern built is written out, read back as a knitter would, and checked cell
 * by cell against the drawing and against the rules.
 */

/** Nested peaks, one inside the next, each stepping a stitch per ridge: the
 *  drawing that started F2. Peaks [a, b] are counted from the left edge. */
function nested(width: number, height: number, peaks: [string, number, number][]): string {
  const rise = (a: number, b: number, x: number) => (x < a || x > b ? 0 : Math.min(x - a, b - x) + 1);
  const lines: string[] = [];
  for (let k = height - 1; k >= 0; k--) {
    let line = "";
    for (let x = 0; x < width; x++) line += peaks.find(([, a, b]) => k < rise(a, b, x))?.[0] ?? "A";
    lines.push(line);
  }
  return lines.join("\n");
}

const TRIANGLES = nested(16, 8, [
  ["D", 5, 10],
  ["C", 3, 12],
  ["B", 1, 14],
]);

function check(text: string) {
  const { grid, problems } = parseGrid(text);
  expect(problems).toEqual([]);
  const built = knitShortRows(grid!);
  return { grid: grid!, built };
}

/** Written, read back, and compared with the drawing, stitch by stitch. */
function expectKnitsAsDrawn(grid: Grid, built: ReturnType<typeof knitShortRows>) {
  expect(built.problems).toEqual([]);
  const out = writeRows(built.passes, grid.width, "RS");
  expect(out.problems).toEqual([]);
  const read = readWritten(out.text, grid.width);
  expect(read.problems).toEqual([]);

  const fabric = simulate(grid.width, read.passes);
  expect(fabric.problems).toEqual([]);
  expect(fabric.balanced).toBe(true);
  for (let column = 1; column <= grid.width; column++) {
    const expected = grid.cells.flatMap((row) => [row[column - 1], row[column - 1]]);
    const got = fabric.stacks[column - 1].map((strand) => read.strands.find((s) => s.id === strand)!.colour);
    expect(got, `column ${column}`).toEqual(expected);
  }
  expect(stackedTurns(fabric, read.passes, read.info.map((i) => i.endsInTurn))).toEqual([]);
  expect(read.strands.length).toBe(built.strands.length);
  return { read, out };
}

describe("your three nested triangles", () => {
  it("knits with short rows, as drawn", () => {
    const { grid, built } = check(TRIANGLES);
    expectKnitsAsDrawn(grid, built);
  });

  it("takes one ball per colour", () => {
    const { built } = check(TRIANGLES);
    expect(built.strands.map((s) => s.colour).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("builds each slope from turns, one stitch further in each time", () => {
    // Green, the innermost: in, then a zigzag — out to the far end and back to
    // one short of the start, alternating — and home.
    const { built } = check(TRIANGLES);
    const green = built.passes.filter((p) => p.yarn === "D");
    expect(green).toEqual([
      { yarn: "D", from: 6, to: 11 },
      { yarn: "D", from: 11, to: 7 },
      { yarn: "D", from: 7, to: 10 },
      { yarn: "D", from: 10, to: 8 },
      { yarn: "D", from: 8, to: 9 },
      { yarn: "D", from: 9, to: 6 },
    ]);
  });

  it("knits each colour inside the one around it", () => {
    // Purple hands over to orange, orange to green; green comes home first.
    const { built } = check(TRIANGLES);
    const order = built.passes.map((p) => p.yarn).filter((y, i, all) => all.indexOf(y) === i);
    expect(order).toEqual(["A", "B", "C", "D"]);
    const lastOf = (y: string) => built.passes.map((p) => p.yarn).lastIndexOf(y);
    expect(lastOf("D")).toBeLessThan(lastOf("C"));
    expect(lastOf("C")).toBeLessThan(lastOf("B"));
  });
});

describe("other peaks", () => {
  it("a peak reaching the top", () => {
    // The peak cuts the background in two, all the way up: the left-hand part
    // needs its own ball, knitted inside the peak's trip once the peak's left
    // slope is done underneath it.
    const { grid, built } = check(nested(12, 4, [["B", 2, 9]]));
    expectKnitsAsDrawn(grid, built);
    expect(built.strands.map((s) => s.id)).toEqual(["A", "B", "A2"]);
  });

  it("a peak standing on background rows, reaching the top", () => {
    // Lines are written top first, so these plain ridges go underneath.
    const plain = "A".repeat(12);
    const text = [nested(12, 4, [["B", 2, 9]]), plain, plain].join("\n");
    const { grid, built } = check(text);
    expectKnitsAsDrawn(grid, built);
    expect(built.strands.length).toBe(3);
  });

  it("a peak floating in the background", () => {
    // Background all round: one ball of it is enough, crossing over the top
    // of the peak to catch up the far side.
    const plain = "A".repeat(12);
    const text = [plain, plain, nested(12, 4, [["B", 2, 9]]), plain, plain].join("\n");
    const { grid, built } = check(text);
    expectKnitsAsDrawn(grid, built);
    expect(built.strands.length).toBe(2);
  });

  it("a wide peak with a flat top", () => {
    const { grid, built } = check(`AAAAAAAAAAAA
AAAABBBBAAAA
AAABBBBBBAAA
AABBBBBBBBAA`);
    expectKnitsAsDrawn(grid, built);
  });
});

describe("the probes", () => {
  // Every probe knits as drawn — short rows on the slopes, hand-overs on the
  // vertical edges — except the lens, whose turns crowd: it needs rounding
  // first (below), and must say so rather than build something wrong.
  for (const probe of PROBES) {
    it(`${probe.id} ${probe.name}`, () => {
      const { grid, built } = check(probe.grid);
      if (probe.id === "P7") {
        expect(built.passes).toEqual([]);
        expect(built.stuck).toBeDefined();
      } else {
        expectKnitsAsDrawn(grid, built);
      }
    });
  }

  it("never takes more balls than intarsia alone, except the circle", () => {
    // The circle takes one more for now: a piece of background beside its
    // short vertical sides gets its own ball. Worth improving.
    for (const probe of PROBES) {
      if (probe.id === "P7") continue;
      const { grid, built } = check(probe.grid);
      const extra = probe.id === "P8" ? 1 : 0;
      expect(built.strands.length, probe.id).toBeLessThanOrEqual(knitIntarsia(grid).strands.length + extra);
    }
  });
});

describe("the shapes this app is for: the baseline before units (PLAN.md §6)", () => {
  // Today's builder, as it stands on 2026-10-31: these knit as drawn; the rest
  // must say where they're stuck rather than build something wrong. Units are
  // meant to move shapes from the second list to the first.
  const KNIT = ["S1", "S2", "S3", "S4", "S6", "S8", "S9", "S10", "S12", "S14", "S17"];
  for (const shape of SHAPES) {
    it(`${shape.id} ${shape.name}`, () => {
      const { grid, built } = check(shape.grid);
      if (KNIT.includes(shape.id)) expectKnitsAsDrawn(grid, built);
      else expect(built.passes).toEqual([]);
    });
  }
});

describe("rounding, where turns would crowd (PLAN.md §8, L13)", () => {
  it("rounds the lens a few stitches, and the rounding knits", () => {
    const { grid } = check(PROBES.find((p) => p.id === "P7")!.grid);
    const rounded = roundForShortRows(grid);
    expect(rounded).not.toBeNull();
    expect(rounded!.changed.length).toBeLessThanOrEqual(4);
    expectKnitsAsDrawn(rounded!.grid, rounded!.built);
    // Each change is one stitch, at the edge of the lens.
    for (const c of rounded!.changed) expect(grid.cells[c.ridge][c.column - 1]).toBe(c.from);
  });

  it("changes nothing in a drawing that already knits", () => {
    const { grid } = check(TRIANGLES);
    expect(roundForShortRows(grid)!.changed).toEqual([]);
  });
});

describe("steep diagonals: you choose (PLAN.md §8, L12)", () => {
  it("finds the steep diagonal, and nothing else among the probes", () => {
    const steep = PROBES.filter((p) => steepEdges(check(p.grid).grid).length > 0).map((p) => p.id);
    expect(steep).toEqual(["P4"]);
  });

  it("knits it either way: snapped to vertical as drawn, or rounded to a stitch per ridge", () => {
    const { grid, built } = check(PROBES.find((p) => p.id === "P4")!.grid);
    expectKnitsAsDrawn(grid, built);

    const rounded = roundSteep(grid);
    expect(rounded.changed.length).toBeGreaterThan(0);
    expect(steepEdges(rounded.grid)).toEqual([]);
    expectKnitsAsDrawn(rounded.grid, knitShortRows(rounded.grid));
    // The rounded edge moves exactly a stitch every ridge.
    const lastB = rounded.grid.cells.map((row) => row.lastIndexOf("B") + 1);
    for (let r = 1; r < lastB.length; r++) expect(Math.abs(lastB[r] - lastB[r - 1])).toBe(1);
  });
});

describe("your blob with two colours inside (2026-10-25)", () => {
  // Green round purple on blue, the green with short vertical tips, and a wavy
  // band of green under the blue — thick at both ends, with a bump one stitch
  // wide at one of them.
  const BLOB = [
    "AAAAAAAAAAAAAAAAA",
    "AAAAAAAAAAAAAAAAA",
    "AAAAAAAAAAAAAAAAA",
    "AAAAAACCCCCCAAAAA",
    "AAAACCCFFFFCCAAAA",
    "AACCCFFFFFFFCCCAA",
    "ACCFFFFFFFFFFFCCA",
    "ACCCCEEEEEEEECCCA",
    "AACCCCEEEECCCCCAA",
    "AAAACCCCCCCAAAAAA",
    "AAAAAAAAAAAAAAAAA",
  ];

  it("knits as a plain green blob — grey filled up beside its tips first", () => {
    const { grid, built } = check(BLOB.map((r) => r.replace(/[EF]/g, "C")).join("\n"));
    expectKnitsAsDrawn(grid, built);
  });

  it("says where it's stuck: the one-stitch bump of green under the blue", () => {
    const { built } = check(BLOB.join("\n"));
    expect(built.stuck).toEqual({ column: 7, ridge: 2, colour: "C" });
  });

  it("knits once that bump is rounded", () => {
    const { grid } = check(BLOB.join("\n"));
    const rounded = roundForShortRows(grid)!;
    expect(rounded.changed.length).toBeLessThanOrEqual(2);
    expectKnitsAsDrawn(rounded.grid, rounded.built);
  });
});

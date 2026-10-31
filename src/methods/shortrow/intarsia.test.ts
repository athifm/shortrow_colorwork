import { describe, it, expect } from "vitest";
import { knitIntarsia } from "./intarsia";
import { parseGrid } from "./grid";
import { PROBES } from "./probes";
import { writeRows } from "./writer";
import { readWritten } from "./written";
import { simulate } from "./passes";
import { stackedTurns } from "./rules";

/**
 * The claim LIMITS.md asked Stage F to prove: any grid of whole ridges can be
 * knitted, given enough intarsia. Every probe is knitted, written out as rows,
 * read back as a knitter would, and the fabric checked cell by cell against the
 * drawing — and against the rules of PLAN.md §9.
 */

describe("every probe knits with intarsia alone", () => {
  for (const probe of PROBES) {
    it(`${probe.id} ${probe.name}`, () => {
      const { grid, problems } = parseGrid(probe.grid);
      expect(problems).toEqual([]);
      const knitted = knitIntarsia(grid!);

      // Written out and read back, the passes are the same knitting.
      const out = writeRows(knitted.passes, grid!.width, "RS");
      expect(out.problems).toEqual([]);
      const read = readWritten(out.text, grid!.width);
      expect(read.problems).toEqual([]);

      // Every stitch has exactly the colours drawn: two rows per ridge.
      const fabric = simulate(grid!.width, read.passes);
      expect(fabric.problems).toEqual([]);
      expect(fabric.balanced).toBe(true);
      for (let column = 1; column <= grid!.width; column++) {
        const expected = grid!.cells.flatMap((row) => [row[column - 1], row[column - 1]]);
        const got = fabric.stacks[column - 1].map((strand) => read.strands.find((s) => s.id === strand)!.colour);
        expect(got, `column ${column}`).toEqual(expected);
      }

      // Rule 1: no turns at all, so none stacked.
      expect(stackedTurns(fabric, read.passes, read.info.map((i) => i.endsInTurn))).toEqual([]);
      // Rule 3: every trip out and back — so the reader counts the same balls.
      expect(read.strands.length).toBe(knitted.strands.length);
    });
  }
});

describe("the price in yarn", () => {
  const ends = (id: string) => knitIntarsia(parseGrid(PROBES.find((p) => p.id === id)!.grid).grid!).ends;

  it("is three balls for a band from the edge", () => {
    // B from the right edge, then background beyond it on the left — but the
    // background's ball waits at the right edge, so the left needs a second
    // ball of A. The book's Short Stripes does it with two, by catching up the
    // left with short rows instead: what F2 should match.
    expect(ends("P2")).toBe(6);
  });

  it("is two more balls for each extra island", () => {
    // An island needs its own ball, and splits the background: the far side of
    // it needs another ball of background too.
    expect(ends("P9")).toBe(ends("P6") + 4);
  });

  it("stays at one ball each on a diagonal, thanks to short carries", () => {
    // Each ridge the edge moves a stitch. Without carries that meant a new ball
    // of background every ridge (six in all); carrying the yarn a stitch across
    // the back keeps it to one ball of each colour, like a straight edge.
    expect(ends("P3")).toBe(ends("P5"));
  });

  it("carries no further than two stitches", () => {
    // The bands of P2 sit far from any waiting background yarn: a new ball.
    const knitted = knitIntarsia(parseGrid(PROBES.find((p) => p.id === "P2")!.grid).grid!);
    const fabric = simulate(14, knitted.passes);
    expect(fabric.carries.every((c) => c.distance <= 2)).toBe(true);
  });
});

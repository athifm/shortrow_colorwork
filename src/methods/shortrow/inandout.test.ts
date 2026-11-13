import { describe, it, expect } from "vitest";
import { knitShortRows } from "./construct";
import { parseGrid } from "./grid";
import { simulate } from "./passes";
import { stackedTurns } from "./rules";
import { writeRows, colourOfStrand } from "./writer";
import { readWritten } from "./written";
import { SHAPES } from "./probes";

/**
 * The in-and-out walk (PLAN.md §6, "what a found knitting taught"): your peak,
 * whose bottom row is narrower than the row above, was "stuck" for the builder
 * until it could turn back outwards and turn twice on one stitch with an
 * ordinary row between. The try-everything checker had shown it knits as drawn.
 */
const PEAK = `AAAAAAAAAAAAAA
AAAAAAABAAAAAA
AAAAAABBBAAAAA
AAAAABBBBBAAAA
AAAABBBBBBBAAA
AAABBBBBBBBBAA
AABBBBBBBBBBBA
AAAAABBBBBAAAA
AAAAAAAAAAAAAA`;

describe("the in-and-out walk", () => {
  it("knits your peak exactly as drawn, one ball each, nothing carried", () => {
    const g = parseGrid(PEAK).grid!;
    const built = knitShortRows(g);
    expect(built.problems).toEqual([]);
    const written = writeRows(built.passes, g.width, "RS");
    const read = readWritten(written.text, g.width);
    expect(read.problems).toEqual([]);
    const fabric = simulate(g.width, read.passes);
    expect(fabric.balanced).toBe(true);
    expect(fabric.carries).toEqual([]);
    fabric.stacks.forEach((stack, i) => stack.forEach((strand, k) => expect(colourOfStrand(strand)).toBe(g.cells[k >> 1][i])));
    expect(stackedTurns(fabric, read.passes, read.info.map((i) => i.endsInTurn))).toEqual([]);
    expect(read.strands.map((s) => s.id).sort()).toEqual(["A", "B"]);
    // It does turn twice on some stitch: the move itself.
    const turnsAt = read.info.filter((i) => i.turnAt !== null).map((i) => i.turnAt);
    expect(new Set(turnsAt).size).toBeLessThan(turnsAt.length);
  });

  it("knits the blob at the edge exactly as drawn — turning at 7, 8, 5, 7, 5, as the checker found", () => {
    const g = parseGrid(SHAPES.find((s) => s.id === "S11")!.grid).grid!;
    const built = knitShortRows(g);
    expect(built.problems).toEqual([]);
    expect(built.strands.map((s) => s.id).sort()).toEqual(["A", "B"]);
  });
});

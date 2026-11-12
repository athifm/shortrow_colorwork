import { describe, it, expect } from "vitest";
import { canKnit } from "./oracle";
import { parseGrid } from "./grid";
import { simulate } from "./passes";
import { stackedTurns } from "./rules";
import { writeRows, colourOfStrand } from "./writer";
import { readWritten } from "./written";
import { EDGES } from "./probes";

/**
 * The try-everything checker (PLAN.md §6), and what it has settled about the
 * edges of short-row knitting: for each edge probe, the least a yarn must be
 * carried for it to be knitted with one ball to each colour.
 */
describe("the try-everything checker, on the edge probes", () => {
  for (const probe of EDGES) {
    it(`${probe.id} ${probe.name}: ${probe.carry === 0 ? "the book's way" : `only with the yarn carried ${probe.carry}`}`, () => {
      const g = parseGrid(probe.grid).grid!;
      const found = canKnit(g, { maxStates: 1_500_000 });
      expect(found.answer).toBe("yes");
      // Every shorter carry was ruled out for certain, not merely not found.
      expect(found.carryCertain).toBe(true);
      expect(found.carry).toBe(probe.carry);

      // And the knitting it found holds up under the app's own rules.
      const written = writeRows(found.passes!, g.width, "RS");
      expect(written.problems).toEqual([]);
      const read = readWritten(written.text, g.width);
      expect(read.problems).toEqual([]);
      const fabric = simulate(g.width, read.passes);
      expect(fabric.problems).toEqual([]);
      expect(fabric.balanced).toBe(true);
      fabric.stacks.forEach((stack, i) => stack.forEach((strand, k) => expect(colourOfStrand(strand)).toBe(g.cells[k >> 1][i])));
      expect(stackedTurns(fabric, read.passes, read.info.map((i) => i.endsInTurn))).toEqual([]);
      // One ball to each colour.
      expect(new Set(read.strands.map((s) => s.id)).size).toBe(new Set(g.cells.flat()).size);
    });
  }
});

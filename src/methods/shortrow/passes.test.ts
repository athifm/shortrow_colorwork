import { describe, it, expect } from "vitest";
import { simulate, type Pass } from "./passes";

/**
 * Patterns here are small ones invented for the tests, not the textbook's. The
 * book's own patterns are checked privately in research/ — committing them row by
 * row would be republishing them (PLAN.md §7).
 *
 * The shape is the textbook's, though: a background yarn A, a motif yarn B that
 * works a short stripe from the right edge and turns, and a catch-up short row in
 * A at the left edge so every stitch ends level.
 */

// Ten stitches. B stripe of 7, so A's catch-up covers the other 3 (10 − 7).
const stripe: Pass[] = [
  { yarn: "A", from: 10, to: 1 }, // full row
  { yarn: "B", from: 1, to: 7 }, // stripe out, turn
  { yarn: "B", from: 7, to: 1 }, // and back
  { yarn: "A", from: 1, to: 10 }, // full row
  { yarn: "A", from: 10, to: 8 }, // catch-up short row, turn
  { yarn: "A", from: 8, to: 10 }, // and back
  { yarn: "A", from: 10, to: 1 }, // full row
  { yarn: "A", from: 1, to: 10 }, // full row
];

describe("a balanced stripe", () => {
  const fabric = simulate(10, stripe);

  it("brings every stitch to the same height", () => {
    expect(fabric.heights).toEqual(Array(10).fill(6));
    expect(fabric.balanced).toBe(true);
  });

  it("reports no problems", () => {
    expect(fabric.problems).toEqual([]);
  });

  it("puts the stripe in the wales it covers, and only those", () => {
    // Column 3 is under the stripe; column 9 is under the catch-up.
    expect(fabric.stacks[3 - 1]).toEqual(["A", "B", "B", "A", "A", "A"]);
    expect(fabric.stacks[9 - 1]).toEqual(["A", "A", "A", "A", "A", "A"]);
  });

  it("records which pass made each row of each stitch", () => {
    // Column 3, bottom to top: passes 1, 2, 3, 4, 7, 8 — counted from 0 here.
    expect(fabric.madeBy[3 - 1]).toEqual([0, 1, 2, 3, 6, 7]);
  });

  it("counts the turning stitch in both passes either side of the turn", () => {
    // Column 7 is where B turns. With a German short row it becomes a double
    // stitch that fills the return row too — the working assumption (PLAN.md
    // §2.4) under which the textbook's patterns balance.
    expect(fabric.stacks[7 - 1]).toEqual(["A", "B", "B", "A", "A", "A"]);
  });
});

describe("a stripe missing its catch-up row", () => {
  // The mistake in the textbook's photo 6: skip the balancing short row and the
  // edge it should have filled pulls up.
  const fabric = simulate(10, [...stripe.slice(0, 4), ...stripe.slice(6)]);

  it("is reported unbalanced", () => {
    expect(fabric.balanced).toBe(false);
  });

  it("leaves exactly the uncaught stitches short", () => {
    expect(fabric.heights).toEqual([6, 6, 6, 6, 6, 6, 6, 4, 4, 4]);
  });

  it("is not a rule violation — just an unbalanced fabric", () => {
    // Every pass here is individually legal. Balance is a property of the whole
    // repeat, so it lives in `balanced`, not in `problems`.
    expect(fabric.problems).toEqual([]);
  });
});

describe("yarns wait where they stopped", () => {
  it("objects to a pass that starts somewhere its yarn isn't", () => {
    const fabric = simulate(10, [
      { yarn: "B", from: 1, to: 7 },
      { yarn: "B", from: 5, to: 1 }, // B is at 7, not 5
    ]);
    expect(fabric.problems).toHaveLength(1);
    expect(fabric.problems[0].pass).toBe(2);
    expect(fabric.problems[0].message).toMatch(/waiting at column 7/);
  });

  it("lets a yarn's first pass start anywhere, since it's only just joined", () => {
    const fabric = simulate(10, [{ yarn: "B", from: 4, to: 6 }]);
    expect(fabric.problems).toEqual([]);
  });

  it("keeps each yarn's position separate", () => {
    // A and B alternate; each must pick up where *it* left off, regardless of
    // what the other has done in between.
    const fabric = simulate(10, [
      { yarn: "A", from: 10, to: 1 },
      { yarn: "B", from: 1, to: 5 },
      { yarn: "A", from: 1, to: 10 },
      { yarn: "B", from: 5, to: 1 },
    ]);
    expect(fabric.problems).toEqual([]);
  });

  it("still works the misplaced pass, so the rest of the fabric can be seen", () => {
    const fabric = simulate(10, [
      { yarn: "B", from: 1, to: 7 },
      { yarn: "B", from: 5, to: 1 },
    ]);
    expect(fabric.heights.slice(0, 5)).toEqual([2, 2, 2, 2, 2]);
  });
});

describe("passes that run off the needle", () => {
  const fabric = simulate(10, [
    { yarn: "A", from: 10, to: 1 },
    { yarn: "B", from: 1, to: 11 },
  ]);

  it("are reported", () => {
    expect(fabric.problems).toHaveLength(1);
    expect(fabric.problems[0].pass).toBe(2);
  });

  it("are skipped rather than half-worked", () => {
    expect(fabric.heights).toEqual(Array(10).fill(1));
  });
});

describe("several passes in one written row", () => {
  it("builds up a zigzag of shrinking turns in one yarn", () => {
    // Like "K6, SR, K4, SR, K2, SR" — each leg its own pass, each starting where
    // the last one turned. The middle of the run is worked most.
    const fabric = simulate(8, [
      { yarn: "B", from: 1, to: 6 },
      { yarn: "B", from: 6, to: 3 },
      { yarn: "B", from: 3, to: 4 },
    ]);
    expect(fabric.problems).toEqual([]);
    expect(fabric.heights).toEqual([1, 1, 3, 3, 2, 2, 0, 0]);
  });
});

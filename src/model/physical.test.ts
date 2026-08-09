import { describe, it, expect } from "vitest";
import {
  MODEL,
  flarePerShortRowPair,
  edgeStitchesPerJoinRow,
  type Gauge,
} from "./physical";

const gauge: Gauge = { stitchWidthMm: 4.5, rowHeightMm: 3.3 };

/**
 * These tests are mostly not about arithmetic. They are about keeping the file
 * honest: every guess declared, every value traceable to something, and nothing
 * quietly promoted to "measured" without a test piece behind it.
 */
describe("the model's bookkeeping", () => {
  it("gives every relation a unique id", () => {
    const ids = MODEL.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("makes every relation say what would settle it", () => {
    for (const r of MODEL) {
      expect(r.settledBy, `${r.id} does not say what would settle it`).not.toBe("");
      expect(r.source, `${r.id} does not say where its value came from`).not.toBe("");
      expect(r.describes, `${r.id} does not describe itself`).not.toBe("");
    }
  });

  it("does not let a value claim to be measured without naming the test piece", () => {
    // "Fitted from the M1 wedge" is a source. "Seems about right" is not. The
    // check is deliberately crude — it only has to catch the confidence being
    // raised without the source being updated to match.
    for (const r of MODEL.filter((r) => r.confidence === "measured")) {
      expect(
        /M\d+|wedge|swatch|piece/i.test(r.source),
        `${r.id} claims to be measured but its source names no test piece`,
      ).toBe(true);
    }
  });

  it("does not let a value claim to be documented without naming a source", () => {
    // Same idea, one tier down (PLAN.md §2.5): a "documented" value should
    // point at a citation id from research/observations.md, not just assert
    // that one exists.
    for (const r of MODEL.filter((r) => r.confidence === "documented")) {
      expect(
        /research\/observations|https?:\/\//i.test(r.source),
        `${r.id} claims to be documented but its source names no citation`,
      ).toBe(true);
    }
  });

  it("keeps everything ours until we know enough to hand it over", () => {
    // Not a law — the categories are expected to move as the model settles, and
    // when one does, this test is what makes us notice and think about it rather
    // than let it slip through. See PLAN.md §2.4.
    for (const r of MODEL) {
      expect(r.category, `${r.id} changed category — was that deliberate?`).toBe("ours");
    }
  });

  it("freezes relations, so nothing can be tuned at runtime", () => {
    expect(Object.isFrozen(flarePerShortRowPair)).toBe(true);
  });
});

describe("flare per short-row pair", () => {
  // The *form* of this relation is a guess (PLAN.md §2.4), so there is little
  // point asserting particular angles. What is worth pinning down is the
  // behaviour any replacement should still have — if a future version breaks one
  // of these, it is far more likely to be a bug than a discovery.

  it("opens less as the wedge spans more stitches", () => {
    const narrow = flarePerShortRowPair.compute({
      spanStitches: 10,
      gauge,
      technique: "german",
    });
    const wide = flarePerShortRowPair.compute({
      spanStitches: 40,
      gauge,
      technique: "german",
    });
    expect(wide).toBeLessThan(narrow);
  });

  it("opens more when the rows are taller", () => {
    const short = flarePerShortRowPair.compute({
      spanStitches: 20,
      gauge,
      technique: "german",
    });
    const tall = flarePerShortRowPair.compute({
      spanStitches: 20,
      gauge: { ...gauge, rowHeightMm: gauge.rowHeightMm * 2 },
      technique: "german",
    });
    expect(tall).toBeGreaterThan(short);
  });

  it("always opens by something", () => {
    for (const spanStitches of [1, 5, 20, 100, 500]) {
      expect(
        flarePerShortRowPair.compute({ spanStitches, gauge, technique: "german" }),
      ).toBeGreaterThan(0);
    }
  });
});

describe("joining", () => {
  it("eats a whole number of edge stitches", () => {
    const eaten = edgeStitchesPerJoinRow.compute({ technique: "german" });
    expect(Number.isInteger(eaten)).toBe(true);
    expect(eaten).toBeGreaterThanOrEqual(0);
  });
});

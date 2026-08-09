/**
 * Everything we are guessing about how the fabric behaves.
 *
 * The rules of knitting — a row is a contiguous run, a stitch needs a parent,
 * stitches never reorder — are combinatorial and live in `methods/shortrow`.
 * They are certain. Nothing in *this* file is. Every entry below is a claim
 * about yarn that only knitting can settle, and several are guesses at the
 * *shape* of a relation rather than at a number inside one.
 *
 * Three rules govern this file, and they exist because of how little we know:
 *
 *  1. Nothing here is ever shown to a user in the normal flow. Working the model
 *     out is our job. What reaches a knitter is gauge, colours, a picture, a
 *     shape — the things any pattern asks for.
 *
 *  2. Every quantity is a *relation*, not a coefficient. When a test piece shows
 *     that flare depends on something this file does not currently mention, we
 *     replace the function and no caller changes.
 *
 *  3. A quantity's `category` is data. When we finally understand the model,
 *     some of these will turn out to be ordinary parameters — supplied by the
 *     user, or falling out of their gauge. Moving one is editing a field here,
 *     never a refactor anywhere else.
 *
 * Callers — especially the planner — must never inline a number that belongs in
 * this file. There is a test that enforces it, because this rule dies the first
 * time somebody hardcodes a 0.7 at eleven at night.
 *
 * Units are millimetres and radians throughout. Conversion for display is the
 * UI's problem, not the model's.
 */

/** Bumped whenever a relation changes shape. Stamped into every project file so
 *  that improving the model cannot silently alter a pattern somebody is halfway
 *  through knitting. */
export const MODEL_VERSION = 1;

/**
 * Where a quantity comes from — and the whole point of this file is that these
 * assignments are provisional. Today almost everything is `ours`, because we do
 * not yet know enough to hand any of it over.
 */
export type Category =
  /** We determine it once, ship the answer, and never mention it again. */
  | "ours"
  /** Falls out of the user's gauge without them being asked anything extra. */
  | "fromGauge"
  /** Genuinely varies, so the user supplies it — in a pattern's own language. */
  | "fromUser";

/**
 * How much the value deserves to be trusted. Recorded because a number fitted
 * from a measured wedge and a number invented while writing the plan should not
 * look alike in the source.
 */
export type Confidence =
  /** Fitted from something knitted and measured by us, under our own gauge and
   *  conditions. The strongest tier there is. */
  | "measured"
  /** Pulled from a real, published, working example somebody else made —
   *  a pattern photo, a paused video frame. Real evidence, but softer than
   *  `measured`: their gauge and conditions were never ours to control, and the
   *  extraction (counting stitches off a photo) has its own error. See
   *  PLAN.md §2.5 and research/observations.md, which is where the citation in
   *  `source` should point. */
  | "documented"
  /** Reasoned from geometry, never checked against anything real. */
  | "derived"
  /** A placeholder. Written down so it is visible, not because it is right. */
  | "invented";

export interface Provenance {
  category: Category;
  confidence: Confidence;
  /** Which test piece produced it, or how it was arrived at. */
  source: string;
  /** ISO date the value last changed. */
  since: string;
  /** What would settle it — the next measurement worth taking. */
  settledBy: string;
}

export interface Relation<In, Out> extends Provenance {
  /** Stable identifier, used by the dev pages and the tests. */
  readonly id: string;
  /** One line, in plain English, for the workbench to display. */
  readonly describes: string;
  readonly compute: (input: In) => Out;
}

function relation<In, Out>(r: Relation<In, Out>): Relation<In, Out> {
  return Object.freeze(r);
}

/** The knitter's own gauge, measured from an ordinary swatch. The one thing in
 *  this whole area that a knitter already understands and already measures. */
export interface Gauge {
  /** Width of one stitch, millimetres. */
  stitchWidthMm: number;
  /** Height of one row, millimetres. */
  rowHeightMm: number;
}

/** Which technique closes the gap left at a turn. A user choice — it changes the
 *  wording of the instructions, and quite possibly the geometry too, which is
 *  why the relations below accept it even though none of them yet use it. */
export type TurnTechnique = "german" | "wrapAndTurn" | "shadowWrap";

export interface WedgeInput {
  /** How many stitches the short-row pair spans. */
  spanStitches: number;
  gauge: Gauge;
  technique: TurnTechnique;
}

/**
 * How far the fabric opens for each short-row pair, in radians.
 *
 * Reasoning behind the current form: a pair adds two rows of height, `2h`, to a
 * span of `s` stitches of width `w`, and adds nothing to the fabric beside it.
 * Treating that as a wedge of arc length `2h` at radius `s·w` gives the angle.
 *
 * Every part of that is suspect. It assumes the extra height is taken up evenly
 * across the span, that the turn itself adds no height, and that the technique
 * makes no difference. A single knitted wedge will probably contradict at least
 * one of those, and the fix will be to replace this function outright rather
 * than to adjust a number inside it.
 */
export const flarePerShortRowPair = relation<WedgeInput, number>({
  id: "flarePerShortRowPair",
  describes: "Angle the fabric opens for one short-row pair, in radians",
  category: "ours",
  confidence: "derived",
  source: "Geometry, reasoned while writing PLAN.md §2.2. Never knitted.",
  since: "2026-08-09",
  settledBy:
    "M1: one wedge of known span and pair count. Measure the angle between its two straight edges.",
  compute({ spanStitches, gauge }) {
    return (2 * gauge.rowHeightMm) / (spanStitches * gauge.stitchWidthMm);
  },
});

/**
 * Row height in the rows immediately at a turn.
 *
 * Currently claims turns change nothing, which is almost certainly false — a
 * double stitch worked together is not the same height as its neighbours, and
 * the fabric is under different tension there. Stated as an explicit relation
 * rather than left out, so that when M1 shows a wedge's two edges disagreeing
 * with the prediction, there is somewhere obvious for the correction to go.
 */
export const rowHeightNearTurn = relation<
  { gauge: Gauge; technique: TurnTechnique },
  number
>({
  id: "rowHeightNearTurn",
  describes: "Height of a row at a turn, millimetres",
  category: "ours",
  confidence: "invented",
  source: "Assumed identical to ordinary row height. No basis whatsoever.",
  since: "2026-08-09",
  settledBy:
    "M1: compare the wedge's short edge against the row count that produced it.",
  compute({ gauge }) {
    return gauge.rowHeightMm;
  },
});

/**
 * The steepest a boundary between two wedges may get before the join gapes,
 * expressed as stitches stepped per short-row pair.
 *
 * We have no hypothesis at all here — three is a number chosen so that the
 * planner has something to run against, and for no better reason. This is the
 * single least trustworthy value in the file, and §2.5 of PLAN.md explains why
 * the join is the part of the model most likely to be wrong.
 */
export const steepestJoinStep = relation<
  { gauge: Gauge; technique: TurnTechnique },
  number
>({
  id: "steepestJoinStep",
  describes: "Largest stitch step per short-row pair a join can absorb",
  category: "ours",
  confidence: "invented",
  source: "A placeholder. Chosen so the planner has a bound, not because it is right.",
  since: "2026-08-09",
  settledBy:
    "M2: two joined wedges with the step increasing along the boundary. Note where it starts to gape.",
  compute() {
    return 3;
  },
});

/**
 * How many of a neighbour's edge stitches one row of joining consumes.
 *
 * Matters more than it sounds: get it wrong and every region comes out a stitch
 * narrow, which compounds across a piece with many regions.
 */
export const edgeStitchesPerJoinRow = relation<{ technique: TurnTechnique }, number>({
  id: "edgeStitchesPerJoinRow",
  describes: "Neighbour edge stitches eaten by one joined row",
  category: "ours",
  confidence: "derived",
  source: "One per row, from how the join is worked. Plausible, untested.",
  since: "2026-08-09",
  settledBy: "M2: count the neighbour's remaining edge stitches after joining.",
  compute() {
    return 1;
  },
});

/**
 * Above this residual energy, after the mesh relaxation has converged, the piece
 * will not lie flat and the app should say so.
 *
 * Both the threshold and the idea that residual energy is the right measure of
 * flatness are untested. The number is meaningless until the relaxation solver
 * exists at M10 and has been compared against pieces that did and did not lie
 * flat in reality.
 */
export const flatnessThreshold = relation<Record<string, never>, number>({
  id: "flatnessThreshold",
  describes: "Residual relaxation energy above which a piece will not lie flat",
  category: "ours",
  confidence: "invented",
  source: "No basis. The measure itself is unverified, not merely the threshold.",
  since: "2026-08-09",
  settledBy:
    "M10: relax several pieces whose real behaviour is known, and find where the boundary actually falls.",
  compute() {
    return 0.05;
  },
});

/**
 * Everything above, in one list.
 *
 * The workbench renders this, and the tests walk it — so a relation added
 * without provenance, or a value quietly promoted to `measured` without a source
 * to point at, gets caught rather than merely regretted.
 */
export const MODEL: readonly Relation<never, unknown>[] = Object.freeze([
  flarePerShortRowPair,
  rowHeightNearTurn,
  steepestJoinStep,
  edgeStitchesPerJoinRow,
  flatnessThreshold,
] as unknown as Relation<never, unknown>[]);

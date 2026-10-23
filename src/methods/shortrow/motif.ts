/**
 * Designing a pattern: one motif on a background (PLAN.md §9, Stage C).
 *
 * The first step from "what I want" to "how to knit it". You describe a motif;
 * this writes the whole repeat — base rows, the motif, the catch-ups — as
 * passes, which the writer turns into rows.
 *
 * The motif is built the way the textbook builds Shoal's fish. The motif yarn
 * starts at `start` and works a zigzag of turns in two staircases going in, then
 * two coming back out:
 *
 *   going in    left turns  18, 16, 14     right turns  7,  9, 11
 *   coming out  left turns  15, 17, 19     right turns 10,  8
 *   then home to 5
 *
 * The coming-out turns sit one stitch off the going-in ones, so no turn ever
 * lands on another (rule 1) — which is also why the step must be at least two:
 * with one-stitch steps there is no gap for them to sit in. With no steps at all
 * the motif is a stripe: out, turn, home.
 *
 * Around it, the background yarn keeps the rules of §9. It knits up to the motif
 * and hands over mid-row, takes back over when the motif yarn comes home, and
 * every trip ends where it began (rule 3) — so the repeat starts again exactly
 * where it started, and the motif yarn waits at `start` for the next repeat.
 *
 * The layout, one repeat:
 *
 *   1. `rowsBelow` full background rows (an odd number, ending at the right edge);
 *   2. catch-ups, if they come before the motif — shaping the bed it sits on;
 *   3. the motif, in two written rows;
 *   4. catch-ups, if they come after;
 *   5. `rowsAbove` full background rows (an odd number, ending at the left edge,
 *      where the repeat begins again).
 */
import { simulate, type Column, type Pass, type Yarn } from "./passes";
import { fill, levelOut, type CatchUpOptions } from "./balance";
import { stackedTurns, turnsOf } from "./rules";

export interface MotifDesign {
  stitches: number;
  background: Yarn;
  motif: Yarn;
  /** The first stitch of the motif. 1 starts it at the right edge; anything
   *  larger means the background knits up to it and hands over mid-row. */
  start: Column;
  /** How far the motif's first leg reaches, in stitches. */
  width: number;
  /** How many steps the zigzag takes going in. 0 makes a stripe. */
  steps: number;
  /** How many stitches each step moves in. At least 2 when there are steps. */
  step: number;
  /** When the catch-ups are worked, and how. */
  catchUp: { when: "before" | "after" } & Omit<CatchUpOptions, "yarn">;
  /** Full background rows below and above the motif. Odd numbers, so the
   *  background ends each block at the edge where the next part begins. */
  rowsBelow: number;
  rowsAbove: number;
}

export interface Designed {
  passes: Pass[];
  problems: string[];
  notes: string[];
}

/** The motif's own turn columns, in the order the zigzag reaches them. */
export function zigzagTurns(start: Column, width: number, steps: number, step: number): Column[] {
  const leftIn = (k: number) => start + width - 1 - step * k;
  const rightIn = (k: number) => start + step * (k + 1);
  const turns: Column[] = [];
  for (let k = 0; k < steps; k++) turns.push(leftIn(k), rightIn(k));
  if (steps === 0) return [leftIn(0)];
  const innermostLeft = leftIn(steps - 1);
  const innermostRight = rightIn(steps - 1);
  for (let k = 0; k < steps; k++) {
    turns.push(innermostLeft + 1 + step * k);
    if (k < steps - 1) turns.push(innermostRight - 1 - step * k);
  }
  return turns;
}

export function designMotif(d: MotifDesign): Designed {
  const problems: string[] = [];
  const notes: string[] = [];
  const N = d.stitches;

  // What's being asked has to fit.
  if (d.rowsBelow < 1 || d.rowsBelow % 2 === 0) problems.push("Rows below the motif must be an odd number (1, 3, 5…).");
  if (d.rowsAbove < 1 || d.rowsAbove % 2 === 0) problems.push("Rows above the motif must be an odd number (1, 3, 5…).");
  if (d.start < 1 || d.width < 1) problems.push("The motif needs a start column and a width of at least one stitch.");
  if (d.steps > 0 && d.step < 2) {
    problems.push(
      "With steps, each must move at least 2 stitches: the coming-out turns sit between the going-in ones, and with one-stitch steps there's no room — they'd land on top of each other.",
    );
  }
  const turns = zigzagTurns(d.start, d.width, d.steps, d.step);
  const reach = Math.max(...turns);
  if (reach > N) problems.push(`The motif reaches column ${reach}, but there are only ${N} stitches.`);
  if (d.steps > 0) {
    const innermostLeft = turns[2 * (d.steps - 1)];
    const innermostRight = turns[2 * (d.steps - 1) + 1];
    if (innermostRight >= innermostLeft) {
      problems.push(
        `The zigzag closes up before it finishes going in: ${d.steps} steps of ${d.step} need the first leg to be wider than ${d.step * (2 * d.steps - 1) + 1} stitches.`,
      );
    }
  }
  if (problems.length > 0) return { passes: [], problems, notes };

  const right = 1;
  const left = N;
  const A = d.background;
  const B = d.motif;

  // 1. Full background rows, starting at the left edge on a wrong-side row and
  //    ending at the right edge.
  const base: Pass[] = [];
  let at: Column = left;
  for (let r = 0; r < d.rowsBelow; r++) {
    const to = at === left ? right : left;
    base.push({ yarn: A, from: at, to });
    at = to;
  }

  // 3. The motif, as two written rows. The background knits up to it and hands
  //    over; the motif yarn zigzags, comes home, and hands back.
  const motif: Pass[] = [];
  if (d.start > 1) motif.push({ yarn: A, from: right, to: d.start - 1 });
  let needle = d.start;
  for (const turn of turns) {
    motif.push({ yarn: B, from: needle, to: turn });
    needle = turn;
  }
  motif.push({ yarn: B, from: needle, to: d.start });
  if (d.start > 1) motif.push({ yarn: A, from: d.start - 1, to: right });

  // 2 or 4. Catch-ups. Before the motif: work out what the motif will leave
  // short, and add it first, so the motif lands on a shaped bed. After: level
  // what's there once the motif has come home.
  const options: CatchUpOptions = { yarn: A, side: d.catchUp.side, order: d.catchUp.order, step: d.catchUp.step };
  let before: Pass[] = [];
  let after: Pass[] = [];
  if (d.catchUp.when === "before") {
    const heights = simulate(N, motif).heights;
    const tallest = Math.max(...heights);
    const result = fill(N, heights.map((h) => tallest - h), right, options);
    problems.push(...result.problems);
    notes.push(...result.notes);
    before = result.passes;
  } else {
    const result = levelOut(N, [...base, ...motif], options);
    problems.push(...result.problems);
    notes.push(...result.notes);
    after = result.passes;
  }

  // 5. Full rows above, from the right edge, ending at the left — where the
  //    repeat begins again.
  const above: Pass[] = [];
  at = right;
  for (let r = 0; r < d.rowsAbove; r++) {
    const to = at === left ? right : left;
    above.push({ yarn: A, from: at, to });
    at = to;
  }

  const passes = [...base, ...before, ...motif, ...after, ...above];

  const fabric = simulate(N, passes);
  if (!fabric.balanced && problems.length === 0) {
    problems.push("The repeat doesn't come out level — this design needs catch-ups the chosen settings can't give.");
  }
  for (const t of stackedTurns(fabric, passes, turnsOf(passes, N))) {
    problems.push(`Column ${t.column}: two turns land one on the other (passes ${t.passes[0]} and ${t.passes[1]}).`);
  }

  return { passes, problems, notes };
}

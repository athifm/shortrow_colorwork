/**
 * Catch-up rows: levelling the fabric with short-row pairs from the edges
 * (PLAN.md §9, Stage B).
 *
 * After a motif, some columns have fewer rows than others. The background yarn
 * evens them out the way the textbook does: out from an edge, turn, back to the
 * edge — a pair that adds two rows to every column it covers. Each pair reaches
 * a little less far than the one before (or further, depending on the order
 * chosen), so between them they add the most rows near the edge and fewer
 * further in.
 *
 * That only works for some shortfalls, and the solver says so rather than
 * guessing:
 *
 *  - each pair adds two rows, so every column must be short by an even number;
 *  - pairs from an edge reach inward, so the shortfall must shrink moving away
 *    from that edge. Short columns in the middle, with full ones either side,
 *    can't be reached from either edge.
 *
 * The rules of §9 are kept. Every pair goes out and comes back (rule 3), so the
 * yarn ends at an edge. No two pairs turn in the same column one directly on the
 * other (rule 1): when the shortfall asks for that — the same length twice — one
 * pair is moved in by `step` stitches, and the small unevenness that leaves is
 * reported.
 */
import { simulate, type Column, type Pass, type Yarn } from "./passes";

export type Order = "longest-first" | "shortest-first" | "alternate";

export interface CatchUpOptions {
  /** The background yarn that does the catching up. */
  yarn: Yarn;
  /** Which edge(s) to work from. */
  side: "left" | "right" | "both";
  /** In what order to work the pairs. The textbook uses all three:
   *  "alternate" is Harvest's K11, 9, 7, 5, 3, then 4, 6, 8, 10. */
  order: Order;
  /** When two pairs would turn in the same column, move one in this many
   *  stitches (at least 1). */
  step: number;
}

export interface CatchUp {
  /** The catch-up passes, to follow the pattern so far. */
  passes: Pass[];
  /** Pair lengths worked from each edge, in the order worked. */
  left: number[];
  right: number[];
  /** Rows each column ends up short (positive) or over (negative) compared
   *  with level. All zero when the catch-up is exact. Index 0 is column 1. */
  uneven: number[];
  /** Where the background yarn ends up. */
  endsAt: Column | null;
  /** Why it couldn't level the fabric, if it couldn't. */
  problems: string[];
  /** Things worth knowing — a pair staggered, a row added to move the yarn. */
  notes: string[];
}

/**
 * Level a pattern: work out what's missing after `before`, and add the pairs.
 * The needle must be at an edge with the background yarn waiting there, as it
 * is after a motif row has come home — the moment the book does its catching up.
 */
export function levelOut(stitches: number, before: readonly Pass[], options: CatchUpOptions): CatchUp {
  const fabric = simulate(stitches, before);
  const tallest = Math.max(0, ...fabric.heights);
  const missing = fabric.heights.map((h) => tallest - h);

  const needle = before.length > 0 ? before[before.length - 1].to : null;
  const lastOfYarn = [...before].reverse().find((p) => p.yarn === options.yarn);
  const waiting = lastOfYarn ? lastOfYarn.to : null;

  const problems: string[] = [];
  if (needle === null) {
    problems.push("Nothing has been knitted yet, so nothing is short.");
  } else if (needle !== 1 && needle !== stitches) {
    problems.push(`The needle is at column ${needle}, not at an edge. Catch-up rows start from an edge.`);
  } else if (waiting !== needle) {
    problems.push(
      `Yarn ${options.yarn} is waiting at column ${waiting ?? "nowhere — it hasn't been used"}, but the needle is at column ${needle}. ` +
        `It has to be where the needle is to start catching up.`,
    );
  }
  if (problems.length > 0) return empty(missing, problems);

  return fill(stitches, missing, needle!, options);
}

/**
 * Add `add[j]` rows to each column j (index 0 is column 1) with pairs from the
 * edges, starting with the yarn and needle at `start` (an edge).
 */
export function fill(stitches: number, add: readonly number[], start: Column, options: CatchUpOptions): CatchUp {
  const problems: string[] = [];
  const notes: string[] = [];
  const left = stitches;
  const right = 1;

  const odd = add.map((n, i) => (n % 2 !== 0 ? i + 1 : 0)).filter((c) => c > 0);
  if (odd.length > 0) {
    problems.push(
      `${describe(odd)} ${odd.length === 1 ? "is" : "are"} short by an odd number of rows. Each catch-up pair adds two, so these can't be levelled by pairs alone.`,
    );
    return empty([...add], problems);
  }

  // Pairs needed per column, then shared between the edges.
  const need = add.map((n) => n / 2);
  let fromRight: number[];
  let fromLeft: number[];
  if (options.side === "right") {
    fromRight = shrinkingFrom(need, "right");
    fromLeft = need.map(() => 0);
  } else if (options.side === "left") {
    fromLeft = shrinkingFrom(need, "left");
    fromRight = need.map(() => 0);
  } else {
    // Give the right edge as much as it can take, the left edge the rest.
    fromRight = shrinkingFrom(need, "right");
    fromLeft = shrinkingFrom(need.map((n, i) => n - fromRight[i]), "left");
  }
  const unreached = need.map((n, i) => (n - fromRight[i] - fromLeft[i] > 0 ? i + 1 : 0)).filter((c) => c > 0);
  if (unreached.length > 0) {
    problems.push(
      `${describe(unreached)} can't be reached from ${options.side === "both" ? "either edge" : `the ${options.side} edge`}: ` +
        `${unreached.length === 1 ? "it's" : "they're"} short, but columns nearer the edge are not, and a pair can't skip them.`,
    );
  }

  const lengthsRight = staggered(lengthsOf(fromRight), options.step, notes, "right");
  const lengthsLeft = staggered(lengthsOf(fromLeft), options.step, notes, "left");
  const orderedRight = ordered(lengthsRight, options.order);
  const orderedLeft = ordered(lengthsLeft, options.order);

  // Work the edge the yarn is at first; if the other edge needs pairs too, a
  // full row carries the yarn across. A full row adds a row to every column, so
  // it doesn't disturb the levelling.
  const passes: Pass[] = [];
  let at: Column = start;
  const pairsAt = (edge: Column, lengths: number[]) => {
    const inward = edge === right ? 1 : -1;
    for (const length of lengths) {
      const turn = edge + inward * (length - 1);
      passes.push({ yarn: options.yarn, from: edge, to: turn });
      passes.push({ yarn: options.yarn, from: turn, to: edge });
    }
  };
  const crossTo = (edge: Column) => {
    passes.push({ yarn: options.yarn, from: at, to: edge });
    at = edge;
  };

  const work: [Column, number[]][] = [];
  if (orderedRight.length > 0) work.push([right, orderedRight]);
  if (orderedLeft.length > 0) work.push([left, orderedLeft]);
  if (work.length > 1 && work[0][0] !== start) work.reverse();

  for (const [edge, lengths] of work) {
    if (edge !== at) {
      crossTo(edge);
      notes.push(`Added a full row in ${options.yarn} to bring it to the ${edge === right ? "right" : "left"} edge.`);
    }
    pairsAt(edge, lengths);
  }

  // Rule 3: the yarn goes out and comes back. If it crossed to the other edge,
  // a second full row brings it home — so it's waiting where it was picked up,
  // and the repeat keeps an even number of rows. Two full rows add the same to
  // every column, so the levelling is undisturbed.
  if (at !== start) {
    crossTo(start);
    notes.push(`Added a full row in ${options.yarn} to bring it back to where it started.`);
  }

  // What the pairs actually add, against what was asked for. A full row added
  // to carry the yarn across adds a row to every column — level by itself — so
  // it's left out of the comparison.
  const got = add.map(() => 0);
  for (const p of passes) {
    if (Math.abs(p.to - p.from) + 1 === stitches) continue;
    for (let c = Math.min(p.from, p.to); c <= Math.max(p.from, p.to); c++) got[c - 1] += 1;
  }
  const uneven = got.map((g, i) => add[i] - g);

  return { passes, left: orderedLeft, right: orderedRight, uneven, endsAt: passes.length > 0 ? at : start, problems, notes };
}

/** The largest number of pairs per column, from one edge, that never grows
 *  moving away from that edge and never exceeds what's needed. */
function shrinkingFrom(need: readonly number[], edge: "left" | "right"): number[] {
  const out = need.map(() => 0);
  const order = need.map((_, i) => i);
  if (edge === "left") order.reverse();
  let cap = Infinity;
  for (const i of order) {
    cap = Math.min(cap, need[i]);
    out[i] = cap;
  }
  return out;
}

/** Pair lengths, longest first: the k-th pair reaches every column that needs
 *  at least k pairs. */
function lengthsOf(pairs: readonly number[]): number[] {
  const most = Math.max(0, ...pairs);
  const lengths: number[] = [];
  for (let k = 1; k <= most; k++) lengths.push(pairs.filter((n) => n >= k).length);
  return lengths;
}

/** Make lengths distinct, moving repeats in by `step`, so no two pairs turn in
 *  the same column with nothing longer between them. */
function staggered(lengths: number[], step: number, notes: string[], edge: string): number[] {
  const s = Math.max(1, Math.round(step));
  const out: number[] = [];
  for (const length of lengths) {
    const previous = out[out.length - 1];
    let l = length;
    if (previous !== undefined && l >= previous) l = previous - s;
    if (l < 1) {
      notes.push(`A pair from the ${edge} edge was dropped: staggering it to avoid stacked turns left it no stitches.`);
      continue;
    }
    if (l !== length) {
      notes.push(`From the ${edge} edge, a pair of ${length} was shortened to ${l} so its turn doesn't sit on another.`);
    }
    out.push(l);
  }
  return out;
}

function ordered(lengths: number[], order: Order): number[] {
  const desc = [...lengths].sort((a, b) => b - a);
  if (order === "longest-first") return desc;
  if (order === "shortest-first") return desc.reverse();
  // Every other one going in, the rest coming back out.
  const goingIn = desc.filter((_, i) => i % 2 === 0);
  const comingOut = desc.filter((_, i) => i % 2 !== 0).reverse();
  return [...goingIn, ...comingOut];
}

function describe(columns: number[]): string {
  if (columns.length === 1) return `Column ${columns[0]}`;
  const runs: string[] = [];
  let a = columns[0];
  let b = a;
  for (const c of columns.slice(1).concat([NaN])) {
    if (c === b + 1) {
      b = c;
      continue;
    }
    runs.push(a === b ? `${a}` : `${a}–${b}`);
    a = c;
    b = c;
  }
  return `Columns ${runs.join(", ")}`;
}

function empty(uneven: number[], problems: string[]): CatchUp {
  return { passes: [], left: [], right: [], uneven, endsAt: null, problems, notes: [] };
}

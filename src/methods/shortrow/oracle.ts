/**
 * The try-everything checker — a research tool (PLAN.md §6): can this small
 * drawing be knitted at all, the book's way? Not by recipes, as the builder
 * does (construct.ts), but by trying every sequence of passes the knitting
 * itself allows, so that "no" means no.
 *
 * What the knitting allows, and nothing more:
 *
 *  - **The needle** works one stitch after another. After a pass it either
 *    carries on to the next stitch, in another yarn (a hand-over), or turns
 *    and works back from the stitch it's on. Knitting starts at column 1.
 *  - **The picture**: every stitch a pass works must be due that yarn's colour
 *    next, by the drawing — a cell is one stitch by one ridge, two rows.
 *  - **Rule 1**: a turn away from the edges leaves a double stitch; a second
 *    turn on that stitch needs an ordinary row between.
 *  - **Rule 2**: a yarn starts where it was left, or carried a stitch or two
 *    (`carry`; none at all is the book's own way).
 *  - **Balls**: a fixed number for each colour — one, for the book's way.
 *
 * The builder's own habits (colours nesting like brackets, no turn on a
 * straight edge) are not laws of knitting, and aren't imposed here.
 *
 * It is a search with a memory: every position reached — rows worked in each
 * column, where the needle and each ball are, which stitches were just turned
 * on — is remembered once it has been shown to lead nowhere. For small
 * drawings that settles the matter either way; past `maxStates` positions it
 * gives up and says so. A "yes" always comes with the passes, to be checked.
 */
import { MAX_CARRY, type Pass, type Yarn } from "./passes";
import type { Grid } from "./grid";

export interface Order {
  /** Turn back before carrying on to the next stitch. */
  turnFirst: boolean;
  /** Try a pass at its shortest before its longest. */
  shortFirst: boolean;
}

export interface OracleOptions {
  /** Balls allowed of each colour. Any colour not named gets one. */
  balls?: Record<Yarn, number>;
  /** How far a yarn may be carried to start a pass. */
  carry?: number;
  /** Positions to remember before giving up. */
  maxStates: number;
  /** A moment (by `performance.now()`) to give up at, if it comes first. */
  deadline?: number;
  /** Which choices to try first. Any order finds an answer if there is one
   *  and the search isn't cut short; some find it much sooner. */
  order?: Order;
}

export type Verdict =
  | { knits: true; passes: Pass[]; balls: number; states: number }
  /** `certain: false` — the search was cut short; this is not a proof. */
  | { knits: false; certain: boolean; states: number };

/** Rows since a double stitch, counted no further than this: with this many,
 *  a turn is allowed again. */
const CLEAR = 1 + 2;

export function tryEverything(
  grid: Grid,
  { balls = {}, carry = MAX_CARRY, maxStates, deadline, order = { turnFirst: false, shortFirst: false } }: OracleOptions,
): Verdict {
  const N = grid.width;
  const rows = 2 * grid.height;
  const colourDue = (c: number, row: number) => grid.cells[row >> 1][c - 1];
  const allowed = (colour: Yarn) => balls[colour] ?? 1;

  // The position. Columns are 1-based; index 0 is unused.
  const progress = new Uint8Array(N + 1);
  const sinceTurn = new Uint8Array(N + 1).fill(CLEAR);
  const ballColour: Yarn[] = [];
  const ballAt: number[] = [];
  const passes: Pass[] = [];
  let remaining = N * rows;

  // For the stranded-ball check: rows of each colour still to work, and the
  // last row of each colour in each column.
  const colours = [...new Set(grid.cells.flat())];
  const left = new Map<Yarn, number>(colours.map((c) => [c, 0]));
  const lastRowOf = new Map<Yarn, Int16Array>(colours.map((c) => [c, new Int16Array(N + 1).fill(-1)]));
  for (let c = 1; c <= N; c++) {
    for (let row = 0; row < rows; row++) {
      const colour = colourDue(c, row);
      left.set(colour, left.get(colour)! + 1);
      lastRowOf.get(colour)![c] = row;
    }
  }
  /**
   * A colour cut off from its balls. A ball only travels by knitting — over
   * stitches due its colour — or by a carry of at most `carry` stitches to
   * start again. So, from where its balls lie, a colour can only ever reach
   * the columns linked to them by columns that still have rows of that colour
   * to come. If some column with rows of the colour left isn't linked, those
   * rows can never be knitted. (Only once no more balls of it may be joined:
   * a new ball can start anywhere.)
   */
  const cutOff = () => {
    for (const colour of colours) {
      if (left.get(colour) === 0) continue;
      const mine = ballColour.flatMap((c, b) => (c === colour ? [ballAt[b]] : []));
      if (mine.length === 0 || mine.length < allowed(colour)) continue;
      const last = lastRowOf.get(colour)!;
      const due = (c: number) => last[c] >= progress[c];
      const reach = Math.max(1, carry);
      const linked = new Uint8Array(N + 1);
      const queue = [...mine];
      for (const at of mine) linked[at] = 1;
      while (queue.length > 0) {
        const at = queue.pop()!;
        for (let c = Math.max(1, at - reach); c <= Math.min(N, at + reach); c++) {
          if (linked[c] || !due(c)) continue;
          linked[c] = 1;
          queue.push(c);
        }
      }
      for (let c = 1; c <= N; c++) if (due(c) && !linked[c]) return true;
    }
    return false;
  };

  /**
   * A finished column is a wall. The needle can't jump: it only gets past a
   * column by knitting across it, and a column with all its rows takes no
   * more. So if any column between the needle and some work still to do is
   * finished, that work can never be reached.
   */
  const walledIn = (needle: number) => {
    for (const way of [1, -1]) {
      let beyond = false;
      for (let c = way === 1 ? N : 1; c !== needle; c -= way) {
        if (beyond && progress[c] >= rows) return true;
        if (progress[c] < rows) beyond = true;
      }
    }
    return false;
  };

  const dead = new Set<string>();
  let cutShort = false;

  // Each colour as a number, for the position's key.
  const colourCode = new Map<Yarn, number>(colours.map((c, i) => [c, i + 1]));

  /**
   * The position, as a key to remember it by. Two positions that differ only
   * in what can no longer matter are the same position: a finished column's
   * turn marks, and where a ball lies once its colour has nothing left.
   */
  const key = (needle: number, heading: number) => {
    const turns = Array.from(sinceTurn, (t, c) => (progress[c] >= rows ? 0 : t));
    const balls = ballAt.flatMap((at, b) => [colourCode.get(ballColour[b])!, left.get(ballColour[b]) === 0 ? 0 : at]);
    return String.fromCharCode(...progress, ...turns, needle, heading + 1, ...balls, ballAt.length);
  };

  const idOf = (b: number) => {
    const nth = ballColour.slice(0, b + 1).filter((c) => c === ballColour[b]).length;
    return nth === 1 ? ballColour[b] : `${ballColour[b]}${nth}`;
  };

  /**
   * From here, with the needle having just worked `needle` heading `heading`
   * (+1 is leftwards, to higher columns): can the rest be knitted? `first`:
   * nothing worked yet — the first pass starts on `needle` itself.
   */
  const search = (needle: number, heading: number, first: boolean): boolean => {
    if (remaining === 0) return true;
    if (deadline !== undefined && performance.now() > deadline) cutShort = true;
    if (cutShort) return false;
    const k = key(needle, heading);
    if (dead.has(k)) return false;
    if ((!first && walledIn(needle)) || cutOff()) {
      dead.add(k);
      return false;
    }

    // Where the next pass may start, and which way: on to the next stitch,
    // or back from this one — a turn, leaving a double stitch unless it's at
    // an edge, where it is only the end of a row.
    const starts: { from: number; way: number; double: boolean }[] = [];
    if (first) starts.push({ from: needle, way: heading, double: false });
    else {
      if (needle + heading >= 1 && needle + heading <= N) starts.push({ from: needle + heading, way: heading, double: false });
      const atEdge = needle === 1 || needle === N;
      if (atEdge || sinceTurn[needle] >= CLEAR) starts.push({ from: needle, way: -heading, double: !atEdge });
      if (order.turnFirst) starts.reverse();
    }

    for (const { from, way, double } of starts) {
      if (progress[from] >= rows) continue;
      const colour = colourDue(from, progress[from]);
      // Balls of that colour within reach, and a new one if any are left.
      const choices: number[] = [];
      ballColour.forEach((c, b) => {
        if (c === colour && Math.abs(ballAt[b] - from) <= carry) choices.push(b);
      });
      if (ballColour.filter((c) => c === colour).length < allowed(colour)) choices.push(-1);
      // Carrying on in the yarn that just stopped is the same pass, longer.
      const carriesOn = !first && way === heading;
      const justUsed = carriesOn && passes.length > 0 ? passes[passes.length - 1].yarn : null;

      // How far the pass can run: while each stitch is due this colour.
      let far = from;
      while (far + way >= 1 && far + way <= N && progress[far + way] < rows && colourDue(far + way, progress[far + way]) === colour) far += way;
      const ends: number[] = [];
      for (let to = from; ; to += way) {
        ends.push(to);
        if (to === far) break;
      }
      if (!order.shortFirst) ends.reverse();

      for (const choice of choices) {
        if (choice >= 0 && idOf(choice) === justUsed) continue;
        const b = choice >= 0 ? choice : ballColour.length;
        if (choice < 0) {
          ballColour.push(colour);
          ballAt.push(from);
        }
        const wasAt = ballAt[b];
        const id = idOf(b);

        for (const to of ends) {
          // Work the pass: a row on every stitch from `from` to `to`.
          const before: number[] = [];
          for (let c = from; ; c += way) {
            before.push(sinceTurn[c]);
            progress[c]++;
            // The stitch turned on is half of a double stitch; any other
            // row is an ordinary one.
            sinceTurn[c] = double && c === from ? 1 : Math.min(CLEAR, sinceTurn[c] + 1);
            if (c === to) break;
          }
          remaining -= before.length;
          left.set(colour, left.get(colour)! - before.length);
          ballAt[b] = to;
          passes.push({ yarn: id, from, to });

          if (search(to, way, false)) return true;

          passes.pop();
          remaining += before.length;
          left.set(colour, left.get(colour)! + before.length);
          for (let c = to; ; c -= way) {
            progress[c]--;
            sinceTurn[c] = before.pop()!;
            if (c === from) break;
          }
        }

        ballAt[b] = wasAt;
        if (choice < 0) {
          ballColour.pop();
          ballAt.pop();
        }
        if (cutShort) return false;
      }
    }

    if (dead.size >= maxStates) cutShort = true;
    else dead.add(k);
    return false;
  };

  const knits = search(1, 1, true);
  if (knits) return { knits: true, passes: [...passes], balls: ballColour.length, states: dead.size };
  return { knits: false, certain: !cutShort, states: dead.size };
}

/** The orders tried by `canKnit`, the plain one first. */
const ORDERS: Order[] = [
  { turnFirst: false, shortFirst: false },
  { turnFirst: true, shortFirst: false },
  { turnFirst: false, shortFirst: true },
  { turnFirst: true, shortFirst: true },
];

export interface Answer {
  /** "yes": a knitting was found. "no": none exists, for certain. "unknown":
   *  some search was cut short, and none found one. */
  answer: "yes" | "no" | "unknown";
  /** The shortest carry found to work, when the answer is yes. */
  carry?: number;
  /** Whether every shorter carry was ruled out for certain. */
  carryCertain?: boolean;
  passes?: Pass[];
  states: number;
}

/**
 * Can it be knitted with one ball to each colour — and how far must a yarn be
 * carried, at the least? Tries no carry first, then one stitch, then two; for
 * each, several orders of search, since a search cut short proves nothing.
 */
export function canKnit(grid: Grid, options: Pick<OracleOptions, "balls" | "maxStates" | "deadline">): Answer {
  let states = 0;
  let sure = true;
  for (let carry = 0; carry <= MAX_CARRY; carry++) {
    let settled = false;
    for (const order of ORDERS) {
      const v = tryEverything(grid, { ...options, carry, order });
      states += v.states;
      if (v.knits) return { answer: "yes", carry, carryCertain: sure, passes: v.passes, states };
      if (v.certain) {
        settled = true;
        break;
      }
    }
    if (!settled) sure = false;
  }
  return { answer: sure ? "no" : "unknown", states };
}

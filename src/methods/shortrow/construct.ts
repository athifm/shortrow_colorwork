/**
 * Knitting a grid with short rows — Stage F2 of PLAN.md §5, "the fused plan".
 *
 * Every patch of one colour (a region) is knitted by one ball in one trip: the
 * ball comes in at the patch's right-hand end, works its way over it with
 * turns, and goes home again (rule 3). A patch that touches another patch
 * further left — a colour nested inside it — hands over to that colour's trip
 * on the way, and carries on when it comes back. So a picture is a tree of
 * trips, knitted inside out:
 *
 *   grey  ┐                                  ┌ grey levels the top
 *   purple└┐                                ┌┘ purple climbs over orange
 *   orange └┐                              ┌┘  orange climbs over green
 *   green    └── zigzag in, and home ──────┘
 *
 * Between hand-overs, a colour's passes come from these recipes:
 *
 *  - **zigzag** (a peak, or a slope against an edge): out to the far end, turn,
 *    back to one stitch short of where it started, turn, out to one short of
 *    the far end… Every turn one stitch further in, so no column turns twice
 *    (rule 1). This is the Shoal construction, worked going in only, and it can
 *    step one stitch per ridge.
 *  - **bumps** (a layer thicker in several places): the same, with a short
 *    there-and-back over each bump on the way home.
 *  - **fill from the edges** (a valley, like the background over a motif):
 *    catch-up pairs from each edge (Stage B), with a full row to cross between.
 *
 * Where those don't fit as asked, the zigzag and bumps are tried again with
 * the columns that could take more rows raised to suit them (`bridged`,
 * `smoothed`) — the background under two shapes side by side, say — and the
 * bumps also on the way home.
 *
 * Which rows of a colour come before a nested colour and which after is fixed by
 * the picture: rows underneath it come first, rows on top of it after. Rows
 * beside it can go either way; the builder tries the simple choices, checks
 * every result against the rules, and keeps the first that passes.
 *
 * Straight vertical edges are intarsia's (PLAN.md §1): there the patches either
 * side are cut into one-ridge pieces, each its own short trip, so the colours
 * hand over at the edge ridge after ridge — the same tree of trips, no special
 * case. A ball can be lent to a nested piece when it comes back within a short
 * carry of where it's needed, the way intarsia carries the background behind a
 * thin line.
 *
 * What it can't do is reported, not guessed: where two turns would have to
 * share a stitch, it says where (`stuck`), and round.ts can round the drawing a
 * stitch or two to make room (L13).
 */
import { simulate, MAX_CARRY, type Column, type Pass, type Yarn } from "./passes";
import { fill, type Order } from "./balance";
import { stackedTurns, turnsOf } from "./rules";
import { writeRows } from "./writer";
import type { Grid } from "./grid";
import type { Knitted } from "./intarsia";

export interface Built extends Knitted {
  /** Why it couldn't be built, if it couldn't. Empty when it worked. */
  problems: string[];
  /** When it failed because two turns had to share a stitch: where — the
   *  place a rounding of the drawing could help (PLAN.md §8, L13). */
  stuck?: { column: Column; ridge: number; colour: Yarn };
  /** How far the best attempt got, in passes: more is closer. */
  reached: number;
}

/** A connected patch of one colour. */
interface Region {
  id: number;
  colour: Yarn;
  /** Its right-hand end: the lowest column number it reaches. */
  home: Column;
  /** The lowest ridge it has in its home column. */
  homeRidge: number;
  parent: number | null;
  children: number[];
}

type Heading = "left" | "right";
interface End {
  at: Column;
  heading: Heading;
}

/** Everything that changes as passes are added — copied for each attempt. */
interface State {
  passes: Pass[];
  progress: number[];
  strands: Knitted["strands"];
  waitingAt: Map<Yarn, Column>;
}

/** Balls out on a trip that a nested trip is inside: whose they are, and where
 *  the owner will next start knitting with it. */
type Holders = Map<Yarn, { region: number; resume: Column }>;

const clone = (s: State): State => ({
  passes: [...s.passes],
  progress: [...s.progress],
  strands: [...s.strands],
  waitingAt: new Map(s.waitingAt),
});

class Refused extends Error {}


/** `recipes: "first"` tries only the recipes as they were first written —
 *  quicker to give up, for searches that build many drawings (round.ts). */
export function knitShortRows(grid: Grid, { recipes = "all" }: { recipes?: "all" | "first" } = {}): Built {
  const N = grid.width;
  const H = grid.height;
  const { regionOf, regions } = regionsOf(grid, recipes === "all");
  const rowRegion = (c: Column, row: number) => (row < 2 * H ? regionOf[Math.floor(row / 2)][c - 1] : -1);

  // The attempt that got furthest, and why it stopped: what's reported.
  let deepest: { passes: number; reason: string; stuck?: Built["stuck"] } = { passes: -1, reason: "" };
  const fail = (problem: string, stuck?: Built["stuck"]): Built => ({
    passes: [],
    strands: [],
    ends: 0,
    problems: [problem],
    stuck,
    reached: Math.max(0, deepest.passes),
  });

  const top = regions.find((r) => r.parent === null)!;
  for (const r of regions) {
    if (r.id !== top.id && !reaches(regions, r.id, top.id)) {
      return fail(
        `The ${colourName(r.colour)} patch whose right-hand end is column ${r.home} can't be reached: ` +
          `the colours around it lead back into each other. This kind of picture isn't handled yet.`,
      );
    }
  }

  // Each region's cells and those of everything nested inside it, by column:
  // the rows a parent must finish before handing over, and leave until after.
  const family = (id: number): Set<number> => {
    const out = new Set<number>([id]);
    for (const c of regions[id].children) for (const d of family(c)) out.add(d);
    return out;
  };
  const families = regions.map((r) => family(r.id));

  // How many choices to try before giving up: plenty for any drawing the
  // recipes fit, and a stop for one they don't.
  const budget = N * N * H;
  let attempts = 0;
  const note = (s: State, reason: string, stuck?: Built["stuck"]) => {
    if (s.passes.length > deepest.passes) deepest = { passes: s.passes.length, reason, stuck };
  };
  const refuse = (s: State, reason: string, stuck?: Built["stuck"]): never => {
    note(s, reason, stuck);
    throw new Refused(reason);
  };

  // --- Passes ------------------------------------------------------------

  /** Add one pass in `ball`, working region `X`. Every stitch it covers must be
   *  waiting for that region next — that's what keeps the picture right. */
  const emit = (s: State, X: number, ball: Yarn, from: Column, to: Column) => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (let c = lo; c <= hi; c++) {
      const want = rowRegion(c, s.progress[c - 1]);
      if (want !== X) {
        refuse(
          s,
          want === -1
            ? `Column ${c} is already finished, but ${colourName(regions[X].colour)} would need to knit over it.`
            : `Column ${c} needs ${colourName(regions[want].colour)} next, but ${colourName(regions[X].colour)} would need to knit over it.`,
        );
      }
    }
    for (let c = lo; c <= hi; c++) s.progress[c - 1]++;
    s.passes.push({ yarn: ball, from, to });
    s.waitingAt.set(ball, to);
  };

  /** A ball of this colour for a trip starting at `at`: one already waiting
   *  there (or a short carry away), or a new one. A ball still out on a trip
   *  around this one can be borrowed: this trip brings it home to `at`, so
   *  it's fine if its owner picks it up again within a short carry of there —
   *  the way intarsia carries the background behind a thin line — or if its
   *  owner has nothing left to knit. */
  const ballFor = (s: State, colour: Yarn, at: Column, busy: Holders): Yarn => {
    const stillNeeded = (region: number) =>
      s.progress.some((p, i) => {
        for (let row = p; row < 2 * H; row++) if (rowRegion(i + 1, row) === region) return true;
        return false;
      });
    const nearest = s.strands
      .filter((b) => {
        if (b.colour !== colour) return false;
        const holder = busy.get(b.id);
        return !holder || Math.abs(holder.resume - at) <= MAX_CARRY || !stillNeeded(holder.region);
      })
      .map((b) => ({ id: b.id, d: Math.abs((s.waitingAt.get(b.id) ?? Infinity) - at) }))
      .filter(({ d }) => d <= MAX_CARRY)
      .sort((a, b) => a.d - b.d)[0];
    if (nearest) return nearest.id;
    const count = s.strands.filter((b) => b.colour === colour).length;
    const id = count === 0 ? colour : `${colour}${count + 1}`;
    s.strands.push({ id, colour, joinedAt: at, ridge: Math.floor(s.progress[at - 1] / 2) });
    return id;
  };

  // --- Trips ---------------------------------------------------------------

  /**
   * Region X's trip: in at `home` heading left, out again at `home` heading
   * right. Yields every way of doing it that the recipes offer, as finished
   * states (each with X's whole trip, nested colours included).
   */
  function* trip(s0: State, X: number, home: Column, busy: Holders): Generator<State> {
    const region = regions[X];
    const s1 = clone(s0);
    const ball = ballFor(s1, region.colour, home, busy);
    const kids = region.children;

    // Each of X's rows, column by column: which phases it may go in. Phase i is
    // the stretch of X's knitting between nested colour i and i+1.
    const rows: { c: Column; row: number; lo: number; hi: number }[][] = [];
    for (let c = 1; c <= N; c++) {
      const col: { c: Column; row: number; lo: number; hi: number }[] = [];
      for (let row = s1.progress[c - 1]; row < 2 * H; row++) {
        if (rowRegion(c, row) !== X) continue;
        let lo = 0;
        let hi = kids.length;
        kids.forEach((k, i) => {
          const fam = families[k];
          for (let r = 0; r < 2 * H; r++) {
            if (!fam.has(rowRegion(c, r))) continue;
            if (r > row) hi = Math.min(hi, i);
            if (r < row) lo = Math.max(lo, i + 1);
          }
        });
        col.push({ c, row, lo, hi });
      }
      // Bottom to top within a column.
      for (let k = 1; k < col.length; k++) col[k].lo = Math.max(col[k].lo, col[k - 1].lo);
      for (let k = col.length - 2; k >= 0; k--) col[k].hi = Math.min(col[k].hi, col[k + 1].hi);
      if (col.some((r) => r.lo > r.hi)) return;
      rows.push(col);
    }

    // Where each phase starts and ends: at a nested colour's home, by hand-over,
    // or at the right edge when the nested colour starts there.
    const entry = (k: number) => regions[k].home;
    const phaseStart = (i: number): End =>
      i === 0 ? { at: home, heading: "left" } : entry(kids[i - 1]) === 1 ? { at: 1, heading: "left" } : { at: entry(kids[i - 1]) - 1, heading: "right" };
    const phaseEnd = (i: number): End =>
      i === kids.length ? { at: home, heading: "right" } : entry(kids[i]) === 1 ? { at: 1, heading: "right" } : { at: entry(kids[i]) - 1, heading: "left" };

    function* phases(s: State, i: number): Generator<State> {
      if (++attempts > budget) return;
      const last = i === kids.length;
      // How many rows this phase must, and may, add in each column.
      const done = (c: Column) => s.progress[c - 1];
      const min: number[] = [];
      const max: number[] = [];
      for (let c = 1; c <= N; c++) {
        const left = rows[c - 1].filter((r) => r.row >= done(c));
        min.push(left.filter((r) => r.hi <= i).length);
        let may = 0;
        for (const r of left) {
          if (r.lo > i) break;
          may++;
        }
        max.push(last ? left.length : may);
      }

      let shapes = 0;
      for (const shape of walks(min, max, phaseStart(i), phaseEnd(i), N, recipes === "all")) {
        shapes++;
        const s2 = clone(s);
        try {
          for (const p of shape) emit(s2, X, ball, p.from, p.to);
          checkTurns(s2);
        } catch (e) {
          if (e instanceof Refused) continue;
          throw e;
        }
        if (last) {
          yield s2;
          continue;
        }
        // Hand over to the next nested colour, and carry on when it's home.
        const k = kids[i];
        const holders = new Map(busy).set(ball, { region: X, resume: phaseStart(i + 1).at });
        for (const s3 of trip(s2, k, entry(k), holders)) yield* phases(s3, i + 1);
        if (attempts > budget) return;
      }
      if (shapes === 0) {
        const cols = min.map((m, c) => (m > 0 ? c + 1 : 0)).filter((c) => c > 0);
        const where = cols.length > 0 ? ` in columns ${Math.min(...cols)}–${Math.max(...cols)}` : "";
        note(
          s,
          `None of the recipes fits the shape of ${colourName(region.colour)}${where} — a peak, a slope from an edge, ` +
            `a wavy layer or a fill from the edges. This shape isn't handled yet.`,
        );
      }
    }

    yield* phases(s1, 0);
  }

  /** Rule 1, and the edge rule — a turn never sits on a straight vertical
   *  edge, which is intarsia's (PLAN.md §1) — checked as the pattern grows, so a
   *  bad choice is dropped early. */
  const checkTurns = (s: State) => {
    const fabric = simulate(N, s.passes);
    const turns = turnsOf(s.passes, N);
    const stacked = stackedTurns(fabric, s.passes, turns);
    if (stacked.length > 0) {
      const { column, row, passes } = stacked[0];
      const strand = s.passes[passes[1] - 1].yarn;
      refuse(
        s,
        `Column ${column}: two turns would land one on the other, with no ordinary row between them (rule 1).`,
        { column, ridge: Math.floor((row - 1) / 2), colour: s.strands.find((b) => b.id === strand)!.colour },
      );
    }
    turns.forEach((turning, k) => {
      if (!turning) return;
      const p = s.passes[k];
      const t = p.to;
      const beside = p.to > p.from ? t + 1 : t - 1;
      const ridge = Math.floor(fabric.madeBy[t - 1].indexOf(k) / 2);
      const own = regionOf[ridge][t - 1];
      const edgeAt = (r: number) => r >= 0 && r < H && regionOf[r][t - 1] === own && regionOf[r][beside - 1] !== own;
      if (edgeAt(ridge) && (edgeAt(ridge - 1) || edgeAt(ridge + 1))) {
        refuse(
          s,
          `Column ${t}, ridge ${ridge + 1}: a turn would sit on a straight vertical edge, ` +
            `which takes intarsia hand-overs instead.`,
        );
      }
    });
  };

  // --- The whole picture -----------------------------------------------------

  const start: State = { passes: [], progress: Array.from({ length: N }, () => 0), strands: [], waitingAt: new Map() };
  try {
    for (const s of trip(start, top.id, 1, new Map())) {
      if (s.progress.some((p) => p !== 2 * H)) continue;
      if (writeRows(s.passes, N, "RS").problems.length > 0) continue;
      return { passes: s.passes, strands: s.strands, ends: s.strands.length * 2, problems: [], reached: s.passes.length };
    }
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
  }
  return fail(
    deepest.reason
      ? `Couldn't build this with short rows yet. ${deepest.reason}`
      : "Couldn't build this with short rows yet.",
    deepest.stuck,
  );
}

// --- Shapes of one phase of one colour --------------------------------------------

/**
 * Every way the recipes offer to add between `min` and `max` rows to each
 * column (index 0 is column 1), starting and ending as asked. Passes only —
 * the yarn is added by the caller.
 *
 * A phase can start heading right (just after a nested colour handed back): it
 * first runs right to some turn. It can end heading left (about to hand over):
 * its last pass runs left from some turn. In between, it goes left and comes
 * back right: a zigzag, or a fill from the edges.
 */
function* walks(min: number[], max: number[], from: End, to: End, N: number, all: boolean): Generator<{ from: Column; to: Column }[]> {
  const fits = (got: number[]) => got.every((g, i) => g >= min[i] && g <= max[i]);
  const cover = (passes: { from: Column; to: Column }[]) => {
    const got = min.map(() => 0);
    for (const p of passes) for (let c = Math.min(p.from, p.to); c <= Math.max(p.from, p.to); c++) got[c - 1]++;
    return got;
  };

  // Nothing at all, when a nested colour has just come home to the right edge
  // and the next thing starts there too.
  if (from.at === 1 && from.heading === "left" && to.at === 1 && to.heading === "right" && fits(cover([]))) yield [];

  // One pass may be all it takes.
  if (from.heading === to.heading) {
    const one = [{ from: from.at, to: to.at }];
    const ok = from.heading === "left" ? to.at >= from.at : to.at <= from.at;
    if (ok && fits(cover(one))) yield one;
  }

  const pres = from.heading === "right" ? range(from.at, 1).map((t) => ({ pre: [{ from: from.at, to: t }], a: t })) : [{ pre: [], a: from.at }];
  const posts = to.heading === "left" ? range(to.at, 1).map((t) => ({ post: [{ from: t, to: to.at }], b: t })) : [{ post: [], b: to.at }];

  // The recipes as they were first, through every start and end; then the
  // same with free columns raised, and a plain turn — so a drawing that
  // knits the first way keeps it.
  const offered = new Set<string>();
  for (const extra of all ? [false, true] : [false]) {
    for (const { pre, a } of pres) {
      for (const { post, b } of posts) {
        const used = cover([...pre, ...post]);
        const lo = min.map((m, i) => m - used[i]);
        const hi = max.map((m, i) => m - used[i]);
        if (hi.some((h) => h < 0)) continue;
        const middles = extra
          ? [
              ...[bridged(lo, hi, 2), bridged(lo, hi, 0), smoothed(lo, hi, a)].flatMap((w) => [zigzag(w, a, b, N), bumps(w, a, b, N, true)]),
              // Nothing in between: just turn — when all that's needed is to
              // get from one hand-over to the next.
              a === b ? [] : null,
            ]
          : [zigzag(lo, a, b, N), bumps(lo, a, b, N), ...edgeFills(lo, hi, a, b, N)];
        for (const middle of middles) {
          if (!middle) continue;
          const all = [...pre, ...middle, ...post];
          // Several recipes often come to the same walk: offer it once.
          const key = all.map((p) => `${p.from}>${p.to}`).join(" ");
          if (offered.has(key) || !fits(cover(all))) continue;
          offered.add(key);
          yield all;
        }
      }
    }
  }
}

/**
 * The rows wanted, with columns that may take more raised where that saves
 * stacking turns. A layer can't end in a cliff: its end column, with nothing
 * beyond, would turn twice for every two ridges. So a free column beside a
 * cliff takes rows to step down a ridge at a time; a free column at the edge
 * of the fabric joins the layer beside it (a turn there is only the end of a
 * row); and a free column in a dip one stitch wide is filled, or the layer
 * either side of it would be a bump one stitch wide. With `drop` 0, free
 * columns come up level with the layer instead: its turns then move out past
 * them — out from under a shape's tip, say, where the shape turns too.
 */
function bridged(lo: number[], hi: number[], drop: number): number[] {
  const w = lo.map((x) => Math.max(0, x));
  const n = w.length;
  // As far towards `to` as the column may go, in whole ridges.
  const raise = (i: number, to: number) => {
    let v = Math.min(to, hi[i]);
    if ((to - v) % 2 !== 0) v--;
    if (v > w[i]) {
      w[i] = v;
      return true;
    }
    return false;
  };
  for (let changed = true; changed; ) {
    changed = false;
    if (n > 1) changed = raise(0, w[1]) || changed;
    if (n > 1) changed = raise(n - 1, w[n - 2]) || changed;
    for (let i = 0; i < n; i++) {
      const l = i > 0 ? w[i - 1] : 0;
      const r = i + 1 < n ? w[i + 1] : 0;
      if (i > 0 && i + 1 < n) changed = raise(i, Math.min(l, r)) || changed;
      changed = raise(i, Math.max(l, r) - drop) || changed;
    }
  }
  return w;
}

/**
 * The most rows each column may take now, from `a` on — up to the highest
 * any column needs — then brought down a ridge at a time beside lower columns, so no layer ends in a cliff. For a
 * patch of colour that won't be reachable later — the floor under a second
 * shape, beyond the first.
 */
function smoothed(lo: number[], hi: number[], a: Column): number[] {
  const floor = lo.map((x) => Math.max(0, x));
  // No higher than the highest floor this stretch has to lay anyway.
  const cap = Math.max(...floor);
  const w = hi.map((h, i) => (i + 1 >= a ? Math.max(floor[i], Math.min(h, cap)) : floor[i]));
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < w.length; i++) {
      const l = i > 0 ? w[i - 1] : Infinity;
      const r = i + 1 < w.length ? w[i + 1] : Infinity;
      let v = Math.max(floor[i], Math.min(w[i], Math.min(l, r) + 2));
      if ((w[i] - v) % 2 !== 0) v++;
      if (v < w[i]) {
        w[i] = v;
        changed = true;
      }
    }
  }
  return w;
}

/**
 * The zigzag: in from `a` heading left, back out to `b` heading right. Read the
 * rows wanted as layers: layer j is every column wanting at least j pairs. Each
 * layer must be one unbroken run. The walk runs out to the far end of layer 1,
 * back to the near end of layer 2, out to the far end of layer 2, and so on,
 * then home to `b` — so a column in layer j is crossed 2j times.
 *
 * Columns that only need to be passed through (wanting nothing of their own)
 * are taken into the layers they sit between; at the right edge they reach
 * every layer, since a turn at the edge is only the end of a row.
 */
function zigzag(want: number[], a: Column, b: Column, N: number): { from: Column; to: Column }[] | null {
  // Columns right of the start are only crossed by the run home, if at all.
  for (let c = 1; c < a; c++) if (want[c - 1] > (c >= b ? 1 : 0)) return null;

  const level = (c: Column) => Math.ceil(Math.max(0, want[c - 1]) / 2);
  const own = range(a, N).filter((c) => level(c) > 0);
  if (own.length === 0) return null;
  const top = Math.max(...own.map(level));
  const first = Math.min(...own);
  const last = Math.max(...own);
  const levels: number[] = Array.from({ length: N + 1 }, () => 0);
  for (const c of own) levels[c] = level(c);
  // Columns wanting nothing of their own, but in the way. Between the start
  // and the first that does, they climb a stitch at a time, so the turns on
  // this side step in one by one — or, at the right edge, they reach every
  // layer, a turn there being only the end of a row. Between columns that do
  // want rows, as low as the layers allow.
  for (let c = a; c <= last; c++) {
    if (levels[c] > 0) continue;
    if (c < first) {
      levels[c] = a === 1 ? top : Math.min(top, 1 + (c - a));
      continue;
    }
    const leftMax = Math.max(0, ...own.filter((d) => d > c).map(level));
    const rightMax = Math.max(0, ...own.filter((d) => d < c).map(level));
    levels[c] = Math.max(1, Math.min(leftMax, rightMax));
  }

  const runs: [Column, Column][] = [];
  for (let j = 1; j <= top; j++) {
    const cols = range(a, last).filter((c) => levels[c] >= j);
    const L = Math.min(...cols);
    const R = Math.max(...cols);
    if (cols.length !== R - L + 1) return null; // a layer in two pieces: not a peak
    runs.push([L, R]);
  }
  if (runs[0][0] !== a) return null;

  const points: Column[] = [];
  for (const [L, R] of runs) points.push(L, R);
  const passes: { from: Column; to: Column }[] = [];
  for (let k = 0; k + 1 < points.length; k++) passes.push({ from: points[k], to: points[k + 1] });
  passes.push({ from: points[points.length - 1], to: b });
  return passes;
}

/**
 * The zigzag's cousin, for a layer with several bumps — the part of a colour
 * under a nested one, say, thicker at both ends than in the middle. Out to the
 * far end, then on the way home, a short there-and-back over each bump: past
 * it, turn, back over it, turn, and on — two more rows on just those stitches.
 * Bumps on bumps the same way, in the other direction. A bump one stitch wide
 * would need two turns on that one stitch, which rule 1 refuses: that's where
 * rounding comes in (L13). `homeward`: bumps also between home and the start,
 * on the way home — the near side finished last, after the far side.
 */
function bumps(want: number[], a: Column, b: Column, N: number, homeward = false): { from: Column; to: Column }[] | null {
  // Coming home short of the start (b > a) leaves the columns between with
  // the one row of the way out: only when bumps are also made homeward.
  if (b > a && !homeward) return null;
  for (let c = 1; c < a; c++) if (want[c - 1] > (c >= b ? (homeward ? Infinity : 1) : 0)) return null;
  const level = (c: Column) => (c >= a && c <= N ? Math.ceil(Math.max(0, want[c - 1]) / 2) : 0);
  const own = range(a, N).filter((c) => level(c) > 0);
  if (own.length === 0) return null;
  const far = Math.max(...own);
  // Columns crossed on the way, wanting nothing of their own, get the two
  // rows of the way out and back. Columns between home and the start are
  // crossed once, on the way home; bumps there add two rows each, the same.
  const lev = (c: Column) => {
    if (c >= a && c <= far) return Math.max(1, level(c));
    if (c >= b && c < a) return Math.max(1, Math.ceil((Math.max(0, want[c - 1]) + 1) / 2));
    return 0;
  };

  /** Runs of columns between lo and hi at level j or more, lowest first. */
  const runs = (j: number, lo: Column, hi: Column): [Column, Column][] => {
    const out: [Column, Column][] = [];
    for (let c = lo; c <= hi; c++) {
      if (lev(c) < j) continue;
      if (out.length > 0 && out[out.length - 1][1] === c - 1) out[out.length - 1][1] = c;
      else out.push([c, c]);
    }
    return out;
  };

  const passes: { from: Column; to: Column }[] = [];
  let at = a;
  const go = (to: Column) => {
    passes.push({ from: at, to });
    at = to;
  };
  // Heading right from `at` down to `lo`, doubling back over each run of
  // level j on the way; and the same heading left, up to `hi`.
  const right = (lo: Column, j: number) => {
    for (const [L, R] of runs(j, lo, at).reverse()) {
      go(L);
      left(R, j + 1);
    }
    go(lo);
  };
  const left = (hi: Column, j: number) => {
    for (const [L, R] of runs(j, at, hi)) {
      go(R);
      right(L, j + 1);
    }
    go(hi);
  };
  go(far);
  right(b, 2);
  return passes;
}

/**
 * The fill from the edges, for a valley: from the right edge and back to it,
 * with catch-up pairs from each edge (Stage B) and full rows. Every column must
 * belong to this colour at the time, since the full rows cross them all.
 */
function edgeFills(lo: number[], hi: number[], a: Column, b: Column, N: number): ({ from: Column; to: Column }[] | null)[] {
  if (a !== 1 || b !== 1) return [];
  const asked = lo.map((w) => Math.max(0, w));
  const fixed = asked.map((w, i) => w > 0 || hi[i] <= 0);
  if (!fixed.some(Boolean)) return [];
  const first = fixed.indexOf(true);
  const lastFixed = fixed.lastIndexOf(true);

  // Columns wanting nothing yet, two ways. The least: raised to match their
  // neighbours, as far as the pairs need — outward from the valley they can't
  // drop. The most: as high as they may go now — for when later on there'll
  // be no getting back to them, the far side of a motif with a vertical end.
  const least = [...asked];
  for (let i = 0; i < first; i++) least[i] = least[first];
  for (let i = lastFixed + 1; i < N; i++) least[i] = least[lastFixed];
  for (let i = first; i <= lastFixed; i++) {
    if (fixed[i]) continue;
    const l = least.slice(0, i).reverse().find((_, k) => fixed[i - 1 - k]) ?? 0;
    const r = least.slice(i + 1).find((_, k) => fixed[i + 1 + k]) ?? 0;
    least[i] = Math.min(l, r);
  }
  // Pairs add two rows at a time, and can't reach further in than nearer the
  // edge: so even, and never more than the column outside it.
  const most = asked.map((w, i) => (fixed[i] ? w : Math.max(0, hi[i] - (hi[i] % 2))));
  for (let i = 1; i < first; i++) most[i] = Math.min(most[i], most[i - 1]);
  for (let i = N - 2; i > lastFixed; i--) most[i] = Math.min(most[i], most[i + 1]);

  const out: ({ from: Column; to: Column }[] | null)[] = [];
  for (const want of [least, most]) {
    if (want.every((w) => w === 0) || want.some((w, i) => w > hi[i])) continue;
    const common = Math.min(...want);
    const rest = want.map((w) => w - common);
    for (const order of ["longest-first", "alternate", "shortest-first"] as Order[]) {
      const result = fill(N, rest, 1, { yarn: "x", side: "both", order, step: 1 });
      if (result.problems.length > 0 || result.uneven.some((u) => u !== 0)) continue;
      // Crossing to the left edge and back adds two full rows; they count
      // towards the rows every column needs anyway.
      const crossings = result.passes.filter((p) => Math.abs(p.to - p.from) + 1 === N).length;
      const full = common - crossings;
      if (full < 0 || full % 2 !== 0) continue;
      const passes = result.passes.map(({ from, to }) => ({ from, to }));
      for (let k = 0; k < full; k++) passes.push(k % 2 === 0 ? { from: 1, to: N } : { from: N, to: 1 });
      out.push(passes);
    }
  }
  return out;
}

// --- Regions -----------------------------------------------------------------

/**
 * The patches of colour, and how they nest. A patch is entered at its
 * right-hand end — the lowest column it reaches, at its lowest ridge there — by
 * the colour just to the right of that stitch. A patch starting at the right
 * edge is entered there, after the colour beneath it.
 *
 * Where a patch forks going up — one run of stitches with two of the same
 * colour above it, either side of something reaching the top — the branches
 * are patches of their own. By the time a branch is knitted, the run beneath it
 * is long finished, so it can't lead one ball from branch to branch. Branches
 * that join again higher up stay one patch: a full row can cross there.
 */
function regionsOf(grid: Grid, cutWraps: boolean): { regionOf: number[][]; regions: Region[] } {
  const { width: N, height: H, cells } = grid;

  // Runs of one colour along each ridge, and which of them fork upwards.
  const runOf = cells.map((row) => {
    const ids: number[] = [];
    row.forEach((colour, c) => ids.push(c > 0 && row[c - 1] === colour ? ids[c - 1] : c));
    return ids;
  });
  const forkMemo = new Map<string, boolean>();
  const forks = (r: number, c: number): boolean => {
    if (r + 1 >= H) return false;
    const key = `${r},${runOf[r][c]}`;
    if (forkMemo.has(key)) return forkMemo.get(key)!;
    const colour = cells[r][c];
    const branches: number[] = [];
    for (let k = 0; k < N; k++) {
      if (runOf[r][k] === runOf[r][c] && cells[r + 1][k] === colour && !branches.includes(runOf[r + 1][k])) {
        branches.push(runOf[r + 1][k]);
      }
    }
    // Do the branches meet again higher up? Spread from the first through
    // this colour, above the fork only.
    let apart = false;
    if (branches.length > 1) {
      const seen = new Set<string>([`${r + 1},${branches[0]}`]);
      const stack: [number, number][] = [[r + 1, branches[0]]];
      while (stack.length > 0) {
        const [rr, cc] = stack.pop()!;
        for (const [nr, nc] of [
          [rr + 1, cc],
          [rr - 1, cc],
          [rr, cc + 1],
          [rr, cc - 1],
        ]) {
          if (nr <= r || nr >= H || nc < 0 || nc >= N || cells[nr][nc] !== colour) continue;
          const id = `${nr},${nc}`;
          if (seen.has(id)) continue;
          seen.add(id);
          stack.push([nr, nc]);
        }
      }
      // A run is named by its first stitch, so reaching the run reaches that.
      apart = branches.some((b) => !seen.has(`${r + 1},${b}`));
    }
    forkMemo.set(key, apart);
    return apart;
  };
  // Straight vertical edges: two colours side by side, unchanged, for two
  // ridges or more. Those are intarsia's (PLAN.md §1), so the runs either side
  // become one-ridge patches of their own — each its own short trip, handing
  // over at the edge, ridge after ridge.
  const sliced = cells.map((row) => row.map(() => false));
  for (let c = 0; c + 1 < N; c++) {
    let r = 0;
    while (r < H) {
      if (cells[r][c] === cells[r][c + 1]) {
        r++;
        continue;
      }
      let end = r;
      while (end + 1 < H && cells[end + 1][c] === cells[r][c] && cells[end + 1][c + 1] === cells[r][c + 1]) end++;
      if (end > r) {
        for (let k = r; k <= end; k++) {
          for (const side of [c, c + 1]) {
            for (let x = 0; x < N; x++) if (runOf[k][x] === runOf[k][side]) sliced[k][x] = true;
          }
        }
      }
      r = end + 1;
    }
  }

  // Shapes that are one run of their colour in every column — a band, a
  // lens, any short-row unit (units.ts) — never split at a fork: one ball
  // knits them in layers, every pass right across, each column's rows
  // landing at its own height. (Not the background, cast-on to top: that
  // goes round the shapes, and does split.)
  const patchOf = cells.map((row) => row.map(() => -1));
  const oneRun: boolean[] = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < N; c++) {
      if (patchOf[r][c] !== -1) continue;
      const id = oneRun.length;
      const stack: [number, number][] = [[r, c]];
      patchOf[r][c] = id;
      const runs = new Map<number, number[]>();
      while (stack.length > 0) {
        const [rr, cc] = stack.pop()!;
        runs.set(cc, [...(runs.get(cc) ?? []), rr]);
        for (const [nr, nc] of [
          [rr + 1, cc],
          [rr - 1, cc],
          [rr, cc + 1],
          [rr, cc - 1],
        ]) {
          if (nr < 0 || nr >= H || nc < 0 || nc >= N || patchOf[nr][nc] !== -1 || cells[nr][nc] !== cells[r][c]) continue;
          patchOf[nr][nc] = id;
          stack.push([nr, nc]);
        }
      }
      const all = [...runs.values()].flat();
      const shape = Math.min(...all) > 0 || Math.max(...all) < H - 1;
      oneRun.push(shape && [...runs.values()].every((rs) => Math.max(...rs) - Math.min(...rs) + 1 === rs.length));
    }
  }

  // Levels a patch is cut at: no joining a stitch to the one below it.
  const cut = cells.map((row) => row.map(() => false));

  const joined = (r: number, c: number, nr: number, nc: number): boolean => {
    if (cells[nr][nc] !== cells[r][c]) return false;
    if (nr === r) return true;
    if (sliced[r][c] || sliced[nr][nc]) return false;
    if (cut[Math.max(r, nr)][c]) return false;
    if (oneRun[patchOf[r][c]]) return true;
    return nr > r ? !forks(r, c) : !forks(nr, nc);
  };

  const build = () => {
    const regionOf = cells.map((row) => row.map(() => -1));
    const regions: Region[] = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < N; c++) {
        if (regionOf[r][c] !== -1) continue;
        const id = regions.length;
        const colour = cells[r][c];
        const stack: [number, number][] = [[r, c]];
        regionOf[r][c] = id;
        let home = c + 1;
        let homeRidge = r;
        while (stack.length > 0) {
          const [rr, cc] = stack.pop()!;
          if (cc + 1 < home || (cc + 1 === home && rr < homeRidge)) {
            home = cc + 1;
            homeRidge = rr;
          }
          for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nr = rr + dr;
            const nc = cc + dc;
            if (nr < 0 || nr >= H || nc < 0 || nc >= N) continue;
            if (regionOf[nr][nc] !== -1 || !joined(rr, cc, nr, nc)) continue;
            regionOf[nr][nc] = id;
            stack.push([nr, nc]);
          }
        }
        regions.push({ id, colour, home, homeRidge, parent: null, children: [] });
      }
    }
    for (const region of regions) {
      if (region.home > 1) region.parent = regionOf[region.homeRidge][region.home - 2];
      else if (region.homeRidge > 0) region.parent = regionOf[region.homeRidge - 1][0];
      if (region.parent !== null) regions[region.parent].children.push(region.id);
    }
    // Nested colours in the order they're reached: lowest first, then rightmost.
    for (const region of regions) {
      region.children.sort((x, y) => regions[x].homeRidge - regions[y].homeRidge || regions[x].home - regions[y].home);
    }
    return { regionOf, regions };
  };

  // A patch that wraps round something not nested inside it — below it and
  // above it in one column, like the background beside a T's crossbar, under
  // its tip and over it — would need the thing in between both before and
  // after its one trip. So it's cut in two at that level: the part below
  // knitted before, the part above after, each a trip of its own. (Not for
  // `recipes: "first"`, which keeps to the patches as first worked out.)
  for (let tries = 0; cutWraps && tries <= N * H; tries++) {
    const { regionOf, regions } = build();
    const inside = (x: number, y: number): boolean => {
      for (let at: number | null = y; at !== null; at = regions[at].parent) if (at === x) return true;
      return false;
    };
    let level: { region: number; ridge: number } | null = null;
    for (let c = 0; c < N && !level; c++) {
      for (let r = 1; r < H && !level; r++) {
        const x = regionOf[r][c];
        if (regionOf[r - 1][c] === x) continue;
        // The start of a run of x: is there more of x lower down, with
        // something between that isn't inside x?
        let k = r - 1;
        while (k >= 0 && regionOf[k][c] !== x) k--;
        if (k < 0) continue;
        for (let g = k + 1; g < r; g++) if (!inside(x, regionOf[g][c])) level = { region: x, ridge: r };
      }
    }
    if (!level) return { regionOf, regions };
    for (let c = 0; c < N; c++) {
      if (regionOf[level.ridge][c] === level.region && regionOf[level.ridge - 1][c] === level.region) cut[level.ridge][c] = true;
    }
  }
  const { regionOf, regions } = build();
  return { regionOf, regions };
}

function reaches(regions: Region[], from: number, to: number): boolean {
  const seen = new Set<number>();
  let at: number | null = from;
  while (at !== null && !seen.has(at)) {
    if (at === to) return true;
    seen.add(at);
    at = regions[at].parent;
  }
  return false;
}

const colourName = (colour: Yarn) => `yarn ${colour}`;

/** Columns from `a` to `b` inclusive, in that order. */
function range(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let c = a; c <= b; c++) out.push(c);
  else for (let c = a; c >= b; c--) out.push(c);
  return out;
}

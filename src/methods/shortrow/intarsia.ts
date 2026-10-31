/**
 * Knitting any grid with intarsia alone — the baseline of Stage F (PLAN.md §5).
 *
 * Every ridge is two rows: a right-side row from column 1 across to the left
 * edge, and a wrong-side row back. Along the right-side row, each run of colour
 * is worked by a yarn waiting at the start of the run; at the end of the run it
 * hands over to the next yarn on the next stitch. On the way back each yarn
 * works its own run again, home to where it began. No turns at all.
 *
 * That keeps the rules of §5 by construction:
 *  - no turns, so no turn can sit on another (rule 1);
 *  - the needle never jumps: each run starts on the stitch after the last
 *    (rule 2);
 *  - every yarn goes out and comes back within the ridge, ending where it
 *    started (rule 3).
 *
 * So any grid of whole ridges can be knitted this way — the claim PLAN.md §8
 * asked F to prove. The price is yarn: a run needs a yarn of its colour waiting
 * at its first stitch, or within a short carry across the back (two stitches,
 * MAX_CARRY). When a run starts further than that from any yarn of its colour —
 * a second island, background on the far side of a wide motif — another ball
 * is joined, two more ends. The count is
 * reported, and it's what the short-row version (F2) exists to bring down.
 */
import { MAX_CARRY, type Column, type Pass, type Yarn } from "./passes";
import { runsOf, type Grid } from "./grid";

export interface Knitted {
  passes: Pass[];
  /** Each ball of yarn used, with its colour and where it was joined. */
  strands: { id: Yarn; colour: Yarn; joinedAt: Column; ridge: number }[];
  /** Two per ball: a tail where it's joined and one where it's cut. */
  ends: number;
}

export function knitIntarsia(grid: Grid): Knitted {
  const passes: Pass[] = [];
  const strands: Knitted["strands"] = [];
  const waitingAt = new Map<Yarn, Column>();

  grid.cells.forEach((row, ridge) => {
    const runs = runsOf(row);

    // Which ball works each run, in order along the right-side row: one of its
    // colour waiting at the run's first stitch; failing that, the nearest within
    // a short carry across the back (MAX_CARRY) — including a ball that has just
    // worked an earlier run in this same row and stopped close by, carried
    // behind the stitches between (a single-stitch dot needs no second ball of
    // background); failing that, a new ball joined there.
    const at = new Map(waitingAt);
    const balls = runs.map((run) => {
      const nearest = strands
        .filter((s) => s.colour === run.colour)
        .map((s) => ({ s, d: Math.abs((at.get(s.id) ?? Infinity) - run.from) }))
        .filter(({ d }) => d <= MAX_CARRY)
        .sort((a, b) => a.d - b.d)[0];
      let id: Yarn;
      if (nearest) {
        id = nearest.s.id;
      } else {
        const count = strands.filter((s) => s.colour === run.colour).length;
        id = count === 0 ? run.colour : `${run.colour}${count + 1}`;
        strands.push({ id, colour: run.colour, joinedAt: run.from, ridge });
      }
      at.set(id, run.to);
      return id;
    });

    // Right-side row: across, handing over at every change of colour.
    runs.forEach((run, k) => passes.push({ yarn: balls[k], from: run.from, to: run.to }));
    // Wrong-side row: back, each ball working its own run home.
    for (let k = runs.length - 1; k >= 0; k--) {
      passes.push({ yarn: balls[k], from: runs[k].to, to: runs[k].from });
      waitingAt.set(balls[k], runs[k].from);
    }
  });

  return { passes, strands, ends: strands.length * 2 };
}

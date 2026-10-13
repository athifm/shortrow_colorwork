/**
 * The forward model: a list of passes in, the fabric out.
 *
 * This is the smallest program that captures what the textbook teaches (PLAN.md
 * §2.2, §2.5). Balanced short-row colorwork can be tracked with two things per
 * stitch: how many rows it has been worked so far, and which yarn worked each of
 * them. A pattern is just an ordered list of passes, each one yarn knitting one
 * unbroken run of stitches before it turns or reaches an edge.
 *
 * It runs in one direction only — pattern to fabric. The reverse, a picture to a
 * list of passes, is the hard problem, and it only gets attempted once this side
 * reproduces the textbook's own patterns exactly. A model that cannot explain the
 * patterns that work is in no position to invent new ones.
 *
 * Columns are numbered the way the textbook's charts number them: 1 at the
 * right-hand edge, counting leftwards. Keeping the book's convention costs an
 * offset here and saves a translation every time a chart is checked by eye.
 */

/** A yarn, named the way patterns name them: "A" for the background, "B" for
 *  the motif, and so on. */
export type Yarn = string;

/** A stitch position on the needle, 1 at the right-hand edge — the numbering
 *  printed along the bottom of every chart in the textbook. */
export type Column = number;

/**
 * One pass of the needle: one yarn, one unbroken run of stitches, one direction.
 *
 * Given as the two columns it runs between, in knitting order, because that is
 * how it reads off a chart — "B from column 1 to column 24", then turn. The
 * direction falls out of which end is which, so a pass cannot disagree with
 * itself about where it is going.
 *
 * A written row in a pattern can hold several passes. "K41, SR, K16, SR, …" is
 * a zigzag of shrinking passes in one yarn, and each leg is its own pass here.
 */
export interface Pass {
  yarn: Yarn;
  from: Column;
  to: Column;
}

export interface Problem {
  /** Which pass, counting from 1, the way pattern rows are counted. */
  pass: number;
  message: string;
}

export interface Fabric {
  stitches: number;
  /** Rows worked over each stitch. Index 0 is column 1, the right-hand edge. */
  heights: number[];
  /** The yarns that worked each stitch, bottom to top. The picture, column by
   *  column — read up any one of these and you are reading up that wale of the
   *  finished fabric. */
  stacks: Yarn[][];
  /** Which pass made each row of each stitch — same shape as `stacks`, holding
   *  the pass's index in the list given (from 0). Lets a view answer "where did
   *  this stitch come from?" without replaying the pattern itself. */
  madeBy: number[][];
  /** Every stitch at the same height. The textbook's central rule: a pattern
   *  that ends a repeat unbalanced pulls up and stretches. */
  balanced: boolean;
  problems: Problem[];
}

/**
 * Work through the passes in order and report the fabric they make.
 *
 * Every stitch in a pass gets one more row, in that pass's yarn. That includes
 * the stitch the pass turns on: with German short rows it becomes a double
 * stitch, slipped at the start of the return pass and stretched up to fill that
 * row too. Counting it in both is a working assumption, not a measurement — it is
 * the reading under which every stripe pattern in the textbook balances, and the
 * first test stripe exists partly to check it (PLAN.md §2.4).
 *
 * Problems are reported, never thrown, so that one mistake in a long pattern
 * still produces a fabric to look at — the rest of the pattern is usually worth
 * seeing. A pass that runs off the needle is skipped, since there is nothing it
 * could sensibly have worked. A pass that starts somewhere its yarn isn't is
 * reported and then worked anyway, because the stitches it covers are real.
 */
export function simulate(stitches: number, passes: readonly Pass[]): Fabric {
  const heights: number[] = Array.from({ length: stitches }, () => 0);
  const stacks: Yarn[][] = Array.from({ length: stitches }, () => []);
  const madeBy: number[][] = Array.from({ length: stitches }, () => []);
  const problems: Problem[] = [];

  // Where each yarn is waiting. Yarns are not carried across the back, so a
  // yarn stays exactly where its last pass ended, and the next pass in that yarn
  // has to begin there. A yarn missing from this map has not been joined yet,
  // and can start anywhere.
  const waitingAt = new Map<Yarn, Column>();

  passes.forEach((pass, index) => {
    const number = index + 1;
    const offNeedle = [pass.from, pass.to].filter(
      (c) => !Number.isInteger(c) || c < 1 || c > stitches,
    );

    if (offNeedle.length > 0) {
      problems.push({
        pass: number,
        message:
          `Yarn ${pass.yarn} runs from column ${pass.from} to ${pass.to}, ` +
          `but the needle only holds columns 1 to ${stitches}. Skipped.`,
      });
      return;
    }

    const waiting = waitingAt.get(pass.yarn);
    if (waiting !== undefined && waiting !== pass.from) {
      problems.push({
        pass: number,
        message:
          `Yarn ${pass.yarn} is waiting at column ${waiting}, ` +
          `but this pass starts at column ${pass.from}. ` +
          `Yarns aren't carried, so it can only start where it stopped.`,
      });
    }

    const low = Math.min(pass.from, pass.to);
    const high = Math.max(pass.from, pass.to);
    for (let column = low; column <= high; column++) {
      heights[column - 1] += 1;
      stacks[column - 1].push(pass.yarn);
      madeBy[column - 1].push(index);
    }

    waitingAt.set(pass.yarn, pass.to);
  });

  const balanced = heights.every((h) => h === heights[0]);

  return { stitches, heights, stacks, madeBy, balanced, problems };
}

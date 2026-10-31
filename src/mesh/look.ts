/**
 * What a knitting plan will look like, painted back onto the drawing's grid —
 * step L1 of "Draw the look" (PLAN.md §5).
 *
 * A drawing cell is one stitch wide and one ridge — two rows — tall. On the
 * needle, the cell at ridge r of a column is that column's rows 2r and 2r + 1.
 * In the finished fabric the rows have moved: short rows cram extra rows into
 * some columns, the fabric relaxes (mesh/relax.ts), and each row ends up a
 * little higher or lower than it was knitted. So the cell's place in the
 * fabric — heights 2r to 2r + 2 — is filled by whichever rows have moved
 * there.
 *
 * The look gives each cell the colour that fills most of it, and how much of it
 * that colour fills. Columns stay upright in fabric that lies flat as a
 * rectangle, so a colour only ever moves up or down its own column. For a
 * pattern that fans or won't lie flat, there is no look on this grid yet: the
 * plan aims for a rectangle (decided 2026-10-30).
 */
import type { Fabric, Pass, Yarn } from "../methods/shortrow/passes";
import { relax, type RelaxOptions } from "./relax";

export interface Look {
  /** cells[ridge][column − 1]: the colour that fills most of that cell. Ridge 0
   *  is the cast-on, column 1 the right edge — the same layout as a Grid. */
  cells: Yarn[][];
  /** How much of each cell that colour fills, from 0 to 1. */
  share: number[][];
}

/**
 * The look of a balanced fabric, or null if it doesn't balance.
 *
 * `colourOf` turns a strand into its colour: "B2", a second ball of B, is B.
 */
export function lookOf(
  fabric: Fabric,
  passes: readonly Pass[],
  options: Pick<RelaxOptions, "yarnPull" | "doubleStitch" | "endsInTurn">,
  colourOf: (strand: Yarn) => Yarn,
): Look | null {
  if (!fabric.balanced || fabric.stitches === 0) return null;
  const rows = fabric.heights[0];
  if (rows % 2 !== 0) return null;
  const ridges = rows / 2;
  const relaxed = relax(fabric, passes, options);

  const cells: Yarn[][] = [];
  const share: number[][] = [];
  for (let r = 0; r < ridges; r++) {
    const bottom = 2 * r;
    const top = 2 * r + 2;
    const rowCells: Yarn[] = [];
    const rowShare: number[] = [];
    fabric.stacks.forEach((stack, i) => {
      // How much of this cell each colour covers.
      const cover = new Map<Yarn, number>();
      stack.forEach((strand, k) => {
        const overlap = Math.min(top, relaxed.upper[i][k]) - Math.max(bottom, relaxed.lower[i][k]);
        if (overlap <= 0) return;
        const colour = colourOf(strand);
        cover.set(colour, (cover.get(colour) ?? 0) + overlap);
      });
      let best: Yarn = colourOf(stack[2 * r]);
      let most = -1;
      for (const [colour, amount] of cover) {
        if (amount > most) {
          best = colour;
          most = amount;
        }
      }
      rowCells.push(best);
      rowShare.push(Math.max(0, most) / (top - bottom));
    });
    cells.push(rowCells);
    share.push(rowShare);
  }
  return { cells, share };
}

/** The plan read literally, as on the needle: ridge r of a column is its rows
 *  2r and 2r + 1, coloured by the first of them. */
export function needleOf(fabric: Fabric, colourOf: (strand: Yarn) => Yarn): Yarn[][] | null {
  if (!fabric.balanced || fabric.heights[0] % 2 !== 0) return null;
  const ridges = fabric.heights[0] / 2;
  return Array.from({ length: ridges }, (_, r) => fabric.stacks.map((stack) => colourOf(stack[2 * r])));
}

/**
 * Rules a pattern must keep beyond counting — checked on every pattern,
 * whether generated, typed in, or from the book (PLAN.md §9).
 *
 * Rule 1: no turning stitch directly on top of another. A turn leaves a German
 * double stitch: the last stitch worked, slipped and stretched to fill the
 * return pass's row as well, so it occupies two rows of its column. A second
 * turn in the same column with no ordinary row between them puts one double
 * stitch straight onto the other — a weak, holey spot. Once an ordinary row has
 * been knitted over it, a turn there is fine again.
 */
import type { Column, Fabric, Pass } from "./passes";

/**
 * Which passes end in a turn. The reader knows from the SRs it read. For passes
 * made any other way: a pass turns when the next one starts on the stitch it
 * ended on — unless that stitch is at an edge, where turning is simply the end
 * of a row and leaves no double stitch.
 */
export function turnsOf(passes: readonly Pass[], stitches: number): boolean[] {
  return passes.map((p, k) => {
    const next = passes[k + 1];
    const atEdge = p.to === 1 || p.to === stitches;
    return next !== undefined && next.from === p.to && !atEdge;
  });
}

export interface StackedTurn {
  column: Column;
  /** The row (counted from 1 within the column) where the upper double stitch starts. */
  row: number;
  /** The two passes (counted from 1) whose turns are stacked. */
  passes: [number, number];
}

export function stackedTurns(fabric: Fabric, passes: readonly Pass[], endsInTurn: readonly boolean[]): StackedTurn[] {
  const found: StackedTurn[] = [];
  fabric.madeBy.forEach((col, i) => {
    const column = i + 1;
    // Rows of this column that start a double stitch, with the turning pass.
    const starts: { row: number; pass: number }[] = [];
    col.forEach((p, r) => {
      if (endsInTurn[p] && passes[p]?.to === column && col[r + 1] === p + 1) starts.push({ row: r, pass: p });
    });
    for (let k = 0; k + 1 < starts.length; k++) {
      // The lower double stitch fills rows r and r+1; the upper starts right at r+2.
      if (starts[k + 1].row === starts[k].row + 2) {
        found.push({ column, row: starts[k + 1].row + 1, passes: [starts[k].pass + 1, starts[k + 1].pass + 1] });
      }
    }
  });
  return found;
}

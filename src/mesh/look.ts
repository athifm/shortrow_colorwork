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

/** Where the fabric's bottom edge is, in the heights mesh/relax.ts gives: it
 *  puts row r's centre at r + 1, so the first row starts half a row up. */
export const BOTTOM_EDGE = 0.5;

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
    const bottom = 2 * r + BOTTOM_EDGE;
    const top = bottom + 2;
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

/** A piece of the outline of a patch of colour in the relaxed fabric, on the
 *  drawing's grid: across one column at a height, or up the line between two
 *  columns. Heights are in ridges above the cast-on; column 0 is column 1. */
export type Edge =
  | { kind: "across"; column: number; at: number }
  | { kind: "up"; after: number; from: number; to: number };

/** Heights closer than this, in rows, are the same height: arithmetic, not knitting. */
const SAME_HEIGHT = 1e-6;

/**
 * Where the edges between colours land once the fabric relaxes — to draw over
 * the drawing, so each can be seen against the edge that was drawn. `lower` and
 * `upper` are each stitch's edges in rows, as mesh/relax.ts and mesh/settle.ts
 * give them; columns must be upright (fabric that lies flat as a rectangle).
 */
export function edgesOf(
  fabric: Fabric,
  lower: readonly (readonly number[])[],
  upper: readonly (readonly number[])[],
  colourOf: (strand: Yarn) => Yarn,
): Edge[] {
  const edges: Edge[] = [];
  const ridges = (rows: number) => (rows - BOTTOM_EDGE) / 2;

  // Across each column: wherever one colour stops and another starts.
  fabric.stacks.forEach((stack, i) => {
    for (let k = 0; k + 1 < stack.length; k++) {
      if (colourOf(stack[k]) !== colourOf(stack[k + 1])) edges.push({ kind: "across", column: i, at: ridges(upper[i][k]) });
    }
  });

  // Up the line between two columns: wherever they differ at the same height.
  const colourAt = (i: number, height: number): Yarn | null => {
    const k = fabric.stacks[i].findIndex((_, r) => lower[i][r] <= height && height < upper[i][r]);
    return k < 0 ? null : colourOf(fabric.stacks[i][k]);
  };
  for (let i = 0; i + 1 < fabric.stacks.length; i++) {
    const breaks = [...new Set([...lower[i], ...upper[i], ...lower[i + 1], ...upper[i + 1]])].sort((a, b) => a - b);
    let open: { from: number; to: number } | null = null;
    for (let b = 0; b + 1 < breaks.length; b++) {
      // Two columns' edges at the same height differ by rounding only.
      if (breaks[b + 1] - breaks[b] < SAME_HEIGHT) continue;
      const middle = (breaks[b] + breaks[b + 1]) / 2;
      const here = colourAt(i, middle);
      const there = colourAt(i + 1, middle);
      if (here !== null && there !== null && here !== there) {
        if (open) open.to = breaks[b + 1];
        else open = { from: breaks[b], to: breaks[b + 1] };
      } else if (open) {
        edges.push({ kind: "up", after: i, from: ridges(open.from), to: ridges(open.to) });
        open = null;
      }
    }
    if (open) edges.push({ kind: "up", after: i, from: ridges(open.from), to: ridges(open.to) });
  }
  return edges;
}

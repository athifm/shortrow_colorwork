/**
 * A drawing made bigger, or wider — PLAN.md §6, step 4. For trying whether a
 * shape that breaks the laws (laws.ts) only needs more room:
 *
 *  - **bigger ×2** — twice the stitches and twice the ridges, the same picture.
 *    Cures what is too *small*: a detail one stitch wide gets two.
 *  - **wider ×2** — twice the stitches, the same ridges. Cures what is too
 *    *steep*: every slope half as steep, at the price of the proportions.
 *
 * Plainly doubling every cell would turn each slope into a staircase with
 * steps twice as tall, breaking the slope law where the drawing kept it. So
 * the edges are redrawn smoothly instead: a drawing is read column by column
 * as stretches of colour, and each column becomes two, each leaning a quarter
 * of the way towards its neighbour on that side — where the neighbour has the
 * same colours in the same order; where it hasn't (the shape ends there), the
 * column is simply kept.
 */
import type { Yarn } from "./passes";
import type { Grid } from "./grid";
import { checkLaws } from "./laws";

/** A column as stretches of colour, bottom up: each with where it ends. */
type Stretches = { colour: Yarn; top: number }[];

const QUARTER = 1 / (2 * 2);

function stretchesOf(grid: Grid, c: number): Stretches {
  const out: Stretches = [];
  for (let r = 0; r < grid.height; r++) {
    const colour = grid.cells[r][c];
    const last = out[out.length - 1];
    if (last && last.colour === colour) last.top = r + 1;
    else out.push({ colour, top: r + 1 });
  }
  return out;
}

/**
 * Column `own`, leaning a quarter of the way towards `beside`.
 *
 * An edge between two colours is the same edge in the next column if it lies
 * between the same two colours, in the same order up the column; such an edge
 * moves a quarter of the way to where its neighbour has it. So the outline of
 * a shape leans smoothly even where something nested inside it starts.
 *
 * A stretch of colour that `beside` has nothing of, at those ridges, ends
 * here, and is tapered instead: half as thick, from its bottom — so a point
 * one ridge thick, made two by doubling the ridges, is a point again, and a
 * blunt end gets a first step towards one. The ridges it gives up go to the
 * stretch above it (below, for the topmost).
 */
function lean(own: Stretches, beside: Stretches | undefined, roundUpFrom: number): Stretches {
  if (!beside || own.length === 1) return own;
  const out = own.map((s) => ({ ...s }));

  // Match the edges of the two columns, bottom up: the longest run of edges
  // they share, in order.
  const edge = (st: Stretches, k: number) => `${st[k].colour}/${st[k + 1].colour}`;
  const n = own.length - 1;
  const m = beside.length - 1;
  const best = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      best[i][j] = edge(own, i) === edge(beside, j) ? 1 + best[i + 1][j + 1] : Math.max(best[i + 1][j], best[i][j + 1]);
    }
  }
  const matched = own.map(() => false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (edge(own, i) === edge(beside, j)) {
      out[i].top = Math.floor((1 - QUARTER) * own[i].top + QUARTER * beside[j].top + (1 - roundUpFrom));
      matched[i] = true;
      i++;
      j++;
    } else if (best[i + 1][j] >= best[i][j + 1]) i++;
    else j++;
  }

  // Taper what ends here: a stretch with neither edge shared, and nothing of
  // its colour beside it.
  const colourAt = (stretches: Stretches, r: number) => stretches.find((s) => r < s.top)!.colour;
  own.forEach((s, k) => {
    const bottom = k === 0 ? 0 : own[k - 1].top;
    const thick = s.top - bottom;
    if (thick < 2 || matched[k] || (k > 0 && matched[k - 1])) return;
    for (let r = bottom; r < s.top; r++) if (colourAt(beside, r) === s.colour) return;
    const keep = Math.max(1, Math.floor(thick / 2));
    if (k + 1 < out.length) out[k].top = bottom + keep;
    else out[k - 1].top = s.top - keep;
  });

  // Edges stay in order up the column.
  for (let k = 1; k < out.length; k++) out[k].top = Math.max(out[k].top, out[k - 1].top);
  return out;
}

function columnOf(stretches: Stretches, height: number): Yarn[] {
  const out: Yarn[] = [];
  for (const s of stretches) while (out.length < Math.min(s.top, height)) out.push(s.colour);
  // The last stretch runs to the top, whatever rounding did.
  while (out.length < height) out.push(stretches[stretches.length - 1].colour);
  return out;
}

function widened(grid: Grid, roundUpFrom: number): Grid {
  const columns = Array.from({ length: grid.width }, (_, c) => stretchesOf(grid, c));
  const wide: Yarn[][] = [];
  columns.forEach((own, c) => {
    wide.push(
      columnOf(lean(own, columns[c - 1], roundUpFrom), grid.height),
      columnOf(lean(own, columns[c + 1], roundUpFrom), grid.height),
    );
  });
  const cells = Array.from({ length: grid.height }, (_, r) => wide.map((col) => col[r]));
  return { width: wide.length, height: grid.height, cells };
}

/**
 * Twice the stitches, the same ridges: every slope half as steep.
 *
 * A leaning edge lands between ridges and has to be rounded to one. Rounding
 * at the half is the plain choice. Rounding up from a quarter on makes an edge
 * on its way up step a column early and one on its way down a column late —
 * which pulls apart a top and a bottom that both step at one place, so the
 * thickness changes a ridge at a time; from three quarters on does the
 * opposite. Which is best depends on the drawing, so all three are made and
 * the one that breaks the laws in the fewest places is kept — the plain one
 * on a tie.
 */
export function widen(grid: Grid): Grid {
  const HALF = 1 / 2;
  const tries = [HALF, QUARTER, 1 - QUARTER].map((from) => widened(grid, from));
  const places = tries.map((g) => checkLaws(g).length);
  return tries[places.indexOf(Math.min(...places))];
}

/** Twice the stitches and twice the ridges: the same picture, with more room. */
export function enlarge(grid: Grid): Grid {
  const tall: Grid = {
    width: grid.width,
    height: grid.height * 2,
    cells: grid.cells.flatMap((row) => [[...row], [...row]]),
  };
  return widen(tall);
}

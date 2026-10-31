/**
 * A picture as the fabric will hold it: a grid of cells, one stitch wide and one
 * ridge (two rows) tall (PLAN.md §1).
 *
 * Written as text, the way you'd draw it: one line per ridge, top of the fabric
 * first; the first character of a line is the left edge — the last column —
 * and the last character is column 1, at the right edge where knitting starts.
 *
 *   `.`  background, yarn A
 *   `#`  motif, yarn B
 *   `o`  a third colour, yarn C
 *   a letter A–J stands for that yarn — up to ten colours (PLAN.md §8, L3).
 */
import type { Column, Yarn } from "./passes";

export interface Grid {
  /** Stitches across. */
  width: number;
  /** Ridges up. */
  height: number;
  /** cells[ridge][column − 1]: the yarn for that cell. Ridge 0 is the bottom. */
  cells: Yarn[][];
}

const SYMBOLS: Record<string, Yarn> = { ".": "A", "#": "B", o: "C" };

export function parseGrid(text: string): { grid: Grid | null; problems: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const problems: string[] = [];
  if (lines.length === 0) return { grid: null, problems: ["The grid is empty."] };

  const width = lines[0].length;
  lines.forEach((l, i) => {
    if (l.length !== width) problems.push(`Line ${i + 1} is ${l.length} stitches wide; the first line is ${width}.`);
    for (const ch of l) {
      if (!(ch in SYMBOLS) && !/^[A-Ja-j]$/.test(ch)) problems.push(`Line ${i + 1}: "${ch}" isn't a colour. Use . # o or a letter A–J.`);
    }
  });
  if (problems.length > 0) return { grid: null, problems };

  // Bottom ridge first; within a line, the last character is column 1.
  const cells = [...lines].reverse().map((l) => [...l].reverse().map((ch) => SYMBOLS[ch] ?? ch.toUpperCase()));
  return { grid: { width, height: lines.length, cells }, problems };
}

/** The runs of one colour along a ridge, from column 1 upwards. */
export function runsOf(row: readonly Yarn[]): { colour: Yarn; from: Column; to: Column }[] {
  const runs: { colour: Yarn; from: Column; to: Column }[] = [];
  row.forEach((colour, i) => {
    const last = runs[runs.length - 1];
    if (last && last.colour === colour) last.to = i + 1;
    else runs.push({ colour, from: i + 1, to: i + 1 });
  });
  return runs;
}

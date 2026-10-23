/**
 * Writing passes back out as a pattern's written rows — the reverse of
 * written.ts.
 *
 * The app thinks in passes: one trip of the needle in one yarn (PLAN.md §9). A
 * knitter reads written rows, which group passes: "Row 8: (B) K41, SR, K16, SR,
 * …" is thirteen of them. Generated patterns need writing out, and the test of
 * a writer is simple: read back what it wrote, and the passes must come out
 * identical.
 *
 * Where a written row ends is a matter of style, and the style here is the
 * textbook's, worked out from its patterns:
 *
 *  - A row ends when the needle reaches an edge.
 *  - A row also ends at a turn, but only when the pass after the turn runs all
 *    the way back to an edge. Harvest writes its zigzag "K41, SR, K16, SR, …
 *    K18, SR" as one row, and the run home, "Knit to end", as the next.
 *  - A row only ends after a pass that went the row's own way, so right- and
 *    wrong-side rows keep alternating as the reader counts them.
 *
 * Wording, also the book's: "Knit all sts" for a row that is one full pass;
 * "Knit to end" for any pass that reaches an edge — capitalised only when it
 * opens the row, as in "SR, knit to end"; "K" and a count otherwise. The yarn is
 * named at the start of every row and wherever it changes. Identical
 * neighbouring rows are merged: "Rows 4 to 5: (A) Knit all sts".
 */
import type { Column, Pass, Yarn } from "./passes";
import type { Side } from "./written";

export interface WrittenOut {
  /** The pattern as text, one written row (or merged run of rows) per line. */
  text: string;
  /** Number of written rows, counting a merged "Rows 4 to 5" as two. */
  rows: number;
  /** Passes that can't be written because the needle would have to jump. */
  problems: string[];
}

type Direction = 1 | -1;

/** "B2" is the second strand of yarn B: a pattern just says (B). */
export const colourOfStrand = (strand: Yarn): string => strand.replace(/\d+$/, "");

export function writeRows(
  passes: readonly Pass[],
  stitches: number,
  firstSide: Side,
  colourOf: (strand: Yarn) => string = colourOfStrand,
): WrittenOut {
  const problems: string[] = [];
  const bodies: string[] = [];
  const sides: Side[] = [];

  let direction: Direction = firstSide === "RS" ? 1 : -1;
  const edgeAhead = (d: Direction): Column => (d === 1 ? stitches : 1);
  const edgeBehind = (d: Direction): Column => (d === 1 ? 1 : stitches);

  // The needle: where the last stitch was worked, and whether the next pass
  // starts on that same stitch (after a turn or a row end) or the next one
  // (after a yarn hands over mid-row). The same model the reader uses.
  let needle: Column = edgeBehind(direction);
  let fresh = true;

  let tokens: string[] = [];
  let rowDirection: Direction = direction;
  let lastStrand: Yarn | null = null;

  const endRow = () => {
    bodies.push(tokens.join(", "));
    sides.push(rowDirection === 1 ? "RS" : "WS");
    tokens = [];
    lastStrand = null;
  };

  // Does the run of passes starting at `from` — one pass, plus any yarns it
  // hands over to mid-row — reach the edge it's heading for?
  const runReachesEdge = (from: number, d: Direction): boolean => {
    let k = from;
    while (k + 1 < passes.length) {
      const here = passes[k];
      const next = passes[k + 1];
      if (next.yarn !== here.yarn && next.from === here.to + d) k++;
      else break;
    }
    return passes[k] !== undefined && passes[k].to === edgeAhead(d);
  };

  for (let k = 0; k < passes.length; k++) {
    const pass = passes[k];
    const start = fresh ? needle : needle + direction;
    if (pass.from !== start) {
      problems.push(
        `Pass ${k + 1} (yarn ${pass.yarn}) starts at column ${pass.from}, but the needle is at column ${start}. ` +
          `The needle can't jump, so this can't be written as rows.`,
      );
      break;
    }
    if ((pass.to - pass.from) * direction < 0) {
      problems.push(`Pass ${k + 1} (yarn ${pass.yarn}) runs the wrong way for where the needle is heading.`);
      break;
    }

    const opensRow = tokens.length === 0;
    const count = Math.abs(pass.to - pass.from) + 1;
    let instruction: string;
    if (opensRow && pass.from === edgeBehind(direction) && pass.to === edgeAhead(direction)) {
      instruction = "Knit all sts";
    } else if (pass.to === edgeAhead(direction)) {
      instruction = opensRow ? "Knit to end" : "knit to end";
    } else {
      instruction = `K${count}`;
    }
    tokens.push(pass.yarn === lastStrand ? instruction : `(${colourOf(pass.yarn)}) ${instruction}`);
    lastStrand = pass.yarn;

    const passDirection = direction;
    needle = pass.to;
    fresh = false;

    const next = passes[k + 1];
    if (next === undefined) {
      if (needle !== edgeAhead(direction)) tokens.push("SR");
      endRow();
      break;
    }

    if (next.from === needle + direction) {
      // Another yarn carries on from the next stitch (or the same one, if a
      // pattern spells a pass in two parts). Same row, same direction.
      continue;
    }

    if (next.from !== needle) {
      problems.push(
        `Pass ${k + 2} (yarn ${next.yarn}) starts at column ${next.from}, but the needle is at column ${needle}. ` +
          `The needle can't jump, so this can't be written as rows.`,
      );
      endRow();
      break;
    }

    // The next pass starts on the stitch just worked: the needle turns.
    if (needle === edgeAhead(direction)) {
      // At an edge, turning is just the end of the row.
      endRow();
      direction = direction === 1 ? -1 : 1;
      rowDirection = direction;
      fresh = true;
      continue;
    }

    tokens.push("SR");
    direction = direction === 1 ? -1 : 1;
    fresh = true;
    if (passDirection === rowDirection && runReachesEdge(k + 1, direction)) {
      endRow();
      rowDirection = direction;
    }
  }

  if (tokens.length > 0) endRow();

  // Number the rows, naming the side on the first two as the book does, and
  // merge identical neighbours after that.
  const lines: string[] = [];
  let n = 0;
  while (n < bodies.length) {
    const first = n + 1;
    if (first <= 2) {
      lines.push(`Row ${first} (${sides[n]}): ${bodies[n]}`);
      n++;
      continue;
    }
    let last = first;
    while (last < bodies.length && bodies[last] === bodies[n]) last++;
    lines.push(last === first ? `Row ${first}: ${bodies[n]}` : `Rows ${first} to ${last}: ${bodies[n]}`);
    n = last;
  }

  return { text: lines.join("\n"), rows: bodies.length, problems };
}

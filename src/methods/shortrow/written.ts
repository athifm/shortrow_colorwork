/**
 * Reading a pattern's written rows — "Row 2 (RS): (B) K24, SR" — into passes.
 *
 * The forward simulator (passes.ts) takes passes with explicit columns, which is
 * exact but not how anybody writes a pattern. Patterns say where to *stop*; where
 * to *start* is left implicit, because a knitter always knows — the needle is
 * wherever the last stitch was worked. This file supplies that knowledge, so a
 * pattern can be typed or pasted exactly as printed.
 *
 * Everything here was worked out against the textbook's patterns, all five of
 * which read back to the same passes that were checked by hand against their
 * charts (research/check-book-patterns.ts):
 *
 *  - RS rows work leftwards along the chart (column numbers rising), WS rows
 *    rightwards. Columns count from 1 at the right-hand edge.
 *  - "SR" turns. The next stitches start *on* the stitch just worked: with a
 *    German short row it becomes the double stitch, and the chart counts it in
 *    the return pass.
 *  - A row ends either with a turn or at an edge, and the next row starts there,
 *    going back the other way.
 *  - A new yarn named mid-row — "(A) K4, (B) K14" — picks up from the *next*
 *    stitch, going the same way. Nothing turned; one yarn simply handed over to
 *    another.
 *  - Yarns aren't carried. If a yarn is needed somewhere none of that colour is
 *    waiting, the knitter must be using another strand of it — another ball or
 *    bobbin, and two more ends to weave in. That gets said, not hidden.
 */
import type { Column, Pass, Yarn } from "./passes";

export type Side = "RS" | "WS";

/** One column step: +1 works leftwards along the chart (RS), −1 rightwards. */
type Direction = 1 | -1;

export interface PassInfo {
  /** The written row this pass belongs to, numbered as printed. */
  row: number;
  /** Which repeat of the pattern, counting from 1. */
  repeat: number;
  side: Side;
  /** The yarn as the pattern names it: "A", "B". */
  colour: string;
  /** The physical strand. Usually the same as the colour; "B2" when a second
   *  strand of B had to be joined. */
  strand: Yarn;
  /** Where the chart would draw ∞ — the cell just past the last stitch — when
   *  this pass ends in a turn. Null when it doesn't, and also when the turn is
   *  at the very edge, where there is no cell past the last stitch to draw in. */
  turnAt: Column | null;
  /** Whether this pass ends in a turn, edge or not. Its last stitch is then a
   *  German double stitch, stretched to fill the return pass's row too. */
  endsInTurn: boolean;
}

export interface Strand {
  id: Yarn;
  colour: string;
  joinedAt: Column;
  row: number;
  repeat: number;
}

export interface RowMessage {
  /** Row as printed; 0 for a message about the text as a whole. */
  row: number;
  repeat: number;
  message: string;
}

export interface WrittenPattern {
  passes: Pass[];
  /** One entry per pass, in the same order. */
  info: PassInfo[];
  strands: Strand[];
  /** Rows in one repeat, as written. */
  rowsPerRepeat: number;
  /** Things that are wrong or can't be read. */
  problems: RowMessage[];
  /** Things worth knowing that aren't wrong — a second strand joined, a side
   *  assumed. */
  notes: RowMessage[];
}

interface WrittenRow {
  number: number;
  side: Side | null;
  body: string;
}

const ROW_LINE =
  /^rows?\s+(?<first>\d+)(?:\s*(?:to|-|–)\s*(?<last>\d+))?\s*(?:\((?<side>rs|ws)\))?\s*:\s*(?<body>.*)$/i;
const YARN_PREFIX = /^\((?<yarn>[a-z][a-z\d]*)\)\s*(?<rest>.*)$/i;
const KNIT_N = /^k\s*(?<count>\d+)$/i;
const TURN = /^sr$/i;
const TO_END = /^knit\s+to\s+(?:the\s+)?end$/i;
const ALL = /^knit\s+all(?:\s+(?:sts|stitches))?$/i;

/** Split pasted text into rows, expanding "Rows 4 to 5" into two. */
function readRows(text: string, problems: RowMessage[], notes: RowMessage[]): WrittenRow[] {
  const rows: WrittenRow[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "") return;

    const m = ROW_LINE.exec(line);
    if (!m?.groups) {
      // A pasted page brings its notes and "Repeat rows…" lines with it. Those
      // are fine to skip, but a line that *starts* like a row and can't be read
      // is a typo worth flagging.
      const list = /^rows?\b/i.test(line) ? problems : notes;
      list.push({ row: 0, repeat: 0, message: `Line ${index + 1} isn't a row I can read, so I skipped it: "${line}"` });
      return;
    }

    const first = Number(m.groups.first);
    const last = m.groups.last === undefined ? first : Number(m.groups.last);
    const side = (m.groups.side?.toUpperCase() ?? null) as Side | null;
    for (let n = first; n <= last; n++) {
      rows.push({ number: n, side: n === first ? side : null, body: m.groups.body });
    }
  });

  rows.forEach((row, i) => {
    const expected = i === 0 ? row.number : rows[i - 1].number + 1;
    if (row.number !== expected) {
      problems.push({ row: row.number, repeat: 0, message: `Row ${row.number} follows row ${rows[i - 1].number}. Is a row missing?` });
    }
  });

  return rows;
}

export function readWritten(text: string, stitches: number, repeats = 1): WrittenPattern {
  const problems: RowMessage[] = [];
  const notes: RowMessage[] = [];
  const rows = readRows(text, problems, notes);

  const passes: Pass[] = [];
  const info: PassInfo[] = [];
  const strands: Strand[] = [];
  const waitingAt = new Map<Yarn, Column>();

  if (rows.length === 0) {
    return { passes, info, strands, rowsPerRepeat: 0, problems, notes };
  }

  const firstSide = rows[0].side;
  if (firstSide === null) {
    notes.push({ row: rows[0].number, repeat: 1, message: `Row ${rows[0].number} doesn't say RS or WS, so I've assumed RS.` });
  }

  let direction: Direction = firstSide === "WS" ? -1 : 1;
  const edgeAhead = (d: Direction): Column => (d === 1 ? stitches : 1);
  const edgeBehind = (d: Direction): Column => (d === 1 ? 1 : stitches);

  // Where the needle is: the last stitch worked. `fresh` means the next stitch
  // worked is that same one — true after a turn or at the start of a row, where
  // the knitting doubles back over it. False mid-row, where it carries on to the
  // next stitch.
  let needle: Column = edgeBehind(direction);
  let fresh = true;
  let lastColour: string | null = null;

  for (let repeat = 1; repeat <= repeats; repeat++) {
    for (const row of rows) {
      const side: Side = direction === 1 ? "RS" : "WS";
      const at = { row: row.number, repeat };

      if (row.side !== null && row.side !== side && repeat === 1) {
        problems.push({ ...at, message: `Row ${row.number} says ${row.side}, but counting from row ${rows[0].number} it should be ${side}.` });
      }
      if (row.side !== null && row.side !== side && repeat > 1 && row === rows[0]) {
        problems.push({ ...at, message: `The repeat has an odd number of rows, so row ${row.number} comes round as ${side} the second time instead of ${row.side}.` });
      }

      let colour: string | null = null;
      let strand: Yarn | null = null;
      let justTurned = false;
      let segmentStarted = false;

      const startOfNext = (): Column => (fresh ? needle : needle + direction);

      const pickStrand = (c: string): Yarn => {
        const start = startOfNext();
        const sameColour = strands.filter((s) => s.colour === c);
        const waiting = sameColour.find((s) => waitingAt.get(s.id) === start);
        if (waiting) return waiting.id;

        const id = sameColour.length === 0 ? c : `${c}${sameColour.length + 1}`;
        strands.push({ id, colour: c, joinedAt: start, row: row.number, repeat });
        if (sameColour.length > 0) {
          const elsewhere = sameColour.map((s) => waitingAt.get(s.id)).join(" and ");
          notes.push({ ...at, message: `Row ${row.number}: ${c} is needed at column ${start}, but the ${c} already in use is waiting at column ${elsewhere}. That means joining another strand of ${c} (${id}) — two more ends to weave in.` });
        }
        return id;
      };

      const work = (to: Column) => {
        if (strand === null || colour === null) return;
        const from = startOfNext();
        passes.push({ yarn: strand, from, to });
        info.push({ row: row.number, repeat, side, colour, strand, turnAt: null, endsInTurn: false });
        waitingAt.set(strand, to);
        needle = to;
        fresh = false;
        justTurned = false;
      };

      for (const rawToken of row.body.split(",")) {
        let token = rawToken.trim().replace(/\.$/, "");
        if (token === "") continue;

        const prefix = YARN_PREFIX.exec(token);
        if (prefix?.groups) {
          const named = prefix.groups.yarn.toUpperCase();
          token = prefix.groups.rest.trim();
          if (named !== colour) {
            // A different yarn mid-row is a handoff: it carries on from the next
            // stitch in the same direction. At the start of a row nothing has
            // been worked yet in this row, so it starts where the needle is.
            colour = named;
            strand = pickStrand(named);
            segmentStarted = true;
          }
          if (token === "") continue;
        }

        if (!segmentStarted) {
          // No yarn named at the start of the row: carry on with the last one.
          if (lastColour === null) {
            problems.push({ ...at, message: `Row ${row.number} doesn't say which yarn to use, and no yarn has been used yet.` });
            break;
          }
          colour = lastColour;
          strand = pickStrand(lastColour);
          segmentStarted = true;
        }

        const knit = KNIT_N.exec(token);
        if (knit?.groups) {
          const count = Number(knit.groups.count);
          work(startOfNext() + (count - 1) * direction);
        } else if (TURN.test(token)) {
          if (info.length > 0 && !justTurned) {
            const past = needle + direction;
            const last = info[info.length - 1];
            last.turnAt = past >= 1 && past <= stitches ? past : null;
            last.endsInTurn = true;
          }
          direction = direction === 1 ? -1 : 1;
          fresh = true;
          justTurned = true;
        } else if (TO_END.test(token)) {
          work(edgeAhead(direction));
        } else if (ALL.test(token)) {
          if (startOfNext() !== edgeBehind(direction)) {
            problems.push({ ...at, message: `Row ${row.number} says knit all stitches, but the needle is at column ${needle}, not at the edge.` });
          }
          work(edgeAhead(direction));
        } else {
          problems.push({ ...at, message: `Row ${row.number}: I don't know "${token}". I can read K followed by a number, SR, "knit to end" and "knit all sts".` });
        }
      }

      lastColour = colour ?? lastColour;

      // The row boundary. A row that ended in a turn has already turned; one
      // that ended at an edge turns now. One that just stops mid-row, with
      // nothing to turn on, is a mistake in the pattern.
      if (!justTurned) {
        if (needle !== edgeAhead(direction)) {
          problems.push({ ...at, message: `Row ${row.number} stops at column ${needle} without a turn (SR) and without reaching the edge.` });
        }
        direction = direction === 1 ? -1 : 1;
        fresh = true;
      }
    }
  }

  return { passes, info, strands, rowsPerRepeat: rows.length, problems, notes };
}

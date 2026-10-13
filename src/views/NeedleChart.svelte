<!--
  The needle chart: one line per pass, drawn in the order it's knitted, the way
  the textbook draws its charts. Column 1 is at the right-hand edge. Each cell
  shows its yarn's colour and which way the needle was travelling; ∞ marks a turn.

  This is construction space (PLAN.md §2.1). It is *not* a picture of the fabric:
  a line near the top may sit, in the finished piece, beside one near the bottom.
  That's what the fabric view is for.
-->
<script lang="ts">
  import type { Pass } from "../methods/shortrow/passes";
  import type { PassInfo } from "../methods/shortrow/written";

  let {
    stitches,
    passes,
    info,
    colourOf,
    hovered,
    onhover,
  }: {
    stitches: number;
    passes: Pass[];
    info: PassInfo[];
    colourOf: (colour: string) => string;
    hovered: number | null;
    onhover: (pass: number | null) => void;
  } = $props();

  const CELL = 14;
  const LABEL = 30;
  const FOOT = 18;

  const width = $derived(LABEL + stitches * CELL + 4);
  const height = $derived(passes.length * CELL + FOOT);

  // Line 0 is the first pass knitted, drawn at the bottom like a chart.
  const yOf = (k: number) => (passes.length - 1 - k) * CELL;
  const xOf = (column: number) => LABEL + (stitches - column) * CELL;

  const cellsOf = (p: Pass) => {
    const lo = Math.min(p.from, p.to);
    const hi = Math.max(p.from, p.to);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  };

  // Rising column numbers mean the needle is moving left across the chart.
  const arrowOf = (p: Pass, i: PassInfo) =>
    p.to > p.from ? "<" : p.to < p.from ? ">" : i.side === "RS" ? "<" : ">";

  // Dark text on light yarn, light text on dark yarn.
  function inkFor(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1b1b1f" : "#ffffff";
  }

  const columnTicks = $derived(
    Array.from({ length: stitches }, (_, i) => i + 1).filter(
      (c) => stitches <= 30 || c === 1 || c % 5 === 0,
    ),
  );

  function pick(event: PointerEvent) {
    const el = (event.target as Element).closest("[data-pass]");
    onhover(el ? Number(el.getAttribute("data-pass")) : null);
  }
</script>

<div class="scroll">
  <svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label="Needle chart: one line per pass, in knitting order"
    onpointerover={pick}
    onpointerleave={() => onhover(null)}
  >
    {#each passes as p, k (k)}
      {@const i = info[k]}
      {@const fill = colourOf(i.colour)}
      {@const ink = inkFor(fill)}
      {@const dim = hovered !== null && hovered !== k}
      <g data-pass={k} opacity={dim ? 0.35 : 1}>
        {#each cellsOf(p) as c (c)}
          <rect x={xOf(c)} y={yOf(k)} width={CELL} height={CELL} {fill} class="cell" />
          <text x={xOf(c) + CELL / 2} y={yOf(k) + CELL / 2} fill={ink} class="glyph">{arrowOf(p, i)}</text>
        {/each}
        {#if i.turnAt !== null}
          <rect x={xOf(i.turnAt)} y={yOf(k)} width={CELL} height={CELL} class="turn" />
          <text x={xOf(i.turnAt) + CELL / 2} y={yOf(k) + CELL / 2} class="glyph turn-glyph">∞</text>
        {/if}
        {#if hovered === k}
          {@const cs = cellsOf(p)}
          <rect
            x={xOf(cs[cs.length - 1])}
            y={yOf(k)}
            width={cs.length * CELL}
            height={CELL}
            class="outline"
          />
        {/if}
        {#if k === 0 || info[k - 1].row !== i.row}
          <text x={LABEL - 6} y={yOf(k) + CELL / 2} class="row-label">{i.row}</text>
        {/if}
      </g>
    {/each}
    {#each columnTicks as c (c)}
      <text x={xOf(c) + CELL / 2} y={passes.length * CELL + 12} class="col-label">{c}</text>
    {/each}
  </svg>
</div>

<style>
  .scroll {
    overflow: auto;
    max-height: 70vh;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    padding: 8px;
  }
  svg {
    display: block;
  }
  .cell {
    stroke: var(--grid);
    stroke-width: 0.5;
  }
  .turn {
    fill: var(--surface);
    stroke: var(--grid);
    stroke-width: 0.5;
  }
  .glyph {
    font: 9px/1 var(--mono);
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
  .turn-glyph {
    fill: var(--ink);
    font-size: 11px;
  }
  .outline {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
  }
  .row-label,
  .col-label {
    font: 9px/1 var(--mono);
    fill: var(--muted);
  }
  .row-label {
    text-anchor: end;
    dominant-baseline: central;
  }
  .col-label {
    text-anchor: middle;
  }
</style>

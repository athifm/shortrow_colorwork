<!--
  The fabric: each stitch column's rows stacked bottom to top, in the yarn that
  worked them.

  Two ways to draw it:
   - straight: every row the same height, stacked from a flat bottom. Shows the
     counting plainly — a balanced pattern ends with a flat top, a missing
     catch-up row shows as a dip — but any extra rows can only pile upward.
   - relaxed: each stitch where the fabric settles once the yarn in each pass
     pulls its stitches level (mesh/relax.ts). Ridges curve both ways around a
     motif, as in real knitting. How much they curve rests on a guessed ratio
     in model/physical, so this is a prediction, not yet a measurement.
-->
<script lang="ts">
  import type { Fabric } from "../methods/shortrow/passes";
  import type { Relaxed } from "../mesh/relax";

  let {
    fabric,
    layout,
    colourOfStrand,
    linked,
    onhover,
  }: {
    fabric: Fabric;
    /** Where each stitch settled; null to draw straight. */
    layout: Relaxed | null;
    colourOfStrand: (strand: string) => string;
    /** Highlight every stitch made by passes in this set. */
    linked: (pass: number) => boolean;
    onhover: (pass: number | null) => void;
  } = $props();

  // A garter row is about half as tall as a stitch is wide, so the picture is
  // drawn on cells of that shape rather than squares. A display choice for now;
  // it should come from the knitter's own gauge once there is a gauge input.
  const W = 10;
  const H = 5;

  // Each stitch's lower and upper edge, in rows.
  const lowerOf = (i: number, r: number) => (layout ? layout.lower[i][r] : r);
  const upperOf = (i: number, r: number) => (layout ? layout.upper[i][r] : r + 1);

  const bottom = $derived(layout ? Math.min(...layout.lower.filter((c) => c.length).map((c) => c[0])) : 0);
  const top = $derived(layout ? layout.height : Math.max(1, ...fabric.heights));

  const width = $derived(fabric.stitches * W);
  const height = $derived(Math.max(1, top - bottom) * H);
  const anyLinked = $derived(fabric.madeBy.some((col) => col.some((p) => linked(p))));

  // Column 1 sits at the right, matching the chart and the book.
  const xOf = (index: number) => (fabric.stitches - 1 - index) * W;
  const yOf = (rows: number) => (top - rows) * H;

  function pick(event: PointerEvent) {
    const el = (event.target as Element).closest("[data-pass]");
    onhover(el ? Number(el.getAttribute("data-pass")) : null);
  }
</script>

<div class="scroll">
  <!-- Scales to the panel's width, up to about 20px per stitch so a narrow
       pattern doesn't balloon. -->
  <svg
    viewBox="0 0 {width} {height}"
    style="width: min(100%, {fabric.stitches * 20}px)"
    role="img"
    aria-label="The fabric: each stitch's rows stacked bottom to top"
    onpointerover={pick}
    onpointerleave={() => onhover(null)}
  >
    {#each fabric.stacks as stack, index (index)}
      {#each stack as strand, row (row)}
        {@const pass = fabric.madeBy[index][row]}
        {@const on = linked(pass)}
        {@const lo = lowerOf(index, row)}
        {@const hi = upperOf(index, row)}
        <rect
          data-pass={pass}
          x={xOf(index)}
          y={yOf(hi)}
          width={W}
          height={Math.max(0, hi - lo) * H}
          fill={colourOfStrand(strand)}
          opacity={anyLinked && !on ? 0.3 : 1}
          class:on
        />
      {/each}
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
    height: auto;
    margin: 0 auto;
  }
  rect {
    stroke: var(--grid);
    stroke-width: 0.3;
  }
  rect.on {
    stroke: var(--accent);
    stroke-width: 1;
  }
</style>

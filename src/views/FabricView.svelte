<!--
  The fabric: every stitch in the yarn that worked it.

  Two ways to draw it:
   - straight: every row the same height, stacked from a flat bottom. Shows the
     counting plainly, but any extra rows can only pile upward.
   - relaxed: each stitch where the fabric settles (mesh/settle.ts) — ridges
     curving round motifs, a wedge opening into a fan, whatever the pattern
     makes. Each stitch is drawn as a small tilted quad, square to its column.
     How far ridges bend rests on a fitted guess in model/physical, so this is a
     prediction, not a measurement.
-->
<script lang="ts">
  import type { Fabric } from "../methods/shortrow/passes";
  import type { Shape } from "../mesh/settle";

  let {
    fabric,
    shape,
    showStretch,
    colourOfStrand,
    linked,
    onhover,
  }: {
    fabric: Fabric;
    /** Where each stitch settled; null to draw straight. */
    shape: Shape | null;
    /** Outline stitches whose row has to stretch. */
    showStretch: boolean;
    colourOfStrand: (strand: string) => string;
    /** Highlight every stitch made by passes in this set. */
    linked: (pass: number) => boolean;
    onhover: (pass: number | null) => void;
  } = $props();

  // Pixels per row height. A garter stitch is about two rows wide, so straight
  // cells are 10 × 5; relaxed ones take their width from the shape.
  const PX = 5;
  const STRAIGHT_WIDTH = 2;

  const tallest = $derived(Math.max(1, ...fabric.heights));

  // The drawing's extent, in row heights.
  const extent = $derived(
    shape
      ? shape.bounds
      : { minX: 0, maxX: fabric.stitches * STRAIGHT_WIDTH, minY: 0, maxY: tallest },
  );
  const width = $derived(Math.max(1, (extent.maxX - extent.minX) * PX));
  const height = $derived(Math.max(1, (extent.maxY - extent.minY) * PX));
  const sx = (x: number) => (x - extent.minX) * PX;
  const sy = (y: number) => (extent.maxY - y) * PX;

  /** A stitch's four corners, as an SVG points string. */
  function quad(s: Shape, i: number, r: number): string {
    const cx = s.x[i][r];
    const cy = s.y[i][r];
    const ux = s.upX[i][r];
    const uy = s.upY[i][r];
    const half = s.stitchWidth / 2;
    const corners: [number, number][] = [
      [-half, -s.below[i][r]],
      [half, -s.below[i][r]],
      [half, s.above[i][r]],
      [-half, s.above[i][r]],
    ];
    // Across the column is (uy, −ux); along it is (ux, uy).
    return corners
      .map(([a, b]) => `${sx(cx + a * uy + b * ux).toFixed(2)},${sy(cy - a * ux + b * uy).toFixed(2)}`)
      .join(" ");
  }

  const anyLinked = $derived(fabric.madeBy.some((col) => col.some((p) => linked(p))));

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
    style="width: min(100%, {Math.max(fabric.stitches * 20, width * 2)}px)"
    role="img"
    aria-label="The fabric, each stitch in the yarn that worked it"
    onpointerover={pick}
    onpointerleave={() => onhover(null)}
  >
    {#each fabric.stacks as stack, index (index)}
      {#each stack as strand, row (row)}
        {@const pass = fabric.madeBy[index][row]}
        {@const on = linked(pass)}
        {@const dim = anyLinked && !on}
        {#if shape}
          <polygon
            data-pass={pass}
            points={quad(shape, index, row)}
            fill={colourOfStrand(strand)}
            opacity={dim ? 0.3 : 1}
            class:on
            class:taut={showStretch && shape.stretch[index][row] > 0}
          />
        {:else}
          <rect
            data-pass={pass}
            x={sx((fabric.stitches - 1 - index) * STRAIGHT_WIDTH)}
            y={sy(row + 1)}
            width={STRAIGHT_WIDTH * PX}
            height={PX}
            fill={colourOfStrand(strand)}
            opacity={dim ? 0.3 : 1}
            class:on
          />
        {/if}
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
    max-width: 100%;
    margin: 0 auto;
  }
  rect,
  polygon {
    stroke: var(--grid);
    stroke-width: 0.3;
  }
  .on {
    stroke: var(--accent);
    stroke-width: 1;
  }
  .taut {
    stroke: var(--bad);
    stroke-width: 1;
  }
</style>

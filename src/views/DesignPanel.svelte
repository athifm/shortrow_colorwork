<!--
  Design a pattern from a few numbers: one motif on a background (PLAN.md §9,
  Stages C and D).

  The panel holds no knitting logic. methods/shortrow/motif.ts builds the
  repeat, the writer turns it into rows, and "Make pattern" hands the rows to
  the page — where the chart, fabric and verdict take over as for any pattern.
  Whether the design can be knitted is shown as you change it, before anything
  is made, with the reason when it can't.
-->
<script lang="ts">
  import { designMotif, type MotifDesign } from "../methods/shortrow/motif";
  import { writeRows } from "../methods/shortrow/writer";
  import type { Order } from "../methods/shortrow/balance";

  let { onmake }: { onmake: (text: string, stitches: number) => void } = $props();

  // Starts as Shoal's fish, on our own count of stitches.
  let shape = $state<"stripe" | "lens">("lens");
  let stitches = $state(30);
  let start = $state(5);
  let width = $state(14);
  let steps = $state(3);
  let step = $state(2);
  let when = $state<"before" | "after">("after");
  let side = $state<"left" | "right" | "both">("both");
  let order = $state<Order>("longest-first");
  let stagger = $state(1);
  let rowsBelow = $state(1);
  let rowsAbove = $state(1);
  let open = $state(true);

  const whole = (n: number, lo: number) => Math.max(lo, Math.floor(Number(n) || lo));

  const design = $derived<MotifDesign>({
    stitches: whole(stitches, 2),
    background: "A",
    motif: "B",
    start: whole(start, 1),
    width: whole(width, 1),
    steps: shape === "stripe" ? 0 : whole(steps, 1),
    step: whole(step, 1),
    catchUp: { when, side, order, step: whole(stagger, 1) },
    rowsBelow: whole(rowsBelow, 1),
    rowsAbove: whole(rowsAbove, 1),
  });

  const result = $derived(designMotif(design));
  const rows = $derived(result.problems.length === 0 ? writeRows(result.passes, design.stitches, "WS") : null);

  function make() {
    if (rows && rows.problems.length === 0) onmake(rows.text, design.stitches);
  }
</script>

<details class="design" bind:open>
  <summary>Design a motif</summary>

  <div class="kind" role="group" aria-label="Motif">
    <button type="button" aria-pressed={shape === "lens"} onclick={() => (shape = "lens")}>Lens</button>
    <button type="button" aria-pressed={shape === "stripe"} onclick={() => (shape = "stripe")}>Stripe</button>
  </div>

  <div class="grid">
    <label><span>Stitches</span><input type="number" min="2" max="200" bind:value={stitches} /></label>
    <label><span>Starts at stitch</span><input type="number" min="1" bind:value={start} /></label>
    <label><span>First leg (sts)</span><input type="number" min="1" bind:value={width} /></label>
    {#if shape === "lens"}
      <label><span>Steps in</span><input type="number" min="1" bind:value={steps} /></label>
      <label><span>Each step (sts)</span><input type="number" min="2" bind:value={step} /></label>
    {/if}
    <label><span>Rows below</span><input type="number" min="1" step="2" bind:value={rowsBelow} /></label>
    <label><span>Rows above</span><input type="number" min="1" step="2" bind:value={rowsAbove} /></label>
  </div>

  <fieldset>
    <legend>Catch-up rows</legend>
    <div class="grid">
      <label>
        <span>When</span>
        <select bind:value={when}>
          <option value="after">after the motif</option>
          <option value="before">before the motif</option>
        </select>
      </label>
      <label>
        <span>From</span>
        <select bind:value={side}>
          <option value="both">both edges</option>
          <option value="left">left edge</option>
          <option value="right">right edge</option>
        </select>
      </label>
      <label>
        <span>Order</span>
        <select bind:value={order}>
          <option value="longest-first">longest first</option>
          <option value="shortest-first">shortest first</option>
          <option value="alternate">alternate</option>
        </select>
      </label>
      <label>
        <span>Stagger stacked turns (sts)</span>
        <input type="number" min="1" max="6" bind:value={stagger} />
      </label>
    </div>
  </fieldset>

  {#if result.problems.length > 0}
    <ul class="problems">{#each result.problems as p, i (i)}<li>{p}</li>{/each}</ul>
  {:else if rows}
    <p class="ok">
      ✓ Knittable — {rows.rows} rows per repeat. "Make pattern" puts it in the box below.
    </p>
    {#each result.notes as n, i (i)}<p class="note">{n}</p>{/each}
  {/if}

  <button type="button" class="make" disabled={!rows || result.problems.length > 0} onclick={make}>Make pattern</button>
</details>

<style>
  .design {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    padding: 8px 12px 12px;
    font-size: 0.85rem;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--ink);
    font-size: 0.95rem;
  }
  .kind {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    margin: 10px 0 8px;
  }
  .kind button {
    font: inherit;
    padding: 4px 14px;
    border: 0;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
  }
  .kind button[aria-pressed="true"] {
    background: var(--accent);
    color: #fff;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: var(--muted);
  }
  input,
  select {
    font: inherit;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 4px 6px;
    min-width: 0;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 6px;
    margin: 10px 0 0;
    padding: 6px 8px 8px;
  }
  legend {
    color: var(--muted);
    padding: 0 4px;
  }
  .problems {
    margin: 10px 0 0;
    padding-left: 18px;
    color: var(--bad);
  }
  .ok {
    margin: 10px 0 0;
    color: var(--good);
  }
  .note {
    margin: 4px 0 0;
    color: var(--muted);
  }
  .make {
    margin-top: 10px;
    font: inherit;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    cursor: pointer;
  }
  .make:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .make:focus-visible,
  .kind button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>

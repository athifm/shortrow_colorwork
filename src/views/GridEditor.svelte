<!--
  Draw a grid, and knit it (PLAN.md §9: an early stand-in for G and H, so the
  grid constructor can be tried on real drawings as it's built).

  Each cell is one stitch wide and one ridge tall — the finest the fabric can
  hold (LIMITS.md). Column 1, where knitting starts, is at the right, as on a
  chart. Click or drag to paint with the chosen yarn. "Knit it" builds the
  pattern with short rows (methods/shortrow/construct.ts, F2), writes it out,
  and hands the rows to the page. Where turns would crowd, the drawing is
  rounded a stitch or two (round.ts, LIMITS.md L13) and the changed stitches
  are outlined over it. A steep diagonal is shown both ways — snapped to
  vertical, or rounded to a stitch per ridge — and you choose, every time
  (steep.ts, L12). Intarsia alone (F1) is offered alongside, to compare.

  The grid is kept as text, the same notation as the probe grids: one line per
  ridge, top first, a letter A–J per cell.
-->
<script lang="ts">
  import { parseGrid } from "../methods/shortrow/grid";
  import { knitIntarsia } from "../methods/shortrow/intarsia";
  import { knitShortRows } from "../methods/shortrow/construct";
  import { roundForShortRows, type Change } from "../methods/shortrow/round";
  import { steepEdges, roundSteep } from "../methods/shortrow/steep";
  import type { Grid } from "../methods/shortrow/grid";
  import { turnsOf } from "../methods/shortrow/rules";
  import { writeRows } from "../methods/shortrow/writer";
  import { simulate, type Pass } from "../methods/shortrow/passes";
  import { PROBES } from "../methods/shortrow/probes";

  let {
    colourOf,
    onknit,
  }: {
    colourOf: (yarn: string) => string;
    onknit: (text: string, stitches: number) => void;
  } = $props();

  const YARNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const MAX_W = 60;
  const MAX_H = 40;
  const STORAGE_KEY = "shortrow-lab.grid.v1";

  /** Probe notation → letters. */
  const toLetters = (line: string) => line.replace(/\./g, "A").replace(/#/g, "B").replace(/o/g, "C");

  function blank(w: number, h: number): string[][] {
    return Array.from({ length: h }, () => Array.from({ length: w }, () => "A"));
  }

  function load(): string[][] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const rows = JSON.parse(raw) as string[][];
        if (Array.isArray(rows) && rows.length > 0) return rows;
      }
    } catch {
      // Nothing saved, or unreadable: start from a probe.
    }
    return PROBES.find((p) => p.id === "P7")!.grid.split("\n").map((l) => [...toLetters(l)]);
  }

  // rows[0] is the top ridge; rows[r][0] is the left edge, the last column.
  let rows = $state<string[][]>(load());
  let brush = $state("B");
  let painting = $state(false);
  let open = $state(true);
  let message = $state("");

  const width = $derived(rows[0]?.length ?? 0);
  const height = $derived(rows.length);

  $effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // Not remembered; the grid still works.
    }
  });

  function resize(w: number, h: number) {
    const W = Math.max(2, Math.min(MAX_W, Math.floor(w) || 2));
    const H = Math.max(1, Math.min(MAX_H, Math.floor(h) || 1));
    // Keep what's drawn, anchored at the bottom right — where knitting starts.
    const next = blank(W, H);
    for (let r = 0; r < H; r++) {
      const from = rows.length - H + r;
      if (from < 0) continue;
      for (let c = 0; c < W; c++) {
        const fromC = rows[from].length - W + c;
        if (fromC >= 0) next[r][c] = rows[from][fromC];
      }
    }
    rows = next;
  }

  function paint(r: number, c: number) {
    if (rows[r][c] === brush) return;
    rows[r][c] = brush;
  }

  function loadProbe(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const probe = PROBES.find((p) => p.id === select.value);
    select.value = "";
    if (probe) rows = probe.grid.split("\n").map((l) => [...toLetters(l)]);
  }

  const grid = $derived(parseGrid(rows.map((r) => r.join("")).join("\n")).grid);

  /** Short rows, as the fused plan has it (PLAN.md §9, F2) — rounded first
   *  if the turns would crowd. `before` are changes already made to get `g`
   *  from the drawing; all changes are reported against the drawing. */
  function build(g: Grid, before: Change[] = []) {
    let k = knitShortRows(g);
    let more: Change[] = [];
    if (k.problems.length > 0 && k.stuck) {
      const rounded = roundForShortRows(g);
      if (rounded) {
        k = rounded.built;
        more = rounded.changed;
      }
    }
    const byCell = new Map<string, Change>();
    for (const ch of [...before, ...more]) {
      const key = `${ch.ridge},${ch.column}`;
      byCell.set(key, { ...ch, from: byCell.get(key)?.from ?? ch.from });
    }
    const changed = [...byCell.values()].filter((ch) => ch.from !== ch.to);
    return { ...k, changed, crowded: more.length, turns: turnsOf(k.passes, g.width).filter(Boolean).length };
  }

  // Steep diagonals: knitted as you choose, asked afresh for each drawing.
  const drawingKey = $derived(rows.map((r) => r.join("")).join("/"));
  const steep = $derived(grid ? steepEdges(grid) : []);
  const sloped = $derived(grid && steep.length > 0 ? roundSteep(grid, steep) : null);
  let steepPick = $state<{ key: string; way: "vertical" | "slope" } | null>(null);
  const way = $derived(steepPick?.key === drawingKey ? steepPick.way : null);

  const asDrawn = $derived(grid ? build(grid) : null);
  const asSlope = $derived(sloped ? build(sloped.grid, sloped.changed) : null);
  const shortRows = $derived(steep.length === 0 || way === "vertical" ? asDrawn : way === "slope" ? asSlope : null);

  /** Intarsia alone (F1): knits anything, at a price in yarn. */
  const intarsia = $derived.by(() => {
    if (!grid) return null;
    const k = knitIntarsia(grid);
    const fabric = simulate(grid.width, k.passes);
    return { ...k, carries: fabric.carries.length };
  });

  const colours = $derived(grid ? new Set(grid.cells.flat()).size : 0);

  function knit(passes: Pass[]) {
    const out = writeRows(passes, width, "RS");
    if (out.problems.length > 0) {
      message = out.problems.join(" ");
      return;
    }
    message = "";
    onknit(out.text, width);
  }

  const CELL = 14;
  const THUMB = 6;
</script>

{#snippet thumb(cells: string[][], changed: Change[])}
  {@const h = cells.length}
  {@const w = cells[0]?.length ?? 0}
  <svg width={w * THUMB} height={h * THUMB} viewBox="0 0 {w * THUMB} {h * THUMB}" aria-hidden="true">
    {#each cells as row, r (r)}
      {#each row as cell, c (c)}
        <rect class="thumb-cell" x={(w - 1 - c) * THUMB} y={(h - 1 - r) * THUMB} width={THUMB} height={THUMB} fill={colourOf(cell)} />
      {/each}
    {/each}
    {#each changed as ch (`${ch.ridge},${ch.column}`)}
      <rect
        class="thumb-changed"
        x={(w - ch.column) * THUMB + 0.5}
        y={(h - 1 - ch.ridge) * THUMB + 0.5}
        width={THUMB - 1}
        height={THUMB - 1}
      />
    {/each}
  </svg>
{/snippet}

<svelte:window onpointerup={() => (painting = false)} />

<details class="grid-editor" bind:open>
  <summary>Draw a grid</summary>

  <div class="row">
    <label><span>Stitches</span><input type="number" min="2" max={MAX_W} value={width} onchange={(e) => resize(Number((e.currentTarget as HTMLInputElement).value), height)} /></label>
    <label><span>Ridges</span><input type="number" min="1" max={MAX_H} value={height} onchange={(e) => resize(width, Number((e.currentTarget as HTMLInputElement).value))} /></label>
    <label>
      <span>Start from</span>
      <select onchange={loadProbe}>
        <option value="">a probe…</option>
        {#each PROBES as p (p.id)}<option value={p.id}>{p.id} {p.name}</option>{/each}
      </select>
    </label>
  </div>

  <div class="palette" role="group" aria-label="Yarn to paint with">
    {#each YARNS as y (y)}
      <button
        type="button"
        class="swatch"
        aria-pressed={brush === y}
        aria-label="Yarn {y}"
        title="Yarn {y}"
        style="background: {colourOf(y)}"
        onclick={() => (brush = y)}
      >{y}</button>
    {/each}
  </div>

  <div class="canvas">
    <svg
      width={width * CELL}
      height={height * CELL}
      viewBox="0 0 {width * CELL} {height * CELL}"
      role="img"
      aria-label="The grid: click or drag to paint"
    >
      {#each rows as row, r (r)}
        {#each row as cell, c (c)}
          <rect
            x={c * CELL}
            y={r * CELL}
            width={CELL}
            height={CELL}
            fill={colourOf(cell)}
            role="presentation"
            onpointerdown={(e) => {
              e.preventDefault();
              painting = true;
              paint(r, c);
            }}
            onpointerenter={() => painting && paint(r, c)}
          />
        {/each}
      {/each}
      {#each shortRows?.changed ?? [] as ch (`${ch.ridge},${ch.column}`)}
        {@const x = (width - ch.column) * CELL}
        {@const y = (height - 1 - ch.ridge) * CELL}
        <g class="changed" aria-hidden="true">
          <rect x={x + 3} y={y + 3} width={CELL - 6} height={CELL - 6} fill={colourOf(ch.to)} />
          <rect x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1} fill="none" />
        </g>
      {/each}
    </svg>
  </div>
  <p class="hint">One cell = one stitch × one ridge. Knitting starts at the bottom right.</p>

  {#if grid && sloped && asDrawn && asSlope}
    <fieldset class="steep">
      <legend>
        This drawing has a steep diagonal — steeper than short rows can turn, a stitch per ridge. How should it be
        knitted?
      </legend>
      <div class="ways">
        <button
          type="button"
          class="way"
          aria-pressed={way === "vertical"}
          onclick={() => (steepPick = { key: drawingKey, way: "vertical" })}
        >
          {@render thumb(grid.cells, [])}
          <strong>Snapped to vertical</strong>
          <span>As drawn: intarsia hand-overs up each vertical piece.</span>
          <span
            >{asDrawn.problems.length > 0
              ? "Can't be built yet."
              : `${asDrawn.strands.length} balls · ${asDrawn.turns} turns`}</span
          >
        </button>
        <button
          type="button"
          class="way"
          aria-pressed={way === "slope"}
          onclick={() => (steepPick = { key: drawingKey, way: "slope" })}
        >
          {@render thumb(sloped.grid.cells, sloped.changed)}
          <strong>Rounded to a stitch per ridge</strong>
          <span>Short rows all the way; {sloped.changed.length} stitches change (outlined).</span>
          <span
            >{asSlope.problems.length > 0
              ? "Can't be built yet."
              : `${asSlope.strands.length} balls · ${asSlope.turns} turns`}</span
          >
        </button>
      </div>
    </fieldset>
  {/if}

  {#if shortRows && shortRows.problems.length === 0}
    <p class="cost">
      Short rows: {shortRows.strands.length} balls ({shortRows.ends} ends) ·
      {colours} {colours === 1 ? "colour" : "colours"} ·
      {shortRows.turns} {shortRows.turns === 1 ? "turn" : "turns"}
    </p>
    {#if shortRows.changed.length > 0}
      {@const n = shortRows.changed.length}
      <p class="note">
        {#if way === "slope"}Rounded the steep diagonal{shortRows.crowded > 0 ? ", and moved a few stitches so no two turns land on the same stitch" : ""}:
        {:else}Rounded so no two turns land on the same stitch:
        {/if}
        {n} {n === 1 ? "stitch changes" : "stitches change"}, outlined on the drawing and filled with the colour
        {n === 1 ? "it" : "they"}'ll be knitted in.
      </p>
    {/if}
  {:else if steep.length > 0 && !way}
    <p class="note">Choose how to knit the steep diagonal, above.</p>
  {:else if shortRows}
    <p class="warn">{shortRows.problems.join(" ")}</p>
  {/if}
  {#if message}<p class="warn">{message}</p>{/if}
  <div class="actions">
    <button
      type="button"
      class="knit"
      onclick={() => shortRows && knit(shortRows.passes)}
      disabled={!shortRows || shortRows.problems.length > 0}>Knit it</button
    >
    <button type="button" class="plain" onclick={() => (rows = blank(width, height))}>Clear</button>
  </div>
  {#if intarsia}
    <p class="hint">
      Intarsia alone, to compare: {intarsia.strands.length} balls ({intarsia.ends} ends),
      {intarsia.carries} short {intarsia.carries === 1 ? "carry" : "carries"} across the back.
      <button type="button" class="link" onclick={() => knit(intarsia.passes)}>Knit it this way</button>
    </p>
  {/if}
  <p class="hint">
    Sloped edges are built with short rows, straight vertical edges with intarsia hand-overs.
  </p>
</details>

<style>
  .grid-editor {
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
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr 2fr;
    gap: 8px;
    margin-top: 10px;
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
  .palette {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 10px 0 8px;
  }
  .swatch {
    width: 26px;
    height: 26px;
    border-radius: 5px;
    border: 2px solid var(--line);
    font: 600 0.7rem var(--sans);
    color: #fff;
    text-shadow: 0 0 2px #000;
    cursor: pointer;
    padding: 0;
  }
  .swatch[aria-pressed="true"] {
    border-color: var(--ink);
    outline: 2px solid var(--accent);
  }
  .canvas {
    overflow: auto;
    max-height: 50vh;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 4px;
    touch-action: none;
  }
  svg {
    display: block;
    cursor: crosshair;
  }
  rect {
    stroke: var(--grid);
    stroke-width: 0.5;
  }
  .hint {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.78rem;
  }
  .cost {
    margin: 8px 0 0;
    color: var(--ink);
  }
  .steep {
    margin: 10px 0 0;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .steep legend {
    padding: 0 4px;
    color: var(--ink);
  }
  .ways {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .way {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    font: inherit;
    text-align: left;
    color: var(--ink);
    background: var(--surface);
    border: 2px solid var(--line);
    border-radius: 6px;
    padding: 6px;
    cursor: pointer;
    min-width: 0;
  }
  .way svg {
    max-width: 100%;
    height: auto;
  }
  .way span {
    color: var(--muted);
    font-size: 0.78rem;
  }
  .way[aria-pressed="true"] {
    border-color: var(--accent);
  }
  .way:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .thumb-cell {
    stroke: none;
  }
  .thumb-changed {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1;
  }
  .note {
    margin: 4px 0 0;
    color: var(--ink);
  }
  .changed {
    pointer-events: none;
  }
  .changed rect:last-child {
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-dasharray: 2 2;
  }
  .warn {
    margin: 6px 0 0;
    color: var(--bad);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .knit {
    font: inherit;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    cursor: pointer;
  }
  .plain {
    font: inherit;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
  .link {
    font: inherit;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
  .knit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .link:focus-visible,
  .knit:focus-visible,
  .plain:focus-visible,
  .swatch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>

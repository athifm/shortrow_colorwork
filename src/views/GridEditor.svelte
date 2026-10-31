<!--
  Draw a grid, and knit it — its own tab, for development (PLAN.md §5: an early
  stand-in for G and H, so the constructor can be tried on real drawings as
  it's built).

  Each cell is one stitch wide and one ridge tall. Column 1, where knitting
  starts, is at the right, as on a chart. Click or drag to paint with the chosen
  yarn. Painting only paints: nothing is worked out until "Work out the
  knitting", so drawing stays quick. Results are kept for the drawing they were
  worked out for, and marked out of date once it changes.

  The drawing is read as the finished look by default (PLAN.md §5, "Draw the
  look"): mesh/convert.ts works out what to knit so that it bends into it, and
  the plan and the predicted look are shown beside it. "Draw the needle" reads
  each cell literally: built with short rows (construct.ts), rounded where turns
  would crowd (round.ts, L13), and a steep diagonal shown both ways for you to
  choose (steep.ts, L12). Intarsia alone (F1) is offered alongside, to compare.
  "Knit it" writes the pattern out and hands it to the pattern lab.

  The grid is kept as text, the same notation as the probe grids: one line per
  ridge, top first, a letter A–J per cell.
-->
<script lang="ts">
  import { parseGrid, type Grid } from "../methods/shortrow/grid";
  import { knitIntarsia } from "../methods/shortrow/intarsia";
  import { knitShortRows } from "../methods/shortrow/construct";
  import { roundForShortRows, type Change } from "../methods/shortrow/round";
  import { steepEdges, roundSteep } from "../methods/shortrow/steep";
  import { turnsOf } from "../methods/shortrow/rules";
  import { writeRows, colourOfStrand } from "../methods/shortrow/writer";
  import { lookOf } from "../mesh/look";
  import { convert } from "../mesh/convert";
  import { yarnPull, doubleStitchStiffness } from "../model/physical";
  import { simulate, type Pass } from "../methods/shortrow/passes";
  import { PROBES, SHAPES } from "../methods/shortrow/probes";

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
  const MODE_KEY = "shortrow-lab.drawing-means.v1";

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
  let message = $state("");

  const width = $derived(rows[0]?.length ?? 0);
  const height = $derived(rows.length);
  const drawingKey = $derived(rows.map((r) => r.join("")).join("/"));

  $effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // Not remembered; the grid still works.
    }
  });

  // Two ways to read the drawing (PLAN.md §5, "Draw the look"). The look —
  // how the finished fabric should look, ridges bent and all — is the point of
  // the app. The needle — each cell a stitch and a ridge exactly as knitted —
  // is the advanced switch.
  let mode = $state<"look" | "needle">(
    (() => {
      try {
        return localStorage.getItem(MODE_KEY) === "needle" ? "needle" : "look";
      } catch {
        return "look";
      }
    })(),
  );
  $effect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Not remembered; the switch still works.
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
    const probe = [...SHAPES, ...PROBES].find((p) => p.id === select.value);
    select.value = "";
    if (probe) rows = probe.grid.split("\n").map((l) => [...toLetters(l)]);
  }

  // --- Worked out on request --------------------------------------------------

  /** The drawing the results below were worked out for, and how it was read. */
  let worked = $state<{ key: string; grid: Grid; mode: "look" | "needle" } | null>(null);
  let workingOut = $state(false);
  const stale = $derived(worked !== null && (worked.key !== drawingKey || worked.mode !== mode));

  function workItOut() {
    const g = parseGrid(rows.map((r) => r.join("")).join("\n")).grid;
    if (!g) return;
    message = "";
    workingOut = true;
    // Let "Working it out…" show before the work starts.
    setTimeout(() => {
      worked = { key: drawingKey, grid: g, mode };
      workingOut = false;
    }, 20);
  }

  const physics = { yarnPull: yarnPull.compute({}), doubleStitch: doubleStitchStiffness.compute({}) };
  const grid = $derived(worked?.grid ?? null);
  const colours = $derived(grid ? new Set(grid.cells.flat()).size : 0);

  /** Short rows, as the fused plan has it (PLAN.md §5, F2) — rounded first
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

  /** What a pattern will look like, relaxed, and where that differs from the
   *  drawing (L1). A prediction: it rests on the guessed physics. */
  function lookFor(g: Grid, passes: Pass[]) {
    const look = lookOf(simulate(g.width, passes), passes, { ...physics, endsInTurn: turnsOf(passes, g.width) }, colourOfStrand);
    if (!look) return null;
    const differs: Change[] = [];
    look.cells.forEach((row, ridge) =>
      row.forEach((colour, i) => {
        const drawn = g.cells[ridge][i];
        if (colour !== drawn) differs.push({ ridge, column: i + 1, from: drawn, to: colour });
      }),
    );
    return { cells: look.cells, differs };
  }

  // Draw the needle: steep diagonals are knitted as you choose, asked afresh
  // for each drawing.
  const needle = $derived(worked?.mode === "needle" ? worked : null);
  const steep = $derived(needle ? steepEdges(needle.grid) : []);
  const sloped = $derived(needle && steep.length > 0 ? roundSteep(needle.grid, steep) : null);
  let steepPick = $state<{ key: string; way: "vertical" | "slope" } | null>(null);
  const way = $derived(needle && steepPick?.key === needle.key ? steepPick.way : null);
  const asDrawn = $derived(needle ? build(needle.grid) : null);
  const asSlope = $derived(sloped ? build(sloped.grid, sloped.changed) : null);
  const shortRows = $derived(steep.length === 0 || way === "vertical" ? asDrawn : way === "slope" ? asSlope : null);

  // Draw the look: worked back to a plan for the needle.
  const converted = $derived(worked?.mode === "look" ? convert(worked.grid, physics) : null);

  /** The pattern to knit, whichever way the drawing was read. */
  const active = $derived.by(() => {
    if (!grid) return null;
    if (needle) return shortRows;
    if (!converted) return null;
    const b = converted.built;
    return { ...b, turns: turnsOf(b.passes, grid.width).filter(Boolean).length };
  });

  /** What it will look like, and where that differs from the drawing. */
  const view = $derived.by(() => {
    if (!grid) return null;
    if (needle) return shortRows && shortRows.problems.length === 0 ? lookFor(grid, shortRows.passes) : null;
    return converted?.look ? { cells: converted.look, differs: converted.mismatch } : null;
  });

  /** Intarsia alone (F1): knits anything, at a price in yarn. */
  const intarsia = $derived.by(() => {
    if (!grid) return null;
    const k = knitIntarsia(grid);
    return { ...k, carries: simulate(grid.width, k.passes).carries.length };
  });

  function knit(passes: Pass[]) {
    if (!grid) return;
    const out = writeRows(passes, grid.width, "RS");
    if (out.problems.length > 0) {
      message = out.problems.join(" ");
      return;
    }
    message = "";
    onknit(out.text, grid.width);
  }

  const CELL = 14;
  const THUMB = 6;
</script>

{#snippet thumb(cells: string[][], changed: Change[], size: number = THUMB)}
  {@const h = cells.length}
  {@const w = cells[0]?.length ?? 0}
  <svg width={w * size} height={h * size} viewBox="0 0 {w * size} {h * size}" aria-hidden="true">
    {#each cells as row, r (r)}
      {#each row as cell, c (c)}
        <rect class="thumb-cell" x={(w - 1 - c) * size} y={(h - 1 - r) * size} width={size} height={size} fill={colourOf(cell)} />
      {/each}
    {/each}
    {#each changed as ch (`${ch.ridge},${ch.column}`)}
      <rect
        class="thumb-changed"
        x={(w - ch.column) * size + 0.5}
        y={(h - 1 - ch.ridge) * size + 0.5}
        width={size - 1}
        height={size - 1}
      />
    {/each}
  </svg>
{/snippet}

<svelte:window onpointerup={() => (painting = false)} />

<div class="grid-editor">
  <section class="drawing" aria-label="Your drawing">
    <div class="row">
      <label><span>Stitches</span><input type="number" min="2" max={MAX_W} value={width} onchange={(e) => resize(Number((e.currentTarget as HTMLInputElement).value), height)} /></label>
      <label><span>Ridges</span><input type="number" min="1" max={MAX_H} value={height} onchange={(e) => resize(width, Number((e.currentTarget as HTMLInputElement).value))} /></label>
      <label>
        <span>Start from</span>
        <select onchange={loadProbe}>
          <option value="">a shape…</option>
          <optgroup label="Shapes this app is for">
            {#each SHAPES as p (p.id)}<option value={p.id}>{p.id} {p.name}</option>{/each}
          </optgroup>
          <optgroup label="Old probes (regression tests)">
            {#each PROBES as p (p.id)}<option value={p.id}>{p.id} {p.name}</option>{/each}
          </optgroup>
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

    <div class="modes" role="group" aria-label="What the drawing means">
      <button type="button" class="mode" aria-pressed={mode === "look"} onclick={() => (mode = "look")}>
        Draw the look
      </button>
      <button type="button" class="mode" aria-pressed={mode === "needle"} onclick={() => (mode = "needle")}>
        Draw the needle (advanced)
      </button>
    </div>
    <p class="hint">
      {#if mode === "look"}
        Draw how the finished fabric should look. The app works out what to knit so that, once the ridges bend, it
        comes out as close to your drawing as it can.
      {:else}
        Each cell is knitted exactly as drawn: one stitch, one ridge, on the needle. The fabric then bends.
      {/if}
    </p>

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
        {#each needle && !stale ? (shortRows?.changed ?? []) : [] as ch (`${ch.ridge},${ch.column}`)}
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

    <div class="actions">
      <button type="button" class="knit" onclick={workItOut} disabled={workingOut}>
        {workingOut ? "Working it out…" : "Work out the knitting"}
      </button>
      <button type="button" class="plain" onclick={() => (rows = blank(width, height))}>Clear</button>
    </div>
  </section>

  <section class="results" aria-label="What to knit">
    {#if !worked}
      <p class="hint">Draw, then press "Work out the knitting". Nothing is worked out while you paint.</p>
    {:else}
      {#if stale}
        <p class="warn">
          The drawing or the reading has changed since this was worked out. Press "Work out the knitting" again.
        </p>
      {/if}
      <div class="panels" class:stale>
        {#if converted}
          {@const n = converted.planChanges.length}
          <div class="panel">
            <p class="note">
              <strong>What to knit</strong>, on the needle.
              {#if n === 0}
                The same as your drawing.
              {:else}
                {n} {n === 1 ? "cell differs" : "cells differ"} from your drawing (outlined), so that it bends into your look.
              {/if}
            </p>
            <div class="canvas">{@render thumb(converted.plan.cells, converted.planChanges, CELL)}</div>
          </div>
        {/if}

        {#if view}
          <div class="panel">
            <p class="note">
              <strong>What you'll get</strong>, once the ridges bend — a prediction.
              {#if view.differs.length === 0}
                It matches your drawing.
              {:else}
                {view.differs.length} {view.differs.length === 1 ? "cell differs" : "cells differ"} from your
                drawing (outlined).
              {/if}
            </p>
            <div class="canvas">{@render thumb(view.cells, view.differs, CELL)}</div>
          </div>
        {/if}
      </div>

      {#if needle && sloped && asDrawn && asSlope}
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
              onclick={() => (steepPick = { key: needle.key, way: "vertical" })}
            >
              {@render thumb(needle.grid.cells, [])}
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
              onclick={() => (steepPick = { key: needle.key, way: "slope" })}
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

      {#if active && active.problems.length === 0}
        <p class="cost">
          Short rows: {active.strands.length} balls ({active.ends} ends) ·
          {colours} {colours === 1 ? "colour" : "colours"} ·
          {active.turns} {active.turns === 1 ? "turn" : "turns"}
        </p>
        {#if needle && shortRows && shortRows.changed.length > 0}
          {@const n = shortRows.changed.length}
          <p class="note">
            {#if way === "slope"}Rounded the steep diagonal{shortRows.crowded > 0 ? ", and moved a few stitches so no two turns land on the same stitch" : ""}:
            {:else}Rounded so no two turns land on the same stitch:
            {/if}
            {n} {n === 1 ? "stitch changes" : "stitches change"}, outlined on the drawing and filled with the colour
            {n === 1 ? "it" : "they"}'ll be knitted in.
          </p>
        {/if}
      {:else if needle && steep.length > 0 && !way}
        <p class="note">Choose how to knit the steep diagonal, above.</p>
      {:else if active}
        <p class="warn">{active.problems.join(" ")}</p>
      {/if}
      {#if message}<p class="warn">{message}</p>{/if}

      <div class="actions">
        <button
          type="button"
          class="knit"
          onclick={() => active && knit(active.passes)}
          disabled={stale || !active || active.problems.length > 0}>Knit it</button
        >
      </div>
      <p class="hint">"Knit it" writes the pattern out and opens it in the pattern lab.</p>
      {#if intarsia}
        <p class="hint">
          Intarsia alone, to compare: {intarsia.strands.length} balls ({intarsia.ends} ends),
          {intarsia.carries} short {intarsia.carries === 1 ? "carry" : "carries"} across the back.
          <button type="button" class="link" onclick={() => knit(intarsia.passes)} disabled={stale}>Knit it this way</button>
        </p>
      {/if}
      <p class="hint">Sloped edges are built with short rows, straight vertical edges with intarsia hand-overs.</p>
    {/if}
  </section>
</div>

<style>
  .grid-editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
    font-size: 0.85rem;
  }
  @media (max-width: 860px) {
    .grid-editor {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .drawing,
  .results {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    padding: 12px;
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr 2fr;
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
    max-height: 70vh;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 4px;
    touch-action: none;
  }
  svg {
    display: block;
    cursor: crosshair;
  }
  .panel svg,
  .way svg {
    cursor: default;
  }
  rect {
    stroke: var(--grid);
    stroke-width: 0.5;
  }
  .panels {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .panels.stale {
    opacity: 0.45;
  }
  .panel {
    min-width: 0;
  }
  .panel .note {
    margin: 0 0 6px;
    max-width: 44ch;
  }
  .hint {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.78rem;
  }
  .cost {
    margin: 12px 0 0;
    color: var(--ink);
  }
  .steep {
    margin: 12px 0 0;
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
  .thumb-cell {
    stroke: none;
  }
  .thumb-changed {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
  }
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 2px;
  }
  .mode {
    font: inherit;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
  .mode[aria-pressed="true"] {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
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
    margin-top: 10px;
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
  .knit:disabled,
  .link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .link:focus-visible,
  .knit:focus-visible,
  .plain:focus-visible,
  .swatch:focus-visible,
  .mode:focus-visible,
  .way:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>

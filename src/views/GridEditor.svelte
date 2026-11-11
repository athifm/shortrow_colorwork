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
  look"). Each blob of colour is fitted to a short-row unit (PLAN.md §6,
  mesh/fit.ts) three ways — the shape grows, the background gives way, or
  either — and those are offered side by side with the drawing as it is, each
  with its cost and its predicted look (L19). You pick; for the one picked,
  the plan is shown large, then the fabric it makes once it relaxes — the
  pattern lab's own picture (FabricView, mesh/settle.ts) — and your drawing
  with lines where the colour edges will land. "Draw the needle" reads
  each cell literally: built with short rows (construct.ts), rounded where turns
  would crowd (round.ts, L13), and a steep diagonal shown both ways for you to
  choose (steep.ts, L12). Intarsia alone (F1) is offered alongside, to compare.

  Everything about the way picked is on this one page: its needle chart beside
  its fabric (point at one to light up the other), whether it lies flat, and
  the written rows. "Open in pattern lab" hands the rows over, to edit by hand.

  The grid is kept as text, the same notation as the probe grids: one line per
  ridge, top first, a letter A–J per cell.

  While developing, a review bar (ReviewBar.svelte) sits over the drawing: say
  "looks right", save a redraw or leave a note on the shape loaded, and it's
  kept in review/review.json to be read from the project.
-->
<script lang="ts">
  import { parseGrid, type Grid } from "../methods/shortrow/grid";
  import { knitIntarsia } from "../methods/shortrow/intarsia";
  import { knitShortRows } from "../methods/shortrow/construct";
  import { roundForShortRows, type Change } from "../methods/shortrow/round";
  import { steepEdges, roundSteep } from "../methods/shortrow/steep";
  import { writeRows, colourOfStrand } from "../methods/shortrow/writer";
  import type { Edge } from "../mesh/look";
  import { predictionOf, versionsOf, type Version, type Way } from "../mesh/fit";
  import type { UnitKind } from "../methods/shortrow/units";
  import { yarnPull, doubleStitchStiffness, stitchAspect, smallestBump, flatnessThreshold } from "../model/physical";
  import { describeShape } from "../mesh/settle";
  import FabricView from "./FabricView.svelte";
  import NeedleChart from "./NeedleChart.svelte";
  import ReviewBar from "./ReviewBar.svelte";
  import { loadReview, saveReview, type Review, type ReviewEntry } from "./review";
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
    loadShape(select.value);
    select.value = "";
  }

  // --- The shape review (development only) --------------------------------------

  // The published site has no dev server to keep the review file, so no bar.
  const REVIEWING = import.meta.env.DEV;
  let review = $state<Review>({ entries: {} });
  /** The shape loaded for review, and the drawing as it was loaded. */
  let reviewing = $state<{ id: string; title: string; name: string; loaded: string } | null>(null);
  let reviewStatus = $state("");
  if (REVIEWING) loadReview().then((r) => (review = r));

  const drawingText = $derived(rows.map((r) => r.join("")).join("\n"));
  const reviewed = $derived(SHAPES.filter((s) => review.entries[s.id]?.verdict).length);
  const mine = $derived(Object.values(review.entries).filter((e) => e.mine));
  /** Notes on a drawing that is no shape in particular are kept together. */
  const LOOSE = { id: "notes", name: "Notes on other drawings" };

  /** A test shape, a probe or a shape of your own — your redraw of it, if you saved one. */
  function loadShape(id: string) {
    const probe = [...SHAPES, ...PROBES].find((p) => p.id === id);
    const entry = review.entries[id];
    const saved = entry?.grid && (entry.verdict === "redrawn" || entry.mine) ? entry.grid : null;
    const text = saved ?? (probe ? probe.grid.split("\n").map(toLetters).join("\n") : null);
    if (text === null) return;
    rows = text.split("\n").map((l) => [...l]);
    const test = SHAPES.find((p) => p.id === id);
    reviewing = test
      ? { id, title: `${id} ${test.name}`, name: test.name, loaded: text }
      : entry?.mine
        ? { id, title: `your shape "${entry.name}"`, name: entry.name, loaded: text }
        : null;
    reviewStatus = "";
  }

  async function record(id: string, name: string, change: (entry: ReviewEntry) => void, said: string) {
    const entry = review.entries[id] ?? { id, name, verdict: null, grid: null, notes: [] };
    change(entry);
    review.entries[id] = entry;
    reviewStatus = (await saveReview($state.snapshot(review))) ? said : "Couldn't save that — is the dev server running?";
  }

  function looksRight() {
    if (!reviewing) return;
    const grid = drawingText;
    record(reviewing.id, reviewing.name, (e) => ((e.verdict = "looks right"), (e.grid = grid)), "Saved: looks right.");
  }

  function saveRedraw() {
    if (!reviewing) return;
    const grid = drawingText;
    record(reviewing.id, reviewing.name, (e) => ((e.verdict = "redrawn"), (e.grid = grid)), "Saved your redraw.");
    reviewing.loaded = grid;
  }

  /** Drop a redraw: the draft comes back, to be judged afresh. Notes stay. */
  async function backToDraft() {
    if (!reviewing) return;
    const id = reviewing.id;
    await record(id, reviewing.name, (e) => ((e.verdict = null), (e.grid = null)), "Back to the draft.");
    loadShape(id);
    reviewStatus = "Back to the draft.";
  }

  function addNote(text: string) {
    const about = reviewing ?? LOOSE;
    const note = {
      at: new Date().toISOString(),
      text,
      grid: drawingText,
      reading: mode,
      way: worked && !stale && chosen ? chosen.way : null,
    };
    record(about.id, about.name, (e) => e.notes.push(note), "Saved your note.");
  }

  /** The next test shape not yet reviewed, after this one; or simply the next. */
  function nextShape() {
    const from = SHAPES.findIndex((s) => s.id === reviewing?.id);
    const order = SHAPES.map((_, k) => SHAPES[(from + 1 + k) % SHAPES.length]);
    loadShape((order.find((s) => !review.entries[s.id]?.verdict) ?? order[0]).id);
  }

  function saveAsNew(name: string) {
    const id = `mine: ${name}`;
    const grid = drawingText;
    record(id, name, (e) => ((e.mine = true), (e.grid = grid)), `Saved as "${name}".`);
    reviewing = { id, title: `your shape "${name}"`, name, loaded: grid };
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

  const physics = {
    yarnPull: yarnPull.compute({}),
    doubleStitch: doubleStitchStiffness.compute({}),
    stitchAspect: stitchAspect.compute({}),
    smallestBump: smallestBump.compute({}),
  };
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
    // The fabric it makes, as the pattern lab will draw it — and its turns,
    // counted as a knitter reads them back.
    const prediction = k.problems.length === 0 ? predictionOf(g.width, k.passes, physics) : null;
    return { ...k, changed, crowded: more.length, prediction, turns: prediction?.endsInTurn.filter(Boolean).length ?? 0 };
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

  // Draw the look: the ways to knit it, side by side.
  const versions = $derived(worked?.mode === "look" ? versionsOf(worked.grid, physics) : null);
  const shown = $derived(versions ? versions.filter((v) => !v.sameAs) : []);
  const knits = (v: Version) => v.built.problems.length === 0;
  const intarsiaRows = (v: Version) => v.prediction?.intarsiaRows.length ?? 0;
  const intarsiaNote = (n: number) =>
    `${n} ${n === 1 ? "row is" : "rows are"} intarsia-style: a colour stops for another and carries on beyond it from a second ball.`;
  /** Picked to start with: the short-row way with the fewest intarsia-style
   *  rows, then the one whose look is nearest the drawing, fewest stitches
   *  changed on a tie; else the drawing as it is. */
  const suggested = $derived.by((): Way | null => {
    if (!versions) return null;
    const ok = shown.filter((v) => knits(v) && v.turns > 0);
    ok.sort((a, b) => intarsiaRows(a) - intarsiaRows(b) || a.mismatch.length - b.mismatch.length || a.changed.length - b.changed.length);
    return ok[0]?.way ?? "as drawn";
  });
  let wayPick = $state<{ key: string; way: Way } | null>(null);
  const chosen = $derived.by(() => {
    if (!versions || !worked) return null;
    const w = wayPick?.key === worked.key ? wayPick.way : suggested;
    return versions.find((v) => v.way === w) ?? null;
  });

  const WAY_NAME: Record<Way, string> = {
    "as drawn": "As drawn",
    nudged: "Nudged",
    grow: "The shape grows",
    "give way": "The background gives way",
    both: "Either way, fewest changes",
  };
  const WAY_HINT: Record<Way, string> = {
    "as drawn": "Every stitch as you drew it.",
    nudged: "As drawn, with a stitch or two moved where two turns would land on one stitch.",
    grow: "Stitches added in the shape's colour, none taken away.",
    "give way": "Stitches taken from the shape, none added.",
    both: "Added or taken, whichever changes the fewest stitches.",
  };
  const KIND_NAME: Record<UnitKind, string> = {
    stripe: "a stripe",
    "edge shape": "a shape from the edge",
    peak: "a peak",
    lens: "a lens",
    "leaning stripe": "a leaning stripe",
  };
  const unitsOf = (v: Version) => v.units.map((u) => `${KIND_NAME[u.kind]} in ${u.colour}`).join(", ");

  /** The pattern to knit, whichever way the drawing was read. */
  const active = $derived.by(() => {
    if (!grid) return null;
    if (needle) return shortRows;
    return chosen ? { ...chosen.built, turns: chosen.turns } : null;
  });

  /** The fabric it makes once it relaxes: a prediction, resting on the
   *  model's guesses — the same one the pattern lab shows. */
  const view = $derived.by(() => {
    if (!grid) return null;
    return needle ? (shortRows?.prediction ?? null) : (chosen?.prediction ?? null);
  });

  const verdict = $derived(view ? describeShape(view.shape, flatnessThreshold.compute({})) : null);
  /** The pass pointed at, in the needle chart or the fabric: lit up in both. */
  let hoveredPass = $state<number | null>(null);
  let copied = $state(false);
  async function copyRows(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      message = "Couldn't copy — select the rows and copy them by hand.";
    }
  }

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
  /** FabricView's own padding and border, so its stitches come out CELL wide. */
  const FABRIC_FRAME = 18;
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
      <!-- The colour you drew, still showing in the middle of the cell. -->
      {#if size >= CELL}
        <rect
          class="thumb-drawn"
          x={(w - ch.column) * size + size / 3}
          y={(h - 1 - ch.ridge) * size + size / 3}
          width={size / 3}
          height={size / 3}
          fill={colourOf(ch.from)}
        />
      {/if}
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

<!-- The drawing, with lines where the colour edges land once the fabric
     relaxes: each line twice, a dark casing under a light line, so it shows
     on any colour. -->
{#snippet landed(cells: string[][], edges: Edge[])}
  {@const h = cells.length}
  {@const w = cells[0]?.length ?? 0}
  <svg width={w * CELL} height={h * CELL} viewBox="0 0 {w * CELL} {h * CELL}" aria-hidden="true">
    {#each cells as row, r (r)}
      {#each row as cell, c (c)}
        <rect x={(w - 1 - c) * CELL} y={(h - 1 - r) * CELL} width={CELL} height={CELL} fill={colourOf(cell)} />
      {/each}
    {/each}
    {#each ["edge-casing", "edge"] as layer (layer)}
      {#each edges as e, k (k)}
        {#if e.kind === "across"}
          <line class={layer} x1={(w - 1 - e.column) * CELL} x2={(w - e.column) * CELL} y1={(h - e.at) * CELL} y2={(h - e.at) * CELL} />
        {:else}
          <line class={layer} x1={(w - 1 - e.after) * CELL} x2={(w - 1 - e.after) * CELL} y1={(h - e.from) * CELL} y2={(h - e.to) * CELL} />
        {/if}
      {/each}
    {/each}
  </svg>
{/snippet}

<svelte:window onpointerup={() => (painting = false)} />

<div class="grid-editor">
  <section class="drawing" aria-label="Your drawing">
    {#if REVIEWING}
      <ReviewBar
        title={reviewing?.title ?? null}
        entry={review.entries[(reviewing ?? LOOSE).id]}
        redrawn={reviewing !== null && reviewing.loaded !== drawingText}
        done={reviewed}
        total={SHAPES.length}
        status={reviewStatus}
        onlooksright={looksRight}
        onredraw={saveRedraw}
        onnote={addNote}
        onnext={nextShape}
        onreset={backToDraft}
        onsaveas={saveAsNew}
      />
    {/if}
    <div class="row">
      <label><span>Stitches</span><input type="number" min="2" max={MAX_W} value={width} onchange={(e) => resize(Number((e.currentTarget as HTMLInputElement).value), height)} /></label>
      <label><span>Ridges</span><input type="number" min="1" max={MAX_H} value={height} onchange={(e) => resize(width, Number((e.currentTarget as HTMLInputElement).value))} /></label>
      <label>
        <span>Start from</span>
        <select onchange={loadProbe}>
          <option value="">a shape…</option>
          <optgroup label="Shapes this app is for">
            {#each SHAPES as p (p.id)}
              <option value={p.id}>{review.entries[p.id]?.verdict ? "✓ " : ""}{p.id} {p.name}</option>
            {/each}
          </optgroup>
          {#if mine.length > 0}
            <optgroup label="Your shapes">
              {#each mine as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
            </optgroup>
          {/if}
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
        <!-- The way picked: a shape no unit fits, outlined, and where it gets stuck, ringed. -->
        {#each chosen && !stale ? chosen.unfitted : [] as u (`u${u.ridge},${u.column}`)}
          <rect class="unfit" x={(width - u.column) * CELL + 1.5} y={(height - 1 - u.ridge) * CELL + 1.5} width={CELL - 3} height={CELL - 3} />
        {/each}
        {#if chosen && !stale && chosen.built.stuck}
          {@const st = chosen.built.stuck}
          <circle class="stuck" cx={(width - st.column) * CELL + CELL / 2} cy={(height - 1 - st.ridge) * CELL + CELL / 2} r={CELL * 0.75} />
        {/if}
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
      {#if versions && worked}
        <fieldset class="steep ways-to-knit" class:stale>
          <legend>Ways to knit it — pick one. Each shape is fitted to a short-row unit, three ways.</legend>
          <div class="ways">
            {#each shown as v (v.way)}
              {@const twins = versions.filter((o) => o.sameAs === v.way).map((o) => WAY_NAME[o.way].toLowerCase())}
              <button
                type="button"
                class="way"
                aria-pressed={chosen?.way === v.way}
                onclick={() => (wayPick = { key: worked.key, way: v.way })}
              >
                {@render thumb(v.plan.cells, v.changed)}
                <strong>{WAY_NAME[v.way]}{v.way === suggested && knits(v) ? " (suggested)" : ""}</strong>
                <span>{WAY_HINT[v.way]}{twins.length > 0 ? ` The same as: ${twins.join(", ")}.` : ""}</span>
                {#if !knits(v)}
                  <span class="bad">
                    Can't be knitted with short rows yet{v.built.stuck
                      ? ` — stuck at column ${v.built.stuck.column}, ridge ${v.built.stuck.ridge + 1}` +
                        (chosen?.way === v.way ? " (ringed on your drawing)" : "")
                      : ""}.
                  </span>
                  {#if v.unfitted.length > 0}
                    <span class="bad">
                      A shape fits no unit{chosen?.way === v.way ? " (outlined on your drawing)" : ""}; left as drawn.
                    </span>
                  {/if}
                {:else}
                  <span>
                    {v.changed.length} {v.changed.length === 1 ? "stitch changes" : "stitches change"} ·
                    {v.balls} balls ({v.balls * 2} ends) · {v.turns} {v.turns === 1 ? "turn" : "turns"}
                  </span>
                  <span>
                    {v.turns === 0
                      ? "All hand-overs: intarsia, not short-row colorwork."
                      : `Its look: ${v.mismatch.length} ${v.mismatch.length === 1 ? "cell differs" : "cells differ"} from your drawing.`}
                  </span>
                  {#if v.turns > 0 && intarsiaRows(v) > 0}<span class="bad">{intarsiaNote(intarsiaRows(v))}</span>{/if}
                  {#if v.units.length > 0}<span>Found: {unitsOf(v)}.</span>{/if}
                {/if}
              </button>
            {/each}
          </div>
        </fieldset>
      {/if}

      <div class="panels" class:stale>
        {#if chosen}
          {@const n = chosen.changed.length}
          <div class="panel">
            <p class="note">
              <strong>What to knit</strong> — {WAY_NAME[chosen.way].toLowerCase()}.
              {#if n === 0}
                The same as your drawing.
              {:else}
                {n} {n === 1 ? "stitch differs" : "stitches differ"} from your drawing (outlined; the small square is
                the colour you drew).
              {/if}
            </p>
            <div class="canvas">{@render thumb(chosen.plan.cells, chosen.changed, CELL)}</div>
          </div>
        {/if}

        {#if view && grid}
          {#if view.edges.length > 0}
            <div class="panel">
              <p class="note">
                <strong>Against your drawing</strong> — the lines are where the colour edges will land. Where a line
                leaves an edge you drew, the fabric will differ there.
              </p>
              <div class="canvas">{@render landed(grid.cells, view.edges)}</div>
            </div>
          {/if}
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
        {#if view && view.intarsiaRows.length > 0 && active.turns > 0}
          <p class="warn">
            {intarsiaNote(view.intarsiaRows.length)} In the written pattern: {view.intarsiaRows.length === 1 ? "row" : "rows"}
            {view.intarsiaRows.join(", ")}.
          </p>
        {/if}
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
        {#if view && grid}
          <div class="panels knitting" class:stale>
            {#if view.info.length > 0}
              <div class="panel">
                <p class="note"><strong>Needle chart</strong> — one line per pass, in knitting order. ∞ is a turn.</p>
                <div class="chart">
                  <NeedleChart
                    stitches={grid.width}
                    passes={view.passes}
                    info={view.info}
                    {colourOf}
                    hovered={hoveredPass}
                    onhover={(pass) => (hoveredPass = pass)}
                  />
                </div>
              </div>
            {/if}
            <div class="panel">
              <p class="note">
                <strong>What you'll get</strong> — the fabric once it relaxes, every stitch where it settles. A
                prediction.
              </p>
              <div class="fabric" style="width: {grid.width * CELL + FABRIC_FRAME}px">
                <FabricView
                  fabric={view.fabric}
                  shape={view.shape}
                  showStretch={verdict?.kind === "stretched"}
                  colourOfStrand={(strand) => colourOf(colourOfStrand(strand))}
                  linked={(pass) => pass === hoveredPass}
                  onhover={(pass) => (hoveredPass = pass)}
                />
              </div>
            </div>
          </div>
          <p class="note" class:stale>
            {#if verdict?.kind === "rectangle"}
              ✓ Lies flat — a rectangle.
            {:else if verdict?.kind === "fan"}
              ◢ Lies flat — fans out about {verdict.degrees}°, the {verdict.longer} edge longer.
            {:else if verdict}
              ✗ Won't lie flat — the rows over columns {verdict.fromColumn}–{verdict.toColumn} would have to stretch
              about {verdict.percent}%.
            {/if}
            {#if view.fabric.balanced}Balanced: {view.fabric.heights[0]} rows in every stitch.{:else}Not balanced.{/if}
            Point at a pass in the chart, or a stitch in the fabric, to see where it came from.
          </p>
          <div class="written" class:stale>
            <p class="note">
              <strong>Written rows</strong> — {view.written.split("\n").length} rows.
              <button type="button" class="link" onclick={() => copyRows(view.written)}>{copied ? "Copied" : "Copy"}</button>
            </p>
            <pre>{view.written}</pre>
          </div>
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
          disabled={stale || !active || active.problems.length > 0}>Open in pattern lab</button
        >
      </div>
      <p class="hint">Opens these written rows in the pattern lab, to edit them by hand.</p>
      {#if intarsia}
        <p class="hint">
          Intarsia alone, to compare: {intarsia.strands.length} balls ({intarsia.ends} ends),
          {intarsia.carries} short {intarsia.carries === 1 ? "carry" : "carries"} across the back.
          <button type="button" class="link" onclick={() => knit(intarsia.passes)} disabled={stale}>Open that in the pattern lab</button>
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
  .panels.stale,
  .ways-to-knit.stale {
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
    margin: 12px 0 12px;
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
  .fabric {
    max-width: 100%;
  }
  .knitting {
    margin-top: 12px;
    align-items: flex-start;
  }
  .chart {
    max-width: 100%;
  }
  .written {
    margin-top: 12px;
  }
  .written pre {
    margin: 6px 0 0;
    padding: 8px;
    max-height: 16rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 0.78rem;
    white-space: pre-wrap;
    color: var(--ink);
  }
  .note.stale,
  .written.stale {
    opacity: 0.45;
  }
  .edge,
  .edge-casing {
    fill: none;
    stroke-linecap: square;
    pointer-events: none;
  }
  .edge-casing {
    stroke: #000;
    stroke-width: 4;
  }
  .edge {
    stroke: #fff;
    stroke-width: 1.5;
  }
  .thumb-drawn {
    stroke: var(--ink);
    stroke-width: 0.5;
  }
  .bad {
    color: var(--bad) !important;
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
  .unfit,
  .stuck {
    fill: none;
    stroke: var(--bad);
    pointer-events: none;
  }
  .unfit {
    stroke-width: 1.5;
    stroke-dasharray: 3 2;
  }
  .stuck {
    stroke-width: 2;
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

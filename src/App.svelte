<!--
  Pattern lab: type or paste a short-row colorwork pattern's written rows, and
  see the needle chart, the fabric it makes, and whether it balances.

  The page holds no knitting logic of its own. Reading the rows is
  methods/shortrow/written.ts; working them is methods/shortrow/passes.ts. This
  file only wires inputs to those and their answers to the screen.
-->
<script lang="ts">
  import { readWritten } from "./methods/shortrow/written";
  import { simulate } from "./methods/shortrow/passes";
  import { PRESETS, type Preset } from "./presets";
  import NeedleChart from "./views/NeedleChart.svelte";
  import FabricView from "./views/FabricView.svelte";
  import { relax } from "./mesh/relax";
  import { yarnPull, doubleStitchStiffness } from "./model/physical";

  const STORAGE_KEY = "shortrow-lab.v1";

  // Colours offered for yarns as they first appear. Background first, then
  // motif colours that stand apart from it and from each other.
  const DEFAULT_COLOURS: Record<string, string> = {
    A: "#a7acb4",
    B: "#c2185b",
    C: "#2e7d6b",
    D: "#e0a526",
    E: "#4f5fbf",
  };
  const SPARE = ["#7b5ea7", "#d2691e", "#3a7ca5", "#8c9e3a"];

  type Saved = { text: string; stitches: number; repeats: number; colours: Record<string, string> };

  // Remember the pattern between visits, in this browser only. Storage can be
  // unavailable (private windows, blocked site data) — the page works without it.
  function load(): Saved | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Saved) : null;
    } catch {
      return null;
    }
  }

  const saved = load();
  const start = PRESETS[2];

  let text = $state(saved?.text ?? start.text);
  let stitches = $state(saved?.stitches ?? start.stitches);
  let repeats = $state(saved?.repeats ?? 2);
  let colours = $state<Record<string, string>>({ ...DEFAULT_COLOURS, ...(saved?.colours ?? {}) });
  // The example's description, shown only while its own text is still in the
  // box — once the rows are edited or replaced, it would be describing
  // something that isn't there.
  let loaded = $state<{ text: string; about: string } | null>(saved ? null : { text: start.text, about: start.about });
  const about = $derived(loaded && loaded.text === text ? loaded.about : "");
  let hovered = $state<number | null>(null);

  $effect(() => {
    const data: Saved = { text, stitches, repeats, colours };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Not saved; nothing lost but the convenience.
    }
  });

  // A photo of real knitting, shown beside the fabric to compare against. It
  // never leaves the browser: it's read from disk, shrunk, and kept in this
  // browser's storage — so a photo of a book's swatch can be compared against
  // without ever being uploaded or published. Kept apart from the pattern
  // because it's far bigger, and storage may refuse it.
  const PHOTO_KEY = "shortrow-lab.photo.v1";
  const PHOTO_MAX_SIDE = 1200;

  function loadPhoto(): string | null {
    try {
      return localStorage.getItem(PHOTO_KEY);
    } catch {
      return null;
    }
  }

  let photo = $state<string | null>(loadPhoto());
  let photoNote = $state("");

  /** Optionally cut out [x, y, width, height] in the image's own pixels, then
   *  scale down so the longest side is at most PHOTO_MAX_SIDE. */
  async function shrink(image: Blob, crop?: [number, number, number, number]): Promise<string> {
    const url = URL.createObjectURL(image);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const [sx, sy, sw, sh] = crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
      const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.85);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Set when the photo came with a book example, so that loading one of our
  // own examples afterwards doesn't leave the book's swatch beside it.
  let photoFromExample = false;

  function showPhoto(dataUrl: string) {
    photo = dataUrl;
    try {
      localStorage.setItem(PHOTO_KEY, dataUrl);
      photoNote = "";
    } catch {
      photoNote = "Shown, but too big to remember — it will be gone when the page reloads.";
    }
  }

  async function pickPhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      showPhoto(await shrink(file));
      photoFromExample = false;
    } catch {
      photoNote = "That file couldn't be read as a picture.";
    }
  }

  function removePhoto() {
    photo = null;
    photoNote = "";
    photoFromExample = false;
    try {
      localStorage.removeItem(PHOTO_KEY);
    } catch {
      // Nothing stored, nothing to remove.
    }
  }

  const safeStitches = $derived(Math.max(1, Math.min(200, Math.floor(stitches) || 1)));
  const safeRepeats = $derived(Math.max(1, Math.min(10, Math.floor(repeats) || 1)));

  const read = $derived(readWritten(text, safeStitches, safeRepeats));
  const fabric = $derived(simulate(safeStitches, read.passes));

  // Straight shows the counting plainly; relaxed shows where the stitches
  // settle once the yarn pulls each pass level (mesh/relax.ts).
  let drawing = $state<"relaxed" | "straight">("relaxed");

  // The model's guesses, overridable only while developing, to fit them against
  // the photos by eye. In a production build `import.meta.env.DEV` is false and
  // the sliders don't exist: users never tune the physics (PLAN.md §7).
  let tunedPull = $state(yarnPull.compute({}));
  let tunedDouble = $state(doubleStitchStiffness.compute({}));
  const pull = $derived(import.meta.env.DEV ? tunedPull : yarnPull.compute({}));
  const doubleStitch = $derived(import.meta.env.DEV ? tunedDouble : doubleStitchStiffness.compute({}));

  const relaxed = $derived(
    drawing === "relaxed" && read.passes.length > 0
      ? relax(fabric, read.passes, {
          yarnPull: pull,
          doubleStitch,
          endsInTurn: read.info.map((i) => i.endsInTurn),
        })
      : null,
  );

  const perRepeat = $derived(read.info.filter((i) => i.repeat === 1).length);
  const chartPasses = $derived(read.passes.slice(0, perRepeat));
  const chartInfo = $derived(read.info.slice(0, perRepeat));

  const yarnLetters = $derived([...new Set(read.strands.map((s) => s.colour))]);

  function colourOf(letter: string): string {
    if (colours[letter]) return colours[letter];
    const i = yarnLetters.indexOf(letter);
    return SPARE[(i < 0 ? 0 : i) % SPARE.length];
  }

  const strandColour = $derived(new Map(read.strands.map((s) => [s.id, s.colour])));
  const colourOfStrand = (strand: string) => colourOf(strandColour.get(strand) ?? strand);

  // Hover is tracked in chart terms — a pass within one repeat — so that
  // pointing at any repeat of a stitch lights up the line that makes it.
  const linked = (pass: number) => hovered !== null && perRepeat > 0 && pass % perRepeat === hovered;
  const fromFabric = (pass: number | null) => {
    hovered = pass === null || perRepeat === 0 ? null : pass % perRepeat;
  };

  // Where the fabric falls short, as runs of neighbouring columns.
  const shortfalls = $derived.by(() => {
    const top = Math.max(...fabric.heights);
    const runs: { from: number; to: number; short: number }[] = [];
    fabric.heights.forEach((h, i) => {
      const short = top - h;
      const last = runs[runs.length - 1];
      if (short === 0) return;
      if (last && last.to === i && last.short === short) last.to = i + 1;
      else runs.push({ from: i + 1, to: i + 1, short });
    });
    return runs;
  });

  const problems = $derived([
    ...read.problems.map((p) => p.message),
    ...fabric.problems.map((p) => {
      const i = read.info[p.pass - 1];
      return i ? `Row ${i.row} (repeat ${i.repeat}): ${p.message}` : p.message;
    }),
  ]);

  const hoveredInfo = $derived(hovered === null ? null : chartInfo[hovered] ?? null);
  const hoveredPass = $derived(hovered === null ? null : chartPasses[hovered] ?? null);

  // Patterns from a book, kept in research/book-presets.json. That folder is
  // never committed, and this only runs under `npm run dev`: in a production
  // build `import.meta.env.DEV` is false, so the whole block — URL and all — is
  // dropped. The published site can't offer a book's patterns because it never
  // has them. (The deploy workflow refuses to publish a build that points at
  // book-presets or research/sources, so this can't quietly stop being true.)
  type BookPreset = Preset & { photo?: { src: string; crop: [number, number, number, number] } };
  let bookPresets = $state<BookPreset[]>([]);

  if (import.meta.env.DEV) {
    fetch(`${import.meta.env.BASE_URL}research/book-presets.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => {
        if (Array.isArray(list)) bookPresets = list as BookPreset[];
      })
      .catch(() => {
        // No file, or not JSON (the dev server answers a missing file with the
        // page itself). Either way, there are simply no book examples.
      });
  }

  async function loadPreset(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const [group, index] = select.value.split(":");
    const preset: BookPreset | undefined = group === "book" ? bookPresets[Number(index)] : PRESETS[Number(index)];
    select.value = "";
    if (!preset) return;

    text = preset.text;
    stitches = preset.stitches;
    loaded = { text: preset.text, about: preset.about };
    hovered = null;

    if (preset.photo) {
      try {
        const image = await (await fetch(`${import.meta.env.BASE_URL}${preset.photo.src}`)).blob();
        showPhoto(await shrink(image, preset.photo.crop));
        photoFromExample = true;
      } catch {
        photoNote = `Couldn't load the photo for ${preset.name}.`;
      }
    } else if (photoFromExample) {
      removePhoto();
    }
  }
</script>

<header>
  <h1>Short-row colorwork — pattern lab</h1>
  <p class="lede">
    Type or paste a pattern's written rows. You'll see the chart, the fabric it
    makes, and whether every stitch ends up with the same number of rows.
  </p>
</header>

<main>
  <section class="controls" aria-label="Pattern">
    <label class="field">
      <span>Load an example</span>
      <select onchange={loadPreset}>
        <option value="">Choose…</option>
        <optgroup label="Examples">
          {#each PRESETS as p, i (p.name)}
            <option value="own:{i}">{p.name}</option>
          {/each}
        </optgroup>
        {#if bookPresets.length > 0}
          <optgroup label="From the book — this computer only">
            {#each bookPresets as p, i (p.name)}
              <option value="book:{i}">{p.name}</option>
            {/each}
          </optgroup>
        {/if}
      </select>
    </label>
    {#if about}<p class="about">{about}</p>{/if}

    <div class="pair">
      <label class="field">
        <span>Stitches</span>
        <input type="number" min="1" max="200" bind:value={stitches} />
      </label>
      <label class="field">
        <span>Repeats</span>
        <input type="number" min="1" max="10" bind:value={repeats} />
      </label>
    </div>

    {#if yarnLetters.length > 0}
      <div class="yarns">
        {#each yarnLetters as letter (letter)}
          <label class="swatch">
            <input
              type="color"
              value={colourOf(letter)}
              oninput={(e) => (colours = { ...colours, [letter]: (e.currentTarget as HTMLInputElement).value })}
            />
            <span>Yarn {letter}</span>
          </label>
        {/each}
      </div>
    {/if}

    <div class="field">
      <span>Photo to compare</span>
      <div class="photo-pick">
        <label class="button">
          {photo ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/*" onchange={pickPhoto} />
        </label>
        {#if photo}<button type="button" class="button" onclick={removePhoto}>Remove</button>{/if}
      </div>
      <small>Crop it to the knitting first. Stays in this browser; it's never uploaded.</small>
      {#if photoNote}<small class="warn">{photoNote}</small>{/if}
    </div>

    {#if import.meta.env.DEV}
      <fieldset class="dev">
        <legend>Model tuning — development only</legend>
        <p>
          Fit these by eye against a book photo with the fabric drawn relaxed.
          Users never see this; it's removed from the published site.
        </p>
        <label class="field">
          <span>Yarn pull: {tunedPull.toFixed(2)} <small>(model: {yarnPull.compute({})})</small></span>
          <input
            type="range"
            min="-1"
            max="1.5"
            step="0.05"
            value={Math.log10(tunedPull)}
            oninput={(e) => (tunedPull = 10 ** Number((e.currentTarget as HTMLInputElement).value))}
          />
        </label>
        <label class="field">
          <span>Double stitch stiffness: {tunedDouble.toFixed(2)} <small>(model: {doubleStitchStiffness.compute({})})</small></span>
          <input type="range" min="0.05" max="1" step="0.05" bind:value={tunedDouble} />
        </label>
        {#if relaxed}
          <small>Settled in {relaxed.iterations} rounds{relaxed.converged ? "" : " — didn't fully settle"}.</small>
        {/if}
      </fieldset>
    {/if}

    <label class="field grow">
      <span>Written rows</span>
      <textarea bind:value={text} spellcheck="false" rows="18"></textarea>
    </label>

    <details class="help">
      <summary>How to write rows</summary>
      <ul>
        <li><code>Row 1 (WS): (A) Knit all sts</code> — say RS or WS on the first row; the rest alternate.</li>
        <li><code>Rows 4 to 5: (A) Knit all sts</code> — several rows at once.</li>
        <li><code>(B) K24, SR</code> — knit 24, then turn. <code>SR</code> is a German short row.</li>
        <li><code>Knit to end</code> — on to the edge you're heading for.</li>
        <li><code>(A) K4, (B) K14, SR</code> — A knits 4 and stops; B carries on from the next stitch.</li>
        <li>Columns count from 1 at the right-hand edge, as on a chart. RS rows travel left.</li>
        <li>Other lines (notes, "Repeat rows…") are skipped, so you can paste a whole page.</li>
      </ul>
    </details>
  </section>

  <section class="results" aria-label="Result">
    <div class="status" class:good={fabric.balanced && problems.length === 0} class:bad={!fabric.balanced}>
      {#if read.passes.length === 0}
        <p class="verdict">No rows yet.</p>
      {:else if fabric.balanced}
        <p class="verdict">✓ Balanced — every stitch gets {fabric.heights[0] / safeRepeats} rows per repeat.</p>
      {:else}
        <p class="verdict">✗ Not balanced — the fabric would pull up where stitches are short.</p>
        <ul class="shortfalls">
          {#each shortfalls as s (s.from)}
            <li>
              {s.from === s.to ? `Column ${s.from} is` : `Columns ${s.from}–${s.to} are`}
              {s.short} {s.short === 1 ? "row" : "rows"} short
            </li>
          {/each}
        </ul>
      {/if}
      {#if read.passes.length > 0}
        <p class="facts">
          {read.rowsPerRepeat} rows · {perRepeat} passes per repeat ·
          {read.strands.length} {read.strands.length === 1 ? "strand" : "strands"}
          ({read.strands.map((s) => s.id).join(", ")}) · {read.strands.length * 2} ends to weave in
        </p>
      {/if}
    </div>

    {#if problems.length > 0}
      <div class="messages problems">
        <h2>Problems</h2>
        <ul>{#each problems as m, i (i)}<li>{m}</li>{/each}</ul>
      </div>
    {/if}
    {#if read.notes.length > 0}
      <div class="messages notes">
        <h2>Worth knowing</h2>
        <ul>{#each read.notes as n, i (i)}<li>{n.message}</li>{/each}</ul>
      </div>
    {/if}

    <p class="hover-line" aria-live="polite">
      {#if hoveredInfo && hoveredPass}
        Row {hoveredInfo.row} ({hoveredInfo.side}), yarn {hoveredInfo.strand}: columns
        {hoveredPass.from} → {hoveredPass.to}
        ({Math.abs(hoveredPass.to - hoveredPass.from) + 1} sts){hoveredInfo.turnAt !== null ? ", then turn" : ""}
      {:else}
        Point at a pass in the chart, or a stitch in the fabric, to see where it came from.
      {/if}
    </p>

    {#if read.passes.length > 0}
      <div class="views" class:compare={photo !== null}>
        <figure>
          <figcaption>
            <div class="caption-row">
              <h2>Fabric</h2>
              <div class="toggle" role="group" aria-label="How to draw the fabric">
                <button type="button" aria-pressed={drawing === "relaxed"} onclick={() => (drawing = "relaxed")}>Relaxed</button>
                <button type="button" aria-pressed={drawing === "straight"} onclick={() => (drawing = "straight")}>Straight</button>
              </div>
            </div>
            <span>
              {safeRepeats} {safeRepeats === 1 ? "repeat" : "repeats"}.
              {#if drawing === "relaxed"}
                Ridges bend where the yarn pulls them — how far is still a prediction.
              {:else}
                Every row stacked straight up — shows the counting, not the shape.
              {/if}
            </span>
          </figcaption>
          <FabricView {fabric} layout={relaxed} {colourOfStrand} {linked} onhover={fromFabric} />
        </figure>
        {#if photo}
          <figure>
            <figcaption>
              <h2>Photo</h2>
              <span>Real knitting, to compare against the fabric.</span>
            </figcaption>
            <div class="photo-frame"><img src={photo} alt="Knitted swatch to compare against the fabric" /></div>
          </figure>
        {/if}
        <figure class:wide={photo !== null}>
          <figcaption>
            <h2>Needle chart</h2>
            <span>One repeat, one line per pass, in knitting order. ∞ is a turn.</span>
          </figcaption>
          <NeedleChart
            stitches={safeStitches}
            passes={chartPasses}
            info={chartInfo}
            {colourOf}
            {hovered}
            onhover={(k) => (hovered = k)}
          />
        </figure>
      </div>
    {/if}
  </section>
</main>

<style>
  header {
    padding: 24px 24px 8px;
    max-width: 1400px;
    margin: 0 auto;
  }
  h1 {
    font-size: 1.6rem;
    margin: 0 0 6px;
    color: var(--ink);
    font-weight: 600;
  }
  .lede {
    margin: 0;
    color: var(--muted);
    max-width: 60ch;
  }
  main {
    display: grid;
    grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
    gap: 24px;
    padding: 16px 24px 48px;
    max-width: 1400px;
    margin: 0 auto;
    align-items: start;
  }
  @media (max-width: 860px) {
    main {
      grid-template-columns: minmax(0, 1fr);
      padding: 16px;
    }
    header {
      padding: 16px 16px 4px;
    }
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  input[type="number"],
  select,
  textarea {
    font: inherit;
    font-size: 0.95rem;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 8px;
  }
  textarea {
    font-family: var(--mono);
    font-size: 0.82rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 240px;
  }
  .about {
    margin: -4px 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .yarns {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--ink);
  }
  .swatch input {
    width: 32px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: none;
  }
  .help {
    font-size: 0.82rem;
    color: var(--muted);
  }
  .help summary {
    cursor: pointer;
    color: var(--ink);
  }
  .help ul {
    padding-left: 18px;
    margin: 8px 0 0;
  }
  .help li {
    margin-bottom: 4px;
  }
  code {
    font-family: var(--mono);
    font-size: 0.78rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 4px;
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }
  .status {
    border: 1px solid var(--line);
    border-left: 4px solid var(--line);
    border-radius: 8px;
    padding: 12px 14px;
    background: var(--surface);
  }
  .status.good {
    border-left-color: var(--good);
  }
  .status.bad {
    border-left-color: var(--bad);
  }
  .verdict {
    margin: 0;
    font-weight: 600;
    color: var(--ink);
  }
  .shortfalls {
    margin: 6px 0 0;
    padding-left: 18px;
    color: var(--ink);
  }
  .facts {
    margin: 6px 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .messages {
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.88rem;
  }
  .messages h2 {
    font-size: 0.9rem;
    margin: 0 0 4px;
  }
  .messages ul {
    margin: 0;
    padding-left: 18px;
  }
  .problems {
    background: var(--bad-bg);
    color: var(--ink);
  }
  .notes {
    background: var(--note-bg);
    color: var(--ink);
  }
  .hover-line {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
    min-height: 1.4em;
  }
  .views {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    align-items: start;
  }
  figure {
    margin: 0;
    min-width: 0;
  }
  /* With a photo, fabric and photo sit side by side in two equal halves for
     comparison, and the chart takes the full width beneath them. On a phone
     they stack. */
  .views.compare {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 700px) {
    .views.compare {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  figure.wide {
    grid-column: 1 / -1;
  }
  .photo-frame {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    padding: 8px;
  }
  .photo-frame img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 70vh;
    object-fit: contain;
  }
  .photo-pick {
    display: flex;
    gap: 8px;
  }
  .button {
    font: inherit;
    font-size: 0.85rem;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
    position: relative;
  }
  .button:hover {
    border-color: var(--accent);
  }
  .button:focus-within,
  .button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .button input[type="file"] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  small {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .caption-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .toggle {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
  }
  .toggle button {
    font: inherit;
    font-size: 0.8rem;
    padding: 3px 10px;
    border: 0;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
  }
  .toggle button[aria-pressed="true"] {
    background: var(--accent);
    color: #fff;
  }
  .toggle button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .dev {
    border: 1px dashed var(--line);
    border-radius: 8px;
    padding: 8px 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dev legend {
    font-size: 0.8rem;
    color: var(--muted);
    padding: 0 4px;
  }
  .dev p {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
  }
  small.warn {
    color: var(--bad);
  }
  figcaption {
    margin-bottom: 6px;
  }
  figcaption h2 {
    font-size: 1rem;
    margin: 0;
    color: var(--ink);
  }
  figcaption span {
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>

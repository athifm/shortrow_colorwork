<!--
  The review bar (Draw tab, development only): say what you think of the shape
  in front of you, right where you load it. "Looks right", "Save my redraw" or
  a note — each saved at once to review/review.json (review.ts), to be read
  from the project later. Nothing here changes the test set itself: a redraw
  replaces the shape in the tests only once the review has been read.
-->
<script lang="ts">
  import type { ReviewEntry } from "./review";

  let {
    title,
    entry,
    redrawn,
    done,
    total,
    status,
    onlooksright,
    onredraw,
    onnote,
    onnext,
    onreset,
    onsaveas,
  }: {
    /** The test shape being reviewed, as "S9 leaf" — or null for a drawing of your own. */
    title: string | null;
    entry: ReviewEntry | undefined;
    /** Whether the drawing differs from the shape as it was loaded. */
    redrawn: boolean;
    done: number;
    total: number;
    /** The last thing saved, or what went wrong. */
    status: string;
    onlooksright: () => void;
    onredraw: () => void;
    onnote: (text: string) => void;
    onnext: () => void;
    /** Drop your redraw and go back to the draft. */
    onreset: () => void;
    onsaveas: (name: string) => void;
  } = $props();

  let note = $state("");
  let name = $state("");

  function addNote() {
    const text = note.trim();
    if (!text) return;
    onnote(text);
    note = "";
  }
</script>

<section class="review" aria-label="Review this shape">
  <div class="head">
    <strong>{title ? `Reviewing ${title}` : "A drawing of your own"}</strong>
    <span>{done} of {total} test shapes reviewed</span>
  </div>

  {#if title}
    <p class="said">
      {#if entry?.verdict === "looks right"}
        You said: looks right.
      {:else if entry?.verdict === "redrawn"}
        Your redraw is saved, and loads in place of the draft.
      {:else}
        Is this how you'd draw it?
      {/if}
    </p>
    <div class="buttons">
      {#if entry?.verdict === "redrawn"}
        <button type="button" onclick={onreset}>Back to the draft</button>
      {:else}
        <button type="button" class="yes" onclick={onlooksright} disabled={redrawn}>Looks right</button>
      {/if}
      <button type="button" onclick={onredraw} disabled={!redrawn}>Save my redraw</button>
      <button type="button" onclick={onnext}>Next shape →</button>
    </div>
    <p class="hint">
      {redrawn
        ? "You've changed the drawing: save it as your redraw, or load the shape again to start over."
        : "To change it, paint over it, then save your redraw."}
    </p>
  {:else}
    <div class="saveas">
      <input type="text" placeholder="Name this shape" bind:value={name} aria-label="A name for this shape" />
      <button
        type="button"
        onclick={() => {
          onsaveas(name.trim());
          name = "";
        }}
        disabled={name.trim() === ""}>Save as a new shape</button
      >
    </div>
    <p class="hint">Or pick a test shape under "Start from" to review it.</p>
  {/if}

  <div class="noting">
    <textarea rows="2" placeholder="A note — anything: the shape, the suggested way, the picture…" bind:value={note}></textarea>
    <button type="button" onclick={addNote} disabled={note.trim() === ""}>Add note</button>
  </div>
  {#if entry && entry.notes.length > 0}
    <ul class="notes">
      {#each entry.notes as n (n.at)}<li>{n.text}</li>{/each}
    </ul>
  {/if}
  {#if status}<p class="status">{status}</p>{/if}
</section>

<style>
  .review {
    border: 1px dashed var(--accent);
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 10px;
    font-size: 0.82rem;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    color: var(--ink);
  }
  .head span,
  .hint {
    color: var(--muted);
    font-size: 0.78rem;
  }
  .said {
    margin: 6px 0;
    color: var(--ink);
  }
  .hint {
    margin: 4px 0 0;
  }
  .buttons,
  .saveas,
  .noting {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  button {
    font: inherit;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }
  .yes {
    border-color: var(--accent);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  input,
  textarea {
    font: inherit;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 4px 6px;
    flex: 1 1 12rem;
    min-width: 0;
  }
  .notes {
    margin: 6px 0 0;
    padding-left: 1.2em;
    color: var(--ink);
  }
  .status {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.78rem;
  }
</style>

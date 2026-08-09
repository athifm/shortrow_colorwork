/**
 * The calibration workbench — a page in the repository that is not part of the
 * app. See PLAN.md §3.6.
 *
 * What it will do, at M1:
 *   1. Print the instructions for a test piece.
 *   2. Record what the app predicted that piece would measure.
 *   3. Take what it actually measured.
 *   4. Fit the relation, and emit a TypeScript file we read and commit.
 *
 * Its output is source code. The shipped app never runs any of this.
 */
import { MODEL } from "../../model/physical";

const root = document.querySelector("#workbench")!;

root.innerHTML = `
  <h1>Calibration workbench</h1>
  <p>Not part of the app. Everything the model is currently guessing:</p>
  <ul>
    ${MODEL.map(
      (r) => `<li><b>${r.id}</b> — ${r.describes}
        <br><small>${r.confidence} · ${r.source}</small>
        <br><small>Settled by: ${r.settledBy}</small></li>`,
    ).join("")}
  </ul>
`;

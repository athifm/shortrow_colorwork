import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Two rules from PLAN.md that are worth nothing as good intentions.
 *
 * Both describe things that stay true only while everybody remembers them, which
 * is to say not very long. So they are checked here instead.
 */

const SRC = join(import.meta.dirname, ".");

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .map((f) => join(SRC, f))
    .filter((f) => /\.(ts|svelte)$/.test(f))
    .filter((f) => !/\.test\.ts$/.test(f));
}

function stripCommentsAndStrings(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

describe("the planner holds no physics of its own", () => {
  // PLAN.md §2.4: any planner line that wants to know how far a wedge flares
  // asks `model/physical`. The rule dies the first time somebody inlines a 0.7
  // at eleven at night, so it is checked rather than trusted.
  //
  // Array bookkeeping needs small integers, so those are allowed. Anything else
  // — a fraction, an angle, a millimetre figure — is the shape of a physical
  // constant and belongs in the model.
  const ALLOWED = new Set(["0", "1", "2", "-1"]);

  it("uses no numeric literals beyond plain index arithmetic", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const rel = relative(SRC, file);
      if (!rel.startsWith(`methods${sep}`)) continue;

      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const [literal] of code.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?/g)) {
        if (!ALLOWED.has(literal)) offenders.push(`${rel}: ${literal}`);
      }
    }

    expect(
      offenders,
      "These look like physical constants. They belong in src/model/physical.ts:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("development-only code cannot reach the shipped app", () => {
  // The calibration workbench and the model page are ours, not the user's
  // (PLAN.md §3.6). They stay out of the production bundle because nothing the
  // app builds ever imports them — which holds only as long as that is true, so
  // here it is checked.
  it("is never imported by anything outside src/dev", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const rel = relative(SRC, file);
      if (rel.startsWith(`dev${sep}`)) continue;

      const code = readFileSync(file, "utf8");
      for (const [, path] of code.matchAll(
        /(?:import|from)\s+["']([^"']+)["']/g,
      )) {
        if (/(^|\/)dev\//.test(path)) offenders.push(`${rel} imports ${path}`);
      }
    }

    expect(
      offenders,
      "Development code would be pulled into the production build:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

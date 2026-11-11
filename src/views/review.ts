/**
 * The shape review (Draw tab, development only): what you said about each test
 * shape, kept in review/review.json by the dev server (vite.config.ts) so it
 * can be read from the project — no screenshots, no pasting.
 */
export interface ReviewNote {
  /** When it was written. */
  at: string;
  text: string;
  /** The drawing as it stood, in grid notation: top ridge first, a letter per cell. */
  grid: string;
  /** How the drawing was being read, and the way picked, if worked out. */
  reading: "look" | "needle";
  way: string | null;
}

export interface ReviewEntry {
  id: string;
  name: string;
  /** "looks right": the shape as it stands is how you'd draw it. "redrawn":
   *  `grid` is your version, to replace it. Null: only notes so far. */
  verdict: "looks right" | "redrawn" | null;
  grid: string | null;
  notes: ReviewNote[];
  /** A shape of your own, not one of the test set. */
  mine?: boolean;
}

export interface Review {
  entries: Record<string, ReviewEntry>;
}

const ADDRESS = "/__review";

export async function loadReview(): Promise<Review> {
  try {
    const review = (await (await fetch(ADDRESS)).json()) as Review;
    return review && typeof review.entries === "object" ? review : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

/** True when the file was written. */
export async function saveReview(review: Review): Promise<boolean> {
  try {
    const answer = await fetch(ADDRESS, { method: "POST", body: JSON.stringify(review) });
    return answer.ok;
  } catch {
    return false;
  }
}

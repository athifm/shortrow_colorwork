/**
 * Example patterns for the pattern lab.
 *
 * All designed for this project, deliberately not taken from any book: the page
 * may be published, and printing someone else's patterns on it would be
 * republishing them. Each one is small enough to check by hand, and each is
 * pinned by a test (written.test.ts) so a change to the reader can't quietly
 * break them.
 */
export interface Preset {
  name: string;
  /** What it demonstrates, in a sentence. */
  about: string;
  stitches: number;
  text: string;
}

export const PRESETS: Preset[] = [
  {
    name: "Stripe with catch-up",
    about:
      "B works a stripe from the right edge and turns. The three stitches it didn't reach get a catch-up short row in A, so every stitch ends level.",
    stitches: 12,
    text: `Row 1 (WS): (A) Knit all sts
Row 2 (RS): (B) K9, SR
Row 3: (B) Knit to end
Row 4: (A) Knit all sts
Row 5: (A) K3, SR
Row 6: (A) Knit to end
Rows 7 to 8: (A) Knit all sts`,
  },
  {
    name: "Stripe, catch-up missing",
    about:
      "The same stripe with the catch-up short row left out. The three left-hand stitches end up two rows short — the fabric would pull up there.",
    stitches: 12,
    text: `Row 1 (WS): (A) Knit all sts
Row 2 (RS): (B) K9, SR
Row 3: (B) Knit to end
Row 4: (A) Knit all sts
Rows 5 to 6: (A) Knit all sts`,
  },
  {
    name: "Lens",
    about:
      "A pointed lens in B, built from one zigzag of turns that shrink and then grow. A hands over to B mid-row and takes back over on the way home; catch-up short rows on both sides level the fabric.",
    stitches: 16,
    text: `Row 1 (WS): (A) Knit all sts
Row 2 (RS): (A) K4, (B) K8, SR, K6, SR, K4, SR, K2, SR, K3, SR, K4, SR, K6, SR
Row 3: (B) K9, (A) Knit to end
Row 4: (A) K8, SR
Row 5: (A) Knit to end
Row 6: (A) K7, SR
Row 7: (A) Knit to end
Row 8: (A) K6, SR
Row 9: (A) Knit to end
Row 10: (A) Knit all sts
Row 11: (A) K6, SR
Row 12: (A) Knit to end
Row 13: (A) K5, SR
Row 14: (A) Knit to end
Row 15: (A) K4, SR
Row 16: (A) Knit to end
Row 17: (A) K3, SR
Row 18: (A) Knit to end
Rows 19 to 20: (A) Knit all sts`,
  },
];

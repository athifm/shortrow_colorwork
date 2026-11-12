/**
 * The probe grids of Stage E: small drawings, each asking one question of the
 * grid constructor (PLAN.md §8). This file is their only copy. `.` is the
 * background (A), `#` the motif (B), `o` a third colour (C); each character is
 * one stitch by one ridge; the top line is the top of the fabric, and the right
 * end of a line is column 1, where knitting starts.
 */
export interface Probe {
  id: string;
  name: string;
  grid: string;
}

export const PROBES: Probe[] = [
  {
    id: "P1",
    name: "full-width band",
    grid: `..............
##############
..............`,
  },
  {
    id: "P2",
    name: "band from the right edge",
    grid: `..............
....##########
..............`,
  },
  {
    id: "P3",
    name: "gentle diagonal",
    grid: `.............#
............##
...........###
..........####
.........#####`,
  },
  {
    id: "P4",
    name: "steep diagonal",
    grid: `...........###
...........###
..........####
..........####
..........####
.........#####`,
  },
  {
    id: "P5",
    name: "vertical edge",
    grid: `.........#####
.........#####
.........#####
.........#####
.........#####`,
  },
  {
    id: "P6",
    name: "floating rectangle",
    grid: `..............
....######....
....######....
....######....
..............`,
  },
  {
    id: "P7",
    name: "floating lens",
    grid: `..............
......##......
....######....
...########...
....######....
......##......
..............`,
  },
  {
    id: "P8",
    name: "circle",
    grid: `.....####.....
...########...
..##########..
..##########..
...########...
.....####.....`,
  },
  {
    id: "P9",
    name: "two islands side by side",
    grid: `..............
.###......###.
.###......###.
..............`,
  },
  {
    id: "P10",
    name: "two islands one above the other",
    grid: `.....####.....
..............
..............
.....####.....`,
  },
  {
    id: "P11",
    name: "ring",
    grid: `....######....
...##....##...
...##....##...
....######....`,
  },
  {
    id: "P12",
    name: "thin vertical line",
    grid: `.......#......
.......#......
.......#......
.......#......`,
  },
  {
    id: "P13",
    name: "thin horizontal line",
    grid: `..............
...#######....
..............`,
  },
  {
    id: "P14",
    name: "checkerboard",
    grid: `##..##..##..##
##..##..##..##
..##..##..##..
..##..##..##..`,
  },
  {
    id: "P15",
    name: "single dot",
    grid: `..............
.......#......
..............`,
  },
  {
    id: "P16",
    name: "two colours touching",
    grid: `..............
...####oooo...
...####oooo...
..............`,
  },
  {
    id: "P17",
    name: "mushroom",
    grid: `...########...
...########...
......##......
......##......`,
  },
  {
    id: "P18",
    name: "cup",
    grid: `...##....##...
...##....##...
...########...
...########...`,
  },
];

/**
 * The shapes this app is for (PLAN.md §6, step 1): the book's kind, blobby
 * ones, and your own drawings. The probes above stay as regression tests; these
 * are what the app is measured against. Letters are yarns, A the background.
 */
export const SHAPES: Probe[] = [
  {
    id: "S1",
    name: "stripe",
    grid: `AAAAAAAAAAAAAA
BBBBBBBBBBBBBB
BBBBBBBBBBBBBB
AAAAAAAAAAAAAA`,
  },
  {
    id: "S2",
    name: "short stripe from an edge",
    grid: `AAAAAAAAAAAAAA
AAAAAAAAABBBBB
AAAAAAAABBBBBB
AAAAAAABBBBBBB
AAAAAAAAAAAAAA`,
  },
  {
    id: "S3",
    name: "wedge",
    grid: `AAAAAAAAAAAAAA
AAAAAAAAAAAABB
AAAAAAAAAABBBB
AAAAAAAABBBBBB
AAAAAABBBBBBBB
AAAABBBBBBBBBB
AAAAAAAAAAAAAA`,
  },
  {
    id: "S4",
    name: "leaning stripe",
    grid: `AAAAAAAAAAAAAAAA
BBAAAAAAAAAAAAAA
BBBBAAAAAAAAAAAA
AABBBBAAAAAAAAAA
AAAABBBBAAAAAAAA
AAAAAABBBBAAAAAA
AAAAAAAABBBBAAAA
AAAAAAAAAABBBBAA
AAAAAAAAAAAABBBB
AAAAAAAAAAAAAABB
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S5",
    name: "fish with a tail",
    grid: `AAAAAAAAAAAAAAAA
AAAAAABBBAAAAAAA
AABAABBBBBBAAAAA
AAABBBBBBBBBBAAA
AABAABBBBBBAAAAA
AAAAAABBBAAAAAAA
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S6",
    name: "zigzag band",
    grid: `AAAAAAAAAAAAAAAA
AAAABBAAAAAABBAA
AABBBBBBAABBBBBB
BBBBAABBBBBBAABB
BBAAAAAABBAAAAAA
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S7",
    name: "oval",
    grid: `AAAAAAAAAAAAAAAA
AAAAABBBBBBAAAAA
AAABBBBBBBBBBAAA
AABBBBBBBBBBBBAA
AAABBBBBBBBBBAAA
AAAAABBBBBBAAAAA
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S8",
    name: "teardrop",
    grid: `AAAAAAAAAAAAAA
AAAAAAABAAAAAA
AAAAAABBBAAAAA
AAAAAABBBAAAAA
AAAAABBBBBAAAA
AAAABBBBBBBAAA
AAAABBBBBBBAAA
AAAAABBBBBAAAA
AAAAAAAAAAAAAA`,
  },
  {
    id: "S9",
    name: "leaf",
    grid: `AAAAAAAAAAAAAAAA
AAAAAAAAAAAAABAA
AAAAAAAAAABBBAAA
AAAAAAABBBBBBAAA
AAAABBBBBBBAAAAA
AAABBBBBAAAAAAAA
AABBAAAAAAAAAAAA
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S10",
    name: "wave band",
    grid: `AAAAAAAAAAAAAAAA
AABBBBBAAAAAAAAA
BBBBBBBBBBAAAAAB
BBBBBBBBBBBBBBBB
BBAAAAABBBBBBBBB
AAAAAAAAAABBBBBA
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S11",
    name: "blob at the edge",
    grid: `AAAAAAAAAAAAAA
AAAAAAAAABBBBB
AAAAAAABBBBBBB
AAAAAABBBBBBBB
AAAAAAABBBBBBB
AAAAAAAAABBBBB
AAAAAAAAAAAAAA`,
  },
  {
    id: "S12",
    name: "two blobs side by side",
    grid: `AAAAAAAAAAAAAAAAAA
AAAABBBAAAAACCCAAA
AABBBBBBBAACCCCCCA
AAABBBBBAAAAACCCAA
AAAAAAAAAAAAAAAAAA`,
  },
  {
    id: "S13",
    name: "blob inside a blob",
    grid: `AAAAAAAAAAAAAAAA
AAAAABBBBBBAAAAA
AAABBBBCCBBBBAAA
AABBBCCCCCCBBBAA
AAABBBBCCBBBBAAA
AAAAABBBBBBAAAAA
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S14",
    name: "your nested triangles",
    grid: `AAAAAAAAAAAAAAAA
AAAAAAABBAAAAAAA
AAAAAABBBBAAAAAA
AAAAABBCCBBAAAAA
AAAABBCCCCBBAAAA
AAABBCCDDCCBBAAA
AABBCCDDDDCCBBAA
ABBCCDDDDDDCCBBA`,
  },
  {
    id: "S15",
    name: "your blob with two colours inside",
    grid: `AAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAA
AAAAAACCCCCCAAAAA
AAAACCCFFFFCCAAAA
AACCCFFFFFFFCCCAA
ACCFFFFFFFFFFFCCA
ACCCCEEEEEEEECCCA
AACCCCEEEECCCCCAA
AAAACCCCCCCAAAAAA
AAAAAAAAAAAAAAAAA`,
  },
  {
    id: "S16",
    name: "your fish",
    grid: `AAAAAAAHHHHHAAAA
AAAAAHHHGGGHHAAA
AAAAHHGGGGGGHAAA
AAAHHGGGIIIIHAAA
AAAHGGGIIIIIHHHA
AAAHHGGGIIIIHHHA
AAAAHHGGGGGGHAAA
AAAAAHHHGGGHHAAA
AAAAAAAHHHHHAAAA
AAAAAAAAAAAAAAAA`,
  },
  {
    id: "S17",
    name: "your T",
    grid: `AAABBBBBBBBAAA
AAABBBBBBBBAAA
AAAAAABBAAAAAA
AAAAAABBAAAAAA`,
  },
];

/**
 * Edge probes (PLAN.md §6): the smallest drawings that each ask one question
 * about what short rows can knit, with the answer the try-everything checker
 * (oracle.ts) proved: the least a yarn must be carried for the drawing to be
 * knitted with one ball to each colour. 0 is the book's own way.
 *
 * Column 1, where every ridge starts, is at the right: the right-hand end of a
 * shape is its near end, where its yarn waits; the left is its far end, where
 * it turns.
 */
export const EDGES: (Probe & {
  carry: number;
  /** Balls allowed of a colour, where one isn't enough. */
  balls?: Record<string, number>;
})[] = [
  {
    id: "E1",
    name: "blunt near end, far end a point",
    carry: 0,
    grid: `AAAAAAAA
AAABBAAA
AABBBAAA
AAAAAAAA`,
  },
  {
    id: "E2",
    name: "blunt far end (E1 mirrored)",
    carry: 2,
    grid: `AAAAAAAA
AAABBAAA
AAABBBAA
AAAAAAAA`,
  },
  {
    id: "E3",
    name: "blunt near end, far end widening upwards",
    carry: 0,
    grid: `AAAAAAAA
AABBBAAA
AAABBAAA
AAAAAAAA`,
  },
  {
    id: "E4",
    name: "far end straight for two ridges",
    carry: 2,
    grid: `AAAAAAAA
AABBBAAA
AABBBAAA
AAAAAAAA`,
  },
  {
    id: "E5",
    name: "notch in the far side",
    carry: 2,
    grid: `AAAAAAAA
AABBBBAA
AAAABBAA
AABBBBAA
AAAAAAAA`,
  },
  {
    id: "E6",
    name: "lens, a stitch a ridge at both ends, top two wide",
    carry: 0,
    grid: `AAAAAAAAAA
AAAABBAAAA
AAABBBBAAA
AABBBBBBAA
AAAAAAAAAA`,
  },
  {
    id: "E7",
    name: "the same upside down",
    carry: 0,
    grid: `AAAAAAAAAA
AABBBBBBAA
AAABBBBAAA
AAAABBAAAA
AAAAAAAAAA`,
  },
  {
    id: "E8",
    name: "peak one stitch wide, points at both ends",
    carry: 1,
    grid: `AAAAAAAA
AAABAAAA
AABBBAAA
AAAAAAAA`,
  },
  {
    id: "E9",
    name: "shape touching the top edge",
    carry: 2,
    grid: `AAABBBAAA
AABBBBBAA
AAAAAAAAA`,
  },
  {
    id: "E10",
    name: "the same with a ridge of background above",
    carry: 0,
    grid: `AAAAAAAAA
AAABBBAAA
AABBBBBAA
AAAAAAAAA`,
  },
  {
    id: "E11",
    name: "a shape inside a shape",
    carry: 1,
    grid: `AAAAAAAAAA
AAAABBAAAA
AAABCCBAAA
AABBBBBBAA
AAAAAAAAAA`,
  },
  {
    id: "E12",
    name: "a shape inside a wider shape",
    carry: 1,
    grid: `AAAAAAAAAAAA
AAAAABBAAAAA
AAABBCCBBAAA
AABBBBBBBBAA
AAAAAAAAAAAA`,
  },
  {
    id: "E13",
    name: "a shape inside a shape, at its near end",
    carry: 1,
    grid: `AAAAAAAAAA
AAAABBAAAA
AAABBCCAAA
AABBBBBBAA
AAAAAAAAAA`,
  },
  {
    id: "E14",
    name: "two shapes side by side — a ball each",
    carry: 0,
    balls: { B: 2 },
    grid: `AAAAAAAAAAA
AABBAAABBAA
ABBBAABBBAA
AAAAAAAAAAA`,
  },
  {
    id: "E15",
    name: "two shapes one above the other — one ball",
    carry: 0,
    grid: `AAAAAAAA
AAABBAAA
AABBBAAA
AAAAAAAA
AAABBAAA
AABBBAAA
AAAAAAAA`,
  },
  {
    id: "E16",
    name: "a tail at the far end",
    carry: 2,
    grid: `AAAAAAAAAA
ABBABBAAAA
AABBBBBAAA
ABBABBAAAA
AAAAAAAAAA`,
  },
  {
    id: "E17",
    name: "a tail at the near end",
    carry: 2,
    grid: `AAAAAAAAAA
AAAABBABBA
AAABBBBBAA
AAAABBABBA
AAAAAAAAAA`,
  },
  {
    id: "E18",
    name: "touching the cast-on",
    carry: 0,
    grid: `AAAAAAAA
AAABBAAA
AABBBAAA`,
  },
  {
    id: "E19",
    name: "far end at the left edge of the fabric",
    carry: 0,
    grid: `AAAAAAAA
BBBAAAAA
BBBBAAAA
AAAAAAAA`,
  },
  {
    id: "E20",
    name: "a C, open on the near side",
    carry: 2,
    grid: `AAAAAAAA
AABBBBAA
AABAAAAA
AABBBBAA
AAAAAAAA`,
  },
  {
    id: "E21",
    name: "far side stepping 2 stitches a ridge",
    carry: 0,
    grid: `AAAAAAAAAA
AAAAABBAAA
AAABBBBAAA
ABBBBBBAAA
AAAAAAAAAA`,
  },
  {
    id: "E22",
    name: "far side stepping a stitch every 2 ridges",
    carry: 2,
    grid: `AAAAAAAA
AAABBAAA
AAABBAAA
AABBBAAA
AABBBAAA
AAAAAAAA`,
  },
  {
    id: "E23",
    name: "a bar inside a shape, the shape two stitches wide each side",
    carry: 1,
    grid: `AAAAAAAAAAAA
AAAAABBAAAAA
AAABBCCBBAAA
AABBBBBBBBAA
AAAAAAAAAAAA`,
  },
  {
    id: "E24",
    name: "a small lens inside a shape",
    carry: 1,
    grid: `AAAAAAAAAA
AAAABBAAAA
AAABBCBAAA
AABBCCCBAA
AAABBBBAAA
AAAAAAAAAA`,
  },
];

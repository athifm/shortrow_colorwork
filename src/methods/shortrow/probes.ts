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

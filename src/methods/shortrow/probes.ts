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

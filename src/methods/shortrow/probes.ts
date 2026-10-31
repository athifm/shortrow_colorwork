/**
 * The probe grids of LIMITS.md, as data: small drawings, each asking one
 * question of the grid constructor (PLAN.md §9, Stage F). Copied from LIMITS.md;
 * keep the two in step.
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

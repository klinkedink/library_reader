import { describe, expect, it } from "vitest";
import {
  bandsFromPlanks,
  chooseBandCount,
  findPlankYs,
  overlappingBands,
  planTilesFromSize,
  shouldSplitWide,
  splitWideTiles,
} from "./tiles";

describe("chooseBandCount", () => {
  it("keeps a front-on single-shelf phone photo as one tile", () => {
    // Typical iPhone portrait of one shelf (~15 spines), not a closet.
    expect(chooseBandCount(3000, 4000)).toBe(1);
    expect(chooseBandCount(4000, 3000)).toBe(1);
    expect(chooseBandCount(4000, 2200)).toBe(1);
  });

  it("uses at most two tiles for a two-shelf stack", () => {
    expect(chooseBandCount(2400, 1400)).toBeLessThanOrEqual(2);
    expect(chooseBandCount(3000, 4800)).toBe(2);
    expect(chooseBandCount(3000, 4800, 2)).toBe(2);
  });

  it("tiles a tall closet when no planks are detected", () => {
    expect(chooseBandCount(3000, 9000)).toBeGreaterThanOrEqual(8);
    expect(chooseBandCount(3000, 9000)).toBeLessThanOrEqual(12);
  });

  it("uses detected planks for a 10-shelf closet in a 3:4 phone frame", () => {
    expect(chooseBandCount(3000, 4000, 10)).toBe(10);
  });
});

describe("overlappingBands", () => {
  it("covers the full height and overlaps neighbors", () => {
    const bands = overlappingBands(1000, 2000, 8);
    expect(bands).toHaveLength(8);
    expect(bands[0].y).toBe(0);
    expect(bands[bands.length - 1].y + bands[bands.length - 1].height).toBe(2000);
    expect(bands[0].y + bands[0].height).toBeGreaterThan(bands[1].y);
  });

  it("returns a single full-frame tile when count is 1", () => {
    const bands = overlappingBands(3000, 4000, 1);
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ x: 0, y: 0, width: 3000, height: 4000 });
  });
});

describe("planTilesFromSize", () => {
  it("does not chop a 1-shelf 3000×4000 photo into spine-slicing strips", () => {
    const tiles = planTilesFromSize(3000, 4000);
    expect(tiles.length).toBeLessThanOrEqual(2);
    expect(Math.min(...tiles.map((t) => t.height))).toBeGreaterThan(2000);
  });

  it("tiles a 10-shelf closet from regularly spaced planks even in a 3:4 frame", () => {
    // Production detects planks on a ~180px-wide analysis canvas, not the
    // 4000px working copy (heavy smoothing would erase thin full-res boards).
    const analysisHeight = 240;
    const stds = Array.from({ length: analysisHeight }, (_, y) => {
      const inPlank = y % 24 < 3;
      return inPlank ? 3 : 30;
    });
    const analysisTiles = planTilesFromSize(180, analysisHeight, stds);
    expect(analysisTiles.length).toBeGreaterThanOrEqual(8);
    expect(analysisTiles.length).toBeLessThanOrEqual(12);

    const plankYs = Array.from({ length: 9 }, (_, i) => Math.round((i + 1) * (4000 / 10)));
    const bands = bandsFromPlanks(3000, 4000, plankYs);
    expect(bands).not.toBeNull();
    expect(bands!.length).toBeGreaterThanOrEqual(8);
    expect(bands!.length).toBeLessThanOrEqual(12);
    expect(Math.min(...bands!.map((t) => t.height))).toBeGreaterThan(250);
  });

  it("tiles a very tall closet wall without plank data", () => {
    const tiles = planTilesFromSize(3000, 9000);
    expect(tiles.length).toBeGreaterThanOrEqual(8);
    expect(tiles.length).toBeLessThanOrEqual(16);
  });

  it("does not left/right-split a 12-band closet", () => {
    expect(shouldSplitWide(3000, 9000, 12)).toBe(false);
  });
});

describe("splitWideTiles", () => {
  it("splits a wide bay into overlapping left/right tiles", () => {
    const [left, right] = splitWideTiles(
      [{ x: 0, y: 0, width: 3000, height: 600, row: 0, col: 0 }],
    );
    expect(left.col).toBe(0);
    expect(right.col).toBe(1);
    expect(left.x + left.width).toBeGreaterThan(right.x);
  });
});

describe("plank detection", () => {
  it("finds low-variance valleys as shelf planks", () => {
    const stds: number[] = [];
    for (let i = 0; i < 400; i += 1) {
      const inPlank = i % 40 < 5;
      stds.push(inPlank ? 4 : 28);
    }
    const planks = findPlankYs(stds);
    expect(planks.length).toBeGreaterThanOrEqual(4);
    const bands = bandsFromPlanks(800, 400, planks);
    expect(bands).not.toBeNull();
    expect(bands!.length).toBeGreaterThanOrEqual(4);
  });
});

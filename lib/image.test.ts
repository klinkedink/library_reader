import { describe, expect, it } from "vitest";
import { scaleToLongSide } from "./image";

describe("scaleToLongSide", () => {
  it("does not upscale", () => {
    expect(scaleToLongSide(1200, 800, 2560)).toEqual({ width: 1200, height: 800 });
  });

  it("fits a closet wall into the working cap without crushing to 1600", () => {
    const fitted = scaleToLongSide(4000, 6000, 5120);
    expect(Math.max(fitted.width, fitted.height)).toBe(5120);
    expect(Math.min(fitted.width, fitted.height)).toBeGreaterThan(3000);
  });
});

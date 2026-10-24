import { expect, it } from "vitest";
import { splitRatio } from "./splitWidth";
it("follows pointer movement and preserves minimum panel widths", () => {
  expect(splitRatio(600, 1000)).toBe(0.6);
  expect(splitRatio(100, 1000)).toBe(0.28);
  expect(splitRatio(950, 1000)).toBe(0.72);
  expect(splitRatio(999, 560)).toBe(0.5);
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BRAND_SHADES,
  COLOR_PRESETS,
  generateBrandScale,
  hexToRgbString,
  isValidHexColor,
} from "../lib/theme/colors";

describe("isValidHexColor", () => {
  it("accepts three- and six-digit hex colors", () => {
    assert.equal(isValidHexColor("#abc"), true);
    assert.equal(isValidHexColor("#A1b2C3"), true);
  });

  it("rejects malformed values", () => {
    assert.equal(isValidHexColor("abc"), false);
    assert.equal(isValidHexColor("#abcd"), false);
    assert.equal(isValidHexColor("#12xz89"), false);
  });
});

describe("hexToRgbString", () => {
  it("expands shorthand hex before converting to RGB", () => {
    assert.equal(hexToRgbString("#0f8"), "0, 255, 136");
  });

  it("converts six-digit hex to RGB", () => {
    assert.equal(hexToRgbString("#10b981"), "16, 185, 129");
  });
});

describe("generateBrandScale", () => {
  it("returns the exact preset scale when the base 500 color matches", () => {
    const emerald = COLOR_PRESETS.find((preset) => preset.id === "emerald")!;
    assert.deepEqual(generateBrandScale(emerald.scale[500]), emerald.scale);
  });

  it("generates every Tailwind-shaped brand shade for custom colors", () => {
    const scale = generateBrandScale("#336699");
    assert.deepEqual(Object.keys(scale).map(Number), BRAND_SHADES);
    for (const shade of BRAND_SHADES) {
      assert.match(scale[shade], /^#[0-9a-f]{6}$/);
    }
  });
});

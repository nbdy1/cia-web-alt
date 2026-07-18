import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatIDR, formatIDRShort, formatNum, formatPct } from "../lib/format";

describe("formatIDR", () => {
  it("formats rounded Indonesian rupiah values", () => {
    assert.equal(formatIDR(1234567.4), "Rp1.234.567");
    assert.equal(formatIDR(1234567.5), "Rp1.234.568");
  });

  it("treats nullish values as zero", () => {
    assert.equal(formatIDR(null), "Rp0");
    assert.equal(formatIDR(undefined), "Rp0");
  });
});

describe("formatNum", () => {
  it("uses Indonesian thousands separators", () => {
    assert.equal(formatNum(1234567), "1.234.567");
  });

  it("treats nullish values as zero", () => {
    assert.equal(formatNum(null), "0");
    assert.equal(formatNum(undefined), "0");
  });
});

describe("formatIDRShort", () => {
  it("formats millions with at most one decimal", () => {
    assert.equal(formatIDRShort(1_250_000), "Rp1,3 jt");
  });

  it("formats thousands as rounded rb values", () => {
    assert.equal(formatIDRShort(349_500), "Rp350 rb");
  });

  it("leaves sub-thousand values unshortened", () => {
    assert.equal(formatIDRShort(999), "Rp999");
  });
});

describe("formatPct", () => {
  it("formats fractions as rounded percentages", () => {
    assert.equal(formatPct(0.424), "42%");
    assert.equal(formatPct(0.425), "43%");
  });

  it("returns a dash for nullish values", () => {
    assert.equal(formatPct(null), "—");
    assert.equal(formatPct(undefined), "—");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { slugify } from "../lib/slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    assert.equal(slugify("Pesantren Darunnajah"), "pesantren-darunnajah");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    assert.equal(slugify("Al-Azhar   & Co."), "al-azhar-co");
  });

  it("strips leading and trailing hyphens", () => {
    assert.equal(slugify("  -Pesantren-  "), "pesantren");
  });

  it("keeps digits", () => {
    assert.equal(slugify("SMA Bakti Mulya 400"), "sma-bakti-mulya-400");
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    assert.equal(slugify("!!!"), "");
  });

  it("is idempotent — slugifying an already-valid slug is a no-op", () => {
    const slug = slugify("darunnajah-2");
    assert.equal(slugify(slug), slug);
  });
});

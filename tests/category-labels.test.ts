import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { categoryDisplayLabel } from "../lib/data/category-labels";

describe("categoryDisplayLabel", () => {
  it("renames Karakter to Character", () => {
    assert.equal(categoryDisplayLabel("Karakter"), "Character");
  });

  it("renames lowercase karakter to lowercase character", () => {
    assert.equal(categoryDisplayLabel("karakter"), "character");
  });

  it("passes Mental and Soft Skill through unchanged", () => {
    assert.equal(categoryDisplayLabel("Mental"), "Mental");
    assert.equal(categoryDisplayLabel("Soft Skill"), "Soft Skill");
  });

  it("passes unknown categories through unchanged", () => {
    assert.equal(categoryDisplayLabel("Akademik"), "Akademik");
  });

  it("never changes the underlying value used for data matching — callers must still compare against the raw category", () => {
    // Regression guard: this function must stay display-only. If a caller
    // starts comparing categoryDisplayLabel() output against stored data,
    // every existing report's category ("Karakter") will silently stop
    // matching. See lib/data/category-labels.ts's own warning comment.
    const raw = "Karakter";
    const displayed = categoryDisplayLabel(raw);
    assert.notEqual(raw, displayed);
  });
});

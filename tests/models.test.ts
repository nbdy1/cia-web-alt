import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getModelLabel, MODEL_OPTIONS } from "../lib/data/models";

describe("getModelLabel", () => {
  it("defaults to Gemini 3.0 Flash for empty ids", () => {
    assert.equal(getModelLabel(null), "Gemini 3.0 Flash");
    assert.equal(getModelLabel(undefined), "Gemini 3.0 Flash");
    assert.equal(getModelLabel(""), "Gemini 3.0 Flash");
  });

  it("returns the configured label for every known model id", () => {
    for (const option of MODEL_OPTIONS) {
      assert.equal(getModelLabel(option.id), option.label);
    }
  });

  it("falls back to the raw id for unknown models", () => {
    assert.equal(getModelLabel("provider/new-model"), "provider/new-model");
  });
});

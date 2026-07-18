import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeCostIdr } from "../lib/usage/rates";

describe("computeCostIdr", () => {
  it("computes OpenRouter chat token costs from input and output rates", () => {
    assert.equal(
      computeCostIdr("openrouter", "google/gemini-3-flash-preview", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
      62_825,
    );
  });

  it("computes embedding input-only costs", () => {
    assert.equal(
      computeCostIdr("openrouter", "openai/text-embedding-3-small", {
        inputTokens: 500_000,
        outputTokens: 999_999,
      }),
      179.5,
    );
  });

  it("computes ElevenLabs character costs", () => {
    assert.equal(
      computeCostIdr("elevenlabs", "flash-v2.5", {
        charCount: 1_500,
      }),
      1_347,
    );
  });

  it("rounds to four decimal places for NUMERIC(14,4)", () => {
    assert.equal(
      computeCostIdr("openrouter", "google/gemini-3-flash-preview", {
        inputTokens: 1,
        outputTokens: 1,
      }),
      0.0628,
    );
  });

  it("returns zero for unknown models or missing usage", () => {
    assert.equal(computeCostIdr("openrouter", "unknown/model", { inputTokens: 1_000_000 }), 0);
    assert.equal(computeCostIdr("openrouter", null, {}), 0);
  });
});

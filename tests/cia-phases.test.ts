import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getCDSPhase, CDS_PHASES } from "../lib/cia-phases";

function phaseIndex(count: number, total: number): number | null {
  return getCDSPhase(count, total)?.index ?? null;
}

describe("getCDSPhase", () => {
  it("returns null when count is 0, regardless of total", () => {
    assert.equal(getCDSPhase(0, 10), null);
  });

  it("returns null when total is 0, regardless of count", () => {
    assert.equal(getCDSPhase(5, 0), null);
  });

  it("classifies the lower boundary of each phase correctly", () => {
    // 1% -> phase 1 (Instingtif)
    assert.equal(phaseIndex(1, 100), 1);
    // 21% -> phase 2 (Imitasi)
    assert.equal(phaseIndex(21, 100), 2);
    // 41% -> phase 3 (Internalisasi)
    assert.equal(phaseIndex(41, 100), 3);
    // 61% -> phase 4 (Aktualisasi)
    assert.equal(phaseIndex(61, 100), 4);
    // 81% -> phase 5 (Integrasi)
    assert.equal(phaseIndex(81, 100), 5);
  });

  it("classifies the upper boundary of each phase correctly", () => {
    assert.equal(phaseIndex(20, 100), 1);
    assert.equal(phaseIndex(40, 100), 2);
    assert.equal(phaseIndex(60, 100), 3);
    assert.equal(phaseIndex(80, 100), 4);
    assert.equal(phaseIndex(100, 100), 5);
  });

  it("works with non-percentage counts (fractions, not just x/100)", () => {
    // 3/7 ≈ 42.9% -> phase 3
    assert.equal(phaseIndex(3, 7), 3);
    // 1/7 ≈ 14.3% -> phase 1
    assert.equal(phaseIndex(1, 7), 1);
  });

  it("every phase has a distinct index 1-5 matching CDS_PHASES order", () => {
    assert.deepEqual(
      CDS_PHASES.map((p) => p.index),
      [1, 2, 3, 4, 5],
    );
  });
});

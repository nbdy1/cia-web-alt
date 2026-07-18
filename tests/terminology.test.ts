import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTerminology } from "../lib/data/terminology";

describe("getTerminology", () => {
  it("defaults to Ustadz/Santri for an unknown organization", () => {
    assert.deepEqual(getTerminology("some-unknown-org-id"), {
      ustadz: "Ustadz",
      ustadzLower: "ustadz",
      santri: "Santri",
      santriLower: "santri",
    });
  });

  it("defaults to Ustadz/Santri for null or undefined org ids", () => {
    assert.equal(getTerminology(null).ustadz, "Ustadz");
    assert.equal(getTerminology(undefined).ustadz, "Ustadz");
  });

  it("returns Guru/Siswa for SMA Bakti Mulya 400", () => {
    const t = getTerminology("0bc3db16-d270-42d9-893a-c233a6b83800");
    assert.equal(t.ustadz, "Guru");
    assert.equal(t.ustadzLower, "guru");
    assert.equal(t.santri, "Siswa");
    assert.equal(t.santriLower, "siswa");
  });

  it("returns Guru/Murid for Limau Bendi School", () => {
    const t = getTerminology("cde16fd0-691d-4343-bacd-19c24cec6041");
    assert.equal(t.ustadz, "Guru");
    assert.equal(t.santri, "Murid");
    assert.equal(t.santriLower, "murid");
  });

  it("never lets an org override leak into another org's lookup", () => {
    const a = getTerminology("0bc3db16-d270-42d9-893a-c233a6b83800");
    const b = getTerminology("cde16fd0-691d-4343-bacd-19c24cec6041");
    assert.notEqual(a.santri, b.santri);
  });
});

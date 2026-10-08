import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BACKUP_MAX_AGE_MS, clearAssessmentBackup, loadAssessmentBackup, saveAssessmentBackup } from "../lib/assessment-backup";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    keys: () => [...data.keys()],
  };
}

const payload = { analysis: { status_summary: "ok" }, narrative: "Guru: halo", model: "m" };
const NOW = 1_800_000_000_000;

describe("assessment backup", () => {
  it("round-trips an analysis for the same student", () => {
    const storage = memoryStorage();
    saveAssessmentBackup("s1", payload, storage, NOW);
    const loaded = loadAssessmentBackup("s1", storage, NOW + 1000);
    assert.deepEqual(loaded?.analysis, payload.analysis);
    assert.equal(loaded?.narrative, "Guru: halo");
  });

  it("never returns one student's analysis for another", () => {
    const storage = memoryStorage();
    saveAssessmentBackup("s1", payload, storage, NOW);
    assert.equal(loadAssessmentBackup("s2", storage, NOW), null);
  });

  it("ignores and removes a stale backup", () => {
    const storage = memoryStorage();
    saveAssessmentBackup("s1", payload, storage, NOW);
    assert.equal(loadAssessmentBackup("s1", storage, NOW + BACKUP_MAX_AGE_MS + 1), null);
    assert.deepEqual(storage.keys(), []);
  });

  it("can be cleared after the report is saved", () => {
    const storage = memoryStorage();
    saveAssessmentBackup("s1", payload, storage, NOW);
    clearAssessmentBackup("s1", storage);
    assert.equal(loadAssessmentBackup("s1", storage, NOW), null);
  });

  it("tolerates corrupt data and unavailable storage", () => {
    const storage = memoryStorage({ "cia:assessment-backup:s1": "{not json" });
    assert.equal(loadAssessmentBackup("s1", storage, NOW), null);
    assert.equal(loadAssessmentBackup("s1", null, NOW), null);
    assert.doesNotThrow(() => saveAssessmentBackup("s1", payload, null, NOW));
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } };
    assert.equal(loadAssessmentBackup("s1", throwing, NOW), null);
    assert.doesNotThrow(() => saveAssessmentBackup("s1", payload, throwing, NOW));
    assert.doesNotThrow(() => clearAssessmentBackup("s1", throwing));
  });

  it("rejects a backup with no analysis or a timestamp from the future", () => {
    const storage = memoryStorage({
      "cia:assessment-backup:a": JSON.stringify({ analysis: null, narrative: "", model: "", savedAt: NOW }),
      "cia:assessment-backup:b": JSON.stringify({ analysis: {}, narrative: "", model: "", savedAt: NOW + 10 * 60_000 }),
    });
    assert.equal(loadAssessmentBackup("a", storage, NOW), null);
    assert.equal(loadAssessmentBackup("b", storage, NOW), null);
  });
});

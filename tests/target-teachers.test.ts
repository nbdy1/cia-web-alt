import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectTrackedTeachers } from "../lib/target-teachers";

const members = [
  { user_id: "active", role: "ustadz" },
  { user_id: "gone", role: "ustadz" },
  { user_id: "test", role: "ustadz", targets_exempt: true },
  { user_id: "boss", role: "admin" },
  { user_id: "plain-admin", role: "admin" },
];
const profiles = [
  { id: "active", name: "Siti" },
  { id: "gone", name: "Eks Guru", is_removed: true },
  { id: "test", name: "Akun Uji" },
  { id: "boss", name: "Kepala" },
  { id: "plain-admin", name: "Admin Biasa" },
];

describe("selectTrackedTeachers", () => {
  it("never lists deactivated (Dinonaktifkan) accounts, even with leftover pending plans", () => {
    const result = selectTrackedTeachers(members, profiles, ["gone", "active"]);
    assert.equal(result.some((t) => t.userId === "gone"), false);
    assert.equal(result.some((t) => t.userId === "active"), true);
  });

  it("lists every teacher, including ones with no plans", () => {
    const ids = selectTrackedTeachers(members, profiles, []).map((t) => t.userId).sort();
    assert.deepEqual(ids, ["active", "test"]);
  });

  it("lists admins only when they own treatment plans", () => {
    const ids = selectTrackedTeachers(members, profiles, ["boss"]).map((t) => t.userId);
    assert.equal(ids.includes("boss"), true);
    assert.equal(ids.includes("plain-admin"), false);
  });

  it("keeps exempt teachers visible but flagged", () => {
    const result = selectTrackedTeachers(members, profiles, []);
    assert.equal(result.find((t) => t.userId === "test")?.exempt, true);
    assert.equal(result.find((t) => t.userId === "active")?.exempt, false);
  });

  it("falls back to a placeholder name when there is no profile row", () => {
    const result = selectTrackedTeachers([{ user_id: "ghost", role: "ustadz" }], [], []);
    assert.deepEqual(result, [{ userId: "ghost", name: "Tanpa nama", exempt: false }]);
  });

  it("treats a missing is_removed value as active", () => {
    const result = selectTrackedTeachers(members, [{ id: "active", name: "Siti", is_removed: null }], []);
    assert.equal(result.some((t) => t.userId === "active"), true);
  });
});

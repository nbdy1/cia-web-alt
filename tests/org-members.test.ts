import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCreateOrgUserInput, canRemoveOwner, mergeMembersWithProfiles } from "../lib/org-members";

describe("validateCreateOrgUserInput", () => {
  const base = { name: "Ahmad Fauzi", email: "ahmad@pesantren.com", password: "secret1", organizationId: "org-1", role: "ustadz" };

  it("accepts a fully valid submission and normalizes the email", () => {
    const result = validateCreateOrgUserInput({ ...base, email: "  Ahmad@Pesantren.COM  " });
    assert.equal(result.valid, true);
    assert.equal((result as any).normalizedEmail, "ahmad@pesantren.com");
  });

  it("rejects a blank or whitespace-only name", () => {
    assert.equal(validateCreateOrgUserInput({ ...base, name: "" }).valid, false);
    assert.equal(validateCreateOrgUserInput({ ...base, name: "   " }).valid, false);
  });

  it("rejects a blank email", () => {
    assert.equal(validateCreateOrgUserInput({ ...base, email: "" }).valid, false);
    assert.equal(validateCreateOrgUserInput({ ...base, email: "   " }).valid, false);
  });

  it("requires a password of at least 6 characters", () => {
    assert.equal(validateCreateOrgUserInput({ ...base, password: "12345" }).valid, false);
    assert.equal(validateCreateOrgUserInput({ ...base, password: "123456" }).valid, true);
  });

  it("requires an organizationId", () => {
    assert.equal(validateCreateOrgUserInput({ ...base, organizationId: "" }).valid, false);
  });

  it("only accepts owner/admin/ustadz as a role", () => {
    assert.equal(validateCreateOrgUserInput({ ...base, role: "owner" }).valid, true);
    assert.equal(validateCreateOrgUserInput({ ...base, role: "admin" }).valid, true);
    assert.equal(validateCreateOrgUserInput({ ...base, role: "ustadz" }).valid, true);
    assert.equal(validateCreateOrgUserInput({ ...base, role: "super-admin" }).valid, false);
    assert.equal(validateCreateOrgUserInput({ ...base, role: "" }).valid, false);
  });

  it("returns the same Indonesian error message regardless of which field is invalid", () => {
    const result = validateCreateOrgUserInput({ ...base, password: "x" });
    assert.equal(result.valid, false);
    assert.equal((result as any).error, "Nama, email, password minimal 6 karakter, organisasi, dan role wajib diisi.");
  });
});

describe("canRemoveOwner", () => {
  it("refuses to remove the only owner", () => {
    assert.equal(canRemoveOwner(1), false);
  });

  it("refuses when the owner count is somehow zero (defensive)", () => {
    assert.equal(canRemoveOwner(0), false);
  });

  it("allows removal when at least one other owner remains", () => {
    assert.equal(canRemoveOwner(2), true);
    assert.equal(canRemoveOwner(5), true);
  });
});

describe("mergeMembersWithProfiles", () => {
  it("joins member rows with their matching profile by id", () => {
    const merged = mergeMembersWithProfiles(
      [{ user_id: "u1", role: "ustadz", created_at: "2026-01-01" }],
      [{ id: "u1", name: "Budi", email: "budi@x.com" }],
    );
    assert.equal(merged[0].name, "Budi");
    assert.equal(merged[0].email, "budi@x.com");
  });

  it("falls back to null name/email when the profile is missing (deleted profile)", () => {
    const merged = mergeMembersWithProfiles([{ user_id: "u1", role: "ustadz", created_at: "2026-01-01" }], []);
    assert.equal(merged[0].name, null);
    assert.equal(merged[0].email, null);
  });

  it("sorts owner first, then admin, then ustadz", () => {
    const merged = mergeMembersWithProfiles(
      [
        { user_id: "u1", role: "ustadz", created_at: "2026-01-01" },
        { user_id: "u2", role: "owner", created_at: "2026-01-02" },
        { user_id: "u3", role: "admin", created_at: "2026-01-03" },
      ],
      [],
    );
    assert.deepEqual(merged.map((m) => m.role), ["owner", "admin", "ustadz"]);
  });

  it("keeps members with an unrecognized role after all known roles, stable order preserved", () => {
    const merged = mergeMembersWithProfiles(
      [
        { user_id: "u1", role: "owner", created_at: "2026-01-01" },
        { user_id: "u2", role: "guest", created_at: "2026-01-02" },
        { user_id: "u3", role: "admin", created_at: "2026-01-03" },
      ],
      [],
    );
    assert.deepEqual(merged.map((m) => m.user_id), ["u1", "u3", "u2"]);
  });

  it("returns an empty array for no members", () => {
    assert.deepEqual(mergeMembersWithProfiles([], []), []);
  });
});

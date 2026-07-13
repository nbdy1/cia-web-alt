import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  browserTenantCookieOptions,
  getTenantHost,
  getTenantSwitchUrl,
  tenantUrl,
} from "../lib/tenant";

describe("tenant host parsing", () => {
  it("treats localhost as non-production and slugless", () => {
    assert.deepEqual(getTenantHost("localhost:3000"), {
      hostname: "localhost",
      slug: null,
      isApex: false,
      isProductionDomain: false,
    });
  });

  it("extracts the organization slug from a production tenant host", () => {
    assert.deepEqual(getTenantHost("bm400.characterdev.systems"), {
      hostname: "bm400.characterdev.systems",
      slug: "bm400",
      isApex: false,
      isProductionDomain: true,
    });
  });

  it("keeps apex production hosts slugless", () => {
    assert.deepEqual(getTenantHost("characterdev.systems"), {
      hostname: "characterdev.systems",
      slug: null,
      isApex: true,
      isProductionDomain: true,
    });
  });

  it("ignores reserved subdomains as tenant slugs", () => {
    assert.equal(getTenantHost("www.characterdev.systems").slug, null);
    assert.equal(getTenantHost("app.characterdev.systems").slug, null);
  });
});

describe("tenant URL switching", () => {
  it("builds tenant URLs while preserving query and hash", () => {
    assert.equal(
      tenantUrl(
        "ubs",
        "/students/123",
        "https://bm400.characterdev.systems/students/123?from=%2Fstudents#report",
      ).toString(),
      "https://ubs.characterdev.systems/students/123?from=%2Fstudents#report",
    );
  });

  it("returns null when switching on localhost", () => {
    assert.equal(
      getTenantSwitchUrl(
        "localhost:3000",
        "ubs",
        "/students",
        "http://localhost:3000/students",
      ),
      null,
    );
  });

  it("returns null when already on the selected tenant", () => {
    assert.equal(
      getTenantSwitchUrl(
        "ubs.characterdev.systems",
        "ubs",
        "/students",
        "https://ubs.characterdev.systems/students",
      ),
      null,
    );
  });

  it("returns the selected tenant URL when switching organizations in production", () => {
    assert.equal(
      getTenantSwitchUrl(
        "bm400.characterdev.systems",
        "ubs",
        "/",
        "https://bm400.characterdev.systems/",
      ),
      "https://ubs.characterdev.systems/",
    );
  });
});

describe("browser tenant cookies", () => {
  it("uses js-cookie compatible expiration options", () => {
    const options = browserTenantCookieOptions();
    assert.equal(options.expires, 365);
    assert.equal("maxAge" in options, false);
  });
});

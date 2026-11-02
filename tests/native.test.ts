import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectNativeApp } from "../lib/native";

describe("detectNativeApp", () => {
  it("recognises the app by its user-agent marker", () => {
    assert.equal(detectNativeApp("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36 CDSApp/1.0"), true);
  });

  it("does not treat a normal mobile browser as the app", () => {
    assert.equal(detectNativeApp("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36"), false);
    assert.equal(detectNativeApp(undefined), false);
  });

  it("falls back to the Capacitor bridge", () => {
    assert.equal(detectNativeApp("Mozilla/5.0", { isNativePlatform: () => true }), true);
    assert.equal(detectNativeApp("Mozilla/5.0", { isNativePlatform: () => false }), false);
  });

  it("never throws if the bridge misbehaves", () => {
    assert.equal(detectNativeApp("Mozilla/5.0", { isNativePlatform: () => { throw new Error("boom"); } }), false);
  });
});

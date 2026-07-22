import assert from "node:assert/strict";
import test from "node:test";
import { getFrameworkForOrganization, isSupplementaryTheme } from "../lib/data/framework";
import {
  buildUnexploredThemesContext,
  enrichDetailedAssessments,
  lookupCanonicalIndicator,
} from "../lib/ai/assessment-helpers";

const BM400_ORG_ID = "0bc3db16-d270-42d9-893a-c233a6b83800";
const OTHER_ORG_ID = "4afa5b61-ea96-4740-a7e6-76ec4299e5f8";

test("BM400 framework appends its 13 supplementary themes", () => {
  const base = getFrameworkForOrganization(OTHER_ORG_ID);
  const bm400 = getFrameworkForOrganization(BM400_ORG_ID);

  assert.equal(base.Karakter.themes.length, 40);
  assert.equal(base.Mental.themes.length, 34);
  assert.equal(base["Soft Skill"].themes.length, 14);
  assert.equal(bm400.Karakter.themes.length, 45);
  assert.equal(bm400.Mental.themes.length, 38);
  assert.equal(bm400["Soft Skill"].themes.length, 18);
  assert.equal(
    bm400.Mental.themes.at(-1)?.title,
    "Kemandirian berpikir dan pengambilan keputusan",
  );
});

test("unknown organizations retain the base framework", () => {
  const base = getFrameworkForOrganization();
  const unknown = getFrameworkForOrganization("not-a-real-org");

  assert.strictEqual(unknown, base);
});

test("BM400-only indicators resolve and are preserved during enrichment", () => {
  const indicator = lookupCanonicalIndicator(
    "Mental",
    "Berwawasan global dan terbuka terhadap keberagaman",
    "Keterbukaan Wawasan Global",
    BM400_ORG_ID,
  );
  assert.ok(indicator);
  assert.equal(indicator.subIndicators.length, 3);

  const enriched = enrichDetailedAssessments(
    [{
      category: "mental",
      theme: "Berwawasan global dan terbuka terhadap keberagaman",
      indicator: "Keterbukaan Wawasan Global",
      fulfilled_sub_indicators: ["Memahami isu-isu global secara objektif"],
    }],
    BM400_ORG_ID,
  );
  assert.equal(enriched.length, 1);
  assert.deepEqual(enriched[0].fulfilled_sub_indicators, ["Memahami isu-isu global secara objektif"]);
});

test("supplementary-theme detection distinguishes BM400 themes from base themes", () => {
  assert.equal(
    isSupplementaryTheme(
      BM400_ORG_ID,
      "Mental",
      "Berwawasan global dan terbuka terhadap keberagaman",
    ),
    true,
  );
  assert.equal(isSupplementaryTheme(BM400_ORG_ID, "Mental", "Optimis"), false);
  assert.equal(
    isSupplementaryTheme(OTHER_ORG_ID, "Mental", "Berwawasan global dan terbuka terhadap keberagaman"),
    false,
  );
});

test("BM400 supplementary themes are available to unexplored-theme prompts", () => {
  const context = buildUnexploredThemesContext([], [], 200, BM400_ORG_ID);

  assert.match(context, /Berwawasan global dan terbuka terhadap keberagaman/);
  assert.match(context, /Kolaborasi lintas budaya/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { resolveFixedDiceFormula } from "../../src/domain/diceFormula";

test("fixed dice formulas resolve arbitrary dice plus flat contributions with provenance", () => {
  const result = resolveFixedDiceFormula({
    dice:[{ source:"test:2d4", sides:4, count:2, faces:[3,4] }],
    flat:[{ source:"test:flat", value:2 }],
  });
  assert.deepEqual(result.selectedFaces,[3,4]);
  assert.equal(result.diceTotal,7);
  assert.equal(result.flatTotal,2);
  assert.equal(result.total,9);
  assert.ok(result.provenance.some((entry) => entry.source === "test:2d4" && entry.reason.includes("2d4 [3, 4] => 7")));
  assert.ok(result.provenance.some((entry) => entry.source === "test:flat" && entry.reason.includes("+2")));
});

test("fixed dice formulas reject faces outside the declared die instead of accepting Mock values", () => {
  assert.throws(() => resolveFixedDiceFormula({
    dice:[{ source:"test:d4", sides:4, count:1, faces:[5] }],
  }),/invalid d4 formula face 5/);
});

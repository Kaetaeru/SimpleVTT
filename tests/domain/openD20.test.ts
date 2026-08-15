import assert from "node:assert/strict";
import test from "node:test";
import type { RulesProfileLike } from "../../src/domain/profileEngine";
import { resolveOpenD20Roll } from "../../src/domain/openD20";

const PROFILE:RulesProfileLike = {
  profileId:"dnd.srd-5.2.1",
  properties:{},
  d20Test:{ advantageDisadvantage:{ sameSideStacks:false, opposingCancel:true } },
};

test("open d20 rolls resolve total and provenance without inventing a target DC", () => {
  const result = resolveOpenD20Roll(PROFILE,{
    family:"ability-check",
    modifierContributions:[
      { source:"ability:str", value:4 },
      { source:"proficiency:athletics", value:3 },
    ],
    dice:{ id:"open-check", purpose:"Athletics", sides:20, faces:[12] },
  });

  assert.equal(result.natural,12);
  assert.equal(result.modifier,7);
  assert.equal(result.total,19);
  assert.equal(result.rollState,"normal");
  assert.equal(result.provenance.some((entry) => entry.source.includes("target:")),false);
  assert.deepEqual(result.provenance.map((entry) => entry.source),[
    "dice:open-check",
    "ability:str",
    "proficiency:athletics",
  ]);
});

test("open d20 rolls reuse profile advantage/disadvantage cancellation semantics", () => {
  const advantage = resolveOpenD20Roll(PROFILE,{
    family:"ability-check",
    modifierContributions:[{ source:"check-bonus", value:7 }],
    rollStateContributions:[{ source:"feature:advantage", state:"advantage" }],
    dice:{ id:"adv-check", purpose:"Athletics", sides:20, faces:[5,18] },
  });
  assert.equal(advantage.natural,18);
  assert.equal(advantage.total,25);

  const cancelled = resolveOpenD20Roll(PROFILE,{
    family:"ability-check",
    modifierContributions:[{ source:"check-bonus", value:7 }],
    rollStateContributions:[
      { source:"feature:advantage", state:"advantage" },
      { source:"condition:disadvantage", state:"disadvantage" },
    ],
    dice:{ id:"cancelled-check", purpose:"Athletics", sides:20, faces:[9] },
  });
  assert.equal(cancelled.rollState,"normal");
  assert.equal(cancelled.natural,9);
  assert.ok(cancelled.provenance.some((entry) => entry.source === "feature:advantage" && entry.status === "suppressed"));
  assert.ok(cancelled.provenance.some((entry) => entry.source === "condition:disadvantage" && entry.status === "suppressed"));
});

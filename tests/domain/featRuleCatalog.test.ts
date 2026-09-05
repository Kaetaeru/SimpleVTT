import assert from "node:assert/strict";
import test from "node:test";
import {
  FEAT_RULE_CATALOG,
  epicBoonFeatRules,
  featAbilityIncreaseOptions,
  featEligibility,
  featExecution,
  featRuleById,
} from "../../src/domain/featRuleCatalog";

const ABILITIES = { str:10, dex:10, con:10, int:10, wis:10, cha:10 } as const;

test("generated feat rule catalog exposes exactly the seven SRD Epic Boons", () => {
  const boons = epicBoonFeatRules();
  assert.equal(boons.length,7);
  assert.deepEqual(new Set(boons.map((feat) => feat.id)),new Set([
    "dnd.srd521.feat.epic.combat-prowess",
    "dnd.srd521.feat.epic.dimensional-travel",
    "dnd.srd521.feat.epic.fate",
    "dnd.srd521.feat.epic.irresistible-offense",
    "dnd.srd521.feat.epic.night-spirit",
    "dnd.srd521.feat.epic.spell-recall",
    "dnd.srd521.feat.epic.truesight",
  ]));
});

test("Epic Boon eligibility is data-driven by level and Spellcasting prerequisite", () => {
  const recall = featRuleById("dnd.srd521.feat.epic.spell-recall");
  assert.ok(recall);
  assert.equal(featEligibility(recall!,{
    totalLevel:18,
    abilities:{ ...ABILITIES },
    hasSpellcastingFeature:true,
  }).eligible,false);
  assert.deepEqual(featEligibility(recall!,{
    totalLevel:19,
    abilities:{ ...ABILITIES },
    hasSpellcastingFeature:false,
  }).reasons,["requires Spellcasting feature"]);
  assert.equal(featEligibility(recall!,{
    totalLevel:19,
    abilities:{ ...ABILITIES },
    hasSpellcastingFeature:true,
  }).eligible,true);
});

test("Epic Boon ability increase choices come from canonical config instead of display prose", () => {
  const offense = featRuleById("dnd.srd521.feat.epic.irresistible-offense");
  const night = featRuleById("dnd.srd521.feat.epic.night-spirit");
  const truesight = featRuleById("dnd.srd521.feat.epic.truesight");
  const combat = featRuleById("dnd.srd521.feat.epic.combat-prowess");
  assert.ok(offense && night && truesight && combat);
  assert.deepEqual(featAbilityIncreaseOptions(offense!),["str","dex"]);
  assert.deepEqual(featAbilityIncreaseOptions(night!),["dex","int","wis","cha"]);
  assert.deepEqual(featAbilityIncreaseOptions(truesight!),["int","wis","cha"]);
  assert.deepEqual(featAbilityIncreaseOptions(combat!),["str","dex","con","int","wis","cha"]);
});

// X1-03: the catalog records how each feat executes so the roadmap can count executable feats honestly.
test("every SRD feat records an execution status, and a non-executing feat names the missing seam", () => {
  const statuses = new Map<string,number>();
  for (const feat of FEAT_RULE_CATALOG.feats) {
    const execution = featExecution(feat);
    assert.ok(feat.config.execution, `${feat.id} has an execution record`);
    assert.ok(["common-play","derived","selection","descriptive"].includes(execution.status), `${feat.id}: ${execution.status}`);
    if (execution.status !== "common-play") assert.ok(execution.reason && execution.reason.length > 10, `${feat.id} explains why it is ${execution.status}`);
    statuses.set(execution.status, (statuses.get(execution.status) ?? 0) + 1);
  }
  assert.equal(featExecution(featRuleById("dnd.srd521.feat.fighting-style.archery")!).status, "common-play");
  assert.equal(featExecution(featRuleById("dnd.srd521.feat.fighting-style.defense")!).status, "derived");
  assert.equal(featExecution(featRuleById("dnd.srd521.feat.skilled")!).status, "selection");
  assert.deepEqual(Object.fromEntries([...statuses.entries()].sort()), { "common-play":1, derived:1, descriptive:12, selection:3 });
});

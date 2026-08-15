import assert from "node:assert/strict";
import test from "node:test";
import {
  epicBoonFeatRules,
  featAbilityIncreaseOptions,
  featEligibility,
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

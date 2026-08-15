import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08WizardEvocationAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { classById } from "../../src/domain/progressionCatalog";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import {
  EVOCATION_SAVANT_FEATURE_ID,
  POTENT_CANTRIP_FEATURE_ID,
  SCULPT_SPELLS_FEATURE_ID,
  WIZARD_EVOCATION_CLASS_ID,
  WIZARD_EVOCATION_SUBCLASS_ID,
  evocationSavantChoiceId,
} from "../../src/domain/wizardEvocationProgression";

const subclassName = classById(WIZARD_EVOCATION_CLASS_ID)!.srdSubclassName;

async function selectRemainingRequired(adapter:MockAdapter,commands:Phase07AdapterCommands,excluded = new Set<string>()) {
  for (;;) {
    const snapshot = await adapter.getSnapshot();
    const choice = snapshot.progressionPlan?.choices.find((entry) => entry.required && entry.status === "ready" && !snapshot.levelUpDraft?.progressionSelections?.[entry.id] && !excluded.has(entry.id));
    if (!choice) return snapshot;
    if (choice.kind === "asi-or-feat") {
      await commands.setProgressionChoice(choice.id,{ kind:"asi", mode:"plus-two", primary:"int" });
      continue;
    }
    const enabled = choice.options.filter((option) => !option.disabledReason).slice(0,choice.count);
    assert.equal(enabled.length,choice.count,`missing enabled options for ${choice.id}`);
    await commands.setProgressionChoice(choice.id,{ kind:"options", optionIds:enabled.map((option) => option.id) });
  }
}

test("Wizard 2 to 3 runtime commits School of Evocation and Evocation Savant spellbook additions", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter:typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"위저드",
    subclassName:"",
    level:2,
    hp:13,
    maxHp:13,
    proficiencyBonus:2,
    abilities:{ str:8,dex:14,con:14,int:18,wis:12,cha:10 },
    features:["주문 시전","의식 전문가","비전 회복"],
    cantrips:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Prestidigitation")],
    preparedSpells:[stableSpellId("Magic Missile"),stableSpellId("Shield"),stableSpellId("Sleep")],
    preparedSpellSources:{},
    spellbookSpells:[
      stableSpellId("Magic Missile"),stableSpellId("Shield"),stableSpellId("Sleep"),
      stableSpellId("Detect Magic"),stableSpellId("Misty Step"),stableSpellId("Web"),
    ],
    spellbookSpellSources:{},
    classLevels:[{ classId:WIZARD_EVOCATION_CLASS_ID, className:"위저드", level:2 }],
    hitDiceByDie:{ d6:2 },
    progressionRevision:4,
    subclassIds:{},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  let snapshot = await adapter.getSnapshot();
  const subclassChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === `progression.${WIZARD_EVOCATION_CLASS_ID}.3.subclass`);
  assert.ok(subclassChoice);
  await commands.setProgressionChoice(subclassChoice!.id,{ kind:"options", optionIds:[`subclass:${subclassName}`] });

  snapshot = await adapter.getSnapshot();
  const savant = snapshot.progressionPlan?.choices.find((choice) => choice.id === evocationSavantChoiceId(3));
  assert.ok(savant);
  assert.equal(savant?.count,2);
  const selectedSavant = savant!.options.filter((option) => !option.disabledReason).slice(0,2);
  assert.equal(selectedSavant.length,2);
  await commands.setProgressionChoice(savant!.id,{ kind:"options", optionIds:selectedSavant.map((option) => option.id) });
  snapshot = await selectRemainingRequired(adapter,commands,new Set([savant!.id]));
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,3);
  assert.equal(snapshot.activeCharacter.subclassIds?.[WIZARD_EVOCATION_CLASS_ID],WIZARD_EVOCATION_SUBCLASS_ID);
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(EVOCATION_SAVANT_FEATURE_ID));
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(POTENT_CANTRIP_FEATURE_ID));
  for (const option of selectedSavant) {
    assert.ok(snapshot.activeCharacter.spellbookSpells?.includes(option.id),option.id);
    assert.match(snapshot.activeCharacter.spellbookSpellSources?.[option.id] ?? "",/환기술 전문가/);
  }
  assert.ok(snapshot.activeCharacter.features.includes("환기술 전문가"));
  assert.ok(snapshot.activeCharacter.features.includes("강력한 소마법"));
});

test("Wizard Evocation 5 to 6 runtime removes generic subclass pending and commits Sculpt Spells", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter:typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"위저드",
    subclassName,
    level:5,
    hp:31,
    maxHp:31,
    proficiencyBonus:3,
    abilities:{ str:8,dex:14,con:14,int:18,wis:12,cha:10 },
    features:["주문 시전","의식 전문가","비전 회복",subclassName,"환기술 전문가","강력한 소마법"],
    cantrips:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Prestidigitation")],
    preparedSpells:[stableSpellId("Magic Missile"),stableSpellId("Shield"),stableSpellId("Fireball")],
    preparedSpellSources:{},
    spellbookSpells:[
      stableSpellId("Magic Missile"),stableSpellId("Shield"),stableSpellId("Sleep"),stableSpellId("Detect Magic"),
      stableSpellId("Misty Step"),stableSpellId("Web"),stableSpellId("Burning Hands"),stableSpellId("Scorching Ray"),stableSpellId("Fireball"),
    ],
    spellbookSpellSources:{},
    classLevels:[{ classId:WIZARD_EVOCATION_CLASS_ID, className:"위저드", level:5, subclassName }],
    hitDiceByDie:{ d6:5 },
    progressionRevision:10,
    subclassIds:{ [WIZARD_EVOCATION_CLASS_ID]:WIZARD_EVOCATION_SUBCLASS_ID },
    subclassFeatureIds:[EVOCATION_SAVANT_FEATURE_ID,POTENT_CANTRIP_FEATURE_ID],
    subclassFeatureSources:{},
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  let snapshot = await selectRemainingRequired(adapter,commands);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === `progression.${WIZARD_EVOCATION_CLASS_ID}.6.subclass-feature`),false);
  assert.ok(snapshot.progressionPlan?.diffs.some((diff) => diff.after === "주문 조형"));
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,6);
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(SCULPT_SPELLS_FEATURE_ID));
  assert.ok(snapshot.activeCharacter.features.includes("주문 조형"));
  assert.equal(snapshot.activeCharacter.progressionRevision,11);
});

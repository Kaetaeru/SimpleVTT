import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08SorcererDraconicAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot } from "../../src/app/contracts";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { classById } from "../../src/domain/progressionCatalog";
import { draconicAffinityChoiceId } from "../../src/domain/progressionPhase08SorcererDraconic";
import {
  DRACONIC_RESILIENCE_FEATURE_ID,
  DRACONIC_SPELLS_FEATURE_ID,
  ELEMENTAL_AFFINITY_FEATURE_ID,
  SORCERER_DRACONIC_SUBCLASS_ID,
  SORCERER_ID,
} from "../../src/domain/sorcererDraconic";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const subclassName = classById(SORCERER_ID)!.srdSubclassName;
type FixtureState = { activeCharacter:AppSnapshot["activeCharacter"]; scene:AppSnapshot["scene"] };

function syncSceneHp(internal:FixtureState) {
  const entity = internal.scene.entities.find((entry) => entry.id === internal.activeCharacter.id);
  if (!entity) return;
  entity.hp = internal.activeCharacter.hp;
  entity.maxHp = internal.activeCharacter.maxHp;
  entity.tempHp = internal.activeCharacter.tempHp;
}

async function selectRemainingRequired(adapter:MockAdapter,commands:Phase07AdapterCommands,excluded = new Set<string>()) {
  for (;;) {
    const snapshot = await adapter.getSnapshot();
    const choice = snapshot.progressionPlan?.choices.find((entry) => entry.required && entry.status === "ready" && !snapshot.levelUpDraft?.progressionSelections?.[entry.id] && !excluded.has(entry.id));
    if (!choice) return snapshot;
    if (choice.kind === "asi-or-feat") {
      await commands.setProgressionChoice(choice.id,{ kind:"asi", mode:"plus-two", primary:"cha" });
      continue;
    }
    const enabled = choice.options.filter((option) => !option.disabledReason).slice(0,choice.count);
    assert.equal(enabled.length,choice.count,`missing enabled options for ${choice.id}`);
    await commands.setProgressionChoice(choice.id,{ kind:"options", optionIds:enabled.map((option) => option.id) });
  }
}

async function draconicLevel3Ready() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as FixtureState;
  internal.activeCharacter = {
    ...baseline,
    className:"소서러",
    subclassName:"",
    level:2,
    hp:14,
    maxHp:14,
    proficiencyBonus:2,
    abilities:{ str:8,dex:14,con:14,int:10,wis:10,cha:18 },
    features:["주문 시전","타고난 마법"],
    cantrips:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion"),stableSpellId("Prestidigitation")],
    preparedSpells:[stableSpellId("Burning Hands"),stableSpellId("Magic Missile"),stableSpellId("Shield")],
    preparedSpellSources:{},
    classLevels:[{ classId:SORCERER_ID, className:"소서러", level:2 }],
    hitDiceByDie:{ d6:2 },
    progressionRevision:4,
    subclassIds:{},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  };
  syncSceneHp(internal);
  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  const initial = await adapter.getSnapshot();
  const subclassChoice = initial.progressionPlan?.choices.find((choice) => choice.id === `progression.${SORCERER_ID}.3.subclass`);
  assert.ok(subclassChoice);
  await commands.setProgressionChoice(subclassChoice!.id,{ kind:"options", optionIds:[`subclass:${subclassName}`] });
  const ready = await selectRemainingRequired(adapter,commands);
  return { adapter, ready };
}

test("Sorcerer 2 to 3 runtime preview has no blockers", async () => {
  const { ready } = await draconicLevel3Ready();
  assert.deepEqual(ready.progressionPlan?.blocking,[]);
});

test("Sorcerer 2 to 3 runtime preview includes Draconic Resilience HP", async () => {
  const { ready } = await draconicLevel3Ready();
  assert.equal(ready.progressionPlan?.diffs.find((diff) => diff.label === "최대 HP")?.after,"23");
});

test("Sorcerer 2 to 3 runtime commits Draconic identity and HP", async () => {
  const { adapter } = await draconicLevel3Ready();
  await adapter.commitLevelUp();
  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,3);
  assert.equal(snapshot.activeCharacter.hp,14,"level-up increases maximum HP without automatically healing current HP");
  assert.equal(snapshot.activeCharacter.maxHp,23);
  assert.equal(snapshot.activeCharacter.subclassIds?.[SORCERER_ID],SORCERER_DRACONIC_SUBCLASS_ID);
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(DRACONIC_RESILIENCE_FEATURE_ID));
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(DRACONIC_SPELLS_FEATURE_ID));
});

test("Sorcerer 2 to 3 runtime commits four always-prepared Draconic spells", async () => {
  const { adapter } = await draconicLevel3Ready();
  await adapter.commitLevelUp();
  const snapshot = await adapter.getSnapshot();
  for (const name of ["Alter Self","Chromatic Orb","Command","Dragon's Breath"]) {
    assert.ok(snapshot.activeCharacter.preparedSpells.includes(`always:${stableSpellId(name)}`),name);
  }
});

test("Sorcerer 5 to 6 runtime replaces generic subclass pending with Elemental Affinity and preserves the selected type", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as FixtureState;
  internal.activeCharacter = {
    ...baseline,
    className:"소서러",
    subclassName,
    level:5,
    hp:35,
    maxHp:40,
    proficiencyBonus:3,
    abilities:{ str:8,dex:14,con:14,int:10,wis:10,cha:18 },
    features:["주문 시전","타고난 마법","드라코닉 회복력","드라코닉 주문",subclassName],
    skills:[],
    cantrips:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion"),stableSpellId("Prestidigitation")],
    preparedSpells:[
      stableSpellId("Burning Hands"),stableSpellId("Magic Missile"),stableSpellId("Shield"),
      ...["Alter Self","Chromatic Orb","Command","Dragon's Breath","Fear","Fly"].map((name) => `always:${stableSpellId(name)}`),
    ],
    preparedSpellSources:{},
    classLevels:[{ classId:SORCERER_ID, className:"소서러", level:5, subclassName }],
    hitDiceByDie:{ d6:5 },
    progressionRevision:10,
    subclassIds:{ [SORCERER_ID]:SORCERER_DRACONIC_SUBCLASS_ID },
    subclassFeatureIds:[DRACONIC_RESILIENCE_FEATURE_ID,DRACONIC_SPELLS_FEATURE_ID],
    subclassFeatureSources:{},
  };
  syncSceneHp(internal);

  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  let snapshot = await adapter.getSnapshot();
  const affinity = snapshot.progressionPlan?.choices.find((choice) => choice.id === draconicAffinityChoiceId());
  assert.ok(affinity);
  assert.equal(affinity?.status,"ready");
  assert.deepEqual(affinity?.options.map((option) => option.label),["산성","냉기","화염","번개","독"]);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === draconicAffinityChoiceId() && choice.status === "catalog-pending"),false);
  await commands.setProgressionChoice(affinity!.id,{ kind:"options", optionIds:["damage:fire"] });
  snapshot = await selectRemainingRequired(adapter,commands,new Set([affinity!.id]));
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,6);
  assert.equal(snapshot.activeCharacter.maxHp,47,"normal Sorcerer level HP +6 plus Draconic +1");
  assert.equal(snapshot.activeCharacter.draconicAffinityDamageType,"fire");
  assert.ok(snapshot.activeCharacter.features.includes("원소 친화"));
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(ELEMENTAL_AFFINITY_FEATURE_ID));
  assert.equal(snapshot.activeCharacter.progressionRevision,11);
});

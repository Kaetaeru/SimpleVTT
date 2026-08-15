import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPhase08BardLoreAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { BARDIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/bardicInspiration";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "../../src/domain/bardCollegeLore";
import {
  BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,
  BARD_LORE_CLASS_ID,
  BARD_LORE_CUTTING_WORDS_FEATURE_ID,
  BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID,
  loreBonusProficienciesChoiceId,
  loreMagicalDiscoveriesChoiceId,
} from "../../src/domain/bardLoreProgression";
import { classById } from "../../src/domain/progressionCatalog";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const subclassName = classById(BARD_LORE_CLASS_ID)!.srdSubclassName;

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

test("Bard 2 to 3 runtime materializes College of Lore bonus skills and Cutting Words", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"바드",
    subclassName:"",
    level:2,
    hp:17,
    maxHp:17,
    proficiencyBonus:2,
    abilities:{ str:8,dex:14,con:14,int:12,wis:12,cha:18 },
    features:["주문 시전","바드의 영감","만능박사"],
    skills:["공연","설득","비전"],
    cantrips:[stableSpellId("Vicious Mockery"),stableSpellId("Mage Hand")],
    preparedSpells:["Animal Friendship","Bane","Charm Person","Command","Cure Wounds"].map(stableSpellId),
    preparedSpellSources:{},
    classLevels:[{ classId:BARD_LORE_CLASS_ID, className:"바드", level:2 }],
    hitDiceByDie:{ d8:2 },
    progressionRevision:8,
    subclassIds:{},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
    bardMagicalDiscoverySpellIds:[],
    bardMagicalDiscoverySpellSources:{},
    resources:internal.activeCharacter.resources.filter((entry) => entry.id !== BARDIC_INSPIRATION_RESOURCE_ID),
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  let snapshot = await adapter.getSnapshot();
  const subclassChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === `progression.${BARD_LORE_CLASS_ID}.3.subclass`);
  const preparedChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === `progression.${BARD_LORE_CLASS_ID}.3.column.준비 주문`);
  assert.ok(subclassChoice);
  assert.ok(preparedChoice);

  await commands.setProgressionChoice(subclassChoice!.id,{ kind:"options", optionIds:[`subclass:${subclassName}`] });
  snapshot = await adapter.getSnapshot();
  const skillChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === loreBonusProficienciesChoiceId());
  assert.ok(skillChoice);
  assert.equal(skillChoice?.options.length,18);
  assert.equal(skillChoice?.options.find((option) => option.label === "공연")?.disabledReason,"이미 숙련된 기술입니다.");

  const preparedId = preparedChoice!.options.find((option) => !option.disabledReason)!.id;
  await commands.setProgressionChoice(preparedChoice!.id,{ kind:"options", optionIds:[preparedId] });
  await commands.setProgressionChoice(skillChoice!.id,{ kind:"options", optionIds:["skill:history","skill:perception","skill:stealth"] });
  snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,3);
  assert.equal(snapshot.activeCharacter.subclassIds?.[BARD_LORE_CLASS_ID],BARD_COLLEGE_LORE_SUBCLASS_ID);
  assert.ok(snapshot.activeCharacter.skills.includes("역사"));
  assert.ok(snapshot.activeCharacter.skills.includes("지각"));
  assert.ok(snapshot.activeCharacter.skills.includes("은신"));
  assert.ok(snapshot.activeCharacter.features.includes("추가 숙련"));
  assert.ok(snapshot.activeCharacter.features.includes("날카로운 말"));
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID));
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(BARD_LORE_CUTTING_WORDS_FEATURE_ID));
  const inspiration = snapshot.activeCharacter.resources.find((entry) => entry.id === BARDIC_INSPIRATION_RESOURCE_ID);
  assert.equal(inspiration?.max,4);
});

test("Bard 5 to 6 runtime exposes Magical Discoveries instead of generic subclass pending and persists both as always prepared", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"바드",
    subclassName,
    level:5,
    hp:38,
    maxHp:38,
    proficiencyBonus:3,
    abilities:{ str:8,dex:14,con:14,int:12,wis:12,cha:18 },
    features:["주문 시전","바드의 영감","영감의 샘","추가 숙련","날카로운 말",subclassName],
    skills:["공연","설득","비전","역사","지각","은신"],
    cantrips:[stableSpellId("Vicious Mockery"),stableSpellId("Mage Hand")],
    preparedSpells:["Animal Friendship","Bane","Charm Person","Command","Cure Wounds","Dissonant Whispers","Faerie Fire","Healing Word","Heroism"].map(stableSpellId),
    preparedSpellSources:{},
    classLevels:[{ classId:BARD_LORE_CLASS_ID, className:"바드", level:5, subclassName }],
    hitDiceByDie:{ d8:5 },
    progressionRevision:12,
    subclassIds:{ [BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID },
    subclassFeatureIds:[BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,BARD_LORE_CUTTING_WORDS_FEATURE_ID],
    subclassFeatureSources:{},
    bardMagicalDiscoverySpellIds:[],
    bardMagicalDiscoverySpellSources:{},
  };

  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  let snapshot = await adapter.getSnapshot();
  const preparedChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === `progression.${BARD_LORE_CLASS_ID}.6.column.준비 주문`);
  const discoveries = snapshot.progressionPlan?.choices.find((choice) => choice.id === loreMagicalDiscoveriesChoiceId());
  assert.ok(preparedChoice);
  assert.ok(discoveries);
  assert.equal(discoveries?.status,"ready");
  assert.equal(discoveries?.count,2);
  assert.equal(snapshot.progressionPlan?.choices.some((choice) => choice.id === `progression.${BARD_LORE_CLASS_ID}.6.subclass-feature` && choice.status === "catalog-pending"),false);

  const preparedId = preparedChoice!.options.find((option) => !option.disabledReason)!.id;
  const guidance = stableSpellId("Guidance");
  const fireball = stableSpellId("Fireball");
  assert.ok(discoveries?.options.some((option) => option.id === guidance));
  assert.ok(discoveries?.options.some((option) => option.id === fireball));
  await commands.setProgressionChoice(preparedChoice!.id,{ kind:"options", optionIds:[preparedId] });
  await commands.setProgressionChoice(discoveries!.id,{ kind:"options", optionIds:[guidance,fireball] });
  snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level,6);
  assert.deepEqual(snapshot.activeCharacter.bardMagicalDiscoverySpellIds,[guidance,fireball]);
  assert.ok(snapshot.activeCharacter.preparedSpells.includes(`always:${guidance}`));
  assert.ok(snapshot.activeCharacter.preparedSpells.includes(`always:${fireball}`));
  assert.ok(snapshot.activeCharacter.features.includes("마법 발견"));
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes(BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID));
  assert.equal(snapshot.activeCharacter.progressionRevision,13);
});

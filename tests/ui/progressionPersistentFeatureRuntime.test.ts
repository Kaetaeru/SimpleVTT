import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionPersistentFeatureRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import {
  CLERIC_BLESSED_STRIKES_ID,
  CLERIC_POTENT_SPELLCASTING_OPTION,
} from "../../src/domain/clericProgressionChoices";
import {
  DRUID_ELEMENTAL_FURY_ID,
  DRUID_PRIMAL_STRIKE_OPTION,
} from "../../src/domain/druidProgressionChoices";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const clericId = "dnd.srd521.class.cleric";
const druidId = "dnd.srd521.class.druid";
const preparedChoice = (classId: string, level: number) => `progression.${classId}.${level}.column.준비 주문`;

async function baseline() {
  const adapter = new MockAdapter();
  const sheet = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as {
    activeCharacter: typeof sheet;
    levelUpDraft: unknown;
    edgeState: "normal" | "save-error" | "unsupported";
  };
  return { adapter, internal, sheet };
}

function clericSix(sheet: Awaited<ReturnType<typeof baseline>>["sheet"]) {
  return {
    ...sheet,
    className:"클레릭",
    subclassName:"생명 권역",
    level:6,
    hp:42,
    maxHp:45,
    proficiencyBonus:3,
    abilities:{ str:10, dex:12, con:14, int:10, wis:20, cha:14 },
    skills:["통찰","의학"],
    features:["주문 시전","신성한 역할","기적술사","생명 권역"],
    cantrips:[stableSpellId("Guidance"),stableSpellId("Light"),stableSpellId("Sacred Flame"),stableSpellId("Thaumaturgy")],
    classLevels:[{ classId:clericId, className:"클레릭", level:6, subclassName:"생명 권역" }],
    hitDiceByDie:{ d8:6 },
    progressionRevision:0,
    persistentFeatureOptionIds:[],
    persistentFeatureOptionSources:{},
    preparedSpells:[
      `always:${stableSpellId("Bless")}`,
      `always:${stableSpellId("Cure Wounds")}`,
      `always:${stableSpellId("Aid")}`,
      `always:${stableSpellId("Lesser Restoration")}`,
      `always:${stableSpellId("Mass Healing Word")}`,
      `always:${stableSpellId("Revivify")}`,
      stableSpellId("Command"),stableSpellId("Healing Word"),stableSpellId("Shield of Faith"),
      stableSpellId("Spiritual Weapon"),stableSpellId("Spirit Guardians"),stableSpellId("Dispel Magic"),
    ],
  };
}

function druidSix(sheet: Awaited<ReturnType<typeof baseline>>["sheet"]) {
  return {
    ...sheet,
    className:"드루이드",
    subclassName:"대지의 결사",
    level:6,
    hp:45,
    maxHp:45,
    proficiencyBonus:3,
    abilities:{ str:10, dex:14, con:14, int:12, wis:18, cha:8 },
    skills:["자연","생존"],
    features:["주문 시전","드루이드어","마법사","대지의 결사"],
    cantrips:[stableSpellId("Druidcraft"),stableSpellId("Produce Flame"),stableSpellId("Guidance")],
    classLevels:[{ classId:druidId, className:"드루이드", level:6, subclassName:"대지의 결사" }],
    hitDiceByDie:{ d8:6 },
    progressionRevision:0,
    persistentFeatureOptionIds:[],
    persistentFeatureOptionSources:{},
    preparedSpells:[
      `always:${stableSpellId("Speak with Animals")}`,
      stableSpellId("Animal Friendship"),stableSpellId("Cure Wounds"),stableSpellId("Faerie Fire"),stableSpellId("Thunderwave"),
      stableSpellId("Goodberry"),stableSpellId("Moonbeam"),stableSpellId("Call Lightning"),stableSpellId("Dispel Magic"),
      stableSpellId("Revivify"),stableSpellId("Sleet Storm"),
    ],
  };
}

test("Cleric Blessed Strikes persists the stable option id and provenance only after a successful level-up commit", async () => {
  const { adapter, internal, sheet } = await baseline();
  internal.activeCharacter = clericSix(sheet);
  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(CLERIC_BLESSED_STRIKES_ID, {
    kind:"options",
    optionIds:[CLERIC_POTENT_SPELLCASTING_OPTION],
  });
  await commands.setProgressionChoice(preparedChoice(clericId, 7), {
    kind:"options",
    optionIds:[stableSpellId("Freedom of Movement")],
  });
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 7);
  assert.ok(snapshot.activeCharacter.persistentFeatureOptionIds?.includes(CLERIC_POTENT_SPELLCASTING_OPTION));
  assert.match(snapshot.activeCharacter.persistentFeatureOptionSources?.[CLERIC_POTENT_SPELLCASTING_OPTION] ?? "", /클레릭 7레벨/);
});

test("Druid Elemental Fury persists the stable Primal Strike id rather than relying on its display label", async () => {
  const { adapter, internal, sheet } = await baseline();
  internal.activeCharacter = druidSix(sheet);
  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(DRUID_ELEMENTAL_FURY_ID, {
    kind:"options",
    optionIds:[DRUID_PRIMAL_STRIKE_OPTION],
  });
  await commands.setProgressionChoice(preparedChoice(druidId, 7), {
    kind:"options",
    optionIds:[stableSpellId("Freedom of Movement")],
  });
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 7);
  assert.ok(snapshot.activeCharacter.persistentFeatureOptionIds?.includes(DRUID_PRIMAL_STRIKE_OPTION));
  assert.match(snapshot.activeCharacter.persistentFeatureOptionSources?.[DRUID_PRIMAL_STRIKE_OPTION] ?? "", /드루이드 7레벨/);
});

test("save-error keeps persistent feature option ids unchanged and leaves the level-up draft open", async () => {
  const { adapter, internal, sheet } = await baseline();
  internal.activeCharacter = clericSix(sheet);
  await adapter.startLevelUp(internal.activeCharacter.id);
  const commands = adapter as unknown as Phase07AdapterCommands;
  await commands.setProgressionChoice(CLERIC_BLESSED_STRIKES_ID, {
    kind:"options",
    optionIds:[CLERIC_POTENT_SPELLCASTING_OPTION],
  });
  await commands.setProgressionChoice(preparedChoice(clericId, 7), {
    kind:"options",
    optionIds:[stableSpellId("Freedom of Movement")],
  });
  internal.edgeState = "save-error";

  await adapter.commitLevelUp();
  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 6);
  assert.deepEqual(snapshot.activeCharacter.persistentFeatureOptionIds, []);
  assert.ok(internal.levelUpDraft, "failed save must keep the draft open");
});

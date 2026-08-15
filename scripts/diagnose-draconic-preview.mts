import "../src/app/progressionPhase08SorcererDraconicAdapter";
import { MockAdapter } from "../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../src/app/progressionRuntimeAdapter";
import { classById } from "../src/domain/progressionCatalog";
import { SORCERER_ID } from "../src/domain/sorcererDraconic";
import { stableSpellId } from "../src/domain/spellListCatalog";

const adapter = new MockAdapter();
const baseline = (await adapter.getSnapshot()).activeCharacter;
const internal = adapter as unknown as { activeCharacter:typeof baseline };
internal.activeCharacter = {
  ...baseline,
  className:"소서러", subclassName:"", level:2, hp:14, maxHp:14, proficiencyBonus:2,
  abilities:{ str:8,dex:14,con:14,int:10,wis:10,cha:18 },
  features:["주문 시전","타고난 마법"],
  cantrips:["Fire Bolt","Mage Hand","Minor Illusion","Prestidigitation"].map(stableSpellId),
  preparedSpells:["Burning Hands","Magic Missile","Shield"].map(stableSpellId), preparedSpellSources:{},
  classLevels:[{ classId:SORCERER_ID, className:"소서러", level:2 }], hitDiceByDie:{ d6:2 }, progressionRevision:4,
  subclassIds:{}, subclassFeatureIds:[], subclassFeatureSources:{},
};
await adapter.startLevelUp(internal.activeCharacter.id);
const commands = adapter as unknown as Phase07AdapterCommands;
let snapshot = await adapter.getSnapshot();
const subclassName = classById(SORCERER_ID)!.srdSubclassName;
const subclass = snapshot.progressionPlan?.choices.find((choice) => choice.id === `progression.${SORCERER_ID}.3.subclass`);
if (!subclass) throw new Error("missing Sorcerer subclass choice");
await commands.setProgressionChoice(subclass.id,{ kind:"options", optionIds:[`subclass:${subclassName}`] });
for (;;) {
  snapshot = await adapter.getSnapshot();
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.required && entry.status === "ready" && !snapshot.levelUpDraft?.progressionSelections?.[entry.id]);
  if (!choice) break;
  const enabled = choice.options.filter((option) => !option.disabledReason).slice(0,choice.count);
  if (enabled.length !== choice.count) throw new Error(`missing enabled options for ${choice.id}`);
  await commands.setProgressionChoice(choice.id,{ kind:"options", optionIds:enabled.map((option) => option.id) });
}
snapshot = await adapter.getSnapshot();
const hpDiff = snapshot.progressionPlan?.diffs.find((diff) => diff.label === "최대 HP");
const details = JSON.stringify({
  activeHp:snapshot.activeCharacter.hp,
  activeMaxHp:snapshot.activeCharacter.maxHp,
  hpMethod:snapshot.levelUpDraft?.hpMethod,
  hpPlan:snapshot.progressionPlan?.hp,
  hpDiff,
  targetLevel:snapshot.progressionPlan?.targetClassLevel,
  blocking:snapshot.progressionPlan?.blocking,
  choices:snapshot.progressionPlan?.choices.map((choice) => ({ id:choice.id,status:choice.status,count:choice.count })),
});
console.log(`::error file=src/app/progressionPhase08SorcererDraconicAdapter.ts,title=Draconic preview state::${details}`);
if (hpDiff?.after !== "23") process.exitCode = 1;

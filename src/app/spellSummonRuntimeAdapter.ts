import type { ActivityEntry, AppSnapshot, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { normalizedSpellDefinitionById } from "../domain/spellExecutionCatalog";
import { selectedCombatSpellSlot } from "./spellcastingRuntimeSelection";

/**
 * V1.3 C1-06: a committed cast whose mechanic declares `summons` adds those catalog creatures to the scene on
 * the caster's side (Animate Dead → skeletons, Create Undead → ghouls). The creatures are ordinary combatants
 * afterwards; the DM runs them from the encounter panel.
 */
interface SummonAdapterState {
  scene:{ entities:SceneEntity[] };
  activity:ActivityEntry[];
  resolution:ResolutionView|null;
}

const previousResolveAction=MockAdapter.prototype.resolveAction;

MockAdapter.prototype.resolveAction=async function resolveActionWithSpellSummons(actionId:string,targetIds:string[]) {
  const before=await this.getSnapshot();
  const action=Object.values(before.scene.actionsByActor).flat().find((entry)=>entry.id===actionId);
  const spellId=action?.spellCast?.spellId;
  const summons=spellId ? normalizedSpellDefinitionById(spellId)?.summons : undefined;
  const snapshot=await previousResolveAction.call(this,actionId,targetIds);
  if (!action||!summons||!spellId) return snapshot;
  const card=snapshot.resolution;
  if (!card||card.actionId!==actionId||card.stage!=="complete"||/시전 거부/.test(card.compact)) return snapshot;
  const internal=this as unknown as SummonAdapterState;
  const caster=internal.scene.entities.find((entity)=>entity.id===action.actorId);
  if (!caster) return snapshot;
  const baseLevel=action.spellCast?.baseLevel ?? 0;
  const slotLevel=baseLevel>0 ? Math.max(baseLevel,selectedCombatSpellSlot(action.actorId,baseLevel)) : baseLevel;
  const count=summons.count+Math.max(0,slotLevel-baseLevel)*(summons.countPerSlotAboveBase ?? 0);
  const names:string[]=[];
  for (let index=0;index<count;index+=1) {
    const known=new Set(internal.scene.entities.map((entity)=>entity.id));
    await this.instantiateCombatant(summons.monsterId);
    const spawned=internal.scene.entities.find((entity)=>!known.has(entity.id));
    if (!spawned) break;
    spawned.side=caster.side;
    names.push(spawned.name);
  }
  if (names.length) {
    internal.activity.unshift({
      id:`summon.${action.actorId}.${Date.now()}`,
      time:"지금",
      actor:caster.name,
      title:`${action.name} · 소환`,
      summary:`${names.join(", ")} · ${caster.side==="ally"?"아군":"상대"} 편으로 등장`,
      detail:[`${count}마리 · ${summons.monsterId}`],
      stateChanges:names.map((name)=>`${name} 추가`),
    });
  }
  return this.getSnapshot();
};

export function summonCountFor(summons:{ count:number; countPerSlotAboveBase?:number },baseLevel:number,slotLevel:number) {
  return summons.count+Math.max(0,slotLevel-baseLevel)*(summons.countPerSlotAboveBase ?? 0);
}

export type { AppSnapshot };

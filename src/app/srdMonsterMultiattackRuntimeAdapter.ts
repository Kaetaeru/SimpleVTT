import type { ActivityEntry, AppSnapshot, CombatantDefinitionVm, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";

/**
 * V1.3 C1-04: a stat block's multiattack routine ("물기 한 번과 발톱 두 번") resolves as one DM action — every
 * attack of the routine is resolved against the chosen target in order, applied, and summarised in one
 * activity entry. Each attack still goes through the atomic attack path, so undo and multiplayer see the
 * same resolutions a one-by-one DM would produce.
 */
interface MultiattackAdapterState {
  scene:{ entities:SceneEntity[]; actionsByActor:Record<string,Array<{ id:string; name:string; actorId:string }>> };
  combatantDefinitions:CombatantDefinitionVm[];
  activity:ActivityEntry[];
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
}

export interface MultiattackRoutineStep { name:string; count:number; actionName:string }

function definitionFor(state:MultiattackAdapterState,actorId:string):CombatantDefinitionVm|undefined {
  const entity=state.scene.entities.find((entry)=>entry.id===actorId);
  const artifact=(entity as { runtimeArtifactId?:string }|undefined)?.runtimeArtifactId;
  return state.combatantDefinitions.find((definition)=>definition.id===artifact||actorId.startsWith(`${definition.id}.instance-`)||actorId===definition.id);
}

/** The routine a scene entity can resolve, or undefined when its stat block has no parsed routine. */
export function multiattackRoutineOf(snapshot:Pick<AppSnapshot,"scene"|"combatantDefinitions">,actorId:string):MultiattackRoutineStep[]|undefined {
  const definition=definitionFor(snapshot as unknown as MultiattackAdapterState,actorId);
  const routine=(definition as { runtimeMonster?:{ multiattackRoutine?:MultiattackRoutineStep[] } }|undefined)?.runtimeMonster?.multiattackRoutine;
  return routine?.length ? routine : undefined;
}

export function multiattackRoutineLabel(routine:MultiattackRoutineStep[]) {
  return routine.map((step)=>`${step.actionName} ${step.count}회`).join(" · ");
}

declare module "./mockAdapter" {
  interface MockAdapter {
    /** Resolve every attack of the actor's multiattack routine against one target, in stat-block order. */
    resolveMultiattackRoutine(actorId:string,targetId:string):Promise<AppSnapshot>;
  }
}

MockAdapter.prototype.resolveMultiattackRoutine=async function resolveMultiattackRoutineRuntime(actorId:string,targetId:string) {
  const internal=this as unknown as MultiattackAdapterState;
  const snapshot=await this.getSnapshot();
  const routine=multiattackRoutineOf(snapshot,actorId);
  const actor=internal.scene.entities.find((entry)=>entry.id===actorId);
  const target=internal.scene.entities.find((entry)=>entry.id===targetId);
  if (!routine||!actor||!target) return snapshot;
  const before=target.hp;
  const outcomes:string[]=[];
  for (const step of routine) {
    const action=(snapshot.scene.actionsByActor[actorId]??[]).find((entry)=>entry.name===step.actionName);
    if (!action) { outcomes.push(`${step.actionName}: 행동 없음`); continue; }
    for (let index=0;index<step.count;index+=1) {
      let after=await this.resolveAction(action.id,[targetId]);
      for (let advance=0;advance<8&&after.resolution&&after.resolution.stage!=="complete";advance+=1) after=await this.advanceResolution();
      const card=after.resolution;
      outcomes.push(card ? `${step.actionName} ${index+1}/${step.count}: ${card.finalOutcome||card.compact}` : `${step.actionName} ${index+1}/${step.count}: 판정 없음`);
      if (card?.stage==="complete") await this.dismissResolution();
      const hp=internal.scene.entities.find((entry)=>entry.id===targetId)?.hp ?? 0;
      if (hp<=0) { outcomes.push(`${target.name} 쓰러짐 · 루틴 종료`); break; }
    }
    if ((internal.scene.entities.find((entry)=>entry.id===targetId)?.hp ?? 0)<=0) break;
  }
  const afterHp=internal.scene.entities.find((entry)=>entry.id===targetId)?.hp ?? before;
  internal.activity.unshift({
    id:`multiattack.${actorId}.${Date.now()}`,
    time:"지금",
    actor:actor.name,
    title:`다중공격 · ${multiattackRoutineLabel(routine)}`,
    summary:`${target.name} HP ${before} → ${afterHp}`,
    detail:outcomes,
    stateChanges:[],
  });
  return this.getSnapshot();
};

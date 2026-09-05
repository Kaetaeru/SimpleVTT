import "./phase09CombatantDefinitionRuntimeAdapter";
import "./encounterGroupContracts";
import type { ActivityEntry, AppSnapshot, CombatantDefinitionVm, SceneEntity, SceneVm } from "./contracts";
import type { SceneGroupVm } from "./encounterGroupContracts";
import { MockAdapter } from "./mockAdapter";
import { ensureCombatantDefinition } from "./phase09CombatantDefinitionRuntimeAdapter";

/**
 * V1.2 T1-04 — groups and group initiative. The DM adds "고블린 ×3 한 무리": the members share one initiative roll
 * (so the turn order keeps them together), carry a `groupId`, and the opposing board folds them into one card that
 * an area action can target in a single tap. Groups follow their members: a removed or dead member leaves the group
 * on the next snapshot, and an empty group disappears.
 */
interface GroupAdapterState {
  scene:SceneVm;
  activity:ActivityEntry[];
  combatantDefinitions:CombatantDefinitionVm[];
  queuedInitiativeD20?:number|null;
  getSnapshot():Promise<AppSnapshot>;
}

let sequence=0;
const eventId=(prefix:string)=>`${prefix}.${Date.now()}.${sequence++}`;

function groups(scene:SceneVm):Record<string,SceneGroupVm> {
  scene.groups ??= {};
  return scene.groups;
}

/** Keeps `groups` and `groupId` consistent with the entities present in the scene. */
export function projectEncounterGroups(scene:SceneVm) {
  if (!scene.groups) return;
  const present=new Map(scene.entities.map((entity)=>[entity.id,entity] as const));
  for (const [id,group] of Object.entries(scene.groups)) {
    const members=group.memberIds.filter((memberId)=>present.get(memberId)?.groupId===id);
    if (members.length<=1) {
      for (const memberId of members) { const entity=present.get(memberId); if (entity) delete entity.groupId; }
      delete scene.groups[id];
      continue;
    }
    if (members.length!==group.memberIds.length) group.memberIds=members;
  }
  for (const entity of scene.entities) {
    if (entity.groupId && !scene.groups[entity.groupId]) delete entity.groupId;
  }
  if (!Object.keys(scene.groups).length) delete scene.groups;
}

export function groupOf(scene:SceneVm,entity:Pick<SceneEntity,"groupId">):SceneGroupVm|undefined {
  return entity.groupId ? scene.groups?.[entity.groupId] : undefined;
}

function nextGroupId(scene:SceneVm,seed:string) {
  const base=`group.${seed.replace(/[^a-z0-9]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase()||"combatants"}`;
  let index=1;
  while (scene.groups?.[`${base}.${index}`]) index+=1;
  return `${base}.${index}`;
}

declare module "./mockAdapter" {
  interface MockAdapter {
    /** Adds `count` copies of a combatant definition as one group sharing a single initiative roll. */
    instantiateCombatantGroup(definitionId:string,count:number,label?:string):Promise<AppSnapshot>;
    /** Groups existing combatants (the first member's initiative becomes the group's). */
    groupCombatants(entityIds:string[],label?:string):Promise<AppSnapshot>;
    ungroupCombatants(groupId:string):Promise<AppSnapshot>;
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot=async function getSnapshotWithEncounterGroups() {
  const internal=this as unknown as GroupAdapterState;
  projectEncounterGroups(internal.scene);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.instantiateCombatantGroup=async function instantiateCombatantGroupRuntime(definitionId:string,count:number,label?:string) {
  const internal=this as unknown as GroupAdapterState;
  const definition=ensureCombatantDefinition(internal as unknown as Parameters<typeof ensureCombatantDefinition>[0],definitionId) ?? internal.combatantDefinitions.find((entry)=>entry.id===definitionId);
  const size=Math.max(1,Math.min(20,Math.floor(count)));
  if (!definition || size<2) return this.instantiateCombatant(definitionId);
  const beforeIds=new Set(internal.scene.entities.map((entity)=>entity.id));
  await this.instantiateCombatant(definitionId);
  const first=internal.scene.entities.find((entity)=>!beforeIds.has(entity.id));
  if (!first) return internal.getSnapshot();
  const bonus=definition.runtimeMonster?.initiativeBonus ?? 0;
  const face=first.initiative-bonus;
  const members=[first];
  for (let index=1; index<size; index+=1) {
    const known=new Set(internal.scene.entities.map((entity)=>entity.id));
    // Reproduce the same initiative total through the normal instantiate path (face + bonus) so turn runtime state agrees.
    internal.queuedInitiativeD20=face;
    await this.instantiateCombatant(definitionId);
    internal.queuedInitiativeD20=null;
    const added=internal.scene.entities.find((entity)=>!known.has(entity.id));
    if (!added) break;
    added.initiative=first.initiative;
    members.push(added);
  }
  const groupId=nextGroupId(internal.scene,definition.id);
  const groupLabel=label ?? `${definition.name} ×${members.length}`;
  groups(internal.scene)[groupId]={ id:groupId, label:groupLabel, definitionId:definition.id, memberIds:members.map((entity)=>entity.id), initiative:first.initiative };
  for (const member of members) member.groupId=groupId;
  internal.activity.unshift({
    id:eventId("group-add"),
    time:"지금",
    actor:"DM",
    title:"한 무리 추가",
    summary:`${groupLabel} · 우선권 ${first.initiative}`,
    detail:members.map((member)=>`${member.name} (${member.id})`),
    stateChanges:[`Group ${groupId} · ${members.length} members · 공유 우선권 ${first.initiative}`],
  });
  return internal.getSnapshot();
};

MockAdapter.prototype.groupCombatants=async function groupCombatantsRuntime(entityIds:string[],label?:string) {
  const internal=this as unknown as GroupAdapterState;
  const members=entityIds.map((id)=>internal.scene.entities.find((entity)=>entity.id===id)).filter((entity):entity is SceneEntity=>Boolean(entity));
  if (members.length<2) return internal.getSnapshot();
  const first=members[0];
  const groupId=nextGroupId(internal.scene,first.name);
  const groupLabel=label ?? `${first.name.replace(/\s+\d+$/,"")} ×${members.length}`;
  for (const member of members) { member.groupId=groupId; member.initiative=first.initiative; }
  groups(internal.scene)[groupId]={ id:groupId, label:groupLabel, memberIds:members.map((entity)=>entity.id), initiative:first.initiative };
  internal.activity.unshift({ id:eventId("group-set"), time:"지금", actor:"DM", title:"무리 지정", summary:groupLabel, detail:members.map((member)=>member.name), stateChanges:[`Group ${groupId}`] });
  return internal.getSnapshot();
};

MockAdapter.prototype.ungroupCombatants=async function ungroupCombatantsRuntime(groupId:string) {
  const internal=this as unknown as GroupAdapterState;
  const group=internal.scene.groups?.[groupId];
  if (!group) return internal.getSnapshot();
  for (const entity of internal.scene.entities) if (entity.groupId===groupId) delete entity.groupId;
  delete internal.scene.groups![groupId];
  internal.activity.unshift({ id:eventId("group-clear"), time:"지금", actor:"DM", title:"무리 해제", summary:group.label, detail:[], stateChanges:[`Group ${groupId} 해제`] });
  return internal.getSnapshot();
};

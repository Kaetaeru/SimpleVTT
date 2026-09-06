import "./productionSessionLifecycleAdapter";
import { MockAdapter } from "./mockAdapter";
import { connectedInternal } from "./connectedSessionRuntimeAdapter";
import { isEphemeralSessionProjectionCharacter } from "./characterSessionProjectionRegistry";

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
/** The reference scene's seeded 기록 entries (Aelar's longsword, Mira's healing word): never part of a real session. */
const FIXTURE_ACTIVITY_IDS=new Set(["evt.201","evt.200"]);
const FIXTURE_ENTITY_IDS=new Set([
  "char.aelar",
  "char.mira",
  "combatant.goblin-a",
  "combatant.goblin-b",
  "combatant.wolf",
  "combatant.training-guardian",
]);

MockAdapter.prototype.getSnapshot=async function getSnapshotWithoutProductionHostFixtures() {
  const snapshot=await previousGetSnapshot.call(this);
  if (snapshot.session.role!=="host"&&snapshot.session.role!=="client") return snapshot;

  const app=connectedInternal(this);
  const localCharacterId=app.activeCharacter.id;
  const keepClientCharacter=snapshot.session.role==="client";
  const removedIds=new Set<string>();
  app.scene.entities=app.scene.entities.filter((entity)=>{
    if (isEphemeralSessionProjectionCharacter(this,entity.id)) return true;
    const clientLocalProjection=keepClientCharacter&&entity.id===localCharacterId;
    if (clientLocalProjection) return true;
    const fixture=FIXTURE_ENTITY_IDS.has(entity.id);
    const hostLocalProjection=snapshot.session.role==="host"&&entity.id===localCharacterId;
    if (!fixture&&!hostLocalProjection) return true;
    removedIds.add(entity.id);
    return false;
  });
  if (app.activity.some((entry)=>FIXTURE_ACTIVITY_IDS.has(entry.id))) app.activity=app.activity.filter((entry)=>!FIXTURE_ACTIVITY_IDS.has(entry.id));
  for (const id of removedIds) {
    delete app.scene.actionsByActor[id];
    delete app.scene.economyByActor[id];
  }
  if (!app.scene.entities.some((entity)=>entity.id===app.scene.currentActorId)) app.scene.currentActorId=app.scene.entities[0]?.id??"";
  if (!app.scene.entities.some((entity)=>entity.id===app.scene.selectedActorId)) app.scene.selectedActorId=app.scene.entities[0]?.id??"";
  if (app.resolution&&(removedIds.has(app.resolution.actorId)||app.resolution.targetIds.some((id)=>removedIds.has(id)))) app.resolution=null;

  // Fixture removal changes target eligibility. Re-run the production snapshot
  // projection once against the cleaned authoritative Scene so the action cards
  // cannot retain targets/reasons that are no longer visible on this peer.
  const refreshed=removedIds.size ? await previousGetSnapshot.call(this) : snapshot;
  const scene=structuredClone(refreshed.scene);
  for(const [actorId,actions] of Object.entries(scene.actionsByActor)){
    if(!isEphemeralSessionProjectionCharacter(this,actorId))continue;
    const ownerActions=app.scene.actionsByActor[actorId]??[];
    scene.actionsByActor[actorId]=actions.map((action)=>{
      if(action.disabledReason!=="필요 아이템이 없습니다."&&action.disabledReason!=="필요 자원이 부족합니다.")return action;
      const ownerAction=ownerActions.find((candidate)=>candidate.id===action.id);
      return ownerAction?.available?{...action,available:true,disabledReason:undefined}:action;
    });
  }

  return {
    ...refreshed,
    activity:refreshed.activity.filter((entry)=>!FIXTURE_ACTIVITY_IDS.has(entry.id)),
    scene,
    resolution:app.resolution ? structuredClone(app.resolution) : null,
  };
};

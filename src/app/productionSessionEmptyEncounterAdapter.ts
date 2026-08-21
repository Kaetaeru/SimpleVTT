import "./productionSessionLifecycleAdapter";
import { MockAdapter } from "./mockAdapter";
import { connectedInternal } from "./connectedSessionRuntimeAdapter";
import { isEphemeralSessionProjectionCharacter } from "./characterSessionProjectionRegistry";

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
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
  if (snapshot.session.role!=="host") return snapshot;

  const app=connectedInternal(this);
  const localCharacterId=app.activeCharacter.id;
  const removedIds=new Set<string>();
  app.scene.entities=app.scene.entities.filter((entity)=>{
    const fixture=FIXTURE_ENTITY_IDS.has(entity.id);
    const hostLocalProjection=entity.id===localCharacterId&&!isEphemeralSessionProjectionCharacter(this,entity.id);
    if (!fixture&&!hostLocalProjection) return true;
    removedIds.add(entity.id);
    return false;
  });
  for (const id of removedIds) {
    delete app.scene.actionsByActor[id];
    delete app.scene.economyByActor[id];
  }
  if (!app.scene.entities.some((entity)=>entity.id===app.scene.currentActorId)) app.scene.currentActorId=app.scene.entities[0]?.id??"";
  if (!app.scene.entities.some((entity)=>entity.id===app.scene.selectedActorId)) app.scene.selectedActorId=app.scene.entities[0]?.id??"";
  if (app.resolution&&(removedIds.has(app.resolution.actorId)||app.resolution.targetIds.some((id)=>removedIds.has(id)))) app.resolution=null;

  return {
    ...snapshot,
    scene:structuredClone(app.scene),
    resolution:app.resolution ? structuredClone(app.resolution) : null,
  };
};

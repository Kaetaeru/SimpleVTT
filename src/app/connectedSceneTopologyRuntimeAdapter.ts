import "./productionSessionEmptyEncounterAdapter";
import "./productionCombatantPreparationAdapter";
import { MockAdapter } from "./mockAdapter";
import { commitConnectedSceneTopology, connectedInternal } from "./connectedSessionRuntimeAdapter";
import { connectedStateFor } from "./connectedSessionState";
import type { SceneVm } from "./contracts";

const previousInstantiateCombatant=MockAdapter.prototype.instantiateCombatant;
const previousRemoveCombatant=MockAdapter.prototype.removeCombatant;

function topologyFingerprint(scene:SceneVm) {
  return JSON.stringify({
    entities:scene.entities.map((entity)=>entity.id),
    economy:Object.keys(scene.economyByActor).sort(),
    currentActorId:scene.currentActorId,
  });
}

async function publishIfChanged(adapter:MockAdapter,before:string,operation:string) {
  const app=connectedInternal(adapter);
  if (connectedStateFor(adapter).mode!=="host"||topologyFingerprint(app.scene)===before) return;
  await commitConnectedSceneTopology(
    adapter,
    [`Scene topology changed: ${operation}`],
    ["host-authoritative Encounter actor composition"],
  );
}

MockAdapter.prototype.instantiateCombatant=async function instantiateConnectedCombatant(definitionId:string) {
  const before=topologyFingerprint(connectedInternal(this).scene);
  await previousInstantiateCombatant.call(this,definitionId);
  await publishIfChanged(this,before,`Combatant added from ${definitionId}`);
  return connectedInternal(this).getSnapshot();
};

MockAdapter.prototype.removeCombatant=async function removeConnectedCombatant(combatantId:string) {
  const before=topologyFingerprint(connectedInternal(this).scene);
  await previousRemoveCombatant.call(this,combatantId);
  await publishIfChanged(this,before,`Combatant removed: ${combatantId}`);
  return connectedInternal(this).getSnapshot();
};

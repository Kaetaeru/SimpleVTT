import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { applyResolutionEvents } from "../../src/app/realEventApplyService";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";
import type { ResolutionEvent } from "../../src/domain/resolutionTypes";

test("resource capacity state changes project through app and runtime state and reverse cleanly",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const resource=snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID);
  assert.ok(resource);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  assert.ok(runtime);
  const combatant=runtime.combatants[characterId];
  assert.ok(combatant);
  combatant.resources.push({
    id:resource.id,
    label:resource.label,
    current:resource.current,
    maximum:resource.max,
    ...(resource.recovery?{recovery:structuredClone(resource.recovery)}:{}),
    ...(resource.maximumAfterLongRest!==undefined?{maximumAfterLongRest:resource.maximumAfterLongRest}:{}),
  });
  const runtimeResource=combatant.resources.find((entry)=>entry.id===resource.id);
  assert.ok(runtimeResource);

  const baseMaximum=resource.max;
  const event={
    id:"family-d-capacity-projection:event",
    resolutionId:"family-d-capacity-projection",
    operationId:"family-d-capacity-projection:resource",
    kind:"resource-capacity-projection-probe",
    actorId:characterId,
    targetId:characterId,
    summary:"temporary capacity projection probe",
    provenance:[],
    stateChanges:[{
      kind:"resource",
      targetId:characterId,
      resourceId:resource.id,
      before:resource.current,
      after:resource.current,
      capacity:{
        before:{maximum:baseMaximum,maximumAfterLongRest:runtimeResource.maximumAfterLongRest??null},
        after:{maximum:baseMaximum+1,maximumAfterLongRest:baseMaximum},
      },
      provenance:[],
      lifetime:"character-durable",
      writeBack:"character",
    }],
    result:{},
  } satisfies ResolutionEvent;

  const forward=applyResolutionEvents(snapshot.scene,[event],snapshot.activeCharacter.resources,[],runtime);
  assert.equal(forward.status,"committed",forward.status==="rejected"?forward.error:undefined);
  if (forward.status!=="committed") return;
  assert.equal(forward.resources.find((entry)=>entry.id===resource.id)?.max,baseMaximum+1);
  const forwardRuntimeResource=forward.runtimeState?.combatants[characterId]?.resources.find((entry)=>entry.id===resource.id);
  assert.equal(forwardRuntimeResource?.maximum,baseMaximum+1);
  assert.equal(forwardRuntimeResource?.maximumAfterLongRest,baseMaximum);

  const inverse=structuredClone(event);
  const inverseChange=inverse.stateChanges[0];
  assert.equal(inverseChange.kind,"resource");
  if (inverseChange.kind!=="resource" || !inverseChange.capacity) return;
  inverseChange.capacity={before:event.stateChanges[0].capacity!.after,after:event.stateChanges[0].capacity!.before};
  const reverted=applyResolutionEvents(forward.scene,[inverse],forward.resources,[],forward.runtimeState);
  assert.equal(reverted.status,"committed",reverted.status==="rejected"?reverted.error:undefined);
  if (reverted.status!=="committed") return;
  assert.equal(reverted.resources.find((entry)=>entry.id===resource.id)?.max,baseMaximum);
  const revertedRuntimeResource=reverted.runtimeState?.combatants[characterId]?.resources.find((entry)=>entry.id===resource.id);
  assert.equal(revertedRuntimeResource?.maximum,baseMaximum);
  assert.equal(revertedRuntimeResource?.maximumAfterLongRest,undefined);
});

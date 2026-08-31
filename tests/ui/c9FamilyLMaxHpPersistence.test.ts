import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { buildCharacterLibraryRecordV1, materializeCharacterRecordV1 } from "../../src/app/characterLibraryPersistence";
import { projectResolutionCharacterWriteBack } from "../../src/app/resolutionCharacterDurableProjection";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ResolutionEvent } from "../../src/domain/resolutionTypes";
function hpEvent(characterId:string,changes:ResolutionEvent["stateChanges"]):ResolutionEvent { return { id:"family-l-max-hp:event",resolutionId:"family-l-max-hp",operationId:"family-l-max-hp:operation",kind:"max-hp-source-model-probe",actorId:characterId,targetId:characterId,summary:"maximum HP source/runtime overlay probe",provenance:[],stateChanges:changes,result:{} }; }
test("maximum HP runtime overlay preserves source maximum across restart and inverse write-back",async()=>{
  const adapter=new MockAdapter(); const snapshot=await adapter.getSnapshot(); const sheet=structuredClone(snapshot.activeCharacter); const baseMaximum=sheet.maxHp; assert.ok(baseMaximum>1);
  const baseline=buildCharacterLibraryRecordV1(sheet); assert.equal(baseline.source.build.maxHp,baseMaximum); assert.equal(baseline.runtime.maxHp,undefined);
  const increased=baseMaximum+5; const increaseEvent=hpEvent(sheet.id,[{kind:"hp",targetId:sheet.id,field:"maximum",before:baseMaximum,after:increased,provenance:[],lifetime:"character-durable",writeBack:"character"}]);
  const forward=projectResolutionCharacterWriteBack(sheet,[increaseEvent],"forward"); assert.equal(forward.status,"committed",forward.status==="rejected"?forward.error:undefined); if(forward.status!=="committed") return; assert.equal(forward.sheet.maxHp,increased); assert.equal(forward.sheet.sourceMaxHp,baseMaximum);
  const persisted=buildCharacterLibraryRecordV1(forward.sheet,baseline); assert.equal(persisted.sourceRevision,baseline.sourceRevision); assert.equal(persisted.source.build.maxHp,baseMaximum); assert.equal(persisted.runtime.maxHp,increased);
  const restarted=materializeCharacterRecordV1(persisted); assert.equal(restarted.maxHp,increased); assert.equal(restarted.sourceMaxHp,baseMaximum);
  const inverse=projectResolutionCharacterWriteBack(restarted,[increaseEvent],"inverse"); assert.equal(inverse.status,"committed",inverse.status==="rejected"?inverse.error:undefined); if(inverse.status!=="committed") return; assert.equal(inverse.sheet.maxHp,baseMaximum); assert.equal(inverse.sheet.sourceMaxHp,baseMaximum);
  const undone=buildCharacterLibraryRecordV1(inverse.sheet,persisted); assert.equal(undone.sourceRevision,persisted.sourceRevision); assert.equal(undone.source.build.maxHp,baseMaximum); assert.equal(undone.runtime.maxHp,undefined); assert.equal(materializeCharacterRecordV1(undone).maxHp,baseMaximum);
});
test("maximum HP reduction requires and persists the matching current HP clamp",async()=>{
  const adapter=new MockAdapter(); const snapshot=await adapter.getSnapshot(); const sheet=structuredClone(snapshot.activeCharacter); const baseMaximum=sheet.maxHp; assert.ok(baseMaximum>1); sheet.hp=baseMaximum; const reduced=baseMaximum-1;
  const event=hpEvent(sheet.id,[{kind:"hp",targetId:sheet.id,field:"current",before:baseMaximum,after:reduced,provenance:[],lifetime:"character-durable",writeBack:"character"},{kind:"hp",targetId:sheet.id,field:"maximum",before:baseMaximum,after:reduced,provenance:[],lifetime:"character-durable",writeBack:"character"}]);
  const forward=projectResolutionCharacterWriteBack(sheet,[event],"forward"); assert.equal(forward.status,"committed",forward.status==="rejected"?forward.error:undefined); if(forward.status!=="committed") return; assert.equal(forward.sheet.hp,reduced); assert.equal(forward.sheet.maxHp,reduced); assert.equal(forward.sheet.sourceMaxHp,baseMaximum);
  const record=buildCharacterLibraryRecordV1(forward.sheet); assert.equal(record.source.build.maxHp,baseMaximum); assert.equal(record.runtime.hp,reduced); assert.equal(record.runtime.maxHp,reduced); const restarted=materializeCharacterRecordV1(record); assert.equal(restarted.hp,reduced); assert.equal(restarted.maxHp,reduced);
  const inverse=projectResolutionCharacterWriteBack(restarted,[event],"inverse"); assert.equal(inverse.status,"committed",inverse.status==="rejected"?inverse.error:undefined); if(inverse.status!=="committed") return; assert.equal(inverse.sheet.hp,baseMaximum); assert.equal(inverse.sheet.maxHp,baseMaximum);
});

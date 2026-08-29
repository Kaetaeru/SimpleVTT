import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import type { ActionVm, ResolutionView, SceneVm } from "../../src/app/contracts";

test("unknown action and source identities use the generic failed-check add-die path",async()=>{
  const adapter=new MockAdapter();await adapter.startInitiative();await adapter.setQueuedD20(6);const actorId="combatant.goblin-a",resourceId="external.resource.luck",sourceId="external.feature.never-seen",actionId="external.action.never-seen";
  const action:ActionVm={id:actionId,actorId,name:"Unknown check",category:"basic",target:"none",economy:"없음",resolutionKind:"ability-check",summary:"unknown",available:true,eligibleTargetIds:[],checkBonus:3,runtimeD20FollowUps:[{sourceId,families:["ability-check"],trigger:"failure",modification:{mode:"add-die",diceSides:8},payment:{resourceId,amount:1,consumeWhen:"success"},presentation:{optionName:"Unknown d8",cost:"success payment",effect:"add d8",source:sourceId}}],details:[]};
  const internal=adapter as unknown as {scene:SceneVm;resolution:ResolutionView|null};internal.scene.actionsByActor[actorId]=[action];const runtime=snapshotAdapterTurnRuntimeState(adapter,internal.scene)!;runtime.combatants[actorId].resources.push({id:resourceId,label:"Unknown",current:1,maximum:1});const expected=runtime.revision;runtime.revision+=1;assert.equal(commitAdapterTurnRuntimeState(adapter,internal.scene,expected,runtime),true);
  internal.resolution={id:"external.resolution.never-seen",actorId,targetIds:[],actionId,actionName:action.name,rollKind:"check",stage:"interrupt",authoritativeDice:[4],naturalD20:4,rollTotal:7,checkTarget:12,checkOutcome:"실패",saveResults:[],damageComponents:[],compact:"7 vs 12",detail:[],provenance:[],calculatedOutcome:"실패",finalOutcome:"실패",stateChanges:[],adjudicated:false,interrupt:{id:"follow-up.d20-modification",responderId:actorId,responderName:"Unknown",trigger:"failed",optionName:"Unknown d8",cost:"success payment",effect:"add d8",source:sourceId},canAdvance:false};
  const snapshot=await adapter.respondToInterrupt(true);assert.equal(snapshot.resolution?.rollTotal,13);assert.equal(snapshot.resolution?.checkOutcome,"성공");assert.deepEqual(snapshot.resolution?.rollModifierContributions,[{source:sourceId,value:6}]);assert.equal(snapshotAdapterTurnRuntimeState(adapter,internal.scene)?.combatants[actorId].resources.find((entry)=>entry.id===resourceId)?.current,0);
});

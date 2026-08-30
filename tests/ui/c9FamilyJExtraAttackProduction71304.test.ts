import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { projectCommonPlayRuntimeArtifactAction } from "../../src/app/installedCommonPlayRuntimeAdapter";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.fighter`,mechanicId=`${prefix}.extra-attack`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Unknown portable Extra Attack",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Multiattack",locales:{en:{name:"Portable Multiattack"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,payments:[{kind:"economy",bucket:"action",amount:{value:1},actionKind:"attack",attacksPerAction:2,consumeAt:"commit",refundOnCancel:true}],entryPoints:[{id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:1}},operations:[{kind:"damage.apply",amount:{value:1},damageType:"slashing",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]},{id:"replace-with-grapple",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"saving-throw",roller:"target",property:{choose:"highest",from:["save.str.modifier","save.dex.modifier"]},dc:{value:12}},operations:[{kind:"condition.apply",condition:"grappled",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}}]}]}}]}]})};
}
function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) { return snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp; }
async function run(prefix:string) {
  const adapter=new MockAdapter(); const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport(); await adapter.startInitiative(); await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot(); const actorId=snapshot.activeCharacter.id;
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"strike"});
  const hpBefore=hp(snapshot);
  await adapter.resolveAction(actionId,["combatant.goblin-a"]); snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete"); assert.equal(hp(snapshot),hpBefore!-1);
  let state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.action,false); assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1);
  const projectedSecond=await projectCommonPlayRuntimeArtifactAction(adapter,actionId,actorId,snapshot,state);
  assert.equal(projectedSecond?.available,true,"remaining Extra Attack must keep the production projector available");
  await adapter.resolveAction(actionId,["combatant.goblin-a"]); snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete"); assert.equal(hp(snapshot),hpBefore!-2);
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!; assert.equal(state.combatants[actorId].economy.extraAttacks?.length,0);
  const revisionAfterSecond=state.revision;
  await adapter.resolveAction(actionId,["combatant.goblin-a"]); snapshot=await adapter.getSnapshot();
  assert.equal(hp(snapshot),hpBefore!-2); assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.revision,revisionAfterSecond);
  await adapter.undoLastResolution(); snapshot=await adapter.getSnapshot(); assert.equal(hp(snapshot),hpBefore!-1);
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!; assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1);
}
async function runReplacement(prefix:string) {
  const adapter=new MockAdapter(); const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport(); await adapter.startInitiative(); await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot(); const actorId=snapshot.activeCharacter.id;
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId});
  const hpBefore=hp(snapshot);
  await adapter.resolveAction(action("strike"),["combatant.goblin-a"]); snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete"); assert.equal(hp(snapshot),hpBefore!-1);
  let state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.action,false); assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1);
  await adapter.setQueuedD20(1);
  await adapter.resolveAction(action("replace-with-grapple"),["combatant.goblin-a"]); snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete"); assert.equal(hp(snapshot),hpBefore!-1);
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,0);
  assert.equal(state.effects.some((effect)=>effect.targetId==="combatant.goblin-a"&&effect.conditionId==="grappled"),true);
  await adapter.undoLastResolution(); snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1);
  assert.equal(state.effects.some((effect)=>effect.targetId==="combatant.goblin-a"&&effect.conditionId==="grappled"),false);
}
test("unknown installed Common Play uses one Action for two structural attacks through production projection and Undo",async()=>{await run("external-family-j-extra-attack");});
test("renaming every external identity preserves portable Extra Attack production economy",async()=>{await run("renamed-family-j-extra-attack");});
test("unknown installed Common Play can replace one Extra Attack with portable control and Undo",async()=>{await runReplacement("external-family-j-replacement");});
test("renaming every external identity preserves portable attack replacement",async()=>{await runReplacement("renamed-family-j-replacement");});

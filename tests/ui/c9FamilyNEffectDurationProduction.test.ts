import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

type Duration =
  | {kind:"durable"}
  | {kind:"maintained";policy:"concentration"}
  | {kind:"until-timing";timing:"rest.short.complete"|"rest.long.complete"}
  | {kind:"elapsed";amount:{value:number};unit:"seconds"|"minutes"|"hours"|"days"};

function packagePayload(prefix:string,duration:Duration) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.effect-content`;
  const mechanicId=`${prefix}.effect-mechanic`;
  const config={
    schemaVersion:"0.2-draft",id:mechanicId,
    entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"probe",target:"actor"}]}],
    artifactTemplates:[{
      id:"probe",artifactKind:"effect",duration,
      rules:[{id:"noop",event:"damage.taken",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:0},damageType:"force",target:"event.actor"}]}],
      lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack",
    }],
  };
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family N duration probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Duration Probe",locales:{en:{name:"Duration Probe"}}},mechanics:[{kind:"common-play",config}]}],
  })};
}

async function exercise(prefix:string,duration:Duration,expected:(elapsed:number)=>unknown) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix,duration);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const before=await adapter.getSnapshot();
  const beforeRuntime=snapshotAdapterTurnRuntimeState(adapter,before.scene)!;
  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"activate",
  });
  const resolved=await adapter.resolveAction(action,["char.aelar"]);
  assert.equal(resolved.resolution?.stage,"complete",JSON.stringify(resolved.resolution));
  const runtime=snapshotAdapterTurnRuntimeState(adapter,resolved.scene)!;
  const effect=runtime.effects.find((entry)=>entry.sourceId===pack.mechanicId);
  assert.ok(effect,JSON.stringify(runtime.effects));
  assert.deepEqual(effect.expiry,expected(beforeRuntime.clock.elapsedSeconds));
  if(duration.kind==="maintained") {
    assert.ok(effect.concentrationGroupId);
    assert.equal(runtime.concentration["char.aelar"]?.sourceId,pack.mechanicId);
  }
  await adapter.undoLastResolution();
  const undone=await adapter.getSnapshot();
  const undoneRuntime=snapshotAdapterTurnRuntimeState(adapter,undone.scene)!;
  assert.equal(undoneRuntime.effects.some((entry)=>entry.sourceId===pack.mechanicId),false);
  if(duration.kind==="maintained") assert.equal(undoneRuntime.concentration["char.aelar"],undefined);
}

async function exerciseElapsedBoundaryExpiry(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix,{kind:"elapsed",amount:{value:6},unit:"seconds"});
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  let runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const initialElapsed=runtime.clock.elapsedSeconds;
  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"activate",
  });
  snapshot=await adapter.resolveAction(action,["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const effect=runtime.effects.find((entry)=>entry.sourceId===pack.mechanicId);
  assert.ok(effect,JSON.stringify(runtime.effects));
  assert.deepEqual(effect.expiry,{kind:"time",elapsedSeconds:initialElapsed+6});

  const maxTurns=snapshot.scene.entities.length+1;
  for(let turn=0;turn<maxTurns&&runtime.clock.elapsedSeconds===initialElapsed;turn+=1) {
    await adapter.endTurn();
    snapshot=await adapter.getSnapshot();
    runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  }
  assert.equal(runtime.clock.elapsedSeconds,initialElapsed+6,"one production round wrap must advance the authoritative clock by six seconds");
  assert.equal(runtime.effects.some((entry)=>entry.sourceId===pack.mechanicId),false,"elapsed effect must expire at the production clock boundary");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const restored=runtime.effects.find((entry)=>entry.sourceId===pack.mechanicId);
  assert.ok(restored,"event-native Undo must restore the effect removed by the final turn lifecycle transaction");
  assert.deepEqual(restored.expiry,{kind:"time",elapsedSeconds:initialElapsed+6});
}

const CASES:Array<{name:string;duration:Duration;expected:(elapsed:number)=>unknown}>=[
  {name:"durable",duration:{kind:"durable"},expected:()=>({kind:"permanent"})},
  {name:"concentration",duration:{kind:"maintained",policy:"concentration"},expected:()=>({kind:"concentration"})},
  {name:"short-rest",duration:{kind:"until-timing",timing:"rest.short.complete"},expected:()=>({kind:"rest",rest:"short"})},
  {name:"long-rest",duration:{kind:"until-timing",timing:"rest.long.complete"},expected:()=>({kind:"rest",rest:"long"})},
  {name:"elapsed",duration:{kind:"elapsed",amount:{value:2},unit:"minutes"},expected:(elapsed)=>({kind:"time",elapsedSeconds:elapsed+120})},
];

test("unknown installed Common Play materializes the portable effect-duration matrix and reverses it through Undo",async()=>{
  for(const probe of CASES) await exercise(`unknown-family-n-${probe.name}`,probe.duration,probe.expected);
});

test("renamed external identities preserve the same portable effect-duration matrix",async()=>{
  for(const probe of CASES) await exercise(`renamed-family-n-${probe.name}`,probe.duration,probe.expected);
});

test("unknown installed elapsed effect expires at the production round clock boundary and Undo restores it",async()=>{
  await exerciseElapsedBoundaryExpiry("unknown-family-n-expiry");
});

test("renamed external identity preserves production elapsed expiry and Undo",async()=>{
  await exerciseElapsedBoundaryExpiry("renamed-family-n-expiry");
});

function suppressionPackage(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const effectMechanicId=`${prefix}.timed-effect`;
  const controlMechanicId=`${prefix}.suppression-control`;
  const effectConfig={
    schemaVersion:"0.2-draft",id:effectMechanicId,
    entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"probe",target:"actor"}]}],
    artifactTemplates:[{
      id:"probe",artifactKind:"effect",duration:{kind:"elapsed",amount:{value:6},unit:"seconds"},
      rules:[{id:"noop",event:"damage.taken",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:0},damageType:"force",target:"event.actor"}]}],
      lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack",
    }],
  };
  const selector={
    from:"effects",min:1,max:1,selection:"automatic",
    where:{op:"eq",left:{ref:"sourceId"},right:{value:effectMechanicId}},
  };
  const controlConfig={
    schemaVersion:"0.2-draft",id:controlMechanicId,
    entryPoints:[
      {id:"suppress",invocation:"manual",operations:[{kind:"effect.suppress",selector,suppressed:true,reason:"portable source paused",pauseDuration:true}]},
      {id:"resume",invocation:"manual",operations:[{kind:"effect.suppress",selector,suppressed:false}]},
    ],
  };
  return {moduleId,contentId,effectMechanicId,controlMechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family N suppression probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Suppression Probe",locales:{en:{name:"Suppression Probe"}}},mechanics:[
      {kind:"common-play",config:effectConfig},{kind:"common-play",config:controlConfig},
    ]}],
  })};
}

function actionFor(pack:ReturnType<typeof suppressionPackage>,mechanicId:string,entryPointId:string) {
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId,entryPointId});
}

async function advanceOneRound(adapter:MockAdapter,initialElapsed:number) {
  let snapshot=await adapter.getSnapshot();
  let runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const maxTurns=snapshot.scene.entities.length+1;
  for(let turn=0;turn<maxTurns&&runtime.clock.elapsedSeconds===initialElapsed;turn+=1) {
    await adapter.endTurn();
    snapshot=await adapter.getSnapshot();
    runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  }
  assert.equal(runtime.clock.elapsedSeconds,initialElapsed+6);
  return {snapshot,runtime};
}

async function exercisePortableSuppression(prefix:string) {
  const adapter=new MockAdapter();
  const pack=suppressionPackage(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  let runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const initialElapsed=runtime.clock.elapsedSeconds;
  snapshot=await adapter.resolveAction(actionFor(pack,pack.effectMechanicId,"activate"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  let effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.ok(effect);
  assert.deepEqual(effect.expiry,{kind:"time",elapsedSeconds:initialElapsed+6});

  snapshot=await adapter.resolveAction(actionFor(pack,pack.controlMechanicId,"suppress"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.deepEqual(effect?.suppression,{reason:"portable source paused",pauseDuration:true,remainingSeconds:6});

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.equal(effect?.suppression,undefined);
  assert.deepEqual(effect?.expiry,{kind:"time",elapsedSeconds:initialElapsed+6});

  snapshot=await adapter.resolveAction(actionFor(pack,pack.controlMechanicId,"suppress"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  ({snapshot,runtime}=await advanceOneRound(adapter,initialElapsed));
  effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.ok(effect,"paused portable effect must survive its original expiry boundary");
  assert.equal(effect.suppression?.remainingSeconds,6);

  await adapter.setCurrentActor("char.aelar");
  snapshot=await adapter.resolveAction(actionFor(pack,pack.controlMechanicId,"resume"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.equal(effect?.suppression,undefined);
  assert.deepEqual(effect?.expiry,{kind:"time",elapsedSeconds:initialElapsed+12});

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.equal(effect?.suppression?.pauseDuration,true,"event-native Undo must restore the paused portable effect");

  snapshot=await adapter.resolveAction(actionFor(pack,pack.controlMechanicId,"resume"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  ({snapshot,runtime}=await advanceOneRound(adapter,initialElapsed+6));
  assert.equal(runtime.effects.some((entry)=>entry.sourceId===pack.effectMechanicId),false,"resumed portable effect must expire after its preserved remaining duration");
}

test("unknown installed Common Play suppresses, pauses, resumes, expires, and undoes a portable effect",async()=>{
  await exercisePortableSuppression("unknown-family-n-suppression");
});

test("renamed external identities preserve portable effect suppression and pause-resume semantics",async()=>{
  await exercisePortableSuppression("renamed-family-n-suppression");
});

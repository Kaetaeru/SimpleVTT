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

import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function moduleJson(prefix:string) {
  const moduleId=`${prefix}.module`;
  const effectContentId=`${prefix}.mastery-content`;
  const effectMechanicId=`${prefix}.mastery-effect`;
  const attackContentId=`${prefix}.attack-content`;
  const attackMechanicId=`${prefix}.attack`;
  const effect={schemaVersion:"0.2-draft",id:effectMechanicId,entryPoints:[
    {id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"mastery",target:"actor"}]},
  ],artifactTemplates:[{
    id:"mastery",artifactKind:"effect",duration:{kind:"elapsed",amount:{value:1},unit:"hours"},
    rules:[{id:"graze",event:"attack.miss",frequency:"once-per-turn",operations:[
      {kind:"damage.apply",amount:{value:2},damageType:"slashing",target:"event.target"},
    ]}],lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack",
  }]};
  const attack={schemaVersion:"0.2-draft",id:attackMechanicId,entryPoints:[{
    id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},
    test:{kind:"attack-roll",roller:"actor",dc:{value:99}},
    operations:[{kind:"damage.apply",amount:{value:0},damageType:"slashing",target:"target"}],
  }]};
  const content=[
    {id:effectContentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Mastery",locales:{en:{name:"Unknown Mastery"}}},mechanics:[{kind:"common-play",config:effect}]},
    {id:attackContentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Strike",locales:{en:{name:"Unknown Strike"}}},mechanics:[{kind:"common-play",config:attack}]},
  ];
  return {moduleId,effectContentId,effectMechanicId,attackContentId,attackMechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown mastery module",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content,
  })};
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  const pack=moduleJson(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(contentId:string,mechanicId:string,entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(contentId,pack.moduleId,"1"),mechanicId,entryPointId,
  });
  const before=await adapter.getSnapshot();
  const targetBefore=before.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  const actorBefore=before.scene.entities.find((entity)=>entity.id==="char.aelar")!.hp;
  await adapter.resolveAction(action(pack.effectContentId,pack.effectMechanicId,"activate"),["char.aelar"]);
  await adapter.resolveAction(action(pack.attackContentId,pack.attackMechanicId,"strike"),["combatant.goblin-a"]);
  const after=await adapter.getSnapshot();
  const targetAfter=after.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  const actorAfter=after.scene.entities.find((entity)=>entity.id==="char.aelar")!.hp;
  const history=snapshotAdapterTurnRuntimeState(adapter,after.scene)?.history??[];
  assert.ok(history.some((entry)=>entry.kind==="attack.miss"&&entry.targetId==="combatant.goblin-a"));
  return {adapter,targetBefore,targetAfter,actorBefore,actorAfter};
}

test("unknown portable miss rider damages the attack target and Undo restores it",async()=>{
  const result=await run("external-family-k-graze");
  assert.equal(result.targetBefore-result.targetAfter,2);
  assert.equal(result.actorAfter,result.actorBefore);
  await result.adapter.undoLastResolution();
  const undone=await result.adapter.getSnapshot();
  assert.equal(undone.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,result.targetBefore);
});

test("renaming unknown mastery module/content/mechanic identities preserves miss-rider semantics",async()=>{
  const first=await run("external-family-k-a");
  const renamed=await run("totally-renamed-family-k-b");
  assert.equal(first.targetBefore-first.targetAfter,2);
  assert.equal(renamed.targetBefore-renamed.targetAfter,2);
  assert.equal(first.actorAfter,first.actorBefore);
  assert.equal(renamed.actorAfter,renamed.actorBefore);
});

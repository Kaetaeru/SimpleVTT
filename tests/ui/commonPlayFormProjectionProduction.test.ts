import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId, parseRuntimeArtifactCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function payload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.form`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown form projection probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Form",locales:{en:{name:"Unknown Form"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          entryPoints:[{id:"transform",invocation:"manual",operations:[{kind:"artifact.spawn",template:"form"}]}],
          artifactTemplates:[{
            id:"form",artifactKind:"form",duration:{kind:"durable"},lifetime:{kind:"durable"},
            initialState:{
              targetActorId:"actor",
              propertyOverlay:{"defense.ac":19,"movement.walk":45,"hp.maximum":37,"hp.current":23,"hp.temporary":6},
              retainedProperties:[],
              replacementProperties:["defense.ac","movement.walk","hp.maximum","hp.current","hp.temporary"],
              hpPolicy:"replace",actionPolicy:"retain",spellcasting:"retain",actionDefinitionIds:[],resources:[],
            },
          }],
        }}],
      }],
    }),
  };
}

type FormActionPolicy="grant"|"replace";

function actionPolicyPayload(prefix:string,actionPolicy:FormActionPolicy) {
  const moduleId=`${prefix}.module`;
  const formContentId=`${prefix}.form-option`;
  const actionContentId=`${prefix}.form-action-option`;
  const formMechanicId=`${prefix}.form`;
  const actionMechanicId=`${prefix}.form-action`;
  const definitionActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(actionContentId,moduleId,"1"),mechanicId:actionMechanicId,entryPointId:"form-action",
  });
  return {
    moduleId,formContentId,formMechanicId,definitionActionId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown form action projection probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[
        {
          id:formContentId,category:"option",
          presentation:{defaultLocale:"en",originalName:"Unknown Action Form",locales:{en:{name:"Unknown Action Form"}}},
          mechanics:[{kind:"common-play",config:{
            schemaVersion:"0.2-draft",id:formMechanicId,
            entryPoints:[{id:"transform",invocation:"manual",operations:[{kind:"artifact.spawn",template:"form"}]}],
            artifactTemplates:[{
              id:"form",artifactKind:"form",duration:{kind:"durable"},lifetime:{kind:"durable"},
              initialState:{
                targetActorId:"actor",controllerId:"actor",propertyOverlay:{},retainedProperties:[],replacementProperties:[],
                hpPolicy:"retain",actionPolicy,spellcasting:"retain",actionDefinitionIds:[definitionActionId],resources:[],
              },
            }],
          }}],
        },
        {
          id:actionContentId,category:"option",
          presentation:{defaultLocale:"en",originalName:"Unknown Form Action",locales:{en:{name:"Unknown Form Action"}}},
          mechanics:[{kind:"common-play",config:{
            schemaVersion:"0.2-draft",id:actionMechanicId,
            entryPoints:[{id:"form-action",invocation:"manual",operations:[{kind:"healing.apply",amount:{value:1},target:"actor"}]}],
          }}],
        },
      ],
    }),
  };
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  const pack=payload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const before=await adapter.getSnapshot();
  const beforeEntity=before.scene.entities.find((entity)=>entity.id==="char.aelar")!;
  const base={ac:before.activeCharacter.ac,speed:before.activeCharacter.speed,hp:before.activeCharacter.hp,maxHp:before.activeCharacter.maxHp,tempHp:before.activeCharacter.tempHp,entityAc:beforeEntity.ac};
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"transform",
  });
  await adapter.resolveAction(actionId,["char.aelar"]);
  const transformed=await adapter.getSnapshot();
  const transformedEntity=transformed.scene.entities.find((entity)=>entity.id==="char.aelar")!;
  assert.equal(transformed.activeCharacter.ac,19);
  assert.equal(transformed.activeCharacter.speed,45);
  assert.equal(transformed.activeCharacter.maxHp,37);
  assert.equal(transformed.activeCharacter.hp,23);
  assert.equal(transformed.activeCharacter.tempHp,6);
  assert.equal(transformedEntity.ac,19);
  assert.equal(transformedEntity.maxHp,37);
  assert.equal(transformedEntity.hp,23);
  assert.equal(transformedEntity.tempHp,6);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,transformed.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="form"&&artifact.form?.targetActorId==="char.aelar"),true);

  await adapter.undoLastResolution();
  const restored=await adapter.getSnapshot();
  const restoredEntity=restored.scene.entities.find((entity)=>entity.id==="char.aelar")!;
  assert.deepEqual(
    {ac:restored.activeCharacter.ac,speed:restored.activeCharacter.speed,hp:restored.activeCharacter.hp,maxHp:restored.activeCharacter.maxHp,tempHp:restored.activeCharacter.tempHp,entityAc:restoredEntity.ac},
    base,
  );
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,restored.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="form"),false);
  return {ac:transformed.activeCharacter.ac,speed:transformed.activeCharacter.speed,hp:transformed.activeCharacter.hp,maxHp:transformed.activeCharacter.maxHp,tempHp:transformed.activeCharacter.tempHp};
}

async function runActionPolicy(prefix:string,actionPolicy:FormActionPolicy) {
  const adapter=new MockAdapter();
  const pack=actionPolicyPayload(prefix,actionPolicy);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const before=await adapter.getSnapshot();
  const baseActionIds=(before.scene.actionsByActor["char.aelar"]??[]).map((action)=>action.id);
  const transformActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.formContentId,pack.moduleId,"1"),mechanicId:pack.formMechanicId,entryPointId:"transform",
  });
  await adapter.resolveAction(transformActionId,["char.aelar"]);
  const transformed=await adapter.getSnapshot();
  const form= snapshotAdapterTurnRuntimeState(adapter,transformed.scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="form")?.form;
  assert.equal(form?.controllerId,"char.aelar");
  const actions=transformed.scene.actionsByActor["char.aelar"]??[];
  const projected=actions.find((action)=>parseRuntimeArtifactCommonPlayActionId(action.id)?.definitionActionId===pack.definitionActionId);
  assert.ok(projected,"form action must be projected from the external definition action id");
  if(actionPolicy==="grant") {
    assert.ok(baseActionIds.every((id)=>actions.some((action)=>action.id===id)),"grant must preserve existing actor actions");
  } else {
    assert.deepEqual(actions.map((action)=>action.id),[projected.id],"replace must expose only the form-defined action set");
  }
  await adapter.undoLastResolution();
  const restored=await adapter.getSnapshot();
  assert.deepEqual((restored.scene.actionsByActor["char.aelar"]??[]).map((action)=>action.id),baseActionIds,"Undo must restore the pre-form action set");
}

test("unknown Common Play form artifact projects replacement properties and restores them on Undo",async()=>{
  assert.deepEqual(await run("unknown-form-a"),{ac:19,speed:45,hp:23,maxHp:37,tempHp:6});
});

test("renaming every external form identity preserves projection semantics",async()=>{
  assert.deepEqual(await run("unknown-form-a-renamed"),await run("completely-renamed-form-b"));
});

test("unknown Common Play form grants source-owned actions through its controller and restores the base action set on Undo",async()=>{
  await runActionPolicy("unknown-form-grant","grant");
});

test("unknown Common Play form replaces the actor action set and restores it on Undo",async()=>{
  await runActionPolicy("unknown-form-replace","replace");
});

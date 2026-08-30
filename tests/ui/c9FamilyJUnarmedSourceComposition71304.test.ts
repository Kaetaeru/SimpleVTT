import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const TARGET_ID="combatant.goblin-a";

type Identity={
  moduleId:string;
  contentId:string;
  mechanicId:string;
  entryPoints:{damage:string;grapple:string;prone:string;push:string};
};

const ORIGINAL:Identity={
  moduleId:"homebrew.family-j-unarmed-source",
  contentId:"option.family-j-unarmed-source",
  mechanicId:"external.unknown.family-j-unarmed-source",
  entryPoints:{damage:"damage",grapple:"grapple",prone:"shove-prone",push:"shove-push"},
};
const RENAMED:Identity={
  moduleId:"homebrew.renamed-unarmed-suite",
  contentId:"option.completely-renamed-unarmed-suite",
  mechanicId:"external.renamed.unarmed-suite",
  entryPoints:{damage:"strike-alpha",grapple:"control-beta",prone:"control-gamma",push:"motion-delta"},
};

const unarmedDc={op:"add",args:[{value:8},{ref:"proficiency.bonus"},{ref:"ability.str.modifier"}]};
const failedSave={op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}};
const successfulAttack={op:"eq",left:{ref:"test.outcome"},right:{value:"success"}};
const meleeTargeting={
  from:"targets",min:1,max:1,
  where:{op:"all",args:[
    {op:"eq",left:{ref:"spatial.within-reach"},right:{value:true}},
    {op:"eq",left:{ref:"spatial.total-cover"},right:{value:false}},
  ]},
};

function packagePayload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family J portable Unarmed Strike composition probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Unarmed Suite",locales:{en:{name:"Portable Unarmed Suite"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",
        id:identity.mechanicId,
        payments:[{
          kind:"economy",bucket:"action",amount:{value:1},actionKind:"attack",attacksPerAction:2,
          consumeAt:"commit",refundOnCancel:true,
        }],
        entryPoints:[
          {
            id:identity.entryPoints.damage,invocation:"manual",targeting:meleeTargeting,
            test:{kind:"attack-roll",roller:"actor",dc:{value:1}},
            operations:[{
              kind:"damage.apply",
              amount:{op:"add",args:[{value:1},{ref:"ability.str.modifier"}]},
              damageType:"bludgeoning",target:"target",when:successfulAttack,
            }],
          },
          {
            id:identity.entryPoints.grapple,invocation:"manual",targeting:meleeTargeting,
            test:{kind:"saving-throw",roller:"target",property:{choose:"highest",from:["save.str.modifier","save.dex.modifier"]},dc:unarmedDc},
            operations:[{kind:"condition.apply",condition:"grappled",target:"target",when:failedSave}],
          },
          {
            id:identity.entryPoints.prone,invocation:"manual",targeting:meleeTargeting,
            test:{kind:"saving-throw",roller:"target",property:{choose:"highest",from:["save.str.modifier","save.dex.modifier"]},dc:unarmedDc},
            operations:[{kind:"condition.apply",condition:"prone",target:"target",when:failedSave}],
          },
          {
            id:identity.entryPoints.push,invocation:"manual",targeting:meleeTargeting,
            test:{kind:"saving-throw",roller:"target",property:{choose:"highest",from:["save.str.modifier","save.dex.modifier"]},dc:unarmedDc},
            operations:[{
              kind:"movement.relocate",mode:"push",target:"target",distance:{value:5},when:failedSave,
              destinationFact:{
                id:"unarmed-push-destination",fact:"spatial.legal-destination",subject:"target",
                authority:"actor-owner",visibility:"actor-and-dm",unknownPolicy:"request-authority",
              },
            }],
          },
        ],
      }}],
    }],
  });
}

async function install(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  setSpatialRelation(internal.scene,{
    sourceId:internal.activeCharacter.id,targetId:TARGET_ID,distanceFeet:5,visible:true,cover:"none",
    targetCanSeeAttacker:true,withinReach:true,provenance:"module:c9-family-j-unarmed-source",
  });
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,
    entryPointId,
  });
  const strengthModifier=Math.floor((internal.activeCharacter.abilities.str-10)/2);
  return {adapter,action,expectedUnarmedDamage:1+strengthModifier};
}

function targetHp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshot.scene.entities.find((entry)=>entry.id===TARGET_ID)?.hp;
}

async function exercise(identity:Identity) {
  const {adapter,action,expectedUnarmedDamage}=await install(identity);
  let snapshot=await adapter.getSnapshot();
  const hpBefore=targetHp(snapshot);

  await adapter.setQueuedD20(20);
  snapshot=await adapter.resolveAction(action(identity.entryPoints.damage),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind,"attack");
  const damageDone=hpBefore!-targetHp(snapshot)!;
  assert.equal(damageDone,expectedUnarmedDamage,"portable Unarmed damage must resolve as 1 + authoritative STR modifier");
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(targetHp(snapshot),hpBefore);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  await adapter.setQueuedD20(1);
  snapshot=await adapter.resolveAction(action(identity.entryPoints.grapple),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  let state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="grappled"),true);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="grappled"),false);

  await adapter.setQueuedD20(1);
  snapshot=await adapter.resolveAction(action(identity.entryPoints.prone),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="prone"),true);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="prone"),false);

  await adapter.setQueuedD20(1);
  snapshot=await adapter.resolveAction(action(identity.entryPoints.push),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const pushEvent=runtimeResolutionEventHistory(adapter)?.events.find((event)=>{
    const result=event.result as {movementMode?:string;distanceFeet?:number}|undefined;
    return event.targetId===TARGET_ID&&result?.movementMode==="push";
  });
  assert.ok(pushEvent,JSON.stringify(runtimeResolutionEventHistory(adapter)));
  const pushResult=pushEvent.result as {
    distanceFeet:number;
    maximumDistanceFeet:number;
    regularMovementSpent:number;
    movementMode:string;
    destinationRef:string;
  };
  assert.equal(pushResult.distanceFeet,5);
  assert.equal(pushResult.maximumDistanceFeet,5);
  assert.equal(pushResult.regularMovementSpent,0);
  assert.equal(pushResult.movementMode,"push");
  assert.match(pushResult.destinationRef,/^manual:/);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  return {damageFormula:true,grapple:true,prone:true,pushDistance:pushResult.distanceFeet};
}

test("unknown source-owned Common Play composes complete Unarmed Strike damage grapple shove-prone and shove-push semantics",async()=>{
  assert.deepEqual(await exercise(ORIGINAL),{damageFormula:true,grapple:true,prone:true,pushDistance:5});
});

test("complete Unarmed Strike source composition survives unrelated module content mechanic and entry-point identity rename",async()=>{
  assert.deepEqual(await exercise(RENAMED),{damageFormula:true,grapple:true,prone:true,pushDistance:5});
});

import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { ActionVm, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";

const OTHER_CHARACTER_ID="char.portable-interceptor-target";
const OTHER_CHARACTER_CHECK_ID="action.portable-interceptor-target.check";

type Identity={moduleId:string;contentId:string;mechanicId:string;interceptorId:string;interactionId:string;displayName:string};
const ORIGINAL:Identity={
  moduleId:"homebrew.portable-interceptor",
  contentId:"item.portable-interceptor-charm",
  mechanicId:"external.portable-interceptor",
  interceptorId:"reduce-successful-d20",
  interactionId:"choose-portable-reaction",
  displayName:"Portable Reaction Charm",
};

function packagePayload(identity=ORIGINAL){
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Portable Interceptor Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"item",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Unknown external passive Common Play interceptor"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          payments:[
            {kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"},
            {kind:"resource",resource:FIGHTER_SECOND_WIND_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
          ],
          interceptors:[{
            id:identity.interceptorId,
            timing:"d20.outcome-determined",
            interaction:{id:identity.interactionId,kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
            operation:"recalculate",
            slot:"d20.roll",
            operations:[{kind:"roll.modify",mode:"subtract-die",dice:"1d8"}],
          }],
        },
      }],
    }],
  });
}

function otherCharacterCheckAction():ActionVm{
  return {
    id:OTHER_CHARACTER_CHECK_ID,actorId:OTHER_CHARACTER_ID,name:"Portable Target Check",category:"basic",target:"none",economy:"없음",
    resolutionKind:"ability-check",summary:"Strength +0",available:true,eligibleTargetIds:[],checkBonus:0,details:[{label:"판정",value:"근력"}],
  };
}

async function prepare(identity=ORIGINAL){
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.startProductionLocalPlay("dm");
  const preview=await adapter.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter.items.push({
    id:`owned.${identity.contentId}`,
    definitionId:identity.contentId,
    name:identity.displayName,
    nameEn:identity.displayName,
    kind:"magic",quantity:1,equipped:true,passiveEffects:[],grantedActionIds:[],provenance:[identity.moduleId],
  });
  internal.scene.entities.push({
    id:OTHER_CHARACTER_ID,name:"Portable Interceptor Target",side:"ally",kind:"character",hp:20,maxHp:20,tempHp:0,ac:12,initiative:18,
    status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],
  });
  internal.scene.actionsByActor[OTHER_CHARACTER_ID]=[otherCharacterCheckAction()];
  await adapter.startInitiative();
  return adapter;
}

async function openAbilityCheckInterrupt(adapter:MockAdapter){
  await adapter.setCurrentActor(OTHER_CHARACTER_ID);
  await adapter.setQueuedD20(15);
  let snapshot=await adapter.resolveAction(OTHER_CHARACTER_CHECK_ID,[]);
  assert.equal(snapshot.resolution?.stage,"roll-animation",JSON.stringify(snapshot.resolution));
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"effect-preview",JSON.stringify(snapshot.resolution));
  const total=snapshot.resolution?.rollTotal;
  assert.equal(typeof total,"number");
  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:total!-2});
  return snapshot;
}

function secondWind(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){
  return snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current;
}

test("owned unknown installed interceptor passively opens after a successful ability check and pays atomically on accept",async()=>{
  const adapter=await prepare();
  let snapshot=await adapter.getSnapshot();
  const resourceBefore=secondWind(snapshot);
  assert.ok(resourceBefore!==undefined&&resourceBefore>0);
  const responderId=snapshot.activeCharacter.id;

  snapshot=await openAbilityCheckInterrupt(adapter);
  assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.interrupt?.responderId,responderId);
  assert.match(snapshot.resolution?.interrupt?.optionName??"",/Portable Reaction Charm/);
  assert.equal(secondWind(snapshot),resourceBefore,"preview must not spend the resource");
  assert.equal(snapshot.scene.economyByActor[responderId]?.reaction,true,"preview must not spend Reaction");

  await adapter.setQueuedD20(6);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.checkOutcome,"실패",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollTotal,9);
  assert.equal(secondWind(snapshot),resourceBefore-1);
  assert.equal(snapshot.scene.economyByActor[responderId]?.reaction,false);
  assert.ok(snapshot.resolution?.provenance.some((entry)=>entry.includes("common-play:")));
});

test("declining a portable installed interceptor spends neither Reaction nor resource",async()=>{
  const adapter=await prepare();
  let snapshot=await adapter.getSnapshot();
  const responderId=snapshot.activeCharacter.id;
  const resourceBefore=secondWind(snapshot);
  snapshot=await openAbilityCheckInterrupt(adapter);
  assert.equal(snapshot.resolution?.stage,"interrupt");
  snapshot=await adapter.respondToInterrupt(false);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.checkOutcome,"성공");
  assert.equal(secondWind(snapshot),resourceBefore);
  assert.equal(snapshot.scene.economyByActor[responderId]?.reaction,true);
});

test("portable production discovery is invariant under module/content/definition/interceptor/display rename",async()=>{
  const renamed:Identity={
    moduleId:"homebrew.completely-renamed-passive",
    contentId:"item.previously-unseen-renamed-passive",
    mechanicId:"external.previously-unseen-renamed-passive",
    interceptorId:"renamed-post-roll-interceptor",
    interactionId:"renamed-owner-choice",
    displayName:"Completely Renamed Passive",
  };
  const execute=async(identity:Identity)=>{
    const adapter=await prepare(identity);
    await openAbilityCheckInterrupt(adapter);
    await adapter.setQueuedD20(4);
    const snapshot=await adapter.respondToInterrupt(true);
    return {
      outcome:snapshot.resolution?.checkOutcome,
      total:snapshot.resolution?.rollTotal,
      resource:secondWind(snapshot),
      reaction:snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.reaction,
    };
  };
  assert.deepEqual(await execute(renamed),await execute(ORIGINAL));
});

test("portable installed d20 interceptor can turn a successful production attack into a miss",async()=>{
  const adapter=await prepare();
  let snapshot=await adapter.setCurrentActor("combatant.goblin-a");
  const responderId=snapshot.activeCharacter.id;
  const resourceBefore=secondWind(snapshot);
  const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===responderId)?.hp;
  await adapter.setQueuedD20(18);
  snapshot=await adapter.resolveAction("action.scimitar",[responderId]);
  for(let step=0;step<4&&snapshot.resolution?.stage!=="interrupt";step++)snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
  await adapter.setQueuedD20(8);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감",JSON.stringify(snapshot.resolution));
  while(snapshot.resolution?.stage!=="complete")snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===responderId)?.hp,hpBefore);
  assert.equal(secondWind(snapshot),resourceBefore!-1);
  assert.equal(snapshot.scene.economyByActor[responderId]?.reaction,false);
});

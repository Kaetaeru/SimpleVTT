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

const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.mechanic`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Portable attack replacement probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable attack options",locales:{en:{name:"Portable attack options"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true,actionKind:"attack",attacksPerAction:2}],
          entryPoints:[
            {id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:1}},operations:[{kind:"damage.apply",amount:{value:1},damageType:"bludgeoning",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]},
            {id:"control",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"saving-throw",roller:"target",property:"save.str.modifier",dc:{value:20}},operations:[{kind:"condition.apply",condition:"grappled",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}}]},
          ],
        }}],
      }],
    }),
  };
}

async function exercise(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId});
  const strike=action("strike");
  const control=action("control");
  const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===TARGET_ID)!.hp;

  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(strike,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===TARGET_ID)?.hp,hpBefore-1);
  let state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.action,false);
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1);

  let projected=await projectCommonPlayRuntimeArtifactAction(adapter,control,actorId,snapshot,state);
  assert.equal(projected?.resolutionKind,"saving-throw");
  assert.equal(projected?.available,true,"an attack-option control action must be able to replace the remaining attack");

  await adapter.setQueuedD20(1);
  snapshot=await adapter.resolveAction(control,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete");
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,0);
  assert.equal(state.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="grappled"),true);

  projected=await projectCommonPlayRuntimeArtifactAction(adapter,strike,actorId,snapshot,state);
  assert.equal(projected?.available,false,"no third attack option remains after the replacement consumes the grant");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="grappled"),false);
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1);
  projected=await projectCommonPlayRuntimeArtifactAction(adapter,control,actorId,snapshot,state);
  assert.equal(projected?.available,true,"Undo must restore the replaceable attack slot");
}

test("unknown installed Common Play can replace one attack with a structural control option and Undo it",async()=>{
  await exercise("external-family-j-replacement");
});

test("complete external identity rename preserves replace-one-attack semantics",async()=>{
  await exercise("renamed-family-j-replacement");
});

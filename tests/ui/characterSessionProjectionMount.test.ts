import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionContracts";
import "../../src/app/connectedProjectionLifecycleAdapter";
import type { CatalogEntry, CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import {
  activateProjectedCharacterResolutionContext,
  mountReconstructedCharacterSessionProjection,
  restoreProjectionResolutionContext,
  unmountReconstructedCharacterSessionProjection,
} from "../../src/app/characterSessionProjectionMount";
import { projectedCharacterForPeer } from "../../src/app/characterSessionProjectionRegistry";

const SOURCE_ID="dnd.srd-5.2.1";
const VERSION="2024";

function entry(contentId:string,category:CatalogEntry["category"],nameKo:string,nameEn:string):CatalogEntry & {contentId:string;sourceId:string} {
  return {
    id:catalogQualifiedId(contentId,SOURCE_ID,VERSION),contentId,sourceId:SOURCE_ID,category,nameKo,nameEn,
    scope:"builtin",source:"SRD 5.2.1",version:VERSION,description:"test",relationships:[],capabilities:[],
  };
}

const catalog:CatalogEntry[]=[
  entry("dnd.srd521.class.fighter","class","파이터","Fighter"),
  entry("dnd.srd521.species.human","species","인간","Human"),
  entry("dnd.srd521.background.soldier","background","군인","Soldier"),
];

function projectedSheet():CharacterSheet {
  return {
    id:"char.phase13.remote",name:"Remote Unknown",className:"파이터",level:1,species:"인간",background:"군인",
    hp:7,maxHp:12,tempHp:0,ac:99,speed:999,proficiencyBonus:99,saveState:"saved",
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],
    equipment:[],items:[],resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:3,runtimeRevision:4,
    classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
  };
}

test("host mounts unknown Character only into ephemeral Scene/action/economy projection", async () => {
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const projection=buildCharacterSessionProjectionV1(projectedSheet(),catalog);
  const reconstruction=reconstructCharacterSessionProjectionV1(projection,catalog);
  assert.equal(reconstruction.status,"accepted");

  const mounted=mountReconstructedCharacterSessionProjection(adapter,"peer.remote",reconstruction);
  assert.equal(mounted.status,"accepted");
  const after=await adapter.getSnapshot();
  assert.deepEqual(after.characters,before.characters);
  assert.equal(after.activeCharacter.id,before.activeCharacter.id);
  assert.ok(after.scene.entities.some((entity)=>entity.id==="char.phase13.remote"));
  assert.ok(after.scene.actionsByActor["char.phase13.remote"]?.some((action)=>action.id==="action.second-wind"));
  assert.equal(after.scene.economyByActor["char.phase13.remote"]?.movementMax,30);
  assert.equal(projectedCharacterForPeer(adapter,"peer.remote")?.characterId,"char.phase13.remote");
});

test("projected resolution context is explicit and restores the host local Character", async () => {
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const reconstruction=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(projectedSheet(),catalog),catalog);
  assert.equal(mountReconstructedCharacterSessionProjection(adapter,"peer.remote",reconstruction).status,"accepted");

  const activated=activateProjectedCharacterResolutionContext(adapter,"peer.remote");
  assert.equal(activated.status,"accepted");
  if (activated.status!=="accepted") return;
  const during=await adapter.getSnapshot();
  assert.equal(during.activeCharacter.id,"char.phase13.remote");
  assert.equal(during.scene.selectedActorId,"char.phase13.remote");

  restoreProjectionResolutionContext(adapter,activated.context);
  const restored=await adapter.getSnapshot();
  assert.equal(restored.activeCharacter.id,before.activeCharacter.id);
  assert.equal(restored.scene.selectedActorId,before.scene.selectedActorId);
  assert.deepEqual(restored.characters,before.characters);
});

test("unmount removes only the ephemeral Scene projection", async () => {
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const reconstruction=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(projectedSheet(),catalog),catalog);
  assert.equal(mountReconstructedCharacterSessionProjection(adapter,"peer.remote",reconstruction).status,"accepted");
  assert.equal(unmountReconstructedCharacterSessionProjection(adapter,"peer.remote"),true);
  const after=await adapter.getSnapshot();
  assert.deepEqual(after.characters,before.characters);
  assert.equal(after.scene.entities.some((entity)=>entity.id==="char.phase13.remote"),false);
  assert.equal(after.scene.actionsByActor["char.phase13.remote"],undefined);
  assert.equal(after.scene.economyByActor["char.phase13.remote"],undefined);
  assert.equal(projectedCharacterForPeer(adapter,"peer.remote"),undefined);
});

test("starting a new host session clears prior ephemeral projections but leaves permanent Characters untouched", async () => {
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const reconstruction=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(projectedSheet(),catalog),catalog);
  assert.equal(mountReconstructedCharacterSessionProjection(adapter,"peer.remote",reconstruction).status,"accepted");
  assert.ok((await adapter.getSnapshot()).scene.entities.some((entity)=>entity.id==="char.phase13.remote"));

  const afterHostAttempt=await adapter.hostSession();
  assert.deepEqual(afterHostAttempt.characters,before.characters);
  assert.equal(afterHostAttempt.scene.entities.some((entity)=>entity.id==="char.phase13.remote"),false);
  assert.equal(afterHostAttempt.scene.actionsByActor["char.phase13.remote"],undefined);
  assert.equal(afterHostAttempt.scene.economyByActor["char.phase13.remote"],undefined);
  assert.equal(projectedCharacterForPeer(adapter,"peer.remote"),undefined);
});

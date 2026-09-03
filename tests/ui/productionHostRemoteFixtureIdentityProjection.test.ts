import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionContracts";
import "../../src/app/productionSessionEmptyEncounterAdapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { connectedInternal } from "../../src/app/connectedSessionRuntimeAdapter";
import type { SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";

function remoteFixtureIdentity():CharacterSheet {
  return {
    id:"char.aelar",name:"일한타르",className:"파이터",level:1,species:"인간",background:"군인",
    hp:8,maxHp:12,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],equipment:[],items:[],
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:4,runtimeRevision:6,
    classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
  };
}

test("production Host keeps a connected remote actor even when its ID matches a removable reference fixture", async () => {
  const adapter=new MockAdapter();
  const productionSnapshot=await adapter.getSnapshot();
  const sheet=remoteFixtureIdentity();
  const manifest:SessionCompatibilityManifest={
    protocolVersion:1,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
    character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0},
  };
  const projection=buildCharacterSessionProjectionV1(sheet,productionSnapshot.catalog);

  const accepted=acceptHostCharacterSessionProjection(adapter,"peer.ilhantar",manifest,projection);
  assert.deepEqual(accepted,{status:"accepted",mode:"mounted",characterId:"char.aelar"});

  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.name,"일한타르");
  assert.ok(snapshot.scene.actionsByActor["char.aelar"]?.length);
  assert.ok(snapshot.scene.economyByActor["char.aelar"]);
});

test("production Client removes local reference enemies but keeps its own Character actor", async () => {
  const adapter=new MockAdapter();
  const app=connectedInternal(adapter);
  app.session.role="client";

  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===snapshot.activeCharacter.id)?.name,snapshot.activeCharacter.name);
  for (const staleId of ["char.mira","combatant.goblin-a","combatant.goblin-b","combatant.wolf","combatant.training-guardian"]) {
    assert.equal(snapshot.scene.entities.some((entity)=>entity.id===staleId),false,`${staleId} must not leak into a connected Client Scene`);
    assert.equal(snapshot.scene.actionsByActor[staleId],undefined);
    assert.equal(snapshot.scene.economyByActor[staleId],undefined);
  }
});
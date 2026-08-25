import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
import { deriveProductionCharacterActions } from "../../src/app/productionPlayRuntimeAdapter";

test("connected Host and owning Client derive an identical production action catalog for a created weapon Character",async()=>{
  const snapshot=await new MockAdapter().getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  const fighter=snapshot.catalog.find((entry)=>entry.category==="class"&&/fighter/i.test(`${entry.id} ${entry.nameEn}`));
  const human=snapshot.catalog.find((entry)=>entry.category==="species"&&/human/i.test(`${entry.id} ${entry.nameEn}`));
  const soldier=snapshot.catalog.find((entry)=>entry.category==="background"&&/soldier/i.test(`${entry.id} ${entry.nameEn}`));
  assert.ok(fighter&&human&&soldier);
  sheet.id="char.connected-action-parity";
  sheet.name="Connected Weapon Character";
  sheet.className=fighter.nameKo;
  sheet.subclassName=undefined;
  sheet.species=human.nameKo;
  sheet.background=soldier.nameKo;
  sheet.classLevels=[{classId:(fighter as typeof fighter&{contentId:string}).contentId,level:sheet.level}];
  sheet.items=sheet.items.filter((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword");
  sheet.equipment=sheet.items.map((item)=>item.name);
  sheet.attacks=materializeCreatedWeaponAttacks(sheet);
  sheet.sourceRevision=3;
  sheet.runtimeRevision=4;

  const reconstructed=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(sheet,snapshot.catalog),snapshot.catalog);
  if(reconstructed.status!=="accepted")throw new Error(reconstructed.error);

  const clientActions=deriveProductionCharacterActions(sheet);
  const hostActions=deriveProductionCharacterActions(reconstructed.sheet);
  const executableFingerprint=(actions:typeof clientActions)=>actions.map((action)=>({
    id:action.id,name:action.name,category:action.category,target:action.target,economy:action.economy,
    resolutionKind:action.resolutionKind,summary:action.summary,attackBonus:action.attackBonus,checkBonus:action.checkBonus,
    saveDc:action.saveDc,saveAbility:action.saveAbility,damage:action.damage,healing:action.healing,
    resourceCost:action.resourceCost,itemCost:action.itemCost,
  }));
  assert.deepEqual(executableFingerprint(hostActions),executableFingerprint(clientActions));
  assert.ok(hostActions.some((action)=>action.resolutionKind==="attack"&&action.name==="롱소드"));
  assert.ok(hostActions.some((action)=>action.id==="action.standard.ready"));
  assert.equal(hostActions.filter((action)=>action.id.startsWith("action.skill.")).length,18);
});

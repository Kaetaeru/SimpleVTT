import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/srdMonsterTimingRuntimeAdapter";
import "../../src/app/encounterGroupRuntimeAdapter";
import "../../src/app/productionCombatantPreparationAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { srdMonsterById } from "../../src/app/srdMonsterCatalog";

type Internal={ queuedInitiativeD20?:number|null; session:{ lifecycle:string }; scene:{ currentActorId:string; entities:Array<{ id:string; name:string; initiative:number; hp:number; groupId?:string }>; groups?:Record<string,{ id:string; label:string; memberIds:string[]; initiative:number }> } };
const GOBLIN="dnd.srd521.monster.goblin-warrior";

test("T1-04: a group of identical monsters shares one initiative roll and folds under one label", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=12;
  const snapshot=await adapter.instantiateCombatantGroup(GOBLIN,3);
  const goblins=snapshot.scene.entities.filter((entity)=>entity.id.startsWith(`${GOBLIN}.instance-`));
  assert.equal(goblins.length,3);
  const bonus=srdMonsterById(GOBLIN)!.initiativeBonus;
  assert.deepEqual(goblins.map((entity)=>entity.initiative),[12+bonus,12+bonus,12+bonus]);
  const groupId=goblins[0].groupId!;
  assert.ok(groupId,"members carry the group id");
  assert.ok(goblins.every((entity)=>entity.groupId===groupId));
  const group=snapshot.scene.groups?.[groupId];
  assert.ok(group);
  assert.equal(group.label,"고블린 전사 ×3");
  assert.deepEqual(group.memberIds,goblins.map((entity)=>entity.id));
  assert.equal(group.initiative,12+bonus);
  assert.equal(snapshot.activity[0]?.title,"한 무리 추가");
});

test("T1-04: group members act consecutively in the initiative order", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=19; // above every default-scene combatant, below nothing else
  await adapter.instantiateCombatantGroup(GOBLIN,3);
  await adapter.setReferenceRole("dm");
  let snapshot=await adapter.startInitiative();
  const order:string[]=[];
  for (let step=0; step<12; step+=1) {
    order.push(snapshot.scene.currentActorId);
    snapshot=await adapter.endTurn();
  }
  const positions=order.map((id,index)=>[id,index] as const).filter(([id])=>id.startsWith(`${GOBLIN}.instance-`)).map(([,index])=>index);
  assert.equal(positions.length>=3,true,"all three goblins took a turn within twelve turns");
  const firstThree=positions.slice(0,3);
  assert.equal(firstThree[2]-firstThree[0],2,`goblins act back to back (turn indexes ${firstThree.join(",")})`);
});

test("T1-04: groups follow their members — removal shrinks them and a lone member ungroups", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=10;
  let snapshot=await adapter.instantiateCombatantGroup(GOBLIN,3);
  const goblins=snapshot.scene.entities.filter((entity)=>entity.id.startsWith(`${GOBLIN}.instance-`));
  const groupId=goblins[0].groupId!;
  internal.session.lifecycle="preparing"; // removal is allowed while preparing or in live freeform
  snapshot=await adapter.removeCombatant(goblins[0].id);
  assert.notEqual(snapshot.session.compatibility,"warning",snapshot.session.compatibilityMessage);
  assert.deepEqual(snapshot.scene.groups?.[groupId]?.memberIds,[goblins[1].id,goblins[2].id]);
  snapshot=await adapter.removeCombatant(goblins[1].id);
  assert.equal(snapshot.scene.groups?.[groupId],undefined,"a single survivor is no longer a group");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===goblins[2].id)?.groupId,undefined);

  // DM groups two existing combatants by hand, then ungroups.
  snapshot=await adapter.groupCombatants(["combatant.goblin-a","combatant.goblin-b"],"고블린 정찰조");
  const manual=Object.values(snapshot.scene.groups ?? {}).find((group)=>group.label==="고블린 정찰조");
  assert.ok(manual);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-b")?.initiative,snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.initiative);
  snapshot=await adapter.ungroupCombatants(manual.id);
  assert.equal(snapshot.scene.groups?.[manual.id],undefined);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.groupId,undefined);
});

test("T1-04: a count of one adds a plain combatant without a group", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.instantiateCombatantGroup(GOBLIN,1);
  assert.equal(snapshot.scene.entities.filter((entity)=>entity.id.startsWith(`${GOBLIN}.instance-`)).length,1);
  assert.equal(snapshot.scene.groups,undefined);
});

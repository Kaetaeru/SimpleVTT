import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { commandWasNoOp, makeRefusal, refusalMessageFor, targetRefusalFor } from "../../src/app/sessionRefusal";

async function adapterWithAelarTurn() {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return adapter;
}

test("S1-01: an unknown action is refused on the snapshot instead of returning silently", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.resolveAction("action.does-not-exist",[]);
  assert.equal(snapshot.resolution,null);
  assert.equal(snapshot.refusal?.code,"action-unknown");
  assert.equal(snapshot.refusal?.actionId,"action.does-not-exist");
  assert.match(snapshot.refusal?.message??"",/알 수 없는 행동/);
});

test("S1-01: acting off-turn as a player is refused with the projected reason", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("combatant.goblin-a");
  const snapshot=await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  assert.equal(snapshot.resolution,null);
  assert.equal(snapshot.refusal?.code,"action-unavailable");
  assert.equal(snapshot.refusal?.message,"현재 Actor의 턴이 아닙니다.");
  assert.equal(snapshot.refusal?.actorId,"char.aelar");
});

test("S1-01: an ineligible target and too many targets are refused by name; a committed action clears the refusal", async () => {
  const adapter=await adapterWithAelarTurn();
  const ally=await adapter.resolveAction("action.longsword",["char.mira"]);
  assert.equal(ally.refusal?.code,"target-ineligible");
  const crowd=await adapter.resolveAction("action.longsword",["combatant.goblin-a","combatant.goblin-b"]);
  assert.equal(crowd.refusal?.code,"too-many-targets");
  assert.match(crowd.refusal?.message??"",/최대 1명/);
  const committed=await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  assert.ok(committed.resolution,"the attack resolves");
  assert.equal(committed.refusal,null,"a committed action leaves no refusal behind");
});

test("S1-01/M8: a creature at 0 HP cannot act — a character may only roll a death save, and the reason says so", async () => {
  const adapter=await adapterWithAelarTurn();
  const scene=(adapter as unknown as {scene:{entities:{id:string;hp:number}[]}}).scene;
  scene.entities.find((entity)=>entity.id==="char.aelar")!.hp=0;
  const downed=await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  assert.equal(downed.resolution,null);
  assert.equal(downed.refusal?.code,"action-unavailable");
  assert.equal(downed.refusal?.message,"의식불명 · 죽음 내성 굴림만 할 수 있습니다.");
  const projected=(downed.scene.actionsByActor["char.aelar"]??[]).find((action)=>action.id==="action.longsword");
  assert.equal(projected?.available,false,"the projection shows the tile unavailable before anyone clicks");
  assert.equal(projected?.disabledReason,"의식불명 · 죽음 내성 굴림만 할 수 있습니다.");
  await adapter.setCurrentActor("combatant.goblin-a");
  scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp=0;
  const goblinAction=(await adapter.getSnapshot()).scene.actionsByActor["combatant.goblin-a"]?.[0];
  assert.ok(goblinAction);
  const dead=await adapter.resolveAction(goblinAction.id,["char.aelar"]);
  assert.equal(dead.refusal?.message,"쓰러진 상태라 행동할 수 없습니다.");
});

test("S1-03/M2: the Host refuses targets the projection did not offer, and more targets than the action allows", () => {
  const greatsword={eligibleTargetIds:["zombie.1","zombie.2"],target:"enemy"};
  assert.equal(targetRefusalFor(greatsword,["zombie.1"]),null);
  assert.deepEqual(targetRefusalFor(greatsword,["char.sera"]),{code:"target-ineligible",message:"그 대상에게는 사용할 수 없습니다."});
  assert.deepEqual(targetRefusalFor(greatsword,["zombie.1","zombie.2"]),{code:"too-many-targets",message:"대상은 최대 1명입니다."});
  assert.equal(targetRefusalFor({eligibleTargetIds:["a","b","c"],target:"multi-enemy",maxTargets:2},["a","b"]),null);
  assert.deepEqual(targetRefusalFor({eligibleTargetIds:["a","b","c"],target:"multi-enemy",maxTargets:2},["a","b","c"]),{code:"too-many-targets",message:"대상은 최대 2명입니다."});
  assert.equal(targetRefusalFor({eligibleTargetIds:[],target:"any"},["anyone"]),null,"unprojected eligibility is left to the resolution path");
  assert.equal(targetRefusalFor(undefined,["x"]),null);
});

test("S1-01: refusal ids only grow, so a notice can key on them", () => {
  const first=makeRefusal("x","a");const second=makeRefusal("x","a");
  assert.ok(second.id>first.id);
  assert.equal(first.origin,"local");
  assert.equal(makeRefusal("x","a",{origin:"host"}).origin,"host");
});

test("S1-01: Host wire error codes read in the rules' words; a Korean Host reason passes through, an English one does not", () => {
  assert.equal(refusalMessageFor("action-rejected"),"호스트가 행동을 거부했습니다.");
  assert.equal(refusalMessageFor("action-rejected","행동을 이미 사용했습니다."),"행동을 이미 사용했습니다.");
  assert.equal(refusalMessageFor("action-rejected","host production resolution path rejected the requested actor/action/targets"),"호스트가 행동을 거부했습니다.");
  assert.equal(refusalMessageFor("some-new-code"),"요청이 거부되었습니다.");
  assert.equal(refusalMessageFor("action-off-turn"),"현재 Actor의 턴이 아닙니다.");
  assert.equal(refusalMessageFor("action-disabled","추가 행동을 이미 사용했습니다."),"추가 행동을 이미 사용했습니다.");
});

test("S1-01: the provider's catch-all recognises a command that left nothing behind", () => {
  const base={resolution:null,activity:[{id:"evt.1"}],refusal:null,scene:{economyByActor:{a:{action:true}},entities:[{id:"a",hp:5}]}};
  assert.equal(commandWasNoOp(base,{...base}),true);
  assert.equal(commandWasNoOp(base,{...base,resolution:{id:"res.1"}}),false,"a new resolution is a commit");
  assert.equal(commandWasNoOp(base,{...base,activity:[{id:"evt.2"},{id:"evt.1"}]}),false,"a new activity entry is a commit");
  assert.equal(commandWasNoOp(base,{...base,refusal:makeRefusal("x","y")}),false,"an explicit refusal is not a silent no-op");
  assert.equal(commandWasNoOp(base,{...base,scene:{economyByActor:{a:{action:false}},entities:base.scene.entities}}),false,"spent economy is a commit");
  assert.equal(commandWasNoOp(base,{...base,scene:{economyByActor:base.scene.economyByActor,entities:[{id:"a",hp:2}]}}),false,"an HP change is a commit");
});

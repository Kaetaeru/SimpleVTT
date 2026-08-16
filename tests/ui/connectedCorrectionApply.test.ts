import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyConnectedCorrections } from "../../src/app/connectedCorrectionApply";

 test("connected correction atomically applies HP, status, and Character resource changes", async () => {
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const target=before.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
  const resource=before.activeCharacter.resources[0];
  assert.ok(target);
  assert.ok(resource);

  const applied=applyConnectedCorrections(before.scene,before.activeCharacter.resources,[
    {kind:"hp",targetId:target.id,before:target.hp,after:Math.max(0,target.hp-1)},
    {kind:"status",targetId:target.id,before:[...target.status],after:[...target.status,"넘어짐"]},
    {kind:"resource",targetId:before.activeCharacter.id,resourceId:resource.id,before:resource.current,after:Math.max(0,resource.current-1)},
  ]);
  assert.equal(applied.status,"committed");
  if (applied.status!=="committed") return;
  assert.equal(applied.scene.entities.find((entry)=>entry.id===target.id)?.hp,Math.max(0,target.hp-1));
  assert.ok(applied.scene.entities.find((entry)=>entry.id===target.id)?.status.includes("넘어짐"));
  assert.equal(applied.resources.find((entry)=>entry.id===resource.id)?.current,Math.max(0,resource.current-1));
  assert.equal(before.scene.entities.find((entry)=>entry.id===target.id)?.hp,target.hp,"source snapshot must remain untouched");
});

test("connected correction rejects drift before mutating any field", async () => {
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const target=before.scene.entities.find((entry)=>entry.id==="combatant.goblin-a");
  assert.ok(target);
  const rejected=applyConnectedCorrections(before.scene,before.activeCharacter.resources,[
    {kind:"hp",targetId:target.id,before:target.hp,after:Math.max(0,target.hp-1)},
    {kind:"status",targetId:target.id,before:["state-that-is-not-current"],after:["넘어짐"]},
  ]);
  assert.equal(rejected.status,"rejected");
  assert.equal(before.scene.entities.find((entry)=>entry.id===target.id)?.hp,target.hp);
});

import test from "node:test";
import assert from "node:assert/strict";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";

test("DM grants catalog items idempotently and can revoke them from a session character",async()=>{
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const potion=before.catalog.find((entry)=>entry.category==="item"&&/치유 물약|potion of healing/i.test(`${entry.nameKo} ${entry.nameEn}`))
    ?? before.catalog.find((entry)=>entry.category==="item");
  assert.ok(potion,"an active catalog item is required");

  const command={requestId:"give-once",actorId:"char.aelar",operation:"grant-item" as const,catalogEntryId:potion.id,quantity:2};
  await adapter.adjustDmInventory(command);
  await adapter.adjustDmInventory(command);
  let snapshot=await adapter.getSnapshot();
  const granted=snapshot.sessionCharacterInventories?.["char.aelar"].items.find((item)=>/치유 물약|potion of healing/i.test(`${item.name} ${item.nameEn}`));
  const originalQuantity=before.sessionCharacterInventories?.["char.aelar"].items.find((item)=>/치유 물약|potion of healing/i.test(`${item.name} ${item.nameEn}`))?.quantity??0;
  assert.equal(granted?.quantity,originalQuantity+2,"a repeated requestId must not duplicate the grant");

  await adapter.adjustDmInventory({requestId:"take-one",actorId:"char.aelar",operation:"revoke-item",itemId:granted!.id,quantity:1});
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.sessionCharacterInventories?.["char.aelar"].items.find((item)=>item.id===granted!.id)?.quantity,originalQuantity+1);
});

test("DM currency adjustment rejects overdraft and undo restores the previous wallet",async()=>{
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const initial=before.sessionCharacterInventories?.["char.aelar"].goldGp??0;
  await adapter.adjustDmInventory({requestId:"gold-grant",actorId:"char.aelar",operation:"grant-currency",amount:25});
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.sessionCharacterInventories?.["char.aelar"].goldGp,initial+25);

  await adapter.undoLastDmInventoryAdjustment();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.sessionCharacterInventories?.["char.aelar"].goldGp,initial);
  await assert.rejects(()=>adapter.adjustDmInventory({requestId:"gold-overdraft",actorId:"char.aelar",operation:"revoke-currency",amount:initial+1}),/보유 GP/);
});

test("equipped items require explicit forceUnequip before DM revocation",async()=>{
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const dagger=before.sessionCharacterInventories?.["char.aelar"].items.find((item)=>item.equipped&&item.quantity===1);
  assert.ok(dagger?.equipped);
  await assert.rejects(()=>adapter.adjustDmInventory({requestId:"take-equipped-blocked",actorId:"char.aelar",operation:"revoke-item",itemId:dagger.id,quantity:1}),/해제 후 회수/);
  await adapter.adjustDmInventory({requestId:"take-equipped",actorId:"char.aelar",operation:"revoke-item",itemId:dagger.id,quantity:1,forceUnequip:true});
  const after=await adapter.getSnapshot();
  assert.equal(after.sessionCharacterInventories?.["char.aelar"].items.some((item)=>item.id===dagger.id),false);
});

test("catalog-less custom item templates can be restored from the party stash",async()=>{
  const adapter=new MockAdapter();
  await adapter.adjustDmInventory({requestId:"custom-template",actorId:"char.aelar",operation:"grant-item-template",quantity:1,itemTemplate:{definitionId:"local.item.no-catalog",name:"별빛 부적",nameEn:"Starlight Charm",kind:"magic",attunementRequired:true,passiveEffects:["빛"],grantedActionIds:[],provenance:["Custom library"]}});
  const snapshot=await adapter.getSnapshot();
  const item=snapshot.sessionCharacterInventories?.["char.aelar"].items.find((candidate)=>candidate.definitionId==="local.item.no-catalog");
  assert.equal(item?.name,"별빛 부적");
  assert.equal(item?.attunementRequired,true);
  assert.equal(item?.equipped,false);
});

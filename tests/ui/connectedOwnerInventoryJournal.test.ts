import assert from "node:assert/strict";
import test from "node:test";
import { MemoryConnectedOwnerInventoryJournalStore } from "../../src/app/connectedOwnerInventoryJournalStore";

const before={characterId:"char.remote",characterName:"Remote",revision:4,goldGp:10,items:[]};
const after={...before,revision:5,goldGp:15};

test("owner inventory journal survives apply/undo/finalize as idempotent phases",async()=>{
  const store=new MemoryConnectedOwnerInventoryJournalStore();
  const prepared=await store.prepare({requestId:"tx.1",actorId:"char.remote",command:{requestId:"tx.1",actorId:"char.remote",operation:"grant-currency",amount:5},before});
  assert.equal(prepared.phase,"prepared");
  assert.equal((await store.prepare({requestId:"tx.1",actorId:"char.remote",command:{requestId:"tx.1",actorId:"char.remote",operation:"grant-currency",amount:5},before})).phase,"prepared");
  assert.equal((await store.markApplied("tx.1",after)).phase,"applied");
  const undoTarget={...before,revision:6};
  assert.equal((await store.beginUndo("tx.1",after,undoTarget)).phase,"undoing");
  assert.equal((await store.markUndone("tx.1")).phase,"undone");
  const finalized=await store.finalize("tx.1","undone");
  assert.equal(finalized.phase,"finalized");
  assert.equal(finalized.finalOutcome,"undone");
  assert.equal((await store.finalize("tx.1","undone")).phase,"finalized");
});

test("owner inventory journal rejects identity drift and opposite final outcome",async()=>{
  const store=new MemoryConnectedOwnerInventoryJournalStore();
  await store.prepare({requestId:"tx.2",actorId:"char.remote",command:{requestId:"tx.2",actorId:"char.remote",operation:"grant-currency",amount:5},before});
  await assert.rejects(()=>store.prepare({requestId:"tx.2",actorId:"char.remote",command:{requestId:"tx.2",actorId:"char.remote",operation:"grant-currency",amount:6},before}),/different journal/);
  await store.markApplied("tx.2",after);
  await store.finalize("tx.2","applied");
  await assert.rejects(()=>store.finalize("tx.2","undone"),/different outcome|does not match/);
});

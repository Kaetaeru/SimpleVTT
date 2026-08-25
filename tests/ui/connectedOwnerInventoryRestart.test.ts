import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedCampaignSystemsRuntimeAdapter";
import "../../src/app/connectedOwnerInventoryJournalAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { setCharacterLibraryStoreForTests, mutateActiveCharacterDurably } from "../../src/app/characterLibraryRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MemoryConnectedOwnerInventoryJournalStore } from "../../src/app/connectedOwnerInventoryJournalStore";
import { setConnectedOwnerInventoryJournalStoreForTests } from "../../src/app/connectedOwnerInventoryJournalAdapter";

async function restarted(characterStore:MemoryCharacterLibraryStore,journal:MemoryConnectedOwnerInventoryJournalStore){
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setConnectedOwnerInventoryJournalStoreForTests(adapter,journal);
  connectedStateFor(adapter).mode="client";
  const snapshot=await adapter.getSnapshot();
  return {adapter,snapshot};
}

function activeInventory(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){
  return snapshot.sessionCharacterInventories?.[snapshot.activeCharacter.id]!;
}

test("prepared journal reconciles an apply committed before a lost acknowledgement without double application",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const journal=new MemoryConnectedOwnerInventoryJournalStore();
  const first=await restarted(characterStore,journal);
  const before=activeInventory(first.snapshot);
  const command={requestId:"restart.apply",actorId:before.characterId,operation:"grant-currency" as const,amount:5};
  await journal.prepare({requestId:command.requestId,actorId:command.actorId,command,before});
  await mutateActiveCharacterDurably(first.adapter,(character)=>{character.goldGp=(character.goldGp??0)+5;});

  const second=await restarted(characterStore,journal);
  assert.equal(activeInventory(second.snapshot).goldGp,before.goldGp+5);
  const replayed=await second.adapter.adjustDmInventory(command);
  assert.equal(activeInventory(replayed).goldGp,before.goldGp+5,"apply replay must not add currency twice");
  assert.equal((await journal.read(command.requestId))?.phase,"applied");
});

test("three concurrent deliveries of one owner currency request mutate the durable Character exactly once",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const journal=new MemoryConnectedOwnerInventoryJournalStore();
  const current=await restarted(characterStore,journal);
  const before=activeInventory(current.snapshot);
  const command={requestId:"concurrent.owner-currency",actorId:before.characterId,operation:"grant-currency" as const,amount:10};

  const results=await Promise.all([
    current.adapter.adjustDmInventory(command),
    current.adapter.adjustDmInventory({...command}),
    current.adapter.adjustDmInventory({...command}),
  ]);

  assert.equal(activeInventory(results[0]).goldGp,before.goldGp+10);
  assert.equal(activeInventory(await current.adapter.getSnapshot()).goldGp,before.goldGp+10,"concurrent duplicate delivery must not apply 30 GP");
  assert.equal((await journal.read(command.requestId))?.phase,"applied");
});

test("durable owner inventory retry compares semantic command identity independent of persisted object key order",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const journal=new MemoryConnectedOwnerInventoryJournalStore();
  const first=await restarted(characterStore,journal);
  const before=activeInventory(first.snapshot);
  const persistedCommand={amount:5,operation:"grant-currency" as const,actorId:before.characterId,requestId:"restart.reordered"};
  await journal.prepare({requestId:persistedCommand.requestId,actorId:persistedCommand.actorId,command:persistedCommand,before});

  const replayCommand={requestId:"restart.reordered",actorId:before.characterId,operation:"grant-currency" as const,amount:5};
  const replayed=await first.adapter.adjustDmInventory(replayCommand);
  assert.equal(activeInventory(replayed).goldGp,before.goldGp+5);
  assert.equal((await journal.read(replayCommand.requestId))?.phase,"applied");
});

test("prepared journal reconciles semantically identical inventory independent of persisted item key order",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const journal=new MemoryConnectedOwnerInventoryJournalStore();
  const first=await restarted(characterStore,journal);
  const current=activeInventory(first.snapshot);
  const canonical=(value:unknown):unknown=>Array.isArray(value)
    ? value.map(canonical)
    : value&&typeof value==="object"
      ? Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([left],[right])=>left.localeCompare(right)).map(([key,item])=>[key,canonical(item)]))
      : value;
  const persistedBefore=JSON.parse(JSON.stringify(canonical(current))) as typeof current;
  const command={requestId:"restart.inventory-reordered",actorId:current.characterId,operation:"grant-currency" as const,amount:5};
  await journal.prepare({requestId:command.requestId,actorId:command.actorId,command,before:persistedBefore});

  const applied=await first.adapter.adjustDmInventory(command);
  assert.equal(activeInventory(applied).goldGp,current.goldGp+5);
  assert.equal((await journal.read(command.requestId))?.phase,"applied");
});

test("restarted owner can compensate an applied transaction with no in-memory undo record",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const journal=new MemoryConnectedOwnerInventoryJournalStore();
  const first=await restarted(characterStore,journal);
  const before=activeInventory(first.snapshot);
  const command={requestId:"restart.undo",actorId:before.characterId,operation:"grant-currency" as const,amount:7};
  await journal.prepare({requestId:command.requestId,actorId:command.actorId,command,before});
  await mutateActiveCharacterDurably(first.adapter,(character)=>{character.goldGp=(character.goldGp??0)+7;});
  const appliedSnapshot=await first.adapter.getSnapshot();
  await journal.markApplied(command.requestId,activeInventory(appliedSnapshot));

  const second=await restarted(characterStore,journal);
  const undone=await second.adapter.undoDmInventoryAdjustment(command.requestId);
  assert.equal(activeInventory(undone).goldGp,before.goldGp);
  assert.equal((await journal.read(command.requestId))?.phase,"undone");

  const third=await restarted(characterStore,journal);
  const duplicate=await third.adapter.undoDmInventoryAdjustment(command.requestId);
  assert.equal(activeInventory(duplicate).goldGp,before.goldGp,"duplicate restart undo must be idempotent");
});

test("undoing journal recognizes a compensation committed before the undone sidecar",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const journal=new MemoryConnectedOwnerInventoryJournalStore();
  const first=await restarted(characterStore,journal);
  const before=activeInventory(first.snapshot);
  const command={requestId:"restart.undo-sidecar",actorId:before.characterId,operation:"grant-currency" as const,amount:9};
  await journal.prepare({requestId:command.requestId,actorId:command.actorId,command,before});
  await mutateActiveCharacterDurably(first.adapter,(character)=>{character.goldGp=(character.goldGp??0)+9;});
  const applied=activeInventory(await first.adapter.getSnapshot());
  await journal.markApplied(command.requestId,applied);
  const target={...before,revision:applied.revision+1};
  await journal.beginUndo(command.requestId,applied,target);
  await mutateActiveCharacterDurably(first.adapter,(character)=>{character.goldGp=before.goldGp;});

  const second=await restarted(characterStore,journal);
  const recovered=await second.adapter.undoDmInventoryAdjustment(command.requestId);
  assert.equal(activeInventory(recovered).goldGp,before.goldGp);
  assert.equal((await journal.read(command.requestId))?.phase,"undone");
});

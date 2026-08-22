import assert from "node:assert/strict";
import test from "node:test";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryConnectedLongRestOwnerPreparationStore } from "../../src/app/connectedLongRestOwnerPreparationStore";

const request={
  transactionId:"long-rest.remote.1",
  preparationId:"character-stage.1",
  write:{expectedGeneration:0,nextGeneration:1,payload:"candidate"},
};

test("owner prepare keeps the candidate invisible until global commit materialization", async () => {
  const characterStore=new MemoryCharacterLibraryStore();
  const store=new MemoryConnectedLongRestOwnerPreparationStore(characterStore);

  const prepared=await store.prepare(request);
  assert.equal(prepared.phase,"prepared");
  assert.deepEqual(await characterStore.readGenerations(),[]);

  const materialized=await store.materialize({transactionId:request.transactionId,preparationId:request.preparationId});
  assert.equal(materialized.phase,"materialized");
  const generations=await characterStore.readGenerations();
  assert.equal(generations.length,1);
  assert.equal(generations[0].generation,1);
  assert.equal(generations[0].payload,"candidate");
});

test("owner prepare and materialization retries are idempotent for the exact transaction", async () => {
  const characterStore=new MemoryCharacterLibraryStore();
  const store=new MemoryConnectedLongRestOwnerPreparationStore(characterStore);

  const first=await store.prepare(request);
  const retry=await store.prepare(structuredClone(request));
  assert.deepEqual(retry,first);
  await store.materialize({transactionId:request.transactionId,preparationId:request.preparationId});
  const repeated=await store.materialize({transactionId:request.transactionId,preparationId:request.preparationId});
  assert.equal(repeated.phase,"materialized");
  assert.equal((await characterStore.readGenerations()).length,1);
});

test("owner prepare rejects conflicting retry and stale materialization", async () => {
  const characterStore=new MemoryCharacterLibraryStore();
  const store=new MemoryConnectedLongRestOwnerPreparationStore(characterStore);
  await store.prepare(request);

  const conflicting=structuredClone(request);
  conflicting.write.payload="other";
  await assert.rejects(()=>store.prepare(conflicting),/different Character preparation/);

  await characterStore.writeGeneration(0,1,"unrelated");
  await assert.rejects(
    ()=>store.materialize({transactionId:request.transactionId,preparationId:request.preparationId}),
    /stale Character library generation/,
  );
});

test("precommit abort remains invisible and cannot later materialize", async () => {
  const characterStore=new MemoryCharacterLibraryStore();
  const store=new MemoryConnectedLongRestOwnerPreparationStore(characterStore);
  await store.prepare(request);
  const aborted=await store.abort({transactionId:request.transactionId,preparationId:request.preparationId});
  assert.equal(aborted.phase,"aborted");
  await assert.rejects(
    ()=>store.materialize({transactionId:request.transactionId,preparationId:request.preparationId}),
    /cannot be materialized/,
  );
  assert.deepEqual(await characterStore.readGenerations(),[]);
});

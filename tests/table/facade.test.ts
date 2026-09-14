import assert from "node:assert/strict";
import { hpStageOf } from "../../src/table/state";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { createTableSessionFacade } from "../../src/table/facade";
import { MemoryTransportHub } from "../../src/table/transport";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";

/**
 * Capability inventory §3 through the old screens' adapter surface: 세션 열기 is the session (no lobby), a solo table
 * runs without a network, a client joins with its sheet and plays through the Host, and 나가기 returns to the library.
 */
test("solo play: hosting without a network runs the table locally and the session is live at once", async () => {
  const base=new MockAdapter();
  const facade=createTableSessionFacade(base);
  const before=await facade.adapter.getSnapshot();
  assert.equal(before.session.role,"offline");
  const hosted=await facade.adapter.hostSession();
  assert.equal(facade.mode,"host");
  assert.equal(hosted.session.role,"host");
  assert.equal(hosted.session.lifecycle,"live","no preparing/lobby step");
  assert.equal(hosted.connectionState,"connected");
  assert.match(hosted.session.compatibilityMessage,/솔로 플레이/);
  assert.ok(hosted.scene.entities.some((entity)=>entity.id===before.activeCharacter.id),"the local character sits on the table");
  // The DM adds a goblin through the old DM tools and the fight runs on the runtime
  const withGoblin=await facade.adapter.instantiateCombatant("dnd.srd521.monster.goblin-warrior");
  assert.ok(withGoblin.scene.entities.some((entity)=>/고블린/.test(entity.name)));
  const started=await facade.adapter.startPreparedSession("initiative");
  assert.equal(started.sessionMode,"initiative");
  const left=await facade.adapter.stopSession();
  assert.equal(left.session.role,"offline");
  assert.equal(facade.mode,"offline");
});

test("connected play through the adapter surface: a client joins with its sheet, acts through the Host, and sees the Host's refusals", async () => {
  const hub=new MemoryTransportHub();
  const dmBase=new MockAdapter();
  const dm=createTableSessionFacade(dmBase,{transport:{hub}});
  await dm.adapter.hostSession();
  await dm.adapter.instantiateCombatant("dnd.srd521.monster.goblin-warrior");
  const playerBase=new MockAdapter();
  const player=createTableSessionFacade(playerBase,{transport:{hub,peerId:"peer.p1"}});
  const joined=await player.adapter.joinSession("memory://host");
  assert.equal(player.mode,"client");
  assert.equal(joined.session.role,"client");
  assert.equal(joined.session.lifecycle,"live");
  const characterId=joined.activeCharacter.id;
  assert.equal(dm.runtime.state.actors[characterId]?.controllerPeer,"peer.p1","the Host bound the character to the joining peer");
  assert.equal(dm.host?.peers.size,1);
  const dmView=await dm.adapter.getSnapshot();
  assert.ok(dmView.session.participants.some((participant)=>participant.id===`client:${characterId}`),"the DM's participant list shows the player");
  // The player attacks the goblin: the command runs on the Host, both snapshots converge
  const goblin=joined.scene.entities.find((entity)=>/고블린/.test(entity.name))!;
  const attack=joined.scene.actionsByActor[characterId].find((action)=>action.resolutionKind==="attack"&&action.available)!;
  const after=await player.adapter.resolveAction(attack.id,[goblin.id]);
  assert.ok(after.activity.length>0);
  // D22: the DM sees numbers, the player sees the stage (3 멀쩡 · 2 다침 · 1 위독 · 0 쓰러짐)
  const dmGoblin=(await dm.adapter.getSnapshot()).scene.entities.find((entity)=>entity.id===goblin.id)!;
  const playerGoblin=after.scene.entities.find((entity)=>entity.id===goblin.id)!;
  assert.equal(playerGoblin.hp,hpStageOf(dmGoblin.hp,dmGoblin.maxHp));
  assert.equal(playerGoblin.maxHp,3);
  assert.ok(playerGoblin.hpStage);
  // A refusal from the Host lands in the player's snapshot with origin host
  const refused=await player.adapter.resolveAction("action.standard.dodge",[goblin.id]);
  assert.equal(refused.refusal?.origin,"host");
  assert.ok(refused.refusal?.message);
  // 나가기
  const left=await player.adapter.stopSession();
  assert.equal(left.session.role,"offline");
});

/** RULES_RUNTIME_SPECS.md §4 write-back on the product path: HP, temp HP and resource counts reach the character library. */
const libraryHp=(base:MockAdapter,id:string)=>getCharacterLibraryPersistenceStateForTests(base)?.document?.characters.find((record)=>record.characterId===id)?.runtime.hp;

test("solo write-back: damage and healing rulings on the local character land in the library record and the active sheet", async () => {
  const base=new MockAdapter();
  setCharacterLibraryStoreForTests(base,new MemoryCharacterLibraryStore());
  const facade=createTableSessionFacade(base);
  const hosted=await facade.adapter.hostSession();
  const id=hosted.activeCharacter.id;
  const before=hosted.activeCharacter.hp;
  assert.equal(hosted.activeCharacter.tempHp,5,"the reference character starts with 5 temp HP");
  await facade.dispatch({type:"ruling",targetIds:[id],ruling:{kind:"damage",amount:8}});
  assert.equal(facade.lastWriteBackError,null);
  assert.equal((await base.getSnapshot()).activeCharacter.hp,before-3,"the active sheet follows the table (5 absorbed by temp HP)");
  assert.equal((await base.getSnapshot()).activeCharacter.tempHp,0);
  assert.equal(libraryHp(base,id),before-3,"the library record carries the new HP");
  await facade.dispatch({type:"ruling",targetIds:[id],ruling:{kind:"temp-hp",amount:4}});
  assert.equal((await base.getSnapshot()).activeCharacter.tempHp,4);
  await facade.dispatch({type:"undo"});
  assert.equal((await base.getSnapshot()).activeCharacter.tempHp,0,"undo is written back too");
  assert.equal(libraryHp(base,id),before-3);
  // Death saves, stable and hit dice are durable too (RULES_RUNTIME_SPECS.md §4).
  await facade.dispatch({type:"ruling",targetIds:[id],ruling:{kind:"damage",amount:60}});
  await facade.adapter.setQueuedD20(4);
  const save=await facade.dispatch({type:"act",actorId:id,actionId:"action.death-save",targetIds:[]},{peerId:"peer.local",role:"player"});
  assert.equal(save.status,"committed",JSON.stringify(save));
  const record=()=>getCharacterLibraryPersistenceStateForTests(base)?.document?.characters.find((entry)=>entry.characterId===id);
  assert.deepEqual(record()?.runtime.lifeFlags?.deathSaves,{successes:0,failures:1},JSON.stringify(record()?.runtime.lifeFlags));
  assert.equal(record()?.runtime.hp,0);
  await facade.dispatch({type:"ruling",targetIds:[id],ruling:{kind:"life",state:"stable"}});
  assert.equal(record()?.runtime.lifeFlags?.stable,true);
  await facade.dispatch({type:"ruling",targetIds:[id],ruling:{kind:"heal",amount:10}});
  assert.equal(facade.dispatch&&(await facade.dispatch({type:"rest",kind:"short",actorIds:[id],hitDice:{[id]:2}})).status,"committed");
  assert.equal((await facade.dispatch({type:"rest-complete"})).status,"committed");
  assert.equal(facade.runtime.state.rules.combatants[id].hitDice[0].current,3,"two of five d10 spent");
  assert.deepEqual(record()?.source.build.hitDiceByDie,{d10:3},"remaining hit dice reach the library");
  assert.equal(facade.lastWriteBackError,null);
  const left=await facade.adapter.stopSession();
  assert.equal(left.activeCharacter.hitDiceByDie?.d10,3,"the sheet keeps the session's hit dice after leaving");
  // A new table seeds the character from the written-back sheet: the spent hit dice stay spent.
  const again=createTableSessionFacade(base);
  await again.adapter.hostSession();
  assert.equal(again.runtime.state.rules.combatants[id].hitDice[0].current,3);
});

test("connected write-back: the DM's ruling on a player's character reaches that player's library, not the DM's", async () => {
  const hub=new MemoryTransportHub();
  const dmBase=new MockAdapter();
  setCharacterLibraryStoreForTests(dmBase,new MemoryCharacterLibraryStore());
  const dm=createTableSessionFacade(dmBase,{transport:{hub}});
  await dm.adapter.hostSession();
  const playerBase=new MockAdapter();
  setCharacterLibraryStoreForTests(playerBase,new MemoryCharacterLibraryStore());
  const player=createTableSessionFacade(playerBase,{transport:{hub,peerId:"peer.p1"}});
  const joined=await player.adapter.joinSession("memory://host");
  const id=joined.activeCharacter.id;
  const before=joined.activeCharacter.hp;
  await dm.dispatch({type:"ruling",targetIds:[id],ruling:{kind:"damage",amount:9}});
  await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(player.lastWriteBackError,null);
  assert.equal((await playerBase.getSnapshot()).activeCharacter.hp,before-4,"the player's active sheet (5 absorbed by temp HP)");
  assert.equal((await playerBase.getSnapshot()).activeCharacter.tempHp,0);
  assert.equal(libraryHp(playerBase,id),before-4,"the player's library record");
  assert.equal(dm.lastWriteBackError,null);
  assert.notEqual(libraryHp(dmBase,id),before-4,"the DM's library never holds the player's character");
});

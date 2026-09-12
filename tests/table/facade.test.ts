import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { createTableSessionFacade } from "../../src/table/facade";
import { MemoryTransportHub } from "../../src/table/transport";

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
  assert.equal(after.scene.entities.find((entity)=>entity.id===goblin.id)?.hp,(await dm.adapter.getSnapshot()).scene.entities.find((entity)=>entity.id===goblin.id)?.hp);
  // A refusal from the Host lands in the player's snapshot with origin host
  const refused=await player.adapter.resolveAction("action.standard.dodge",[goblin.id]);
  assert.equal(refused.refusal?.origin,"host");
  assert.ok(refused.refusal?.message);
  // 나가기
  const left=await player.adapter.stopSession();
  assert.equal(left.session.role,"offline");
});

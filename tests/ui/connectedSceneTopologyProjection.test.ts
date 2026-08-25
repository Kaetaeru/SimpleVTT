import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { applyConnectedClientEvents, connectedInternal } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor, resetConnectedState } from "../../src/app/connectedSessionState";

test("Client replaces stale local encounter actors with Host-authoritative Scene topology", async () => {
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const local=before.scene.entities.find((entity)=>entity.id===before.activeCharacter.id)!;
  const remote={...structuredClone(before.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!),id:"combatant.host-scout.instance-1",name:"Host Scout"};
  resetConnectedState(adapter,"client");
  const state=connectedStateFor(adapter);
  state.sessionId="session.topology";
  state.replica=new ClientSessionReplica("session.topology");
  const event:ConnectedSessionEvent={
    sessionId:"session.topology",eventId:"session.topology:event:1",sequence:1,actorId:"host",
    payload:{
      kind:"scene-topology",
      topology:{
        sceneId:"scene.host",sceneName:"Host Encounter",round:0,currentActorId:local.id,
        entities:[structuredClone(local),remote],
        economyByActor:{
          [local.id]:{action:true,bonusAction:true,reaction:true,movement:30,movementMax:30},
          [remote.id]:{action:true,bonusAction:true,reaction:true,movement:30,movementMax:30},
        },
      },
      stateChanges:["Host Scout added"],
      provenance:["host-authoritative topology test"],
    },
  };

  assert.equal((await applyConnectedClientEvents(adapter,[event])).status,"applied");
  const scene=connectedInternal(adapter).scene;
  assert.deepEqual(scene.entities.map((entity)=>entity.id),[local.id,remote.id]);
  assert.equal(scene.entities.some((entity)=>entity.id==="combatant.goblin-b"||entity.id==="combatant.wolf"),false);
  assert.ok(scene.actionsByActor[local.id]?.length,"Client keeps its own executable actions");
  assert.equal(scene.actionsByActor[remote.id],undefined,"Client does not gain control of Host actors");
});

import assert from "node:assert/strict";
import test from "node:test";
import { ClientSessionReplica, CONNECTED_SESSION_PROTOCOL_VERSION, HostSessionLedger } from "../../src/app/connectedSessionProtocol";

const economy={ action:true,bonusAction:true,reaction:true,movement:30,movementMax:30 };

function ledger() {
  return new HostSessionLedger("session.turn",{
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
  });
}

test("reconnect replays ordered host turn projections without double-applying them", () => {
  const host=ledger();
  const start=host.commitHostEvent({payload:{
    kind:"mode-transition",sessionMode:"initiative",round:1,currentActorId:"char.aelar",
    economyByActor:{"char.aelar":economy,"combatant.goblin-a":{...economy,movement:30,movementMax:30}},
    stateChanges:["initiative-start"],provenance:["host turn runtime"],
  }});
  host.commitHostEvent({payload:{
    kind:"mode-transition",sessionMode:"initiative",round:1,currentActorId:"combatant.goblin-a",
    economyByActor:{"char.aelar":{...economy,action:false},"combatant.goblin-a":economy},
    stateChanges:["turn-end"],provenance:["host turn runtime"],
  }});
  const roundTwo=host.commitHostEvent({payload:{
    kind:"mode-transition",sessionMode:"initiative",round:2,currentActorId:"char.aelar",
    economyByActor:{"char.aelar":economy,"combatant.goblin-a":economy},
    stateChanges:["round-wrap"],provenance:["host turn runtime"],
  }});

  const client=new ClientSessionReplica("session.turn");
  let view={sessionMode:"freeform" as "freeform"|"initiative",round:0,currentActorId:"",economyByActor:{} as Record<string,typeof economy>};
  let applyCount=0;
  const apply=(payload:(typeof start)["payload"])=>{
    if (payload.kind!=="mode-transition") return {status:"committed" as const};
    view={
      sessionMode:payload.sessionMode,
      round:payload.round,
      currentActorId:payload.currentActorId,
      economyByActor:structuredClone(payload.economyByActor),
    };
    applyCount+=1;
    return {status:"committed" as const};
  };

  assert.equal(client.apply(start,apply).status,"applied");
  assert.equal(client.cursor,1);
  const catchup=host.eventsAfter(client.cursor);
  assert.deepEqual(catchup.map((event)=>event.sequence),[2,3]);
  assert.equal(client.applyBatch(catchup,apply).status,"applied");
  assert.equal(client.cursor,3);
  assert.equal(view.sessionMode,"initiative");
  assert.equal(view.round,2);
  assert.equal(view.currentActorId,"char.aelar");
  assert.equal(view.economyByActor["char.aelar"]?.action,true);
  assert.equal(client.apply(roundTwo,apply).status,"duplicate");
  assert.equal(applyCount,3);
});

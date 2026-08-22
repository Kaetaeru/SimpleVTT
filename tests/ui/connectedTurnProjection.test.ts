import assert from "node:assert/strict";
import test from "node:test";
import type { AppSnapshot } from "../../src/app/contracts";
import { ClientSessionReplica, CONNECTED_SESSION_PROTOCOL_VERSION, HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { commitConnectedTurnProjectionEvents } from "../../src/app/connectedTurnRoutingAdapter";

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

test("Ready lifecycle clear is sequenced after the authoritative turn projection",()=>{
  const host=ledger();
  const readyEconomy={...economy,action:false,reaction:true};
  const snapshot={
    sessionMode:"initiative",
    scene:{
      round:2,
      currentActorId:"char.aelar",
      economyByActor:{"char.aelar":readyEconomy,"combatant.goblin-a":economy},
    },
  } as unknown as AppSnapshot;

  const events=commitConnectedTurnProjectionEvents(host,snapshot,"turn-end",[{
    actorId:"char.aelar",
    reason:"next-turn-start",
  }]);

  assert.deepEqual(events.map((event)=>event.sequence),[1,2]);
  assert.deepEqual(events.map((event)=>event.payload.kind),["mode-transition","ready-action"]);
  const clear=events[1];
  assert.equal(clear.actorId,"char.aelar");
  assert.equal(clear.payload.kind,"ready-action");
  if (clear.payload.kind!=="ready-action") assert.fail("expected ready-action clear event");
  assert.equal(clear.payload.transition,"cleared");
  assert.deepEqual(clear.payload.economy,readyEconomy);
  assert.ok(clear.payload.stateChanges.includes("ready-lifecycle=next-turn-start"));
  assert.deepEqual(host.eventsAfter(0).map((event)=>event.eventId),events.map((event)=>event.eventId));
});

test("multiple Ready lifecycle clears are deterministic and actor-specific",()=>{
  const host=ledger();
  const snapshot={
    sessionMode:"freeform",
    scene:{
      round:0,
      currentActorId:"char.aelar",
      economyByActor:{
        "char.aelar":{...economy,reaction:true},
        "combatant.goblin-a":{...economy,reaction:false},
      },
    },
  } as unknown as AppSnapshot;

  const events=commitConnectedTurnProjectionEvents(host,snapshot,"initiative-end",[
    {actorId:"combatant.goblin-a",reason:"initiative-ended"},
    {actorId:"char.aelar",reason:"initiative-ended"},
  ]);

  assert.deepEqual(events.map((event)=>event.sequence),[1,2,3]);
  assert.deepEqual(events.map((event)=>event.payload.kind),["mode-transition","ready-action","ready-action"]);
  assert.deepEqual(events.slice(1).map((event)=>event.actorId),["char.aelar","combatant.goblin-a"]);
  for (const event of events.slice(1)) {
    assert.equal(event.payload.kind,"ready-action");
    if (event.payload.kind!=="ready-action") assert.fail("expected ready-action clear event");
    assert.equal(event.payload.transition,"cleared");
    assert.ok(event.payload.stateChanges.includes("ready-lifecycle=initiative-ended"));
  }
});

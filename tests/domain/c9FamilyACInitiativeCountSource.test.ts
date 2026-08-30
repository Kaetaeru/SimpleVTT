import assert from "node:assert/strict";
import test from "node:test";
import { setTurnRuntimeInitiativeCount } from "../../src/app/turnRuntimeInitiativeCountService";
import type { TurnRuntimeSession } from "../../src/app/realTurnRuntimeService";
import { beginTurn } from "../../src/domain/turnEconomy";

function session():TurnRuntimeSession {
  return {
    initiativeOrder:["actor"],
    activeIndex:0,
    state:{
      revision:4,
      clock:{round:1,elapsedSeconds:0,activeActorId:"actor"},
      combatants:{
        actor:{
          id:"actor",
          baseSpeed:30,
          life:{
            hp:{current:10,maximum:10,temporary:0},
            deathSaves:{successes:0,failures:0},
            stable:false,
            unconscious:false,
            dead:false,
          },
          economy:beginTurn(30),
          resources:[],
          hitDice:[],
        },
      },
      effects:[],
      concentration:{},
      history:[],
    },
  };
}

test("Family AC initiative count advances through one authoritative Resolver event",()=>{
  const runtime=session();
  const result=setTurnRuntimeInitiativeCount(runtime,20);
  assert.equal(result.status,"committed");
  assert.equal(runtime.state.clock.initiativeCount,20);
  assert.equal(runtime.state.revision,5);
  if(result.status!=="committed") return;
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].kind,"set-initiative-count");
  assert.match(result.events[0].summary,/initiative count advanced to 20/);
  const clockChange=result.events[0].stateChanges.find((change)=>change.kind==="turn-clock");
  assert.ok(clockChange);
  assert.equal(clockChange.after.initiativeCount,20);

  const second=setTurnRuntimeInitiativeCount(runtime,10);
  assert.equal(second.status,"committed");
  assert.equal(runtime.state.clock.initiativeCount,10);
  assert.equal(runtime.state.revision,6);
});

test("Family AC initiative count rejects invalid values without mutating the session",()=>{
  const runtime=session();
  const before=structuredClone(runtime.state);
  const result=setTurnRuntimeInitiativeCount(runtime,-1);
  assert.deepEqual(result,{status:"rejected",error:"initiative count must be a non-negative integer"});
  assert.deepEqual(runtime.state,before);
});

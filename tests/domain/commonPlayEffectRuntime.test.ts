import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayEffectActivation,
  resolveCommonPlayEffectActivation,
  resolveCommonPlayEffectEvent,
  type CommonPlayPersistentEffectDefinition,
} from "../../src/domain/commonPlayEffectRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { ResolutionCommit, ResolutionEvent } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const DEFINITION=JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/persistent-effect-trigger.json",import.meta.url),
  "utf8",
)) as CommonPlayPersistentEffectDefinition;

function committed(value:ResolutionCommit,label:string) {
  assert.equal(value.status,"committed",label);
  if (value.status!=="committed") throw new Error(`${label}: ${value.error}`);
  return value;
}

function activate(definition=DEFINITION) {
  const state=runtimeState();
  return committed(resolveCommonPlayEffectActivation(TEST_PROFILE,state,definition,{
    resolutionId:"external-ward-activation",
    actorId:"hero",
    entryPointId:"activate",
  }),"effect activation should commit");
}

function incomingDamage(state:ReturnType<typeof runtimeState>,amount=3) {
  return committed(resolvePendingResolution(TEST_PROFILE,state,{
    id:`incoming-damage-${state.revision}`,
    actorId:"goblin",
    sourceId:"external.unknown.weapon-hit",
    expectedRevision:state.revision,
    operations:[{
      id:"incoming-damage",
      kind:"damage",
      targetId:"hero",
      damageType:"slashing",
      amount,
      creatureKind:"character",
    }],
  }),"incoming damage should commit");
}

function damageEvent(commit:Extract<ResolutionCommit,{status:"committed"}>):ResolutionEvent {
  const event=commit.events.find((candidate)=>candidate.kind==="damage");
  assert.ok(event,"damage event should exist");
  return event;
}

test("Common Play activates an unknown persistent effect and automatically retaliates on positive damage",()=>{
  const initial=runtimeState();
  const pending=compileCommonPlayEffectActivation(initial,DEFINITION,{
    resolutionId:"compile-effect",
    actorId:"hero",
    entryPointId:"activate",
  });
  assert.equal(pending.sourceId,"external.unknown.retaliatory-ward");
  assert.equal(pending.operations.length,1);
  assert.equal(pending.operations[0].kind,"apply-effect");

  const activated=activate();
  assert.equal(activated.state.revision,1);
  assert.equal(activated.state.effects.length,1);
  const effect=activated.state.effects[0];
  assert.equal(effect.sourceId,"external.unknown.retaliatory-ward");
  assert.equal(effect.targetId,"hero");
  assert.equal(effect.metadata?.commonPlayTemplateId,"retaliatory-ward");
  assert.deepEqual(effect.expiry,{kind:"time",elapsedSeconds:3600});

  const incoming=incomingDamage(activated.state);
  assert.equal(incoming.state.revision,2);
  assert.equal(incoming.state.combatants.hero.life.hp.current,17);
  assert.equal(incoming.state.effects.length,1,"incoming damage is committed before automatic event rules run");

  const triggered=resolveCommonPlayEffectEvent(TEST_PROFILE,incoming.state,DEFINITION,{
    event:damageEvent(incoming),
    actorCreatureKind:"monster",
  });
  assert.equal(triggered.status,"committed");
  if (triggered.status!=="committed") return;

  assert.equal(triggered.state.revision,3);
  assert.equal(triggered.state.combatants.goblin.life.hp.current,10);
  assert.equal(triggered.state.effects.length,0);
  assert.equal((triggered.results["common-play-effect-1-rule-1-damage-1"] as {finalDamage:number}).finalDamage,5);
  assert.equal((triggered.results["common-play-effect-1-remove"] as {removed:boolean}).removed,true);
  assert.equal(triggered.events.every((event)=>event.resolutionId.includes(DEFINITION.id)),true);
});

test("Common Play damage.taken does not fire when authoritative final damage is zero",()=>{
  const activated=activate();
  activated.state.combatants.hero.damageDefenses=[{
    source:"external.unknown.slashing-immunity",
    kind:"immunity",
    damageType:"slashing",
  }];
  const incoming=incomingDamage(activated.state);
  const result=incoming.results["incoming-damage"] as {finalDamage:number};
  assert.equal(result.finalDamage,0);

  const triggered=resolveCommonPlayEffectEvent(TEST_PROFILE,incoming.state,DEFINITION,{
    event:damageEvent(incoming),
    actorCreatureKind:"monster",
  });
  assert.equal(triggered.status,"no-match");
  if (triggered.status!=="no-match") return;
  assert.equal(triggered.state.revision,2);
  assert.equal(triggered.state.effects.length,1);
  assert.equal(triggered.state.combatants.goblin.life.hp.current,15);
});

test("Common Play consumed effect makes replaying the same event a no-op",()=>{
  const activated=activate();
  const incoming=incomingDamage(activated.state);
  const event=damageEvent(incoming);
  const first=resolveCommonPlayEffectEvent(TEST_PROFILE,incoming.state,DEFINITION,{
    event,
    actorCreatureKind:"monster",
  });
  assert.equal(first.status,"committed");
  if (first.status!=="committed") return;

  const replay=resolveCommonPlayEffectEvent(TEST_PROFILE,first.state,DEFINITION,{
    event,
    actorCreatureKind:"monster",
  });
  assert.equal(replay.status,"no-match");
  if (replay.status!=="no-match") return;
  assert.equal(replay.state.revision,3);
  assert.equal(replay.state.combatants.goblin.life.hp.current,10);
});

test("Common Play triggered retaliation and effect destruction roll back together on failure",()=>{
  const activated=activate();
  const incoming=incomingDamage(activated.state);
  const event={...damageEvent(incoming),id:"incoming-damage:missing-attacker",actorId:"missing-attacker"};

  const triggered=resolveCommonPlayEffectEvent(TEST_PROFILE,incoming.state,DEFINITION,{
    event,
    actorCreatureKind:"monster",
  });
  assert.equal(triggered.status,"rejected");
  if (triggered.status!=="rejected") return;
  assert.equal(triggered.failedOperationId,"common-play-effect-1-rule-1-damage-1");
  assert.equal(triggered.state,incoming.state);
  assert.equal(triggered.state.revision,2);
  assert.equal(triggered.state.effects.length,1);
});

test("Common Play persistent effect behavior is independent of the external content id",()=>{
  const renamed=structuredClone(DEFINITION);
  renamed.id="external.previously-unseen.retaliatory-effect";
  const activated=activate(renamed);
  assert.equal(activated.state.effects[0].sourceId,renamed.id);

  const incoming=incomingDamage(activated.state);
  const triggered=resolveCommonPlayEffectEvent(TEST_PROFILE,incoming.state,renamed,{
    event:damageEvent(incoming),
    actorCreatureKind:"monster",
  });
  assert.equal(triggered.status,"committed");
  if (triggered.status!=="committed") return;
  assert.equal(triggered.state.combatants.goblin.life.hp.current,10);
  assert.equal(triggered.state.effects.length,0);
});

test("Common Play effect runtime rejects unsupported semantic target shapes before activation",()=>{
  const invalid=structuredClone(DEFINITION);
  (invalid.artifactTemplates[0].rules[0].operations[0] as {target:string}).target="event.target";
  const state=runtimeState();
  const activation=resolveCommonPlayEffectActivation(TEST_PROFILE,state,invalid,{
    resolutionId:"invalid-effect-activation",
    actorId:"hero",
    entryPointId:"activate",
  });
  assert.equal(activation.status,"rejected");
  if (activation.status!=="rejected") return;
  assert.match(activation.error,/target must be event\.actor/);
  assert.equal(activation.state,state);
  assert.equal(state.revision,0);
  assert.deepEqual(state.effects,[]);
});

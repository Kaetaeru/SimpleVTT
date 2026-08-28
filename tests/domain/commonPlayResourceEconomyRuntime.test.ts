import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayEntryPointOperations,
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
  type CommonPlayOperationExecutionInput,
} from "../../src/domain/commonPlayOperationRuntime";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
  FIGHTER_ID,
  coreClassResourceDefinitions,
} from "../../src/domain/coreClassResources";
import { resolveFighterActionSurge } from "../../src/domain/fighterActionSurge";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { RulesProfileLike } from "../../src/domain/profileEngine";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const DEFINITION = JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/resource-economy-action.json", import.meta.url),
  "utf8",
)) as CommonPlayOperationDefinition;

const PROFILE:RulesProfileLike = {
  ...TEST_PROFILE,
  economy:{
    grantBuckets:{
      "action.extra.non-magic":{
        kind:"extra-action",
        allowsMagicAction:false,
        activeTurnOnly:true,
      },
    },
  },
};

function preparedState() {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="action";
  state.combatants.hero.resources.push(
    { id:"resource.external.primary", label:"External Primary", current:1, maximum:1, recovery:{ shortRest:"all" } },
    { id:"resource.external.same-turn", label:"External Same Turn", current:1, maximum:1, recovery:{ turnStart:"all" } },
  );
  return state;
}

function executionInput(resolutionId="external-resource-economy-resolution"):CommonPlayOperationExecutionInput {
  return { resolutionId, actorId:"hero", entryPointId:"activate" };
}

function resourceCurrent(state:ReturnType<typeof runtimeState>,resourceId:string) {
  return state.combatants.hero.resources.find((entry)=>entry.id===resourceId)?.current;
}

function useAction(state:ReturnType<typeof runtimeState>,id:string,actionKind:"magic"|"other") {
  return resolvePendingResolution(TEST_PROFILE,state,{
    id,
    actorId:"hero",
    sourceId:`external:${id}`,
    expectedRevision:state.revision,
    operations:[{ id:`${id}:action`, kind:"use-economy", actorId:"hero", slot:"action", actionKind }],
  });
}

function fighterState(level=17) {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="action";
  state.combatants.hero.resources.push(...coreClassResourceDefinitions([
    { classId:FIGHTER_ID, className:"Fighter", level },
  ]).map((definition)=>({
    id:definition.resourceId,
    label:definition.label,
    current:definition.maximum,
    maximum:definition.maximum,
    recovery:definition.recovery,
  })));
  return state;
}

function fighterCommonPlayDefinition():CommonPlayOperationDefinition {
  const definition=structuredClone(DEFINITION);
  definition.id="external.unknown.restricted-extra-action";
  const payments=definition.payments as Array<Record<string,unknown>>;
  payments[0].resource=FIGHTER_ACTION_SURGE_RESOURCE_ID;
  payments[1].resource=FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID;
  return definition;
}

test("Common Play lowers committed resource payments before generic economy effects",()=>{
  assert.deepEqual(DEFINITION.payments?.map((payment)=>payment.kind),["resource","resource"]);
  assert.deepEqual(DEFINITION.entryPoints[0].operations.map((operation)=>operation.kind),["economy.modify"]);

  const state=preparedState();
  const pending=compileCommonPlayEntryPointOperations(PROFILE,state,DEFINITION,executionInput());
  assert.equal(pending.sourceId,DEFINITION.id);
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["spend-resource","spend-resource","grant-extra-action"]);

  const resolved=resolveCommonPlayEntryPointOperations(PROFILE,state,DEFINITION,executionInput());
  assert.equal(resolved.status,"committed");
  if(resolved.status!=="committed") return;
  assert.equal(resourceCurrent(resolved.state,"resource.external.primary"),0);
  assert.equal(resourceCurrent(resolved.state,"resource.external.same-turn"),0);
  assert.equal(resolved.state.combatants.hero.economy.action,true);
  assert.deepEqual(resolved.state.combatants.hero.economy.extraActions?.map((entry)=>entry.allowsMagicAction),[false]);
});

test("Common Play resource payments and economy effect commit atomically",()=>{
  const state=preparedState();
  const sameTurn=state.combatants.hero.resources.find((entry)=>entry.id==="resource.external.same-turn");
  assert.ok(sameTurn);
  sameTurn.current=0;
  const rejected=resolveCommonPlayEntryPointOperations(PROFILE,state,DEFINITION,executionInput("atomic-rejection"));
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.state,state);
  assert.equal(resourceCurrent(state,"resource.external.primary"),1);
  assert.equal(state.combatants.hero.economy.extraActions?.length??0,0);
});

test("profile-registered restricted extra Action preserves existing Magic Action policy",()=>{
  const state=preparedState();
  const resolved=resolveCommonPlayEntryPointOperations(PROFILE,state,DEFINITION,executionInput("restricted-action"));
  assert.equal(resolved.status,"committed");
  if(resolved.status!=="committed") return;

  const magicState=structuredClone(resolved.state);
  magicState.combatants.hero.economy.action=false;
  const magic=useAction(magicState,"external.magic","magic");
  assert.equal(magic.status,"rejected");
  assert.equal(magicState.combatants.hero.economy.extraActions?.length,1);

  const attackState=structuredClone(resolved.state);
  attackState.combatants.hero.economy.action=false;
  const attack=useAction(attackState,"external.attack","other");
  assert.equal(attack.status,"committed");
  if(attack.status!=="committed") return;
  assert.equal(attack.state.combatants.hero.economy.extraActions?.length,0);
});

test("Common Play resource/economy semantics are invariant under external definition ID rename",()=>{
  const state=preparedState();
  const renamed=structuredClone(DEFINITION);
  renamed.id="external.previously-unseen.resource-economy-action";
  const pending=compileCommonPlayEntryPointOperations(PROFILE,state,renamed,executionInput("renamed-definition"));
  assert.equal(pending.sourceId,renamed.id);
  const resolved=resolveCommonPlayEntryPointOperations(PROFILE,state,renamed,executionInput("renamed-definition"));
  assert.equal(resolved.status,"committed");
  if(resolved.status!=="committed") return;
  assert.equal(resourceCurrent(resolved.state,"resource.external.primary"),0);
  assert.equal(resourceCurrent(resolved.state,"resource.external.same-turn"),0);
  assert.equal(resolved.state.combatants.hero.economy.extraActions?.[0]?.allowsMagicAction,false);
});

test("generic resource/economy lowering matches the Action Surge domain oracle without recognizing Fighter identity",()=>{
  const source=fighterState();
  const legacy=resolveFighterActionSurge(PROFILE,structuredClone(source),{
    id:"legacy-action-surge",
    actorId:"hero",
    expectedRevision:source.revision,
    fighterLevel:17,
  });
  const generic=resolveCommonPlayEntryPointOperations(
    PROFILE,
    structuredClone(source),
    fighterCommonPlayDefinition(),
    executionInput("generic-restricted-extra-action"),
  );
  assert.equal(legacy.status,"committed");
  assert.equal(generic.status,"committed");
  if(legacy.status!=="committed"||generic.status!=="committed") return;

  for(const resourceId of [FIGHTER_ACTION_SURGE_RESOURCE_ID,FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID]) {
    assert.equal(resourceCurrent(generic.state,resourceId),resourceCurrent(legacy.state,resourceId));
  }
  assert.equal(generic.state.combatants.hero.economy.action,legacy.state.combatants.hero.economy.action);
  assert.deepEqual(
    generic.state.combatants.hero.economy.extraActions?.map((entry)=>entry.allowsMagicAction),
    legacy.state.combatants.hero.economy.extraActions?.map((entry)=>entry.allowsMagicAction),
  );

  const second=resolveCommonPlayEntryPointOperations(
    PROFILE,
    generic.state,
    fighterCommonPlayDefinition(),
    executionInput("generic-second-same-turn"),
  );
  assert.equal(second.status,"rejected");
  assert.equal(second.state,generic.state);

  const outOfTurn=fighterState();
  outOfTurn.clock.activeActorId="goblin";
  const rejected=resolveCommonPlayEntryPointOperations(
    PROFILE,
    outOfTurn,
    fighterCommonPlayDefinition(),
    executionInput("generic-out-of-turn"),
  );
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.state,outOfTurn);
});

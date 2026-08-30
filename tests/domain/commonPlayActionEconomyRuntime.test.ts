import assert from "node:assert/strict";
import test from "node:test";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
  FIGHTER_ID,
  coreClassResourceDefinitions,
} from "../../src/domain/coreClassResources";
import {
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
} from "../../src/domain/commonPlayOperationRuntime";
import { resolveFighterActionSurge } from "../../src/domain/fighterActionSurge";
import type { RulesProfileLike } from "../../src/domain/profileEngine";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const RESTRICTED_EXTRA_ACTION_BUCKET = "test.extra-action.non-magic";

const PROFILE:RulesProfileLike = {
  ...TEST_PROFILE,
  economy:{
    grantBuckets:{
      [RESTRICTED_EXTRA_ACTION_BUCKET]:{
        kind:"extra-action",
        allowsMagicAction:false,
        activeTurnOnly:true,
      },
    },
  },
};

function genericDefinition(id="external.rule.quickstep",entryPointId="activate"):CommonPlayOperationDefinition {
  return {
    schemaVersion:"0.2-draft",
    id,
    entryPoints:[{
      id:entryPointId,
      invocation:"manual",
      operations:[
        { kind:"resource.change", resource:"external.resource.primary", amount:{ value:-1 } },
        { kind:"resource.change", resource:"external.resource.turn", amount:{ value:-1 } },
        { kind:"economy.modify", bucket:RESTRICTED_EXTRA_ACTION_BUCKET, amount:{ value:1 } },
      ],
    }],
  };
}

function genericState(primary=1,turn=1) {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="action";
  state.combatants.hero.resources.push(
    { id:"external.resource.primary", label:"External Primary", current:primary, maximum:1 },
    { id:"external.resource.turn", label:"External Turn", current:turn, maximum:1 },
  );
  return state;
}

function semantics(state:ReturnType<typeof runtimeState>) {
  const hero=state.combatants.hero;
  return {
    primary:hero.resources.find((entry)=>entry.id==="external.resource.primary")?.current,
    turn:hero.resources.find((entry)=>entry.id==="external.resource.turn")?.current,
    action:hero.economy.action,
    extraActions:(hero.economy.extraActions??[]).map((entry)=>({ allowsMagicAction:entry.allowsMagicAction })),
  };
}

function resolveGeneric(
  state:ReturnType<typeof runtimeState>,
  definition=genericDefinition(),
  entryPointId=definition.entryPoints[0].id,
) {
  return resolveCommonPlayEntryPointOperations(PROFILE,state,definition,{
    resolutionId:`resolution.${definition.id}`,
    actorId:"hero",
    entryPointId,
  });
}

function portableAttackDefinition(id:string):CommonPlayOperationDefinition {
  return {
    schemaVersion:"0.2-draft",
    id,
    payments:[{
      kind:"economy",
      bucket:"action",
      amount:{value:1},
      actionKind:"attack",
      attacksPerAction:2,
      consumeAt:"commit",
      refundOnCancel:true,
    }],
    entryPoints:[{
      id:"attack",
      invocation:"manual",
      operations:[],
    }],
  };
}

function portableAttackState() {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="action";
  return state;
}

function resolvePortableAttack(
  state:ReturnType<typeof runtimeState>,
  definition:CommonPlayOperationDefinition,
  resolutionId:string,
) {
  return resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId,
    actorId:"hero",
    entryPointId:"attack",
  });
}

test("unknown external Common Play action economy content spends resources atomically and grants a profile-defined restricted action", () => {
  const state=genericState();
  const result=resolveGeneric(state);
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.deepEqual(semantics(result.state),{
    primary:0,
    turn:0,
    action:true,
    extraActions:[{ allowsMagicAction:false }],
  });
});

test("renaming only external definition and entry-point IDs preserves action economy semantics", () => {
  const first=resolveGeneric(genericState(),genericDefinition("external.rule.alpha","activate-alpha"),"activate-alpha");
  const renamed=resolveGeneric(genericState(),genericDefinition("external.rule.beta","activate-beta"),"activate-beta");
  assert.equal(first.status,"committed");
  assert.equal(renamed.status,"committed");
  if (first.status!=="committed"||renamed.status!=="committed") return;
  assert.deepEqual(semantics(first.state),semantics(renamed.state));
});

test("a failed later resource change rolls back the earlier spend", () => {
  const state=genericState(1,0);
  const result=resolveGeneric(state);
  assert.equal(result.status,"rejected");
  assert.equal(state.combatants.hero.resources.find((entry)=>entry.id==="external.resource.primary")?.current,1);
  assert.equal(result.state,state);
});

test("an unregistered economy bucket fails explicitly", () => {
  const definition=genericDefinition();
  definition.entryPoints[0].operations[2]={
    kind:"economy.modify",
    bucket:"external.unregistered-bucket",
    amount:{ value:1 },
  };
  const result=resolveGeneric(genericState(),definition);
  assert.equal(result.status,"rejected");
  assert.match(result.status==="rejected"?result.error:"",/economy.*bucket|unregistered|unsupported/i);
});

test("generic action economy composition matches the Action Surge golden state changes without knowing Fighter content identity", () => {
  const namedState=runtimeState();
  namedState.clock.activeActorId="hero";
  namedState.clock.phase="action";
  namedState.combatants.hero.resources.push(...coreClassResourceDefinitions([
    { classId:FIGHTER_ID, className:"Fighter", level:5 },
  ]).map((definition)=>({
    id:definition.resourceId,
    label:definition.label,
    current:definition.maximum,
    maximum:definition.maximum,
    recovery:definition.recovery,
  })));
  const named=resolveFighterActionSurge(TEST_PROFILE,namedState,{
    id:"fighter.action-surge.golden",
    actorId:"hero",
    expectedRevision:namedState.revision,
    fighterLevel:5,
  });
  assert.equal(named.status,"committed");
  if (named.status!=="committed") return;

  const genericStateForParity=runtimeState();
  genericStateForParity.clock.activeActorId="hero";
  genericStateForParity.clock.phase="action";
  genericStateForParity.combatants.hero.resources.push(
    { id:FIGHTER_ACTION_SURGE_RESOURCE_ID, label:"Primary", current:1, maximum:1 },
    { id:FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID, label:"Turn", current:1, maximum:1 },
  );
  const definition:CommonPlayOperationDefinition={
    schemaVersion:"0.2-draft",
    id:"external.rule.not-fighter",
    entryPoints:[{
      id:"activate",
      invocation:"manual",
      operations:[
        { kind:"resource.change", resource:FIGHTER_ACTION_SURGE_RESOURCE_ID, amount:{ value:-1 } },
        { kind:"resource.change", resource:FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID, amount:{ value:-1 } },
        { kind:"economy.modify", bucket:RESTRICTED_EXTRA_ACTION_BUCKET, amount:{ value:1 } },
      ],
    }],
  };
  const generic=resolveCommonPlayEntryPointOperations(PROFILE,genericStateForParity,definition,{
    resolutionId:"external.parity",
    actorId:"hero",
    entryPointId:"activate",
  });
  assert.equal(generic.status,"committed");
  if (generic.status!=="committed") return;

  const namedHero=named.state.combatants.hero;
  const genericHero=generic.state.combatants.hero;
  assert.equal(
    genericHero.resources.find((entry)=>entry.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,
    namedHero.resources.find((entry)=>entry.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,
  );
  assert.equal(
    genericHero.resources.find((entry)=>entry.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,
    namedHero.resources.find((entry)=>entry.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,
  );
  assert.equal(genericHero.economy.action,namedHero.economy.action);
  assert.deepEqual(
    (genericHero.economy.extraActions??[]).map((entry)=>entry.allowsMagicAction),
    (namedHero.economy.extraActions??[]).map((entry)=>entry.allowsMagicAction),
  );
});

test("profile policy rejects an active-turn-only extra action outside the actor's turn", () => {
  const state=genericState();
  state.clock.activeActorId="goblin";
  const result=resolveGeneric(state);
  assert.equal(result.status,"rejected");
  assert.equal(result.state,state);
  assert.match(result.status==="rejected"?result.error:"",/active turn|actor.*turn/i);
});

test("portable Common Play attack payment spends one Action then its Extra Attack grant", () => {
  const definition=portableAttackDefinition("external.family-j.extra-attack");
  const first=resolvePortableAttack(portableAttackState(),definition,"resolution.family-j.extra-attack.first");
  assert.equal(first.status,"committed");
  if(first.status!=="committed") return;
  assert.equal(first.state.combatants.hero.economy.action,false);
  assert.equal(first.state.combatants.hero.economy.extraAttacks?.length,1);

  const second=resolvePortableAttack(first.state,definition,"resolution.family-j.extra-attack.second");
  assert.equal(second.status,"committed");
  if(second.status!=="committed") return;
  assert.equal(second.state.combatants.hero.economy.action,false);
  assert.equal(second.state.combatants.hero.economy.extraAttacks?.length,0);

  const third=resolvePortableAttack(second.state,definition,"resolution.family-j.extra-attack.third");
  assert.equal(third.status,"rejected");
});

test("portable Extra Attack payment is invariant under unrelated external definition identity", () => {
  const first=resolvePortableAttack(portableAttackState(),portableAttackDefinition("external.family-j.alpha"),"resolution.family-j.alpha");
  const renamed=resolvePortableAttack(portableAttackState(),portableAttackDefinition("unrelated.portable.attack.beta"),"resolution.family-j.beta");
  assert.equal(first.status,"committed");
  assert.equal(renamed.status,"committed");
  if(first.status!=="committed"||renamed.status!=="committed") return;
  assert.deepEqual(
    {
      action:first.state.combatants.hero.economy.action,
      extraAttacks:first.state.combatants.hero.economy.extraAttacks?.length,
    },
    {
      action:renamed.state.combatants.hero.economy.action,
      extraAttacks:renamed.state.combatants.hero.economy.extraAttacks?.length,
    },
  );
});

test("portable attacksPerAction metadata is rejected outside an Attack Action payment", () => {
  const definition=portableAttackDefinition("external.family-j.invalid-extra-attack");
  const payment=definition.payments?.[0];
  if(!payment||payment.kind!=="economy") throw new Error("economy payment fixture missing");
  payment.bucket="reaction";

  assert.throws(
    () => resolvePortableAttack(portableAttackState(),definition,"resolution.family-j.invalid-extra-attack"),
    /attacksPerAction requires bucket=action and actionKind=attack/,
  );
});

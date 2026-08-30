import assert from "node:assert/strict";
import test from "node:test";
import { advanceCommonPlayProject, cancelCommonPlayProject, type CommonPlayProject } from "../../src/domain/commonPlayProjectRuntime";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function project(overrides:Partial<CommonPlayProject>={}):CommonPlayProject {
  return {
    id:"project.external.scroll",
    ownerId:"owner.mage",
    definitionId:"external.crafting.scroll",
    revision:3,
    requiredWork:10,
    completedWork:4,
    status:"active",
    payments:{gp:20},
    contributors:["ally.artificer"],
    ...overrides,
  };
}

test("authorized project contributors add non-consecutive work while owner remains revision authority",()=>{
  const first=advanceCommonPlayProject(project(),{
    expectedRevision:3,
    ownerId:"owner.mage",
    contributorId:"ally.artificer",
    work:2,
    payments:{gp:5},
  });
  assert.equal(first.status,"committed");
  if(first.status!=="committed") return;
  assert.equal(first.project.completedWork,6);
  assert.deepEqual(first.project.payments,{gp:25});
  assert.equal(first.project.revision,4);
  assert.deepEqual(first.project.contributors,["ally.artificer"]);

  const second=advanceCommonPlayProject(first.project,{
    expectedRevision:4,
    ownerId:"owner.mage",
    work:4,
  });
  assert.equal(second.status,"committed");
  if(second.status!=="committed") return;
  assert.equal(second.project.status,"completed");
  assert.equal(second.project.completedWork,10);
});

test("unlisted contributors and stale owner revisions are rejected without mutating project state",()=>{
  const original=project();
  const outsider=advanceCommonPlayProject(original,{
    expectedRevision:3,
    ownerId:"owner.mage",
    contributorId:"outsider.rogue",
    work:1,
  });
  assert.equal(outsider.status,"rejected");
  assert.match(outsider.status==="rejected"?outsider.error:"",/contributor/);
  assert.deepEqual(outsider.project,original);

  const stale=advanceCommonPlayProject(original,{
    expectedRevision:2,
    ownerId:"owner.mage",
    contributorId:"ally.artificer",
    work:1,
  });
  assert.equal(stale.status,"rejected");
  assert.match(stale.status==="rejected"?stale.error:"",/revision mismatch/);
  assert.deepEqual(stale.project,original);
});

test("only the authoritative owner can cancel an active project and cancellation preserves accrued history",()=>{
  const original=project();
  const unauthorized=cancelCommonPlayProject(original,{expectedRevision:3,ownerId:"ally.artificer"});
  assert.equal(unauthorized.status,"rejected");
  assert.match(unauthorized.status==="rejected"?unauthorized.error:"",/owner mismatch/);

  const cancelled=cancelCommonPlayProject(original,{expectedRevision:3,ownerId:"owner.mage"});
  assert.equal(cancelled.status,"committed");
  if(cancelled.status!=="committed") return;
  assert.equal(cancelled.project.status,"cancelled");
  assert.equal(cancelled.project.revision,4);
  assert.equal(cancelled.project.completedWork,4);
  assert.deepEqual(cancelled.project.payments,{gp:20});
  assert.deepEqual(cancelled.project.contributors,["ally.artificer"]);

  const afterCancel=advanceCommonPlayProject(cancelled.project,{expectedRevision:4,ownerId:"owner.mage",work:1});
  assert.equal(afterCancel.status,"rejected");
  assert.match(afterCancel.status==="rejected"?afterCancel.error:"",/not active/);
});

test("project collaboration semantics are independent of external content identity",()=>{
  const run=(definitionId:string,ownerId:string,contributorId:string)=>advanceCommonPlayProject(project({definitionId,ownerId,contributors:[contributorId]}),{
    expectedRevision:3,ownerId,contributorId,work:2,payments:{gp:5},
  });
  const original=run("external.crafting.scroll","owner.mage","ally.artificer");
  const renamed=run("renamed.unseen.project","renamed.owner","renamed.contributor");
  assert.equal(original.status,"committed");
  assert.equal(renamed.status,"committed");
  if(original.status!=="committed"||renamed.status!=="committed") return;
  assert.deepEqual(
    {work:original.project.completedWork,payments:original.project.payments,status:original.project.status,revision:original.project.revision},
    {work:renamed.project.completedWork,payments:renamed.project.payments,status:renamed.project.status,revision:renamed.project.revision},
  );
});

test("portable project progress pays atomically and emits its inventory output only on completion",()=>{
  const initial=runtimeState();
  const spawned=resolvePendingResolution(TEST_PROFILE,initial,{id:"spawn",actorId:"hero",sourceId:"external.recipe",expectedRevision:0,operations:[{id:"project",kind:"spawn-artifact",artifact:{id:"project.instance",sourceId:"external.recipe",sourceActorId:"hero",templateId:"craft",artifactKind:"project",expiry:{kind:"permanent"},project:{id:"project.instance",ownerId:"hero",definitionId:"external.recipe",revision:0,requiredWork:2,completedWork:0,status:"active",payments:{},requirements:{toolProficiencyIds:["external.tool"],preparedSpellDefinitionIds:["external.spell"]}}}}]});
  assert.equal(spawned.status,"committed");if(spawned.status!=="committed")return;
  const definition=parseCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id:"external.recipe",payments:[{kind:"resource",resource:"spell-slot-1",amount:{value:1},consumeAt:"commit"}],entryPoints:[{id:"work",invocation:"manual",operations:[{kind:"project.advance",artifact:"craft",work:{value:1},onComplete:{operations:[{kind:"item.grant",target:"actor",item:{id:"crafted.scroll",definitionId:"external.scroll",name:"External Scroll",kind:"consumable",quantity:1,equipped:false,passiveEffects:[],grantedActionIds:[],spellDefinitionIds:["external.spell"],provenance:["external.recipe"]}}]}}]}]});
  const input=(resolutionId:string)=>({resolutionId,actorId:"hero",entryPointId:"work",projectToolProficiencyIds:["external.tool"],projectPreparedSpellDefinitionIds:["external.spell"]});
  const first=resolvePendingResolution(TEST_PROFILE,spawned.state,compileCommonPlayEntryPointOperations(TEST_PROFILE,spawned.state,definition,input("work.1")));
  assert.equal(first.status,"committed");if(first.status!=="committed")return;
  assert.equal(first.state.artifacts?.[0].project?.completedWork,1);assert.equal(first.state.combatants.hero.resources[0].current,1);
  assert.equal(first.events.some((event)=>event.stateChanges.some((change)=>change.kind==="inventory-item")),false);
  const second=resolvePendingResolution(TEST_PROFILE,first.state,compileCommonPlayEntryPointOperations(TEST_PROFILE,first.state,definition,input("work.2")));
  assert.equal(second.status,"committed");if(second.status!=="committed")return;
  assert.equal(second.state.artifacts?.[0].project?.status,"completed");assert.equal(second.state.combatants.hero.resources[0].current,0);
  const output=second.events.flatMap((event)=>event.stateChanges).find((change)=>change.kind==="inventory-item");
  assert.equal(output?.kind==="inventory-item"?output.after?.definitionId:undefined,"external.scroll");
});

test("portable project prerequisites reject before any payment or project mutation",()=>{
  const original=project({requirements:{toolProficiencyIds:["external.tool"],preparedSpellDefinitionIds:["external.spell"]}});
  const rejected=advanceCommonPlayProject(original,{expectedRevision:3,ownerId:"owner.mage",work:1,toolProficiencyIds:["external.tool"]});
  assert.equal(rejected.status,"rejected");assert.match(rejected.status==="rejected"?rejected.error:"",/prepared spell/);assert.deepEqual(rejected.project,original);
});

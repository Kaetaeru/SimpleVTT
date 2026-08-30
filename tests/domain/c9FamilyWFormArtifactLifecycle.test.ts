import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlayArtifactActivation, type CommonPlayArtifactActivationDefinition } from "../../src/domain/commonPlayArtifactRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function formDefinition(prefix="external.unknown"):CommonPlayArtifactActivationDefinition {
  return {
    schemaVersion:"0.2-draft",
    id:`${prefix}.form`,
    entryPoints:[{id:"transform",invocation:"manual",operations:[{kind:"artifact.spawn",template:"form"}]}],
    artifactTemplates:[{
      id:"form",artifactKind:"form",duration:{kind:"durable"},lifetime:{kind:"durable"},
      initialState:{
        targetActorId:"actor",controllerId:"actor",
        propertyOverlay:{"movement.fly":30,"ability.str.score":18},
        retainedProperties:["ability.int.score"],replacementProperties:["movement.fly","ability.str.score"],
        hpPolicy:"retain",actionPolicy:"grant",spellcasting:"restricted",
        actionDefinitionIds:[`${prefix}.form.claw`],resources:[{id:`${prefix}.form.resource`,current:2,maximum:2}],
      },
    }],
  };
}

test("portable form artifact owns controller changes and removal through Resolver state changes",()=>{
  const activated=resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),formDefinition(),{
    resolutionId:"family-w-form",actorId:"hero",entryPointId:"transform",
  });
  assert.equal(activated.status,"committed");
  if(activated.status!=="committed") return;
  const form=activated.state.artifacts?.find((artifact)=>artifact.artifactKind==="form");
  assert.ok(form?.form);
  assert.equal(form.form.targetActorId,"hero");
  assert.equal(form.form.controllerId,"hero");
  assert.equal(form.form.propertyOverlay["movement.fly"],30);
  assert.deepEqual(form.form.actionDefinitionIds,["external.unknown.form.claw"]);

  const reassigned=resolvePendingResolution(TEST_PROFILE,activated.state,{
    id:"family-w-controller",actorId:"hero",sourceId:"external.unknown.form",expectedRevision:activated.state.revision,
    operations:[{id:"controller",kind:"set-artifact-controller",artifactId:form.id,controllerId:"external.controller"}],
  });
  assert.equal(reassigned.status,"committed");
  if(reassigned.status!=="committed") return;
  assert.equal(reassigned.state.artifacts?.find((artifact)=>artifact.id===form.id)?.form?.controllerId,"external.controller");

  const removed=resolvePendingResolution(TEST_PROFILE,reassigned.state,{
    id:"family-w-end",actorId:"hero",sourceId:"external.unknown.form",expectedRevision:reassigned.state.revision,
    operations:[{id:"remove",kind:"remove-artifact",artifactId:form.id}],
  });
  assert.equal(removed.status,"committed");
  if(removed.status!=="committed") return;
  assert.equal(removed.state.artifacts?.some((artifact)=>artifact.id===form.id),false);
  assert.equal(removed.events.some((event)=>event.stateChanges.some((change)=>change.kind==="artifact"&&change.operation==="removed"&&change.artifactId===form.id)),true);
});

test("portable form artifact lifecycle is invariant under external identity rename",()=>{
  const first=resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),formDefinition("external.first"),{
    resolutionId:"family-w-first",actorId:"hero",entryPointId:"transform",
  });
  const renamed=resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),formDefinition("renamed.second"),{
    resolutionId:"family-w-renamed",actorId:"hero",entryPointId:"transform",
  });
  assert.equal(first.status,"committed");
  assert.equal(renamed.status,"committed");
  if(first.status!=="committed"||renamed.status!=="committed") return;
  assert.deepEqual(
    first.state.artifacts?.map((artifact)=>({kind:artifact.artifactKind,target:artifact.form?.targetActorId,controller:artifact.form?.controllerId})),
    renamed.state.artifacts?.map((artifact)=>({kind:artifact.artifactKind,target:artifact.form?.targetActorId,controller:artifact.form?.controllerId})),
  );
});

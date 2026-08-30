import assert from "node:assert/strict";
import test from "node:test";
import { advanceCommonPlayProject, cancelCommonPlayProject, type CommonPlayProject } from "../../src/domain/commonPlayProjectRuntime";

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

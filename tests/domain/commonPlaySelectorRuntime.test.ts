import assert from "node:assert/strict";
import test from "node:test";
import { resolveCommonPlaySelector, type CommonPlaySelectorCandidate } from "../../src/domain/commonPlaySelectorRuntime";

const candidates:CommonPlaySelectorCandidate[]=[
  {id:"orc",targeting:{id:"orc",kind:"creature",relation:"enemy",cover:"none"},properties:{relation:"enemy",tags:["undead"],initiative:12},areaMember:true},
  {id:"goblin",targeting:{id:"goblin",kind:"creature",relation:"enemy",cover:"none"},properties:{relation:"enemy",tags:["goblinoid"],initiative:18},areaMember:true},
  {id:"hero",targeting:{id:"hero",kind:"creature",relation:"self",cover:"none"},properties:{relation:"self",tags:["humanoid"],initiative:20},areaMember:false},
];

test("generic selector filters, orders, and preserves manual authority without identity dispatch",()=>{
  const selector={from:"targets" as const,min:1,max:2,orderBy:"initiative",where:{op:"relation-matches" as const,ref:"relation",value:"enemy"}};
  const resolved=resolveCommonPlaySelector({sourceId:"hero",selector,candidates,selectedIds:["goblin","orc"],selection:"manual",authority:"actor-owner"});
  assert.equal(resolved.status,"resolved");
  if(resolved.status==="resolved") assert.deepEqual(resolved.targetIds,["goblin","orc"]);
  const renamed=resolveCommonPlaySelector({sourceId:"hero",selector,candidates:candidates.map((candidate)=>({...candidate,properties:{...candidate.properties,contentId:"renamed"}})),selectedIds:["goblin","orc"],selection:"manual",authority:"actor-owner"});
  assert.equal(renamed.status,"resolved");
});

test("area selector requires authoritative membership and never fabricates geometry",()=>{
  const selector={from:"targets" as const,min:1,max:3,area:{kind:"instant" as const,shape:"cone" as const,origin:"self" as const,lengthFeet:15}};
  const missing=resolveCommonPlaySelector({sourceId:"hero",selector,candidates:candidates.map(({areaMember,...candidate})=>candidate),selection:"automatic",authority:"provider"});
  assert.equal(missing.status,"unsupported");
  const resolved=resolveCommonPlaySelector({sourceId:"hero",selector,candidates,selection:"automatic",authority:"provider"});
  assert.equal(resolved.status,"resolved");
  if(resolved.status==="resolved") assert.deepEqual(resolved.targetIds,["orc","goblin"]);
});

test("selector rejects duplicate and ineligible manual identities",()=>{
  const selector={from:"targets" as const,min:1,max:2,where:{op:"relation-matches" as const,ref:"relation",value:"enemy"}};
  assert.equal(resolveCommonPlaySelector({sourceId:"hero",selector,candidates,selectedIds:["orc","orc"],selection:"manual",authority:"dm"}).status,"rejected");
  assert.equal(resolveCommonPlaySelector({sourceId:"hero",selector,candidates,selectedIds:["hero"],selection:"manual",authority:"dm"}).status,"rejected");
});

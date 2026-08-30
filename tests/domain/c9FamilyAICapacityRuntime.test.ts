import assert from "node:assert/strict";
import test from "node:test";
import {commonPlayCarryingCapacityPounds,resolveCommonPlayInventoryTransaction,resolveCommonPlayItemTransfer,type CommonPlayInventoryState} from "../../src/domain/commonPlayInventoryRuntime";
import {validateCommonPlayVehicle} from "../../src/domain/commonPlayMountRuntime";
import {TEST_PROFILE} from "./rulesTestState";

const item=(id:string,weightPounds:number,containerId?:string)=>({id,definitionId:`external.${id}`,quantity:1,stackable:false,equipped:false,wielded:false,weightPounds,...(containerId?{containerId}:{})});

test("RulesProfile carrying capacity scales Strength by authoritative size",()=>{
  assert.equal(commonPlayCarryingCapacityPounds(TEST_PROFILE,10,"tiny"),75);
  assert.equal(commonPlayCarryingCapacityPounds(TEST_PROFILE,10,"medium"),150);
  assert.equal(commonPlayCarryingCapacityPounds(TEST_PROFILE,10,"large"),300);
});

test("one revisioned inventory transaction enforces character, mount, vehicle, and container cargo",()=>{
  const character:CommonPlayInventoryState={ownerId:"external.character",revision:0,capacityPounds:20,items:[{...item("bag",2),containerCapacityPounds:10}]};
  const loaded=resolveCommonPlayInventoryTransaction(character,{expectedRevision:0,operations:[{kind:"grant",item:item("ore",8,"bag")}]});assert.equal(loaded.status,"committed");
  const containerOverflow=resolveCommonPlayInventoryTransaction(character,{expectedRevision:0,operations:[{kind:"grant",item:item("renamed.ore",11,"bag")}]});assert.equal(containerOverflow.status,"rejected");assert.equal(character.revision,0);
  const characterOverflow=resolveCommonPlayInventoryTransaction(character,{expectedRevision:0,operations:[{kind:"grant",item:item("anvil",19)}]});assert.equal(characterOverflow.status,"rejected");

  const mount:CommonPlayInventoryState={ownerId:"external.mount",revision:0,capacityPounds:commonPlayCarryingCapacityPounds(TEST_PROFILE,16,"large"),items:[]};
  assert.equal(resolveCommonPlayInventoryTransaction(mount,{expectedRevision:0,operations:[{kind:"grant",item:item("mount-cargo",480)}]}).status,"committed");
  const vehicle=validateCommonPlayVehicle({draftActorId:"external.mount",vehicleId:"external.vehicle",capacityPounds:600,minimumCrew:1,crewIds:["external.driver"],speedFeet:40});
  const cargo:CommonPlayInventoryState={ownerId:vehicle.vehicleId,revision:0,capacityPounds:vehicle.capacityPounds,items:[]};
  assert.equal(resolveCommonPlayInventoryTransaction(cargo,{expectedRevision:0,operations:[{kind:"grant",item:item("vehicle-cargo",601)}]}).status,"rejected");
});

test("two-owner transfer rejects target capacity atomically and clears old container ownership on success",()=>{
  const source:CommonPlayInventoryState={ownerId:"source",revision:3,capacityPounds:100,items:[{...item("crate",5),containerCapacityPounds:20},item("gem",4,"crate")]};
  const tooSmall:CommonPlayInventoryState={ownerId:"target",revision:7,capacityPounds:3,items:[]};
  const rejected=resolveCommonPlayItemTransfer(source,tooSmall,{sourceRevision:3,targetRevision:7,itemId:"gem",quantity:1,newItemId:"renamed.gem"});assert.equal(rejected.status,"rejected");assert.equal(source.items.length,2);assert.equal(tooSmall.items.length,0);
  const target={...tooSmall,capacityPounds:10};const committed=resolveCommonPlayItemTransfer(source,target,{sourceRevision:3,targetRevision:7,itemId:"gem",quantity:1,newItemId:"renamed.gem"});assert.equal(committed.status,"committed");if(committed.status==="committed")assert.equal(committed.item.containerId,undefined);
});

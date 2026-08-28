import assert from "node:assert/strict";
import test from "node:test";
import {
  commonPlayItemBenefitsActive,
  resolveCommonPlayAttunement,
  resolveCommonPlayAttunementLoss,
  resolveCommonPlayInventoryTransaction,
  resolveCommonPlayItemTransfer,
  type CommonPlayInventoryState,
  type CommonPlayItemInstance,
} from "../../src/domain/commonPlayInventoryRuntime";

function magicItem(id="item.wand"):CommonPlayItemInstance {
  return {id,definitionId:"external.unknown.magic-item",quantity:1,stackable:false,equipped:false,wielded:false,charges:{current:3,maximum:5},attunement:{required:true,prerequisite:{op:"has-tag",ref:"actor.tags",value:"spellcaster"},loss:{onDeath:true}},grantedEntryPointIds:["cast"],effectDefinitionIds:["effect.a"],spellDefinitionIds:["spell.a"]};
}
function inventory(ownerId="hero"):CommonPlayInventoryState {return {ownerId,revision:0,items:[magicItem()]};}

test("inventory transaction atomically grants, equips, wields, consumes charges, and destroys",()=>{
  const state=inventory();
  const committed=resolveCommonPlayInventoryTransaction(state,{expectedRevision:0,operations:[
    {kind:"grant",item:{id:"item.potion",definitionId:"external.potion",quantity:2,stackable:true,equipped:false,wielded:false}},
    {kind:"equip",itemId:"item.wand",equipped:true},
    {kind:"wield",itemId:"item.wand",wielded:true,slot:"main-hand"},
    {kind:"charges",itemId:"item.wand",delta:-2},
    {kind:"quantity",itemId:"item.potion",delta:-2,removeAtZero:true},
  ]});
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  assert.equal(committed.state.revision,1);
  assert.equal(committed.state.items.find((item)=>item.id==="item.wand")?.charges?.current,1);
  assert.equal(committed.state.items.find((item)=>item.id==="item.wand")?.wieldSlot,"main-hand");
  assert.equal(committed.state.items.some((item)=>item.id==="item.potion"),false);
  assert.equal(state.revision,0,"input durable revision is immutable");
});

test("a late inventory failure rolls back every earlier operation",()=>{
  const state=inventory();
  const rejected=resolveCommonPlayInventoryTransaction(state,{expectedRevision:0,operations:[
    {kind:"equip",itemId:"item.wand",equipped:true},
    {kind:"charges",itemId:"item.wand",delta:-9},
  ]});
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.state,state);
  assert.equal(state.items[0].equipped,false);
  assert.equal(state.items[0].charges?.current,3);
});

test("rules-bearing containers require valid acyclic durable ownership",()=>{
  const state=inventory();
  const committed=resolveCommonPlayInventoryTransaction(state,{expectedRevision:0,operations:[
    {kind:"grant",item:{id:"bag",definitionId:"external.bag",quantity:1,stackable:false,equipped:false,wielded:false}},
    {kind:"grant",item:{id:"gem",definitionId:"external.gem",quantity:1,stackable:false,equipped:false,wielded:false,containerId:"bag"}},
  ]});
  assert.equal(committed.status,"committed");
  const invalid=resolveCommonPlayInventoryTransaction(state,{expectedRevision:0,operations:[
    {kind:"grant",item:{id:"orphan",definitionId:"external.orphan",quantity:1,stackable:false,equipped:false,wielded:false,containerId:"missing"}},
  ]});
  assert.equal(invalid.status,"rejected");
});

test("owner transfer is two-revision atomic and clears equipment and exclusive attunement",()=>{
  const source=inventory();source.items[0].equipped=true;source.items[0].attunement!.attunedTo="hero";
  const target:CommonPlayInventoryState={ownerId:"ally",revision:4,items:[]};
  const transferred=resolveCommonPlayItemTransfer(source,target,{sourceRevision:0,targetRevision:4,itemId:"item.wand",quantity:1,newItemId:"item.wand.transferred"});
  assert.equal(transferred.status,"committed");
  if(transferred.status!=="committed") return;
  assert.equal(transferred.source.items.length,0);assert.equal(transferred.source.revision,1);
  assert.equal(transferred.target.revision,5);assert.equal(transferred.item.equipped,false);
  assert.equal(transferred.item.attunement?.attunedTo,undefined);
});

test("attunement requires Short Rest, prerequisites, capacity, exclusive owner, and activates benefits",()=>{
  const state=inventory();
  assert.equal(commonPlayItemBenefitsActive(state,"item.wand"),false);
  const noRest=resolveCommonPlayAttunement(state,{expectedRevision:0,itemId:"item.wand",action:"attune",maximum:3,facts:{"actor.tags":["spellcaster"]}});
  assert.equal(noRest.status,"rejected");
  const attuned=resolveCommonPlayAttunement(state,{expectedRevision:0,itemId:"item.wand",action:"attune",maximum:3,shortRestCompleted:true,facts:{"actor.tags":["spellcaster"]}});
  assert.equal(attuned.status,"committed");
  if(attuned.status!=="committed") return;
  assert.equal(commonPlayItemBenefitsActive(attuned.state,"item.wand"),true);
  assert.equal(attuned.state.items[0].attunement?.attunedTo,"hero");

  attuned.state.items[0].attunement!.cursed=true;
  const cursed=resolveCommonPlayAttunement(attuned.state,{expectedRevision:1,itemId:"item.wand",action:"unattune",maximum:3});
  assert.equal(cursed.status,"rejected");
  const removed=resolveCommonPlayAttunement(attuned.state,{expectedRevision:1,itemId:"item.wand",action:"unattune",maximum:3,curseRemoved:true});
  assert.equal(removed.status,"committed");
});

test("rule-driven attunement loss and identity rename use the same semantics",()=>{
  const state=inventory();state.items[0].attunement!.attunedTo="hero";
  const lost=resolveCommonPlayAttunementLoss(state,{expectedRevision:0,itemId:"item.wand",ownerDead:true});
  assert.equal(lost.status,"committed");
  if(lost.status!=="committed") return;
  assert.equal(lost.state.items[0].attunement?.attunedTo,undefined);
  const renamed=inventory();renamed.items=[magicItem("unknown.renamed")];
  const attuned=resolveCommonPlayAttunement(renamed,{expectedRevision:0,itemId:"unknown.renamed",action:"attune",maximum:3,shortRestCompleted:true,facts:{"actor.tags":["spellcaster"]}});
  assert.equal(attuned.status,"committed");
});

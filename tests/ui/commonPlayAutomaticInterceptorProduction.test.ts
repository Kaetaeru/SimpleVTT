import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { AppSnapshot, CatalogEntry, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { SemanticPredicate } from "../../src/domain/profileEngine";

// X1-02: a feat's automatic interceptor (no `interaction`) applies during the production attack flow without an interrupt.
const ALERT="dnd.srd521.feat.alert";
const GOBLIN="combatant.goblin-a";

type FactQuery={id:string;fact:string;subject:string;authority:"host";visibility:"public";unknownPolicy:"treat-false"};
const query=(id:string,fact:string,subject="intercepted.actor"):FactQuery=>({id,fact,subject,authority:"host",visibility:"public",unknownPolicy:"treat-false"});

function archeryLike(factQueries:FactQuery[],when:SemanticPredicate) {
  return {
    "$schema":"https://simplevtt.local/schemas/common-play-contract.schema.json",schemaVersion:"0.2-draft",id:"feat.alert.test-archery",
    interceptors:[{
      id:"ranged-attack-bonus",timing:"d20.outcome-determined",operation:"recalculate",slot:"d20.roll",families:["attack-roll"],
      factQueries,when,
      operations:[{kind:"roll.modify",mode:"add-flat",value:{value:2}}],
    }],
  };
}

function defenseLike(factQueries:FactQuery[],when:SemanticPredicate) {
  return {
    "$schema":"https://simplevtt.local/schemas/common-play-contract.schema.json",schemaVersion:"0.2-draft",id:"feat.alert.test-defense",
    interceptors:[{
      id:"armored-ac-bonus",timing:"attack.outcome-determined",operation:"recalculate",slot:"attack.outcome",
      factQueries,when,
      operations:[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:1}}],
    }],
  };
}

/** Gives the reference Character the Alert feat as a grant and attaches the probe mechanics to the builtin Alert entry. */
async function prepare(config:Record<string,unknown>) {
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm;catalog:CatalogEntry[]};
  const alert=internal.catalog.find((entry)=>entry.scope==="builtin"&&(entry.contentId??entry.id)===ALERT);
  assert.ok(alert,"the adapter catalog carries the builtin Alert feat");
  alert.mechanics=[{kind:"common-play",config}];
  internal.activeCharacter.featIds=[ALERT];
  await adapter.startInitiative();
  return {adapter,internal};
}

async function attackResult(adapter:MockAdapter,actorId:string,actionId:string,targetId:string,natural:number) {
  await adapter.setCurrentActor(actorId);
  await adapter.setQueuedD20(natural);
  let snapshot=await adapter.resolveAction(actionId,[targetId]);
  // A miss completes in the same step the attack result is determined; a hit pauses at attack-result before damage.
  for(let step=0;step<4&&snapshot.resolution?.stage!=="attack-result"&&snapshot.resolution?.stage!=="complete";step+=1)snapshot=await adapter.advanceResolution();
  assert.ok(snapshot.resolution?.stage==="attack-result"||snapshot.resolution?.stage==="complete",JSON.stringify(snapshot.resolution));
  return snapshot;
}

function commonPlayContribution(snapshot:AppSnapshot) {
  return snapshot.resolution?.rollModifierContributions?.find((entry)=>entry.source.startsWith("common-play:"));
}

test("an Archery-like automatic interceptor adds +2 to a ranged weapon attack roll and leaves a melee attack alone",async()=>{
  const {adapter,internal}=await prepare(archeryLike([query("ranged","attack.weapon.ranged")],{op:"eq",left:{ref:"ranged"},right:{value:true}}));
  const hero=internal.activeCharacter.id;
  let snapshot=await attackResult(adapter,hero,"action.shortbow",GOBLIN,10);
  assert.equal(snapshot.resolution?.interrupt,undefined,"an automatic interceptor never opens an interrupt");
  assert.equal(snapshot.resolution?.attackTotal,10+5+2,JSON.stringify(snapshot.resolution?.rollModifierContributions));
  assert.equal(commonPlayContribution(snapshot)?.value,2);
  assert.ok(snapshot.resolution?.detail.some((line)=>/자동 적용/.test(line)),snapshot.resolution?.detail.join(" | "));
  while(snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance)snapshot=await adapter.advanceResolution();

  snapshot=await attackResult(adapter,hero,"action.longsword",GOBLIN,10);
  assert.equal(snapshot.resolution?.attackTotal,10+7,JSON.stringify(snapshot.resolution?.rollModifierContributions));
  assert.equal(commonPlayContribution(snapshot),undefined,"the melee attack fails the ranged predicate");
});

test("the two-handed attack fact follows the weapon definition and the wield slot, and a failed predicate is silently not applied",async()=>{
  const {adapter,internal}=await prepare(archeryLike([query("two-handed","attack.weapon.two-handed")],{op:"eq",left:{ref:"two-handed"},right:{value:true}}));
  const hero=internal.activeCharacter.id;
  // The SRD shortbow carries the two-handed property → applied.
  let snapshot=await attackResult(adapter,hero,"action.shortbow",GOBLIN,10);
  assert.equal(commonPlayContribution(snapshot)?.value,2,JSON.stringify(snapshot.resolution?.rollModifierContributions));
  while(snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance)snapshot=await adapter.advanceResolution();
  // The longsword is versatile and wielded in the main hand only → the predicate fails and nothing is applied.
  snapshot=await attackResult(adapter,hero,"action.longsword",GOBLIN,10);
  assert.equal(commonPlayContribution(snapshot),undefined);
  assert.equal(snapshot.resolution?.attackTotal,17);
  assert.ok(!snapshot.resolution?.detail.some((line)=>/자동/.test(line)),"a failed predicate leaves no trace on the resolution");
});

test("a Defense-like automatic attack.outcome interceptor raises the armored defender's AC and turns an exact hit into a miss",async()=>{
  const {adapter,internal}=await prepare(defenseLike([query("armored","equipment.armor.worn","interceptor.source")],{op:"eq",left:{ref:"armored"},right:{value:true}}));
  const hero=internal.activeCharacter.id;
  const heroAc=internal.scene.entities.find((entity)=>entity.id===hero)!.ac;
  const hpBefore=internal.scene.entities.find((entity)=>entity.id===hero)!.hp;
  // Goblin scimitar is +4: natural AC-4 hits AC exactly; with +1 AC it misses.
  let snapshot=await attackResult(adapter,GOBLIN,"action.scimitar",hero,heroAc-4);
  assert.equal(snapshot.resolution?.interrupt,undefined);
  assert.equal(snapshot.resolution?.targetAc,heroAc+1,JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감");
  while(snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance)snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===hero)?.hp,hpBefore);
});

test("equipment facts answer from the subject's equipped items: shield worn, armor worn, two weapons wielded",async()=>{
  const shieldOnly:SemanticPredicate={op:"all",args:[
    {op:"eq",left:{ref:"shield"},right:{value:true}},
    {op:"eq",left:{ref:"armor"},right:{value:true}},
    {op:"eq",left:{ref:"dual"},right:{value:false}},
  ]};
  const {adapter,internal}=await prepare(defenseLike([
    query("shield","equipment.shield.worn","interceptor.source"),
    query("armor","equipment.armor.worn","interceptor.source"),
    query("dual","equipment.weapons.two-wielded","interceptor.source"),
  ],shieldOnly));
  const hero=internal.activeCharacter.id;
  const heroAc=internal.scene.entities.find((entity)=>entity.id===hero)!.ac;
  // Reference Character: chain mail + longsword (main hand) + shield (off hand) → shield true, armor true, two weapons false.
  let snapshot=await attackResult(adapter,GOBLIN,"action.scimitar",hero,heroAc-4);
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감",JSON.stringify(snapshot.resolution));
  while(snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance)snapshot=await adapter.advanceResolution();

  // Unequip the shield: the predicate fails and the same attack (from the second goblin, whose action is unspent) hits.
  for(const item of internal.activeCharacter.items)if(item.definitionId==="item.shield"){item.equipped=false;item.wielded=false;delete item.wieldSlot;}
  snapshot=await attackResult(adapter,"combatant.goblin-b","action.scimitar-b",hero,heroAc-4);
  assert.equal(snapshot.resolution?.attackOutcome,"명중",JSON.stringify(snapshot.resolution));
});

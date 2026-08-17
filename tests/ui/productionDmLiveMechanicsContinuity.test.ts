import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterSheet, CharacterSummary } from "../../src/app/contracts";
import { applyAdapterRuntimeEffectApplication } from "../../src/app/realRuntimeEffectApplicationService";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const SCOUT_ID="combatant.phase14.mechanics-scout";
const SCOUT_PAYLOAD=JSON.stringify({
  id:SCOUT_ID,
  name:"Mechanics Scout",
  ac:14,
  maxHp:20,
  speed:35,
  proficiencyBonus:2,
  abilities:{str:8,dex:16,con:12,int:10,wis:14,cha:10},
  savingThrowProficiencies:["wis"],
  resistances:[],
  immunities:[],
  vulnerabilities:[],
  runtimeActions:[{
    id:"dagger",
    name:"단검",
    category:"weapon",
    sourceKind:"weapon",
    attackBonus:5,
    rangeFeet:5,
    damage:{type:"관통",dice:"1d4",flat:3},
  }],
});

type Internal={
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  scene:AppSnapshot["scene"];
};

type ProductionDmAdapter=MockAdapter&{
  startProductionLocalPlay(role:"dm"|"player"):Promise<AppSnapshot>;
};

function runtimeOf(adapter:MockAdapter) {
  const scene=(adapter as unknown as Internal).scene;
  const runtime=snapshotAdapterTurnRuntimeState(adapter,scene);
  assert.ok(runtime,"production Initiative must own an authoritative turn runtime");
  return runtime!;
}

async function liveDmWithNonFixtureActors() {
  const adapter=new MockAdapter();
  const template=await adapter.getSnapshot();
  const character={
    ...structuredClone(template.activeCharacter),
    id:"char.phase14.mechanics-player",
    name:"Phase14 Mechanics Player",
    hp:1,
    maxHp:30,
    tempHp:0,
    ac:10,
    saveState:"saved" as const,
    abilities:{...template.activeCharacter.abilities,dex:20,con:10},
  };
  const internal=adapter as unknown as Internal;
  internal.activeCharacter=structuredClone(character);
  internal.characters=[...internal.characters.filter((entry)=>entry.id!==character.id),structuredClone(character)];

  const production=adapter as ProductionDmAdapter;
  await production.startProductionLocalPlay("dm");
  await adapter.previewCombatantImport(SCOUT_PAYLOAD);
  await adapter.activateCombatantImport();
  let snapshot=await adapter.instantiateCombatant(SCOUT_ID);
  const scout=snapshot.scene.entities.find((entity)=>entity.id===`${SCOUT_ID}.instance-1`);
  assert.ok(scout);
  const dagger=(snapshot.scene.actionsByActor[scout.id]??[]).find((action)=>action.name==="단검");
  assert.ok(dagger?.runtimeAttack,"imported Combatant must retain its actual runtime attack");

  snapshot=await adapter.startInitiative();
  assert.equal(snapshot.scene.currentActorId,character.id,"non-fixture Character should lead the live participant set by initiative");
  return {adapter,character,scout,dagger};
}

test("non-fixture live actors preserve condition, typed defense, reaction, concentration, life state, Activity, and event-native Undo",async()=>{
  const {adapter,character,scout,dagger}=await liveDmWithNonFixtureActors();
  const concentrationGroup=`${character.id}:phase14-focus`;

  const seeded=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase14.live-mechanics.seed",
    actorId:character.id,
    sourceId:"phase14:live-mechanics",
    title:"Phase14 live mechanics seed",
    operations:[
      {
        id:"condition-grappled",
        kind:"apply-effect",
        effect:{
          id:"phase14-grappled",
          sourceId:"phase14:condition:grappled",
          targetId:character.id,
          kind:"condition",
          conditionId:"grappled",
          duration:{kind:"permanent"},
        },
      },
      {
        id:"piercing-resistance",
        kind:"apply-effect",
        effect:{
          id:"phase14-piercing-resistance",
          sourceId:"phase14:defense:piercing-resistance",
          targetId:character.id,
          kind:"modifier",
          tags:["damage-resistance:관통"],
          duration:{kind:"permanent"},
        },
      },
      {id:"start-focus",kind:"start-concentration",groupId:concentrationGroup,sourceId:"spell:phase14-focus"},
      {
        id:"focus-effect",
        kind:"apply-effect",
        effect:{
          id:"phase14-focus-effect",
          sourceId:"spell:phase14-focus",
          sourceActorId:character.id,
          targetId:scout.id,
          kind:"marker",
          duration:{kind:"concentration"},
          concentrationGroupId:concentrationGroup,
        },
      },
    ],
  });
  assert.equal(seeded.status,"committed");
  if (seeded.status!=="committed") return;
  let runtime=runtimeOf(adapter);
  assert.equal(runtime.effects.find((effect)=>effect.id==="phase14-grappled")?.conditionId,"grappled");
  assert.ok(runtime.effects.some((effect)=>effect.id==="phase14-piercing-resistance"));
  assert.equal(runtime.concentration[character.id]?.groupId,concentrationGroup);
  assert.ok(runtime.effects.some((effect)=>effect.id==="phase14-focus-effect"));
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activity[0]?.id,"phase14.live-mechanics.seed");

  await adapter.setQueuedD20(20);
  snapshot=await adapter.declareManualMovementReaction({
    kind:"opportunity-attack",
    provokerId:character.id,
    reactorId:scout.id,
    attackActionId:dagger.id,
    distanceFeet:5,
    visibleAtTrigger:true,
    coverAtTrigger:"none",
    targetCanSeeReactorAtTrigger:true,
  });
  const reactionResolutionId=snapshot.resolution?.id;
  assert.ok(reactionResolutionId);
  assert.equal(snapshot.resolution?.actorId,scout.id);
  assert.deepEqual(snapshot.resolution?.targetIds,[character.id]);

  for (let step=0;step<6&&snapshot.resolution?.stage!=="complete";step++) {
    snapshot=await adapter.advanceResolution();
    if (snapshot.resolution?.stage==="save-animation"&&snapshot.resolution.concentrationSave?.natural===undefined) {
      snapshot=await adapter.submitConcentrationSaveD20(1);
    }
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  const component=snapshot.resolution?.damageComponents[0];
  assert.ok(component);
  assert.ok(component.raw>component.adjusted,"runtime piercing resistance must reduce authoritative damage");
  assert.match(component.adjustment,/런타임 효과 조정|저항/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===character.id)?.hp,0);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===character.id)?.runtimeLife?.unconscious,true);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===character.id)?.runtimeLife?.dead,false);
  assert.equal(snapshot.scene.economyByActor[scout.id]?.reaction,false,"opportunity attack spends Reaction, not Action");
  assert.equal(snapshot.scene.economyByActor[scout.id]?.action,true);

  runtime=runtimeOf(adapter);
  assert.equal(runtime.concentration[character.id],undefined,"0 HP/incapacitation or failed save must end concentration authoritatively");
  assert.equal(runtime.effects.some((effect)=>effect.id==="phase14-focus-effect"),false);
  assert.ok(runtime.effects.some((effect)=>effect.id==="phase14-grappled"),"independent condition remains active through the attack");
  assert.ok(snapshot.activity.some((entry)=>entry.id===reactionResolutionId));
  const reactionActivity=snapshot.activity.find((entry)=>entry.id===reactionResolutionId)!;
  assert.ok(reactionActivity.stateChanges.some((line)=>line.includes(`${scout.id} economy.reaction true → false`)));
  assert.ok(reactionActivity.stateChanges.some((line)=>line.includes(`${character.id} life.unconscious false → true`)));
  assert.ok(reactionActivity.stateChanges.some((line)=>line.includes("concentration")));

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===character.id)?.hp,1);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===character.id)?.runtimeLife?.unconscious,false);
  assert.equal(snapshot.scene.economyByActor[scout.id]?.reaction,true);
  runtime=runtimeOf(adapter);
  assert.equal(runtime.concentration[character.id]?.groupId,concentrationGroup);
  assert.ok(runtime.effects.some((effect)=>effect.id==="phase14-focus-effect"));
  assert.ok(runtime.effects.some((effect)=>effect.id==="phase14-piercing-resistance"));
  assert.ok(runtime.effects.some((effect)=>effect.id==="phase14-grappled"));
  assert.ok(snapshot.activity.some((entry)=>entry.undoOf===reactionResolutionId&&entry.title==="Resolution 되돌림"));

  const removed=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase14.live-mechanics.condition-remove",
    actorId:character.id,
    sourceId:"phase14:condition:grappled",
    title:"Phase14 condition remove",
    operations:[{id:"remove-grappled",kind:"remove-effect",effectId:"phase14-grappled"}],
  });
  assert.equal(removed.status,"committed");
  assert.equal(runtimeOf(adapter).effects.some((effect)=>effect.id==="phase14-grappled"),false);
  snapshot=await adapter.undoLastResolution();
  assert.equal(runtimeOf(adapter).effects.find((effect)=>effect.id==="phase14-grappled")?.conditionId,"grappled");
  assert.ok(snapshot.activity.some((entry)=>entry.undoOf==="phase14.live-mechanics.condition-remove"));
});

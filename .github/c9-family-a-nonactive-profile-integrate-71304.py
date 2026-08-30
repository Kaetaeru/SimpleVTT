from pathlib import Path

adapter = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
text = adapter.read_text(encoding="utf-8")
start_tokens = [
    "export function commonPlayActorProfileProperties(",
    "function commonPlayActorProfileProperties(",
]
starts = [text.find(token) for token in start_tokens]
starts = [value for value in starts if value >= 0]
if not starts:
    raise SystemExit("commonPlayActorProfileProperties start not found")
start = min(starts)
end = text.find("\nfunction operationExecutionInput(", start)
if end < 0:
    raise SystemExit("commonPlayActorProfileProperties end not found")
replacement = '''export function commonPlayActorProfileProperties(
  internal:Pick<AdapterState,"activeCharacter"|"scene">,
  state:RulesRuntimeState,
  actorId:string,
):Record<string,number>|undefined {
  const actorState=state.combatants[actorId];
  if(!actorState) return undefined;
  const sceneActor=internal.scene.entities.find((entity)=>entity.id===actorId);
  const runtimeInputs:Record<string,number>={
    ...(actorState.baseProperties??{}),
    "movement.walk":actorState.baseSpeed,
    "hp.current":actorState.life.hp.current,
    "hp.maximum":actorState.life.hp.maximum,
    "hp.temporary":actorState.life.hp.temporary,
    ...(sceneActor?{"defense.ac":sceneActor.ac,initiative:sceneActor.initiative}:{}),
  };
  const character=internal.activeCharacter;
  const inputs:Record<string,number>=character.id===actorId?{
    ...runtimeInputs,
    "ability.str.score":character.abilities.str,
    "ability.dex.score":character.abilities.dex,
    "ability.con.score":character.abilities.con,
    "ability.int.score":character.abilities.int,
    "ability.wis.score":character.abilities.wis,
    "ability.cha.score":character.abilities.cha,
    "progression.character.level":character.level,
    "proficiency.bonus":character.proficiencyBonus,
    "defense.ac":character.ac,
  }:runtimeInputs;
  const projected={...inputs};
  for(const [property,definition] of Object.entries(SIMPLEVTT_APP_RULES_PROFILE.properties)) {
    if(!Number.isFinite(inputs[property])&&!definition.formula) continue;
    try {
      projected[property]=resolveRuntimeProfileProperty(state.effects,actorId,property,inputs).value;
    } catch(error) {
      if(character.id===actorId) throw error;
    }
  }
  return projected;
}
'''
text = text[:start] + replacement + text[end:]
adapter.write_text(text, encoding="utf-8")

test_path = Path("tests/ui/c9FamilyANonActiveProfileProperties.test.ts")
test_path.write_text('''import assert from "node:assert/strict";
import test from "node:test";
import { commonPlayActorProfileProperties } from "../../src/app/installedCommonPlayRuntimeAdapter";
import { resolveCommonPlayArtifactActivation } from "../../src/domain/commonPlayArtifactRuntime";
import type { EffectInstance } from "../../src/domain/effects";
import { runtimeState, TEST_PROFILE } from "../domain/rulesTestState";

test("non-active runtime actors preserve portable profile properties and resolve derived refs through active Effects",()=>{
  const committed=resolveCommonPlayArtifactActivation(TEST_PROFILE,runtimeState(),{
    schemaVersion:"0.2-draft",id:"external.unknown.actor-profile",
    entryPoints:[{id:"spawn",invocation:"manual",operations:[{kind:"artifact.spawn",template:"companion"}]}],
    artifactTemplates:[{id:"companion",artifactKind:"actor",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{
      combatantId:"external.companion",statDefinitionId:"external.unknown.stat",ownerId:"hero",controllerId:"hero",side:"ally",initiative:"shared",
      properties:{"hp.maximum":12,"hp.current":9,"hp.temporary":0,"movement.walk":25,"defense.ac":13,"ability.str.score":14,"proficiency.bonus":2},
      actionDefinitionIds:[],resources:[],
    }}],
  },{resolutionId:"external-actor-profile-spawn",actorId:"hero",entryPointId:"spawn"});
  assert.equal(committed.status,"committed",committed.status==="rejected"?committed.error:undefined);
  if(committed.status!=="committed") throw new Error("expected committed actor artifact spawn");
  const actor=committed.state.combatants["external.companion"]!;
  assert.equal(actor.baseProperties?.["ability.str.score"],14);
  const modifier:EffectInstance={
    id:"effect.external.companion.str",sourceId:"external.unknown.buff",targetId:"external.companion",kind:"modifier",tags:[],expiry:{kind:"permanent"},
    propertyModifier:{property:"ability.str.score",operation:"add",value:{value:2},source:"definition",instancePolicy:"stack"},
  };
  committed.state.effects.push(modifier);
  const properties=commonPlayActorProfileProperties({
    activeCharacter:{id:"hero"} as never,
    scene:{entities:[{id:"external.companion",ac:13,initiative:11}]} as never,
  },committed.state,"external.companion")!;
  assert.equal(properties["movement.walk"],25);
  assert.equal(properties["hp.current"],9);
  assert.equal(properties["defense.ac"],13);
  assert.equal(properties.initiative,11);
  assert.equal(properties["ability.str.score"],16);
  assert.equal(properties["ability.str.modifier"],3);
});
''', encoding="utf-8")

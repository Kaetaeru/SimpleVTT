from pathlib import Path

path=Path('tests/ui/installedCommonPlayInterceptorProductionRuntime.test.ts')
text=path.read_text(encoding='utf-8')
old='import { SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/realResolutionService";'
new='import { resolveRuntimeProfileProperty, SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/realResolutionService";'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('realResolutionService import anchor missing')

marker='''test("portable production derives remaining RulesProfile special senses from generic property modifiers",async()=>{'''
if marker not in text:
    raise SystemExit('remaining sense matrix test missing; apply final acquisition patch first')

helper='''function resolvedRulesProfileSenseValue(adapter:MockAdapter,property:string){
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state,"TurnRuntime state must exist before profile sense inspection");
  const actor=state!.combatants[internal.activeCharacter.id];
  assert.ok(actor,"active combatant must exist before profile sense inspection");
  const sheet=internal.activeCharacter;
  const inputs:Record<string,number>={
    ...(actor!.baseProperties??{}),
    "movement.walk":actor!.baseSpeed,
    "hp.current":actor!.life.hp.current,
    "hp.maximum":actor!.life.hp.maximum,
    "hp.temporary":actor!.life.hp.temporary,
    "ability.str.score":sheet.abilities.str,
    "ability.dex.score":sheet.abilities.dex,
    "ability.con.score":sheet.abilities.con,
    "ability.int.score":sheet.abilities.int,
    "ability.wis.score":sheet.abilities.wis,
    "ability.cha.score":sheet.abilities.cha,
    "progression.character.level":sheet.level,
    "proficiency.bonus":sheet.proficiencyBonus,
    "defense.ac":sheet.ac,
    "sense.darkvision.range-feet":0,
    "sense.blindsight.range-feet":0,
    "sense.tremorsense.range-feet":0,
    "sense.truesight.range-feet":0,
  };
  return resolveRuntimeProfileProperty(state!.effects,internal.activeCharacter.id,property,inputs).value;
}

'''
if 'function resolvedRulesProfileSenseValue(' not in text:
    text=text.replace(marker,helper+marker,1)

old='''      seedRulesProfileSense(adapter,`${identity.moduleId}.${scenario.label}`,scenario.property,60);
      seedHiddenRuntimeEffect(adapter,OTHER_CHARACTER_ID);'''
new='''      seedRulesProfileSense(adapter,`${identity.moduleId}.${scenario.label}`,scenario.property,60);
      assert.equal(resolvedRulesProfileSenseValue(adapter,scenario.property),60,`${scenario.label}: RulesProfile property acquisition`);
      seedHiddenRuntimeEffect(adapter,OTHER_CHARACTER_ID);'''
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('sense matrix seed anchor missing')
path.write_text(text,encoding='utf-8')

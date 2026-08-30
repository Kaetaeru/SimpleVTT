from pathlib import Path

source_path = Path("src/domain/commonPlayOperationRuntime.ts")
source = source_path.read_text()

helper_anchor = '''function literalInteger(expression:CommonPlayExpression|undefined,label:string) {
  if(!expression||typeof expression!=="object"||!("value" in expression)) {
    throw new DomainEvaluationError(`${label} requires a supported literal expression`);
  }
  const value=(expression as {value?:unknown}).value;
  if(typeof value!=="number"||!Number.isFinite(value)||!Number.isInteger(value)) {
    throw new DomainEvaluationError(`${label} requires a finite integer literal`);
  }
  return value;
}
'''
helper = helper_anchor + '''
function commonPlayD20Ability(property:string|undefined):"str"|"dex"|"con"|"int"|"wis"|"cha"|undefined {
  const match=property?.match(/^(?:save|ability)\.(str|dex|con|int|wis|cha)\.(?:modifier|score)$/);
  return match?.[1] as "str"|"dex"|"con"|"int"|"wis"|"cha"|undefined;
}
'''
if "function commonPlayD20Ability(" not in source:
    if helper_anchor not in source:
        raise SystemExit("literalInteger anchor not found")
    source = source.replace(helper_anchor, helper, 1)

d20_anchor = '''    operations.push({
      id:`${input.resolutionId}:test`,
      kind:"d20",
      actorId:rollerId,
      targetId:entryPoint.test.roller==="target"?input.actorId:input.d20.targetId,
      request:{
'''
d20_replacement = '''    const conditionAbility=commonPlayD20Ability(entryPoint.test.property);
    const selectedTargetFacts=input.targetId
      ? input.targetingTargets?.find((target)=>target.id===input.targetId)
      : undefined;
    const conditionContext={
      ...(conditionAbility?{ability:conditionAbility}:{}),
      ...(selectedTargetFacts?.distanceFeet===undefined?{}:{distanceToTargetFeet:selectedTargetFacts.distanceFeet}),
    };
    operations.push({
      id:`${input.resolutionId}:test`,
      kind:"d20",
      actorId:rollerId,
      targetId:entryPoint.test.roller==="target"?input.actorId:input.d20.targetId,
      ...(Object.keys(conditionContext).length?{condition:conditionContext}:{}),
      request:{
'''
if "const conditionAbility=commonPlayD20Ability(entryPoint.test.property);" not in source:
    if d20_anchor not in source:
        raise SystemExit("d20 operation anchor not found")
    source = source.replace(d20_anchor, d20_replacement, 1)
source_path.write_text(source)

test_path = Path("tests/domain/c9FamilyMCommonPlayConditionRuntime.test.ts")
tests = test_path.read_text()
marker = 'test("portable condition-derived d20 context reaches the generic Resolver"'
if marker not in tests:
    tests += '''

test("portable condition-derived d20 context reaches the generic Resolver",()=>{
  const restrained=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition("external.condition.restrained","condition.apply","restrained"),{resolutionId:"condition-restrained",actorId:"hero",entryPointId:"activate",targetId:"hero"});
  assert.equal(restrained.status,"committed",restrained.status==="rejected"?restrained.error:undefined);
  if(restrained.status!=="committed")return;
  const save=parseManualCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id:"external.unknown.restrained-save",entryPoints:[{id:"activate",invocation:"manual",test:{kind:"saving-throw",roller:"actor",property:"save.dex.modifier",dc:{value:10}},operations:[]}]});
  const saved=resolveCommonPlayEntryPointOperations(TEST_PROFILE,restrained.state,save,{resolutionId:"restrained-save",actorId:"hero",entryPointId:"activate",d20:{faces:[18,4],modifierContributions:[]}});
  assert.equal(saved.status,"committed",saved.status==="rejected"?saved.error:undefined);
  if(saved.status!=="committed")return;
  const saveResult=saved.results["restrained-save:test"] as {natural:number;rollState:string};
  assert.equal(saveResult.rollState,"disadvantage");
  assert.equal(saveResult.natural,4);

  const prone=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition("external.condition.prone","condition.apply","prone"),{resolutionId:"condition-prone",actorId:"hero",entryPointId:"activate",targetId:"goblin"});
  assert.equal(prone.status,"committed",prone.status==="rejected"?prone.error:undefined);
  if(prone.status!=="committed")return;
  const attack=parseManualCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id:"external.unknown.prone-attack",entryPoints:[{id:"activate",invocation:"manual",test:{kind:"attack-roll",roller:"actor",dc:{value:10}},operations:[]}]});
  const attacked=resolveCommonPlayEntryPointOperations(TEST_PROFILE,prone.state,attack,{resolutionId:"prone-attack",actorId:"hero",entryPointId:"activate",targetId:"goblin",targetingTargets:[{id:"goblin",kind:"creature",relation:"enemy",distanceFeet:5}],d20:{faces:[4,18],targetId:"goblin",modifierContributions:[]}});
  assert.equal(attacked.status,"committed",attacked.status==="rejected"?attacked.error:undefined);
  if(attacked.status!=="committed")return;
  const attackResult=attacked.results["prone-attack:test"] as {natural:number;rollState:string};
  assert.equal(attackResult.rollState,"advantage");
  assert.equal(attackResult.natural,18);
});
'''
test_path.write_text(tests)

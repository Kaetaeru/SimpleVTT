from pathlib import Path
import json


def replace_one(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    count = text.count(old)
    assert count == 1, f"{label}: expected one match, got {count}"
    path.write_text(text.replace(old, new, 1))


runtime = Path("src/domain/commonPlayRuntime.ts")
replace_one(
    runtime,
    '| { kind:"roll.modify"; mode:"add-flat"|"target-add"|"replace"|"minimum"; value:LiteralExpression };',
    '| { kind:"roll.modify"; mode:"add-flat"|"target-add"|"replace"|"minimum"|"multiply"; value:LiteralExpression };',
    "runtime roll.modify type",
)
replace_one(
    runtime,
    '''function damageRollReduction(
  definition:CommonPlayReactionDefinition,
  interceptor:CommonPlayDamageRollInterceptor,
  authority:CommonPlayInteractionAuthority|undefined,
) {
  return interceptor.operations.map((operation,index)=>{
    if(operation.kind!=="roll.modify"||operation.mode!=="subtract-die")throw new Error("primary.damage interceptor supports subtract-die only in this bounded slice");
    const formula=parseDiceFormula(operation.dice,"primary.damage subtract-die");
    const faces=authority?.modifierDiceFaces?.[index];
    if(!faces||faces.length!==formula.count||faces.some((face)=>!Number.isInteger(face)||face<1||face>formula.sides))throw new Error(`primary.damage interceptor ${index} requires authoritative die face(s)`);
    return {
      source:`common-play:${definition.id}:${interceptor.id}:operation:${index}`,
      value:-(faces.reduce((sum,face)=>sum+face,0)+formula.flat),
    };
  });
}''',
    '''function damageRollAdjustments(
  definition:CommonPlayReactionDefinition,
  interceptor:CommonPlayDamageRollInterceptor,
  authority:CommonPlayInteractionAuthority|undefined,
  baseTotal:number,
) {
  let runningTotal=baseTotal;
  return interceptor.operations.map((operation,index)=>{
    const source=`common-play:${definition.id}:${interceptor.id}:operation:${index}`;
    let value:number;
    if(operation.kind!=="roll.modify")throw new Error("primary.damage interceptor requires roll.modify operations");
    if(operation.mode==="subtract-die") {
      const formula=parseDiceFormula(operation.dice,"primary.damage subtract-die");
      const faces=authority?.modifierDiceFaces?.[index];
      if(!faces||faces.length!==formula.count||faces.some((face)=>!Number.isInteger(face)||face<1||face>formula.sides))throw new Error(`primary.damage interceptor ${index} requires authoritative die face(s)`);
      value=-(faces.reduce((sum,face)=>sum+face,0)+formula.flat);
    } else if(operation.mode==="multiply") {
      const factor=literalValue(operation.value,"primary.damage multiply value");
      if(factor<0)throw new Error("primary.damage multiply value must be non-negative");
      value=Math.floor(runningTotal*factor)-runningTotal;
    } else {
      throw new Error("primary.damage interceptor supports subtract-die or multiply only in this bounded slice");
    }
    runningTotal+=value;
    return {source,value};
  });
}''',
    "runtime damage adjustments",
)
replace_one(
    runtime,
    '''  if(interceptor.slot==="primary.damage") {
    const payments=paymentOperations(definition,sourceActorId,interceptor.id);
    if(intercepted.kind!=="damage-roll")throw new Error("primary.damage interceptor target is not a damage roll");
    const recalculated:ResolutionOperation={
      ...intercepted,
      request:{...intercepted.request,flat:[...(intercepted.request.flat??[]),...damageRollReduction(definition,interceptor,authority)]},
    };
    return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};
  }''',
    '''  if(interceptor.slot==="primary.damage") {
    const payments=paymentOperations(definition,sourceActorId,interceptor.id);
    if(intercepted.kind!=="damage-roll")throw new Error("primary.damage interceptor target is not a damage roll");
    const preview=stagePendingResolution(profile,inputState,{...pending,operations:pending.operations.slice(0,operationIndex+1)});
    if(preview.status==="rejected")throw new Error(preview.error??"primary.damage preview rejected");
    const provisional=preview.results[intercepted.id] as DamageRollResolution|undefined;
    if(!provisional||!Number.isFinite(provisional.total))throw new Error("primary.damage preview result is missing");
    const recalculated:ResolutionOperation={
      ...intercepted,
      request:{...intercepted.request,flat:[...(intercepted.request.flat??[]),...damageRollAdjustments(definition,interceptor,authority,provisional.total)]},
    };
    return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};
  }''',
    "runtime accepted damage",
)

lowering = Path("src/domain/commonPlayReactionDefinitionRuntime.ts")
replace_one(
    lowering,
    'function lowerD20Interceptor(value:Obj,index:number,options:ReactionLoweringOptions):CommonPlayD20RollInterceptor {',
    'function lowerD20Interceptor(value:Obj,index:number,options:ReactionLoweringOptions,allowMultiply=false):CommonPlayD20RollInterceptor {',
    "lowerer signature",
)
replace_one(
    lowering,
    'if(raw.mode!=="add-flat"&&raw.mode!=="target-add"&&raw.mode!=="replace"&&raw.mode!=="minimum") {',
    'if(raw.mode!=="add-flat"&&raw.mode!=="target-add"&&raw.mode!=="replace"&&raw.mode!=="minimum"&&(!allowMultiply||raw.mode!=="multiply")) {',
    "lowerer deterministic mode gate",
)
replace_one(
    lowering,
    '''      const value=resolvedNumber(raw.value,`${label}.operations[${operationIndex}].value`,options);
      if(!Number.isInteger(value.value)) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value must be an integer`);
      if((raw.mode==="replace"||raw.mode==="minimum")&&(value.value<1||value.value>20)) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value must be between 1 and 20 for ${raw.mode}`);
      return {kind:"roll.modify" as const,mode:raw.mode,value};''',
    '''      const value=resolvedNumber(raw.value,`${label}.operations[${operationIndex}].value`,options);
      if(raw.mode==="multiply") {
        if(value.value<0)throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value must be non-negative for multiply`);
        return {kind:"roll.modify" as const,mode:"multiply",value};
      }
      if(!Number.isInteger(value.value)) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value must be an integer`);
      if((raw.mode==="replace"||raw.mode==="minimum")&&(value.value<1||value.value>20)) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value must be between 1 and 20 for ${raw.mode}`);
      return {kind:"roll.modify" as const,mode:raw.mode,value};''',
    "lowerer multiplier value",
)
replace_one(
    lowering,
    'const lowered=lowerD20Interceptor({...value,timing:"d20.outcome-determined",slot:"d20.roll"},index,options);',
    'const lowered=lowerD20Interceptor({...value,timing:"d20.outcome-determined",slot:"d20.roll"},index,options,true);',
    "damage lowerer allowance",
)
replace_one(
    lowering,
    'if(lowered.operations.some((operation)=>operation.mode!=="subtract-die")) throw new DomainEvaluationError(`${label} primary.damage supports subtract-die only`);',
    'if(lowered.operations.some((operation)=>operation.mode!=="subtract-die"&&operation.mode!=="multiply")) throw new DomainEvaluationError(`${label} primary.damage supports subtract-die or multiply only`);',
    "damage lowerer gate",
)

schema_path = Path("schemas/common-play-contract.schema.json")
schema = json.loads(schema_path.read_text())
modes = schema["$defs"]["rollModify"]["properties"]["mode"]["enum"]
assert "subtract-die" in modes and "add-flat" in modes
assert "multiply" not in modes
modes.append("multiply")
schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n")

contract_test = Path("tests/domain/commonPlayReactionDefinitionRuntime.test.ts")
contract_text = contract_test.read_text()
old_regex = "/primary.damage supports subtract-die only/"
assert contract_text.count(old_regex) == 2
contract_test.write_text(contract_text.replace(old_regex, "/primary.damage supports subtract-die or multiply only/"))

Path("tests/domain/c9FamilyPDamageMultiplier.test.ts").write_text('''import assert from "node:assert/strict";
import test from "node:test";
import { parseCommonPlayDefinition } from "../../src/domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../../src/domain/commonPlayReactionDefinitionRuntime";
import { resumeCommonPlayInteraction, startCommonPlayResolution } from "../../src/domain/commonPlayRuntime";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function definition(id:string) {
  const parsed=parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",
    id,
    payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"}],
    interceptors:[{
      id:"structural-damage-scale",
      timing:"damage.rolled",
      interaction:{id:"use-scale",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
      operation:"recalculate",
      slot:"primary.damage",
      operations:[{kind:"roll.modify",mode:"multiply",value:{value:0.5}}],
    }],
  },"C9 external damage multiplier");
  const lowered=lowerCommonPlayReactionDefinition(parsed);
  assert.ok(lowered);
  return lowered;
}

function pending():PendingResolution {
  return {
    id:"c9-family-p-damage-multiply",
    actorId:"goblin",
    sourceId:"external.unknown.damage",
    expectedRevision:0,
    operations:[{id:"damage-roll",kind:"damage-roll",request:{dice:[{source:"external.die",count:1,sides:6,faces:[6]}],flat:[{source:"external.flat",value:4}]}}],
  };
}

function run(id:string) {
  const state=runtimeState();
  const started=startCommonPlayResolution(TEST_PROFILE,state,pending(),definition(id),"hero");
  assert.equal(started.status,"awaiting-input");
  if(started.status!=="awaiting-input")throw new Error("expected interaction");
  return resumeCommonPlayInteraction(TEST_PROFILE,state,started,{interactionId:started.interaction.id,idempotencyKey:started.interaction.idempotencyKey,value:true});
}

test("unknown Common Play primary.damage multiplier is structural and identity invariant",()=>{
  const original=run("external.unknown.damage-halver");
  const renamed=run("external.renamed.damage-halver");
  for(const result of [original,renamed]){
    assert.equal(result.status,"committed");
    if(result.status!=="committed")continue;
    assert.equal((result.results["damage-roll"] as {total:number}).total,5);
    assert.equal(result.state.combatants.hero.economy.reaction,false);
  }
});
''')

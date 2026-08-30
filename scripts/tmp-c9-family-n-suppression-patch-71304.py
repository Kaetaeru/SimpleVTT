from pathlib import Path
import json

runtime_path = Path("src/domain/commonPlayOperationRuntime.ts")
runtime = runtime_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)


runtime = replace_once(
    runtime,
    '''type CommonPlayEffectRemove={
  kind:"effect.remove";
  selector:CommonPlaySelector&{from:"effects"};
  when?:CommonPlayTestOutcomePredicate;
};
type CommonPlayMovementStand''',
    '''type CommonPlayEffectRemove={
  kind:"effect.remove";
  selector:CommonPlaySelector&{from:"effects"};
  when?:CommonPlayTestOutcomePredicate;
};
type CommonPlayEffectSuppress={
  kind:"effect.suppress";
  selector:CommonPlaySelector&{from:"effects"};
  suppressed:boolean;
  reason?:string;
  pauseDuration?:boolean;
  when?:CommonPlayTestOutcomePredicate;
};
type CommonPlayMovementStand''',
    "effect suppression type",
)

runtime = replace_once(
    runtime,
    '''  |CommonPlayConditionChange
  |CommonPlayEffectRemove
  |CommonPlayRollModify;''',
    '''  |CommonPlayConditionChange
  |CommonPlayEffectRemove
  |CommonPlayEffectSuppress
  |CommonPlayRollModify;''',
    "operation union",
)

runtime = replace_once(
    runtime,
    '''const EFFECT_REMOVE_KEYS=new Set(["kind","selector","when"]);
const TEMP_HP_GRANT_KEYS''',
    '''const EFFECT_REMOVE_KEYS=new Set(["kind","selector","when"]);
const EFFECT_SUPPRESS_KEYS=new Set(["kind","selector","suppressed","reason","pauseDuration","when"]);
const TEMP_HP_GRANT_KEYS''',
    "suppression keys",
)

parser_anchor = '''  if(operation.kind==="condition.apply"||operation.kind==="condition.remove") {'''
parser_block = '''  if(operation.kind==="effect.suppress") {
    supportedKeys(operation,EFFECT_SUPPRESS_KEYS,label);
    const selector=parseCommonPlaySelector(operation.selector,`${label}.selector`);
    if(selector.from!=="effects") throw new DomainEvaluationError(`${label}.selector.from must be effects for portable Common Play effect.suppress`);
    if(selector.selection==="manual") throw new DomainEvaluationError(`${label}.selector.selection must be automatic when changing effect suppression`);
    if(typeof operation.suppressed!=="boolean") throw new DomainEvaluationError(`${label}.suppressed must be boolean`);
    const reason=operation.reason===undefined?undefined:nonEmptyString(operation.reason,`${label}.reason`);
    if(operation.pauseDuration!==undefined&&typeof operation.pauseDuration!=="boolean") throw new DomainEvaluationError(`${label}.pauseDuration must be boolean when present`);
    if(operation.suppressed===false&&(reason!==undefined||operation.pauseDuration!==undefined)) throw new DomainEvaluationError(`${label} unsuppression must not declare reason or pauseDuration`);
    const when=testOutcomePredicate(operation.when,`${label}.when`);
    return {
      kind:"effect.suppress",selector:{...selector,from:"effects"},suppressed:operation.suppressed,
      ...(reason===undefined?{}:{reason}),
      ...(operation.pauseDuration===undefined?{}:{pauseDuration:operation.pauseDuration}),
      ...(when?{when}:{}),
    };
  }
'''
if 'if(operation.kind==="effect.suppress") {' not in runtime:
    if parser_anchor not in runtime:
        raise SystemExit("missing parser insertion anchor")
    runtime = runtime.replace(parser_anchor, parser_block + parser_anchor, 1)

compile_anchor = '''    if(operation.kind==="condition.apply"||operation.kind==="condition.remove") {'''
compile_block = '''    if(operation.kind==="effect.suppress") {
      const when=operation.when?{operationId:`${input.resolutionId}:test`,field:"outcome" as const,equals:operation.when.right.value}:undefined;
      const candidates=state.effects.map((effect)=>({
        id:effect.id,
        properties:{
          tags:[...effect.tags],
          targetId:effect.targetId,
          sourceId:effect.sourceId,
          kind:effect.kind,
          suppressed:!effectIsActive(effect),
          "target.selected":input.targetId!==undefined&&effect.targetId===input.targetId,
          "target.actor":effect.targetId===input.actorId,
          ...(effect.sourceActorId?{sourceActorId:effect.sourceActorId}:{}),
          ...(effect.conditionId?{conditionId:effect.conditionId}:{}),
        },
      }));
      const selected=resolveCommonPlaySelector({sourceId:input.actorId,selector:operation.selector,candidates,selection:"automatic",authority:"host"});
      if(selected.status!=="resolved") throw new DomainEvaluationError(`Common Play effect.suppress selector rejected: ${selected.reason}`);
      selected.targetIds.forEach((effectId,suppressionIndex)=>operations.push({
        id:`${operationId}:suppression:${suppressionIndex}`,
        kind:"set-effect-suppression",
        effectId,
        suppressed:operation.suppressed,
        ...(operation.reason===undefined?{}:{reason:operation.reason}),
        ...(operation.pauseDuration===undefined?{}:{pauseDuration:operation.pauseDuration}),
        ...(when?{when}:{}),
      }));
      continue;
    }
'''
if 'Common Play effect.suppress selector rejected' not in runtime:
    if compile_anchor not in runtime:
        raise SystemExit("missing compile insertion anchor")
    runtime = runtime.replace(compile_anchor, compile_block + compile_anchor, 1)

runtime = runtime.replace(
    '''(operation.kind==="condition.apply"||operation.kind==="condition.remove"||operation.kind==="effect.remove"||operation.kind==="damage.apply")&&operation.when''',
    '''(operation.kind==="condition.apply"||operation.kind==="condition.remove"||operation.kind==="effect.remove"||operation.kind==="effect.suppress"||operation.kind==="damage.apply")&&operation.when''',
)
runtime_path.write_text(runtime)

schema_path = Path("schemas/common-play-contract.schema.json")
schema = json.loads(schema_path.read_text())
defs = schema["$defs"]
operation_union = defs["operation"]["oneOf"]
suppress_ref = {"$ref": "#/$defs/effectSuppress"}
if suppress_ref not in operation_union:
    remove_index = operation_union.index({"$ref": "#/$defs/effectRemove"})
    operation_union.insert(remove_index + 1, suppress_ref)

defs["effectSuppress"] = {
    "type": "object",
    "required": ["kind", "selector", "suppressed"],
    "properties": {
        "kind": {"const": "effect.suppress"},
        "selector": {"$ref": "#/$defs/selector"},
        "suppressed": {"type": "boolean"},
        "reason": {"type": "string", "minLength": 1},
        "pauseDuration": {"type": "boolean"},
        "when": {"$ref": "#/$defs/predicate"},
    },
    "additionalProperties": False,
}
schema_path.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n")

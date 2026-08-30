from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old in text:
        path.write_text(text.replace(old, new, 1), encoding="utf-8")
        return
    if new not in text:
        raise SystemExit(f"{path}: patch marker missing")


runtime = Path("src/domain/commonPlayOperationRuntime.ts")
replace_once(
    runtime,
    'export interface CommonPlayTargetingSelector extends Omit<CommonPlaySelector,"from"|"min"|"max"|"orderBy"|"area"> {',
    'export interface CommonPlayTargetingSelector extends Omit<CommonPlaySelector,"from"|"min"|"max"|"orderBy"> {',
)
replace_once(
    runtime,
    'const TARGETING_KEYS=new Set(["from","where","min","max"]);',
    'const TARGETING_KEYS=new Set(["from","where","min","max","area"]);',
)
replace_once(
    runtime,
    'return {from:"targets",min:parsed.min,max:parsed.max,...(parsed.where===undefined?{}:{where:parsed.where})};',
    'return {from:"targets",min:parsed.min,max:parsed.max,...(parsed.where===undefined?{}:{where:parsed.where}),...(parsed.area===undefined?{}:{area:parsed.area})};',
)

adapter = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
text = adapter.read_text(encoding="utf-8")
selector_import = 'import { resolveCommonPlaySelector, type CommonPlaySelector, type CommonPlaySelectorCandidate } from "../domain/commonPlaySelectorRuntime";\n'
import_anchor = 'import { allocationEntriesFromTargetSequence, resolveCommonPlayAllocation } from "../domain/commonPlayAllocationRuntime";\n'
if selector_import not in text:
    if import_anchor not in text:
        raise SystemExit("selector import anchor missing")
    text = text.replace(import_anchor, import_anchor + selector_import, 1)

old_targeting = 'targeting?:{min?:number;max?:number;where?:{op:string;ref:string;value:string}};'
old_area_targeting = 'targeting?:{min?:number;max?:number;where?:{op:string;ref:string;value:string};area?:unknown};'
if old_targeting in text:
    text = text.replace(old_targeting, 'targeting?:CommonPlaySelector;', 1)
elif old_area_targeting in text:
    text = text.replace(old_area_targeting, 'targeting?:CommonPlaySelector;', 1)
elif 'targeting?:CommonPlaySelector;' not in text:
    raise SystemExit("portable targeting type marker missing")

helper_marker = '''function commonPlayTargetFact(actor:SceneVm["entities"][number],target:SceneVm["entities"][number]):TargetingFactInput {
  return {
    id:target.id,
    kind:"creature",
    relation:target.id===actor.id?"self":target.side===actor.side?"ally":"enemy",
  };
}
'''
helper = helper_marker + '''
function commonPlaySelectorCandidate(actor:SceneVm["entities"][number],target:SceneVm["entities"][number]):CommonPlaySelectorCandidate {
  const targeting=commonPlayTargetFact(actor,target);
  return {
    id:target.id,
    targeting,
    properties:{id:target.id,kind:target.kind,relation:targeting.relation,name:target.name,side:target.side,hp:target.hp},
  };
}
'''
if 'function commonPlaySelectorCandidate(' not in text:
    if helper_marker not in text:
        raise SystemExit("selector candidate helper anchor missing")
    text = text.replace(helper_marker, helper, 1)

old_block = '''  if(hasTargeting) {
    const targeting=portableEntry.targeting!;
    if(targetIds.length<(targeting.min??1)||targetIds.length>(targeting.max??targetIds.length)) return undefined;
    if(targeting.where?.op==="relation-matches"&&targeting.where.ref==="relation"&&selectedTargets.some((target)=>commonPlayTargetFact(actorEntity,target!).relation!==targeting.where!.value)) return undefined;
    if(projectedAction&&(!projectedAction.available||targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  } else if(hasAllocation) {'''
new_block = '''  if(hasTargeting) {
    const targeting=portableEntry.targeting!;
    const candidates=internal.scene.entities
      .filter((target)=>Boolean(state!.combatants[target.id]))
      .map((target)=>commonPlaySelectorCandidate(actorEntity,target));
    const selection=resolveCommonPlaySelector({
      sourceId:actor.id,
      selector:targeting,
      candidates,
      selectedIds:targetIds,
      selection:"manual",
      authority:"actor-owner",
      directTarget:targeting.area===undefined,
    });
    if(selection.status!=="resolved") return undefined;
    if(projectedAction&&(!projectedAction.available||targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  } else if(hasAllocation) {'''
if old_block in text:
    text = text.replace(old_block, new_block, 1)
elif 'const selection=resolveCommonPlaySelector({' not in text:
    raise SystemExit("production targeting block marker missing")

adapter.write_text(text, encoding="utf-8")

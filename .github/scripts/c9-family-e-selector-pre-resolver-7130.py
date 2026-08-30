from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old in text:
        path.write_text(text.replace(old, new, 1), encoding="utf-8")
        return
    if new not in text:
        raise SystemExit(f"{path}: patch marker missing")


adapter = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
replace_once(
    adapter,
    'import type { CommonPlaySelectorCandidate } from "../domain/commonPlaySelectorRuntime";',
    'import { resolveCommonPlaySelector, type CommonPlaySelector, type CommonPlaySelectorCandidate } from "../domain/commonPlaySelectorRuntime";',
)
replace_once(
    adapter,
    'targeting?:{min?:number;max?:number;where?:{op:string;ref:string;value:string}};',
    'targeting?:CommonPlaySelector;',
)
replace_once(
    adapter,
    '''  if(hasTargeting) {
    const targeting=portableEntry.targeting!;
    if(targetIds.length<(targeting.min??1)||targetIds.length>(targeting.max??targetIds.length)) return undefined;
    if(targeting.where?.op==="relation-matches"&&targeting.where.ref==="relation"&&selectedTargets.some((target)=>commonPlayTargetFact(actorEntity,target!).relation!==targeting.where!.value)) return undefined;
    if(projectedAction&&(!projectedAction.available||targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  } else if(hasAllocation) {''',
    '''  if(hasTargeting) {
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
      directTarget:false,
    });
    if(selection.status!=="resolved") return undefined;
    if(projectedAction&&(!projectedAction.available||targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  } else if(hasAllocation) {''',
)

test_file = Path("tests/ui/commonPlayRichSelectorProduction.test.ts")
replace_once(
    test_file,
    ':{from:"targets",min:1,max:2,where:{op:"relation-matches",ref:"relation",value:"enemy"}},',
    ':{from:"targets",min:1,max:2,where:{op:"eq",left:{ref:"relation"},right:{value:"enemy"}}},',
)

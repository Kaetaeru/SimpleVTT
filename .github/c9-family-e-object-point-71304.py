from __future__ import annotations

import json
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if text.count(old) != 1:
        raise SystemExit(f"{label}: expected one anchor, found {text.count(old)}")
    return text.replace(old, new, 1)


# 1) Shared selector grammar/runtime: make target kind explicit and filter before selection.
selector_path = Path("src/domain/commonPlaySelectorRuntime.ts")
selector = selector_path.read_text(encoding="utf-8")
selector = replace_once(
    selector,
    'import { resolveTargeting, type TargetingFactInput, type TargetingResolution } from "./targeting";',
    'import { resolveTargeting, type TargetingFactInput, type TargetingResolution, type TargetKind } from "./targeting";',
    "selector target-kind import",
)
selector = replace_once(
    selector,
    'export interface CommonPlaySelector {\n  from:"targets"|"content"|"artifacts"|"items"|"actors"|"effects";',
    'export interface CommonPlaySelector {\n  from:"targets"|"content"|"artifacts"|"items"|"actors"|"effects";\n  kind?:TargetKind|"any";',
    "selector kind field",
)
selector = replace_once(
    selector,
    'const SELECTOR_KEYS=new Set(["from","where","min","max","orderBy","selection","area"]);',
    'const SELECTOR_KEYS=new Set(["from","kind","where","min","max","orderBy","selection","area"]);',
    "selector supported keys",
)
selector = replace_once(
    selector,
    '  if(typeof selector.from!=="string"||!SOURCES.has(selector.from)) throw new DomainEvaluationError(`${label}.from is unsupported`);\n  const min=selector.min===undefined?undefined:Number(selector.min);',
    '  if(typeof selector.from!=="string"||!SOURCES.has(selector.from)) throw new DomainEvaluationError(`${label}.from is unsupported`);\n  const kind=selector.kind===undefined?undefined:stringValue(selector.kind,`${label}.kind`);\n  if(kind!==undefined&&kind!=="creature"&&kind!=="object"&&kind!=="point"&&kind!=="any") throw new DomainEvaluationError(`${label}.kind is unsupported`);\n  const min=selector.min===undefined?undefined:Number(selector.min);',
    "selector kind parse",
)
selector = replace_once(
    selector,
    '    from:selector.from as CommonPlaySelector["from"],\n    ...(where===undefined?{}:{where}),',
    '    from:selector.from as CommonPlaySelector["from"],\n    ...(kind===undefined?{}:{kind:kind as CommonPlaySelector["kind"]}),\n    ...(where===undefined?{}:{where}),',
    "selector kind return",
)
selector = replace_once(
    selector,
    '    let candidates=input.candidates.filter((candidate)=>!input.selector.area||candidate.areaMember===true)\n      .filter((candidate)=>!input.selector.where||evaluateSemanticPredicate(input.selector.where,(ref)=>ref==="id"?candidate.id:candidate.properties[ref]));',
    '    let candidates=input.candidates\n      .filter((candidate)=>input.selector.kind===undefined||input.selector.kind==="any"||candidate.targeting?.kind===input.selector.kind)\n      .filter((candidate)=>!input.selector.area||candidate.areaMember===true)\n      .filter((candidate)=>!input.selector.where||evaluateSemanticPredicate(input.selector.where,(ref)=>ref==="id"?candidate.id:candidate.properties[ref]));',
    "selector kind filtering",
)
selector = replace_once(
    selector,
    '      kind:"any",minTargets:min,maxTargets:max,directTarget:input.directTarget??!input.selector.area,',
    '      kind:input.selector.kind??"any",minTargets:min,maxTargets:max,directTarget:input.directTarget??!input.selector.area,',
    "selector targeting kind",
)
selector_path.write_text(selector, encoding="utf-8")


# 2) Operation parser/lowering: preserve backwards-compatible creature default, but carry explicit object/point kind.
operation_path = Path("src/domain/commonPlayOperationRuntime.ts")
operation = operation_path.read_text(encoding="utf-8")
operation = replace_once(
    operation,
    'const TARGETING_KEYS=new Set(["from","where","min","max","area","orderBy","selection"]);',
    'const TARGETING_KEYS=new Set(["from","kind","where","min","max","area","orderBy","selection"]);',
    "operation targeting keys",
)
operation = replace_once(
    operation,
    '  return {...parsed,from:"targets",min:parsed.min,max:parsed.max};',
    '  return {...parsed,from:"targets",kind:parsed.kind??"creature",min:parsed.min,max:parsed.max};',
    "operation targeting default kind",
)
operation = replace_once(
    operation,
    '      rule:{kind:"creature",minTargets:entryPoint.targeting.min,maxTargets:entryPoint.targeting.max,directTarget:false},',
    '      rule:{kind:entryPoint.targeting.kind??"creature",minTargets:entryPoint.targeting.min,maxTargets:entryPoint.targeting.max,directTarget:false},',
    "operation resolver targeting kind",
)
operation_path.write_text(operation, encoding="utf-8")


# 3) Contract schema: expose the already-supported Resolver target kinds to portable Common Play.
schema_path = Path("schemas/common-play-contract.schema.json")
schema = json.loads(schema_path.read_text(encoding="utf-8"))
selector_properties = schema["$defs"]["selector"]["properties"]
selector_properties.setdefault("kind", {"enum": ["creature", "object", "point", "any"]})
schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# 4) Production bridge: accept explicit provider-owned non-creature target facts without inventing geometry.
adapter_path = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
adapter = adapter_path.read_text(encoding="utf-8")
provider_anchor = '''export function unregisterAuthoritativeCommonPlayAreaMembershipProvider(adapter:MockAdapter) {
  commonPlayAreaMembershipProviders.delete(adapter);
}
'''
provider_block = provider_anchor + '''
export interface AuthoritativeCommonPlayNonCreatureTargetCandidate {
  id:string;
  kind:"object"|"point";
  relation:TargetingFactInput["relation"];
  distanceFeet?:number;
  visible?:boolean;
  cover?:TargetingFactInput["cover"];
  properties?:CommonPlaySelectorCandidate["properties"];
}

export interface AuthoritativeCommonPlayNonCreatureTargetProvider {
  candidates(input:{sourceId:string}):AuthoritativeCommonPlayNonCreatureTargetCandidate[];
}

const commonPlayNonCreatureTargetProviders=new WeakMap<MockAdapter,AuthoritativeCommonPlayNonCreatureTargetProvider>();

export function registerAuthoritativeCommonPlayNonCreatureTargetProvider(
  adapter:MockAdapter,
  provider:AuthoritativeCommonPlayNonCreatureTargetProvider,
) {
  commonPlayNonCreatureTargetProviders.set(adapter,provider);
}

export function unregisterAuthoritativeCommonPlayNonCreatureTargetProvider(adapter:MockAdapter) {
  commonPlayNonCreatureTargetProviders.delete(adapter);
}
'''
adapter = replace_once(adapter, provider_anchor, provider_block, "non-creature provider declarations")

candidate_anchor = '''function damageDiceFaces(
'''
candidate_helper = '''function commonPlayNonCreatureSelectorCandidates(
  adapter:MockAdapter,
  sourceId:string,
):CommonPlaySelectorCandidate[]|undefined {
  const authored=commonPlayNonCreatureTargetProviders.get(adapter)?.candidates({sourceId})??[];
  const seen=new Set<string>();
  const candidates:CommonPlaySelectorCandidate[]=[];
  for(const candidate of authored) {
    if(!candidate.id||seen.has(candidate.id)||(candidate.kind!=="object"&&candidate.kind!=="point")) return undefined;
    seen.add(candidate.id);
    const targeting:TargetingFactInput={
      id:candidate.id,kind:candidate.kind,relation:candidate.relation,
      ...(candidate.distanceFeet===undefined?{}:{distanceFeet:candidate.distanceFeet}),
      ...(candidate.visible===undefined?{}:{visible:candidate.visible}),
      ...(candidate.cover===undefined?{}:{cover:candidate.cover}),
    };
    candidates.push({
      id:candidate.id,
      targeting,
      properties:{
        ...(candidate.properties??{}),
        kind:candidate.kind,
        relation:candidate.relation,
        ...(candidate.distanceFeet===undefined?{}:{"spatial.distance-feet":candidate.distanceFeet}),
        ...(candidate.visible===undefined?{}:{"sense.can-see":candidate.visible}),
        ...(candidate.cover===undefined?{}:{"spatial.total-cover":candidate.cover==="total"}),
      },
    });
  }
  return candidates;
}

function commonPlayTargetingCandidates(
  adapter:MockAdapter,
  scene:SceneVm,
  state:RulesRuntimeState,
  actor:SceneVm["entities"][number],
  selector:CommonPlaySelector,
):CommonPlaySelectorCandidate[]|undefined {
  const creatures=scene.entities
    .filter((target)=>Boolean(state.combatants[target.id]))
    .map((target)=>commonPlaySelectorCandidate(adapter,scene,actor,target,selector.area));
  if(selector.area) return creatures;
  const nonCreatures=commonPlayNonCreatureSelectorCandidates(adapter,actor.id);
  if(!nonCreatures) return undefined;
  const creatureIds=new Set(creatures.map((candidate)=>candidate.id));
  if(nonCreatures.some((candidate)=>creatureIds.has(candidate.id))) return undefined;
  return [...creatures,...nonCreatures];
}

'''
if candidate_helper not in adapter:
    if candidate_anchor not in adapter:
        raise SystemExit("target candidate helper anchor changed")
    adapter = adapter.replace(candidate_anchor, candidate_helper + candidate_anchor, 1)

prepared_old = '''  selectedTargetId:string;
  selectedTargets:SceneVm["entities"];
  projectedAction:SceneVm["actionsByActor"][string][number]|undefined;
'''
prepared_new = '''  selectedTargetId:string;
  selectedTargetIds:string[];
  selectedTargetFacts:TargetingFactInput[];
  selectorCandidates?:CommonPlaySelectorCandidate[];
  selectedTargets:SceneVm["entities"];
  projectedAction:SceneVm["actionsByActor"][string][number]|undefined;
'''
adapter = replace_once(adapter, prepared_old, prepared_new, "prepared target metadata")

prepare_old = '''  let effectiveTargetIds=[...targetIds];
  let selectedTargetId=effectiveTargetIds[0];
  if(!actorEntity||!state.combatants[actor.id]) return undefined;
  let selectedTargets=effectiveTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id));
  if(selectedTargets.some((target,index)=>!target||!state!.combatants[effectiveTargetIds[index]])) return undefined;
  let uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target!.id,target!] as const)).values()];
  const needsSelectedTarget=action.lowered.kind==="operations"&&portableEntry.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");
  if(hasTargeting) {
    const targeting=portableEntry.targeting!;
    const selectionMode=targeting.selection??"manual";
    if(selectionMode==="automatic"&&targetIds.length&&!(targetIds.length===1&&targetIds[0]===actor.id)) return undefined;
    const candidates=internal.scene.entities
      .filter((target)=>Boolean(state!.combatants[target.id]))
      .map((target)=>commonPlaySelectorCandidate(adapter,internal.scene,actorEntity,target,targeting.area));
    const selection=resolveCommonPlaySelector({
      sourceId:actor.id,
      selector:targeting,
      candidates,
      selectedIds:selectionMode==="manual"?targetIds:undefined,
      selection:selectionMode,
      authority:selectionMode==="automatic"?"host":"actor-owner",
      directTarget:false,
    });
    if(selection.status!=="resolved") return undefined;
    effectiveTargetIds=selection.targetIds;
    selectedTargetId=effectiveTargetIds[0]??actor.id;
    selectedTargets=effectiveTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id));
    if(selectedTargets.some((target,index)=>!target||!state!.combatants[effectiveTargetIds[index]])) return undefined;
    uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target!.id,target!] as const)).values()];
    if(projectedAction&&(!projectedAction.available||selectionMode==="manual"&&targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  } else if(hasAllocation) {
'''
prepare_new = '''  let effectiveTargetIds=[...targetIds];
  let selectedTargetId=effectiveTargetIds[0];
  if(!actorEntity||!state.combatants[actor.id]) return undefined;
  let selectedTargets=effectiveTargetIds
    .map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id))
    .filter((target):target is SceneVm["entities"][number]=>Boolean(target&&state!.combatants[target.id]));
  if(!hasTargeting&&selectedTargets.length!==effectiveTargetIds.length) return undefined;
  let selectedTargetFacts=selectedTargets.map((target)=>commonPlayTargetFact(actorEntity,target));
  let selectorCandidates:CommonPlaySelectorCandidate[]|undefined;
  let uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target.id,target] as const)).values()];
  const needsSelectedTarget=action.lowered.kind==="operations"&&portableEntry.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");
  if(hasTargeting) {
    const targeting=portableEntry.targeting!;
    const selectionMode=targeting.selection??"manual";
    if(selectionMode==="automatic"&&targetIds.length&&!(targetIds.length===1&&targetIds[0]===actor.id)) return undefined;
    selectorCandidates=commonPlayTargetingCandidates(adapter,internal.scene,state,actorEntity,targeting);
    if(!selectorCandidates) return undefined;
    const selection=resolveCommonPlaySelector({
      sourceId:actor.id,
      selector:targeting,
      candidates:selectorCandidates,
      selectedIds:selectionMode==="manual"?targetIds:undefined,
      selection:selectionMode,
      authority:selectionMode==="automatic"?"host":"actor-owner",
      directTarget:false,
    });
    if(selection.status!=="resolved") return undefined;
    effectiveTargetIds=selection.targetIds;
    selectedTargetId=effectiveTargetIds[0]??actor.id;
    const candidateById=new Map(selectorCandidates.map((candidate)=>[candidate.id,candidate] as const));
    const selectedCandidates=effectiveTargetIds.map((id)=>candidateById.get(id));
    if(selectedCandidates.some((candidate)=>!candidate?.targeting)) return undefined;
    selectedTargetFacts=selectedCandidates.map((candidate)=>({...candidate!.targeting!}));
    selectedTargets=effectiveTargetIds
      .map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id))
      .filter((target):target is SceneVm["entities"][number]=>Boolean(target&&state!.combatants[target.id]));
    const requiresCreatureTargets=needsSelectedTarget||hasAllocation||action.lowered.kind==="save-damage";
    if(requiresCreatureTargets&&selectedTargets.length!==effectiveTargetIds.length) return undefined;
    uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target.id,target] as const)).values()];
    const allCreatureTargets=selectedTargetFacts.every((target)=>target.kind==="creature");
    if(projectedAction&&(!projectedAction.available||selectionMode==="manual"&&allCreatureTargets&&targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  } else if(hasAllocation) {
'''
adapter = replace_once(adapter, prepare_old, prepare_new, "prepare non-creature targeting")

return_old = '  return {internal,state,actor,actorEntity,selectedTargetId,selectedTargets:selectedTargets as SceneVm["entities"],projectedAction};'
return_new = '  return {internal,state,actor,actorEntity,selectedTargetId,selectedTargetIds:effectiveTargetIds,selectedTargetFacts,selectorCandidates,selectedTargets,projectedAction};'
adapter = replace_once(adapter, return_old, return_new, "prepared target return")

input_old = '''  const {actor,actorEntity,selectedTargetId,selectedTargets,state}=prepared;'''
input_new = '''  const {actor,actorEntity,selectedTargetId,selectedTargetFacts,selectorCandidates,selectedTargets,state}=prepared;'''
adapter = replace_once(adapter, input_old, input_new, "operation input destructure")
adapter = replace_once(
    adapter,
    '    targetingTargets:entryPoint.targeting?selectedTargets.map((target)=>commonPlayTargetFact(actorEntity,target)):undefined,\n    targetingCandidates:entryPoint.targeting?internal.scene.entities.filter((target)=>state.combatants[target.id]).map((target)=>commonPlaySelectorCandidate(internal as unknown as MockAdapter,internal.scene,actorEntity,target,entryPoint.targeting?.area)):undefined,',
    '    targetingTargets:entryPoint.targeting?selectedTargetFacts.map((target)=>({...target})):undefined,\n    targetingCandidates:entryPoint.targeting?selectorCandidates?.map((candidate)=>structuredClone(candidate)):undefined,',
    "operation input targeting facts",
)

execute_old = '  const {internal,state,actor,actorEntity,selectedTargetId,selectedTargets,projectedAction}=prepared;'
execute_new = '  const {internal,state,actor,actorEntity,selectedTargetId,selectedTargetIds,selectorCandidates,selectedTargets,projectedAction}=prepared;'
adapter = replace_once(adapter, execute_old, execute_new, "execute target metadata")
adapter = replace_once(
    adapter,
    '  const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:allocationTargetIds.length?allocationTargetIds:operationEntryPoint?.targeting?selectedTargets.map((target)=>target.id):lowered.kind==="save-damage"?selectedTargets.map((target)=>target.id):[selectedTargetId];\n  const presentationTargets=presentationTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)!);',
    '  const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:allocationTargetIds.length?allocationTargetIds:operationEntryPoint?.targeting?selectedTargetIds:lowered.kind==="save-damage"?selectedTargets.map((target)=>target.id):[selectedTargetId];\n  const presentationTargetNames=presentationTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)?.name??String(selectorCandidates?.find((candidate)=>candidate.id===id)?.properties.name??id));',
    "presentation non-creature target ids",
)
adapter = replace_once(
    adapter,
    '    targetNames:presentationTargets.map((target)=>target.name),',
    '    targetNames:presentationTargetNames,',
    "presentation non-creature names",
)
adapter_path.write_text(adapter, encoding="utf-8")


# 5) Production acceptance: unknown external object/point selectors + complete identity rename.
test_path = Path("tests/ui/commonPlayRichSelectorProduction.test.ts")
test_text = test_path.read_text(encoding="utf-8")
test_text = replace_once(
    test_text,
    'import { registerAuthoritativeCommonPlayAreaMembershipProvider } from "../../src/app/installedCommonPlayRuntimeAdapter";',
    'import { registerAuthoritativeCommonPlayAreaMembershipProvider, registerAuthoritativeCommonPlayNonCreatureTargetProvider } from "../../src/app/installedCommonPlayRuntimeAdapter";',
    "test provider import",
)
marker = 'test("unknown installed target predicate gates the production Common Play path and survives identity rename"'
if 'unknown installed object and point selectors consume provider-owned candidates and survive identity rename' not in test_text:
    helper = '''
function nonCreaturePayload(identity:Identity,kind:"object"|"point") {
  const authored=JSON.parse(payload(identity));
  authored.content[0].mechanics[0].config.entryPoints[0].targeting={from:"targets",kind,min:1,max:1};
  return JSON.stringify(authored);
}

async function installNonCreature(adapter:MockAdapter,identity:Identity,kind:"object"|"point") {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(nonCreaturePayload(identity,kind));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}

test("unknown installed object and point selectors consume provider-owned candidates and survive identity rename",async()=>{
  async function run(identity:Identity,kind:"object"|"point") {
    const adapter=new MockAdapter();
    const actionId=await installNonCreature(adapter,identity,kind);
    registerAuthoritativeCommonPlayNonCreatureTargetProvider(adapter,{
      candidates:()=>[
        {id:"object.crate",kind:"object",relation:"neutral",properties:{name:"Crate"}},
        {id:"point.cursor",kind:"point",relation:"neutral",properties:{name:"Chosen Point"}},
      ],
    });
    await adapter.startInitiative();
    await adapter.setCurrentActor("char.aelar");
    const wrongId=kind==="object"?"point.cursor":"object.crate";
    await adapter.resolveAction(actionId,[wrongId]);
    let snapshot=await adapter.getSnapshot();
    assert.notEqual(snapshot.resolution?.actionId,actionId,"wrong target kind must fail closed before commit");
    const selectedId=kind==="object"?"object.crate":"point.cursor";
    await adapter.resolveAction(actionId,[selectedId]);
    snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete");
    assert.equal(snapshot.resolution?.actionId,actionId);
    assert.deepEqual(snapshot.resolution?.targetIds,[selectedId]);
    return snapshot.resolution?.targetIds;
  }
  assert.deepEqual(await run(RENAMED,"object"),await run(ORIGINAL,"object"));
  assert.deepEqual(await run(RENAMED,"point"),await run(ORIGINAL,"point"));
});

'''
    index = test_text.find(marker)
    if index < 0:
        raise SystemExit("non-creature test insertion anchor changed")
    test_text = test_text[:index] + helper + test_text[index:]
test_path.write_text(test_text, encoding="utf-8")


# 6) Ledger reconciliation: area provider was already verified/published; this slice closes object/point.
ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next(entry for entry in ledger["rows"] if entry.get("family") == "E")
row["currentState"] = (
    "Portable Common Play targeting preserves bounded selected target sets, evaluates generic predicates over authoritative production candidates, "
    "and routes authored automatic selection plus orderBy through the shared selector kernel with Host authority. Production candidates consume authoritative "
    "Common Play spatial relations for distance, visibility, adjacency, Total Cover, provider-authored reach, and provider-backed area membership without "
    "fabricating geometry. Explicit creature/object/point target kinds route through the same selector and Resolver targeting operation; non-creature objects "
    "and points are supplied only by an authoritative production provider and remain identity-independent."
)
row["disposition"] = "IMPLEMENTED"
for key, evidence in (
    ("implementationEvidence", "commonPlaySelectorRuntime.ts and commonPlayOperationRuntime.ts carry explicit creature/object/point target kind through the shared selector into the existing Resolver TargetingRule; installedCommonPlayRuntimeAdapter.ts bridges provider-owned non-creature candidates without fabricating geometry"),
    ("productionEvidence", "commonPlayRichSelectorProduction.test.ts unknown installed object and point selectors consume provider-owned candidates, reject the wrong target kind before commit, and project selected targetIds through production Common Play"),
    ("productionEvidence", "C9 Family E Area Membership 7130 run 33312307575: provider-backed area membership, 7/7 targeted tests, legacy execution boundary, tsc --noEmit, publish, and verifier retirement all passed; bridge published as 7d3f4ba6"),
    ("identityInvarianceEvidence", "commonPlayRichSelectorProduction.test.ts completely renamed external module/content/mechanic/entry/display identities preserve provider-owned object and point selection semantics"),
):
    if evidence not in row[key]:
        row[key].append(evidence)
row["remainingNamedSeams"] = []
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

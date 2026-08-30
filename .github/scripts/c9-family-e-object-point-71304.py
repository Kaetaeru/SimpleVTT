from pathlib import Path
import json

path = Path('src/app/installedCommonPlayRuntimeAdapter.ts')
text = path.read_text(encoding='utf-8')

provider_anchor = '''export function unregisterAuthoritativeCommonPlayAreaMembershipProvider(adapter:MockAdapter) {
  commonPlayAreaMembershipProviders.delete(adapter);
}
'''
provider_block = provider_anchor + '''
export interface AuthoritativeCommonPlayTargetCandidateProvider {
  candidates(input:{sourceId:string;selector:CommonPlaySelector}):CommonPlaySelectorCandidate[];
}

const commonPlayTargetCandidateProviders=new WeakMap<MockAdapter,AuthoritativeCommonPlayTargetCandidateProvider>();

export function registerAuthoritativeCommonPlayTargetCandidateProvider(
  adapter:MockAdapter,
  provider:AuthoritativeCommonPlayTargetCandidateProvider,
) {
  commonPlayTargetCandidateProviders.set(adapter,provider);
}

export function unregisterAuthoritativeCommonPlayTargetCandidateProvider(adapter:MockAdapter) {
  commonPlayTargetCandidateProviders.delete(adapter);
}
'''
if 'registerAuthoritativeCommonPlayTargetCandidateProvider' not in text:
    if provider_anchor not in text:
        raise SystemExit('target provider insertion anchor changed')
    text = text.replace(provider_anchor, provider_block, 1)

old_sig = '''function projectedArtifactAction(
  actionId:string,
  actorId:string,
  action:CommonPlayProductionAction,
  scene:SceneVm,
  state:RulesRuntimeState,
):ActionVm {'''
new_sig = '''function projectedArtifactAction(
  adapter:MockAdapter,
  actionId:string,
  actorId:string,
  action:CommonPlayProductionAction,
  scene:SceneVm,
  state:RulesRuntimeState,
):ActionVm {'''
if old_sig in text:
    text = text.replace(old_sig, new_sig, 1)
elif new_sig not in text:
    raise SystemExit('projectedArtifactAction signature changed')

old_portable = 'const portableEntry=entryPoint as {targeting?:{min?:number;max?:number;selection?:"manual"|"automatic"};allocation?:{targets:{min?:number;max?:number}}};'
new_portable = 'const portableEntry=entryPoint as {targeting?:CommonPlaySelector;allocation?:{targets:{min?:number;max?:number}}};'
if old_portable in text:
    text = text.replace(old_portable, new_portable, 1)
elif new_portable not in text:
    raise SystemExit('portable entry projection anchor changed')

old_eligible = '''  const eligibleTargetIds=automaticTargeting
    ?[actorId]
    :targeted?scene.entities.filter((entity)=>state.combatants[entity.id]).map((entity)=>entity.id):[actorId];'''
new_eligible = '''  const actorEntity=scene.entities.find((entity)=>entity.id===actorId);
  const selectorTargetIds=targeting&&actorEntity
    ?commonPlayTargetCandidates(adapter,scene,state,actorEntity,targeting).map((candidate)=>candidate.id)
    :[];
  const eligibleTargetIds=automaticTargeting
    ?[actorId]
    :targeting?selectorTargetIds:targeted?scene.entities.filter((entity)=>state.combatants[entity.id]).map((entity)=>entity.id):[actorId];'''
if old_eligible in text:
    text = text.replace(old_eligible, new_eligible, 1)
elif new_eligible not in text:
    raise SystemExit('eligible target projection anchor changed')

text = text.replace(
    'projectedArtifactAction(actionId,actor.combatantId,action,snapshot.scene,state)',
    'projectedArtifactAction(adapter,actionId,actor.combatantId,action,snapshot.scene,state)',
)
text = text.replace(
    'projectedArtifactAction(definitionActionId,stored.ownerActorId,action,snapshot.scene,state)',
    'projectedArtifactAction(adapter,definitionActionId,stored.ownerActorId,action,snapshot.scene,state)',
)

helper_anchor = '''function damageDiceFaces(
  internal:AdapterState,'''
helper = '''function commonPlayTargetCandidates(
  adapter:MockAdapter,
  scene:SceneVm,
  state:RulesRuntimeState,
  actor:SceneVm["entities"][number],
  selector:CommonPlaySelector,
) {
  const creatures=scene.entities
    .filter((target)=>Boolean(state.combatants[target.id]))
    .map((target)=>commonPlaySelectorCandidate(adapter,scene,actor,target,selector.area));
  if(selector.from!=="targets") return creatures;
  const reservedIds=new Set(creatures.map((candidate)=>candidate.id));
  const supplied=commonPlayTargetCandidateProviders.get(adapter)?.candidates({sourceId:actor.id,selector:cp(selector)})??[];
  const external=supplied.filter((candidate)=>
    candidate.id===candidate.targeting?.id
    &&(candidate.targeting.kind==="object"||candidate.targeting.kind==="point")
    &&!reservedIds.has(candidate.id),
  );
  return [...creatures,...cp(external)];
}

''' + helper_anchor
if 'function commonPlayTargetCandidates(' not in text:
    if helper_anchor not in text:
        raise SystemExit('candidate helper insertion anchor changed')
    text = text.replace(helper_anchor, helper, 1)

old_interface = '''interface PreparedCommonPlayAction {
  internal:AdapterState;
  state:RulesRuntimeState;
  actor:{id:string;name:string};
  actorEntity:SceneVm["entities"][number];
  selectedTargetId:string;
  selectedTargets:SceneVm["entities"];
  projectedAction:SceneVm["actionsByActor"][string][number]|undefined;
}'''
new_interface = '''interface PreparedCommonPlayAction {
  internal:AdapterState;
  state:RulesRuntimeState;
  actor:{id:string;name:string};
  actorEntity:SceneVm["entities"][number];
  selectedTargetId:string;
  selectedTargets:SceneVm["entities"];
  selectedTargetFacts:TargetingFactInput[];
  selectedTargetNames:Record<string,string>;
  targetingCandidates?:CommonPlaySelectorCandidate[];
  projectedAction:SceneVm["actionsByActor"][string][number]|undefined;
}'''
if old_interface in text:
    text = text.replace(old_interface, new_interface, 1)
elif new_interface not in text:
    raise SystemExit('prepared interface anchor changed')

old_prepare = '''  let selectedTargets=effectiveTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id));
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
  }'''
new_prepare = '''  let selectedTargets=effectiveTargetIds
    .map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id))
    .filter((target):target is SceneVm["entities"][number]=>Boolean(target&&state!.combatants[target.id]));
  if(!hasTargeting&&selectedTargets.length!==effectiveTargetIds.length) return undefined;
  let selectedTargetFacts=selectedTargets.map((target)=>commonPlayTargetFact(actorEntity,target));
  let selectedTargetNames=Object.fromEntries(selectedTargets.map((target)=>[target.id,target.name]));
  let targetingCandidates:CommonPlaySelectorCandidate[]|undefined;
  let uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target.id,target] as const)).values()];
  const needsSelectedTarget=action.lowered.kind==="operations"&&portableEntry.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");
  if(hasTargeting) {
    const targeting=portableEntry.targeting!;
    const selectionMode=targeting.selection??"manual";
    if(selectionMode==="automatic"&&targetIds.length&&!(targetIds.length===1&&targetIds[0]===actor.id)) return undefined;
    const candidates=commonPlayTargetCandidates(adapter,internal.scene,state,actorEntity,targeting);
    targetingCandidates=candidates;
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
    const byId=new Map(candidates.map((candidate)=>[candidate.id,candidate]));
    const selectedCandidates=effectiveTargetIds.map((id)=>byId.get(id));
    if(selectedCandidates.some((candidate)=>!candidate?.targeting)) return undefined;
    selectedTargetFacts=selectedCandidates.map((candidate)=>candidate!.targeting!);
    selectedTargetNames=Object.fromEntries(selectedCandidates.map((candidate)=>[
      candidate!.id,
      typeof candidate!.properties.name==="string"?candidate!.properties.name:candidate!.id,
    ]));
    selectedTargets=effectiveTargetIds
      .map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id))
      .filter((target):target is SceneVm["entities"][number]=>Boolean(target&&state!.combatants[target.id]));
    uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target.id,target] as const)).values()];
    if((action.lowered.kind==="save-damage"||needsSelectedTarget)&&selectedTargetFacts.some((facts)=>facts.kind!=="creature")) return undefined;
    if(projectedAction&&(!projectedAction.available||selectionMode==="manual"&&targetIds.some((id)=>!projectedAction.eligibleTargetIds.includes(id)))) return undefined;
  }'''
if old_prepare in text:
    text = text.replace(old_prepare, new_prepare, 1)
elif new_prepare not in text:
    raise SystemExit('prepare selector anchor changed')

old_return = 'return {internal,state,actor,actorEntity,selectedTargetId,selectedTargets:selectedTargets as SceneVm["entities"],projectedAction};'
new_return = 'return {internal,state,actor,actorEntity,selectedTargetId,selectedTargets,selectedTargetFacts,selectedTargetNames,targetingCandidates,projectedAction};'
if old_return in text:
    text = text.replace(old_return, new_return, 1)
elif new_return not in text:
    raise SystemExit('prepared return anchor changed')

old_op_destructure = 'const {actor,actorEntity,selectedTargetId,selectedTargets,state}=prepared;'
new_op_destructure = 'const {actor,actorEntity,selectedTargetId,selectedTargets,selectedTargetFacts,targetingCandidates,state}=prepared;'
if old_op_destructure in text:
    text = text.replace(old_op_destructure, new_op_destructure, 1)
elif new_op_destructure not in text:
    raise SystemExit('operation input destructure changed')
text = text.replace(
    'targetingTargets:entryPoint.targeting?selectedTargets.map((target)=>commonPlayTargetFact(actorEntity,target)):undefined,',
    'targetingTargets:entryPoint.targeting?selectedTargetFacts:undefined,',
    1,
)
text = text.replace(
    'targetingCandidates:entryPoint.targeting?internal.scene.entities.filter((target)=>state.combatants[target.id]).map((target)=>commonPlaySelectorCandidate(internal as unknown as MockAdapter,internal.scene,actorEntity,target,entryPoint.targeting?.area)):undefined,',
    'targetingCandidates:entryPoint.targeting?targetingCandidates:undefined,',
    1,
)

old_exec = 'const {internal,state,actor,actorEntity,selectedTargetId,selectedTargets,projectedAction}=prepared;'
new_exec = 'const {internal,state,actor,actorEntity,selectedTargetId,selectedTargets,selectedTargetFacts,selectedTargetNames,projectedAction}=prepared;'
if old_exec in text:
    text = text.replace(old_exec, new_exec, 1)
elif new_exec not in text:
    raise SystemExit('execute destructure changed')
text = text.replace(
    'const candidateTargetIds=[...new Set(selectedTargets.map((target)=>target.id))];',
    'const candidateTargetIds=[...new Set(selectedTargetFacts.map((target)=>target.id))];',
    1,
)
text = text.replace(
    'allocations:allocationEntriesFromTargetSequence(selectedTargets.map((target)=>target.id)),',
    'allocations:allocationEntriesFromTargetSequence(selectedTargetFacts.map((target)=>target.id)),',
    1,
)
old_presentation = 'const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:allocationTargetIds.length?allocationTargetIds:operationEntryPoint?.targeting?selectedTargets.map((target)=>target.id):lowered.kind==="save-damage"?selectedTargets.map((target)=>target.id):[selectedTargetId];\n  const presentationTargets=presentationTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)!);'
new_presentation = 'const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:allocationTargetIds.length?allocationTargetIds:operationEntryPoint?.targeting?selectedTargetFacts.map((target)=>target.id):lowered.kind==="save-damage"?selectedTargets.map((target)=>target.id):[selectedTargetId];\n  const presentationTargetNames=presentationTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)?.name??selectedTargetNames[id]??id);'
if old_presentation in text:
    text = text.replace(old_presentation, new_presentation, 1)
elif new_presentation not in text:
    raise SystemExit('presentation target anchor changed')
text = text.replace('targetNames:presentationTargets.map((target)=>target.name),', 'targetNames:presentationTargetNames,', 1)

path.write_text(text, encoding='utf-8')

test_path = Path('tests/ui/commonPlayRichSelectorProduction.test.ts')
test_text = test_path.read_text(encoding='utf-8')
old_import = 'import { registerAuthoritativeCommonPlayAreaMembershipProvider } from "../../src/app/installedCommonPlayRuntimeAdapter";'
new_import = 'import { registerAuthoritativeCommonPlayAreaMembershipProvider, registerAuthoritativeCommonPlayTargetCandidateProvider } from "../../src/app/installedCommonPlayRuntimeAdapter";'
if old_import in test_text:
    test_text = test_text.replace(old_import, new_import, 1)
elif new_import not in test_text:
    raise SystemExit('rich selector provider import anchor changed')

test_name = 'unknown installed Common Play selects provider-authored object and point targets without identity dispatch'
if test_name not in test_text:
    test_text += '''

function externalTargetPayload(identity:Identity) {
  const authored=JSON.parse(payload(identity));
  authored.content[0].mechanics[0].config.entryPoints[0].targeting={from:"targets",min:1,max:1};
  return JSON.stringify(authored);
}

async function executeExternalTarget(identity:Identity,kind:"object"|"point") {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(externalTargetPayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  registerAuthoritativeCommonPlayTargetCandidateProvider(adapter,{
    candidates:()=>[
      {id:"object.training-door",targeting:{id:"object.training-door",kind:"object",relation:"neutral",distanceFeet:10,visible:true,cover:"none"},properties:{name:"Training Door"}},
      {id:"point.marker-alpha",targeting:{id:"point.marker-alpha",kind:"point",relation:"neutral",distanceFeet:20,visible:true,cover:"none"},properties:{name:"Marker Alpha"}},
      {id:"combatant.goblin-a",targeting:{id:"combatant.goblin-a",kind:"object",relation:"neutral"},properties:{name:"Collision must not override creature"}},
    ],
  });
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
  const targetId=kind==="object"?"object.training-door":"point.marker-alpha";
  await adapter.resolveAction(actionId,[targetId]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.deepEqual(snapshot.resolution?.targetIds,[targetId]);
  return snapshot.resolution?.targetIds;
}

test("unknown installed Common Play selects provider-authored object and point targets without identity dispatch",async()=>{
  assert.deepEqual(await executeExternalTarget(RENAMED,"object"),await executeExternalTarget(ORIGINAL,"object"));
  assert.deepEqual(await executeExternalTarget(RENAMED,"point"),await executeExternalTarget(ORIGINAL,"point"));
});
'''
test_path.write_text(test_text, encoding='utf-8')

ledger_path = Path('docs/rules/v1-mechanism-coverage-ledger.json')
ledger = json.loads(ledger_path.read_text(encoding='utf-8'))
family = next((row for row in ledger['rows'] if row.get('family') == 'E'), None)
if not family:
    raise SystemExit('Family E ledger row missing')
family['currentState'] = 'Portable Common Play targeting preserves bounded selected target sets, generic predicates, automatic/manual authority, provider-backed spatial facts including reach and area membership, and provider-authored object/point candidates through the shared selector kernel without content identity dispatch or Core geometry fabrication.'
family['disposition'] = 'IMPLEMENTED'
def add(field, value):
    if value not in family[field]:
        family[field].append(value)
add('implementationEvidence', 'installedCommonPlayRuntimeAdapter.ts accepts authoritative provider-authored object/point CommonPlaySelectorCandidate facts alongside scene combatants while preventing provider override of creature identities and preserving creature-only damage/save execution boundaries')
add('implementationEvidence', 'installedCommonPlayRuntimeAdapter.ts AuthoritativeCommonPlayAreaMembershipProvider supplies provider-owned area membership to the same generic selector kernel')
add('productionEvidence', 'commonPlayRichSelectorProduction.test.ts unknown installed self-origin area selector consumes provider-backed membership and remains identity invariant; C9 Family E Area Membership 7130 run 33312307575 passed targeted tests, legacy boundary, typecheck, and publish')
add('productionEvidence', 'commonPlayRichSelectorProduction.test.ts unknown installed Common Play selects provider-authored object and point targets through production resolveAction and presentation targetIds')
add('identityInvarianceEvidence', 'commonPlayRichSelectorProduction.test.ts provider-authored object and point target selection remains invariant under complete external module/content/mechanic/entry/display rename')
family['remainingNamedSeams'] = []
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

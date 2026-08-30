from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected exactly one patch anchor")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


adapter = Path("src/app/installedCommonPlayRuntimeAdapter.ts")

replace_once(
    adapter,
    '''export function unregisterAuthoritativeCommonPlayAreaMembershipProvider(adapter:MockAdapter) {
  commonPlayAreaMembershipProviders.delete(adapter);
}


export function setBuiltinCommonPlayCatalogForTests''',
    '''export function unregisterAuthoritativeCommonPlayAreaMembershipProvider(adapter:MockAdapter) {
  commonPlayAreaMembershipProviders.delete(adapter);
}

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

function authoritativeCommonPlayTargetCandidates(
  adapter:MockAdapter,
  sourceId:string,
  selector:CommonPlaySelector,
):CommonPlaySelectorCandidate[]|undefined {
  const provider=commonPlayTargetCandidateProviders.get(adapter);
  if(!provider) return [];
  try {
    const candidates=provider.candidates({sourceId,selector:structuredClone(selector)}).map((candidate)=>cp(candidate));
    const seen=new Set<string>();
    for(const candidate of candidates) {
      const targeting=candidate.targeting;
      if(!candidate.id||!targeting||targeting.id!==candidate.id||(targeting.kind!=="object"&&targeting.kind!=="point")||seen.has(candidate.id)) return undefined;
      seen.add(candidate.id);
    }
    return candidates;
  } catch {
    return undefined;
  }
}


export function setBuiltinCommonPlayCatalogForTests''',
)

replace_once(
    adapter,
    '''interface PreparedCommonPlayAction {
  internal:AdapterState;
  state:RulesRuntimeState;
  actor:{id:string;name:string};
  actorEntity:SceneVm["entities"][number];
  selectedTargetId:string;
  selectedTargets:SceneVm["entities"];
  projectedAction:SceneVm["actionsByActor"][string][number]|undefined;
}''',
    '''interface PreparedCommonPlayAction {
  internal:AdapterState;
  state:RulesRuntimeState;
  actor:{id:string;name:string};
  actorEntity:SceneVm["entities"][number];
  selectedTargetId:string;
  selectedTargetIds:string[];
  selectedTargetNames:Record<string,string>;
  selectedTargets:SceneVm["entities"];
  targetingTargets?:TargetingFactInput[];
  targetingCandidates?:CommonPlaySelectorCandidate[];
  projectedAction:SceneVm["actionsByActor"][string][number]|undefined;
}''',
)

replace_once(
    adapter,
    '''  let uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target!.id,target!] as const)).values()];
  const needsSelectedTarget=action.lowered.kind==="operations"&&portableEntry.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");''',
    '''  let uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target!.id,target!] as const)).values()];
  let selectedTargetNames:Record<string,string>=Object.fromEntries(uniqueSelectedTargets.map((target)=>[target.id,target.name]));
  let targetingTargets:TargetingFactInput[]|undefined;
  let targetingCandidates:CommonPlaySelectorCandidate[]|undefined;
  const needsSelectedTarget=action.lowered.kind==="operations"&&portableEntry.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply")&&operation.target==="target");''',
)

replace_once(
    adapter,
    '''    const candidates=internal.scene.entities
      .filter((target)=>Boolean(state!.combatants[target.id]))
      .map((target)=>commonPlaySelectorCandidate(adapter,internal.scene,actorEntity,target,targeting.area));''',
    '''    const providerCandidates=authoritativeCommonPlayTargetCandidates(adapter,actor.id,targeting);
    if(providerCandidates===undefined||providerCandidates.some((candidate)=>internal.scene.entities.some((entity)=>entity.id===candidate.id))) return undefined;
    const candidates=[
      ...internal.scene.entities
        .filter((target)=>Boolean(state!.combatants[target.id]))
        .map((target)=>commonPlaySelectorCandidate(adapter,internal.scene,actorEntity,target,targeting.area)),
      ...providerCandidates,
    ];''',
)

replace_once(
    adapter,
    '''    effectiveTargetIds=selection.targetIds;
    selectedTargetId=effectiveTargetIds[0]??actor.id;
    selectedTargets=effectiveTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id));
    if(selectedTargets.some((target,index)=>!target||!state!.combatants[effectiveTargetIds[index]])) return undefined;
    uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target!.id,target!] as const)).values()];''',
    '''    effectiveTargetIds=selection.targetIds;
    selectedTargetId=effectiveTargetIds[0]??actor.id;
    const selectedCandidates=effectiveTargetIds.map((id)=>candidates.find((candidate)=>candidate.id===id));
    if(selectedCandidates.some((candidate)=>!candidate?.targeting)) return undefined;
    targetingTargets=selectedCandidates.map((candidate)=>candidate!.targeting!);
    targetingCandidates=candidates;
    selectedTargetNames=Object.fromEntries(selectedCandidates.map((candidate)=>[
      candidate!.id,
      typeof candidate!.properties.name==="string"?candidate!.properties.name:candidate!.id,
    ]));
    selectedTargets=effectiveTargetIds
      .map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id))
      .filter((target):target is SceneVm["entities"][number]=>Boolean(target));
    const requiresCreatureSelectedTarget=action.lowered.kind==="save-damage"||hasAllocation||needsSelectedTarget||("test" in entryPoint&&Boolean(entryPoint.test));
    if(requiresCreatureSelectedTarget&&(selectedTargets.length!==effectiveTargetIds.length||selectedTargets.some((target)=>!state!.combatants[target.id]))) return undefined;
    uniqueSelectedTargets=[...new Map(selectedTargets.map((target)=>[target.id,target] as const)).values()];''',
)

replace_once(
    adapter,
    '''  return {internal,state,actor,actorEntity,selectedTargetId,selectedTargets:selectedTargets as SceneVm["entities"],projectedAction};''',
    '''  return {
    internal,state,actor,actorEntity,selectedTargetId,selectedTargetIds:effectiveTargetIds,selectedTargetNames,
    selectedTargets:selectedTargets as SceneVm["entities"],targetingTargets,targetingCandidates,projectedAction,
  };''',
)

replace_once(
    adapter,
    '''  const {actor,actorEntity,selectedTargetId,selectedTargets,state}=prepared;''',
    '''  const {actor,actorEntity,selectedTargetId,selectedTargets,state,targetingTargets,targetingCandidates}=prepared;''',
)

replace_once(
    adapter,
    '''    targetingTargets:entryPoint.targeting?selectedTargets.map((target)=>commonPlayTargetFact(actorEntity,target)):undefined,
    targetingCandidates:entryPoint.targeting?internal.scene.entities.filter((target)=>state.combatants[target.id]).map((target)=>commonPlaySelectorCandidate(internal as unknown as MockAdapter,internal.scene,actorEntity,target,entryPoint.targeting?.area)):undefined,''',
    '''    targetingTargets:entryPoint.targeting?targetingTargets:undefined,
    targetingCandidates:entryPoint.targeting?targetingCandidates:undefined,''',
)

replace_once(
    adapter,
    '''  const {internal,state,actor,actorEntity,selectedTargetId,selectedTargets,projectedAction}=prepared;''',
    '''  const {internal,state,actor,actorEntity,selectedTargetId,selectedTargetIds,selectedTargetNames,selectedTargets,projectedAction}=prepared;''',
)

replace_once(
    adapter,
    '''  const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:allocationTargetIds.length?allocationTargetIds:operationEntryPoint?.targeting?selectedTargets.map((target)=>target.id):lowered.kind==="save-damage"?selectedTargets.map((target)=>target.id):[selectedTargetId];
  const presentationTargets=presentationTargetIds.map((id)=>internal.scene.entities.find((candidate)=>candidate.id===id)!);''',
    '''  const presentationTargetIds=affectedTargetIds.length?affectedTargetIds:allocationTargetIds.length?allocationTargetIds:operationEntryPoint?.targeting?selectedTargetIds:lowered.kind==="save-damage"?selectedTargets.map((target)=>target.id):[selectedTargetId];''',
)

replace_once(
    adapter,
    '''    targetNames:presentationTargets.map((target)=>target.name),''',
    '''    targetNames:presentationTargetIds.map((id)=>selectedTargetNames[id]??internal.scene.entities.find((candidate)=>candidate.id===id)?.name??id),''',
)


test_path=Path("tests/ui/c9FamilyEObjectPointSelectorProduction.test.ts")
if not test_path.exists():
    test_path.write_text(r'''import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import {
  registerAuthoritativeCommonPlayTargetCandidateProvider,
  unregisterAuthoritativeCommonPlayTargetCandidateProvider,
} from "../../src/app/installedCommonPlayRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

type Identity={moduleId:string;contentId:string;mechanicId:string;objectEntry:string;pointEntry:string;displayName:string};
const ORIGINAL:Identity={
  moduleId:"homebrew.family-e-object-point",contentId:"option.family-e-object-point",mechanicId:"external.unknown.family-e-object-point",
  objectEntry:"select-object",pointEntry:"select-point",displayName:"Object Point Selector",
};
const RENAMED:Identity={
  moduleId:"homebrew.renamed-family-e-object-point",contentId:"option.renamed-family-e-object-point",mechanicId:"external.renamed.family-e-object-point",
  objectEntry:"renamed-object-entry",pointEntry:"renamed-point-entry",displayName:"Completely Renamed Selector",
};
const OBJECT_ID="provider.object.portable-crate";
const POINT_ID="provider.point.portable-marker";

function payload(identity:Identity) {
  const entry=(id:string,kind:"object"|"point")=>({
    id,invocation:"manual",targeting:{
      from:"targets",min:1,max:1,selection:"automatic",
      where:{op:"eq",left:{ref:"kind"},right:{value:kind}},
    },operations:[],
  });
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family E object/point selector probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        entryPoints:[entry(identity.objectEntry,"object"),entry(identity.pointEntry,"point")],
      }}],
    }],
  });
}

async function installed(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return adapter;
}

function actionId(identity:Identity,entryPointId:string) {
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,entryPointId,
  });
}

async function exercise(identity:Identity) {
  const adapter=await installed(identity);
  registerAuthoritativeCommonPlayTargetCandidateProvider(adapter,{
    candidates:()=>[
      {id:OBJECT_ID,targeting:{id:OBJECT_ID,kind:"object",relation:"neutral"},properties:{kind:"object",name:"Portable Crate"}},
      {id:POINT_ID,targeting:{id:POINT_ID,kind:"point",relation:"neutral"},properties:{kind:"point",name:"Portable Marker"}},
    ],
  });
  const actorId=(await adapter.getSnapshot()).activeCharacter.id;
  const objectResult=await adapter.resolveAction(actionId(identity,identity.objectEntry),[actorId]);
  assert.equal(objectResult.resolution?.stage,"complete",JSON.stringify(objectResult.resolution));
  assert.deepEqual(objectResult.resolution?.targetIds,[OBJECT_ID]);
  const pointResult=await adapter.resolveAction(actionId(identity,identity.pointEntry),[actorId]);
  assert.equal(pointResult.resolution?.stage,"complete",JSON.stringify(pointResult.resolution));
  assert.deepEqual(pointResult.resolution?.targetIds,[POINT_ID]);
  unregisterAuthoritativeCommonPlayTargetCandidateProvider(adapter);
  return [objectResult.resolution?.targetIds,pointResult.resolution?.targetIds];
}

test("unknown installed Common Play selects provider-owned object and point targets under complete identity rename",async()=>{
  assert.deepEqual(await exercise(RENAMED),await exercise(ORIGINAL));
});

test("object and point selectors fail closed without an authoritative candidate provider",async()=>{
  const adapter=await installed(ORIGINAL);
  const actorId=(await adapter.getSnapshot()).activeCharacter.id;
  const result=await adapter.resolveAction(actionId(ORIGINAL,ORIGINAL.objectEntry),[actorId]);
  assert.equal(result.resolution,undefined);
});
''',encoding="utf-8")

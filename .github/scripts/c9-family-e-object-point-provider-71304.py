from pathlib import Path

p=Path('src/app/installedCommonPlayRuntimeAdapter.ts')
text=p.read_text(encoding='utf-8')

def rep(old,new):
    global text
    if new in text: return
    if text.count(old)!=1: raise SystemExit('provider patch anchor changed')
    text=text.replace(old,new,1)

rep('''export function unregisterAuthoritativeCommonPlayAreaMembershipProvider(adapter:MockAdapter) {
  commonPlayAreaMembershipProviders.delete(adapter);
}
''','''export function unregisterAuthoritativeCommonPlayAreaMembershipProvider(adapter:MockAdapter) {
  commonPlayAreaMembershipProviders.delete(adapter);
}

export interface AuthoritativeCommonPlayTargetCandidateProvider {
  candidates(input:{sourceId:string;selector:CommonPlaySelector}):CommonPlaySelectorCandidate[];
}

const commonPlayTargetCandidateProviders=new WeakMap<MockAdapter,AuthoritativeCommonPlayTargetCandidateProvider>();

export function registerAuthoritativeCommonPlayTargetCandidateProvider(adapter:MockAdapter,provider:AuthoritativeCommonPlayTargetCandidateProvider) {
  commonPlayTargetCandidateProviders.set(adapter,provider);
}

export function unregisterAuthoritativeCommonPlayTargetCandidateProvider(adapter:MockAdapter) {
  commonPlayTargetCandidateProviders.delete(adapter);
}
''')

rep('''function projectedArtifactAction(
  actionId:string,
  actorId:string,
  action:CommonPlayProductionAction,
  scene:SceneVm,
  state:RulesRuntimeState,
):ActionVm {''','''function projectedArtifactAction(
  adapter:MockAdapter,
  actionId:string,
  actorId:string,
  action:CommonPlayProductionAction,
  scene:SceneVm,
  state:RulesRuntimeState,
):ActionVm {''')
rep('''  const portableEntry=entryPoint as {targeting?:{min?:number;max?:number;selection?:"manual"|"automatic"};allocation?:{targets:{min?:number;max?:number}}};''','''  const portableEntry=entryPoint as {targeting?:CommonPlaySelector;allocation?:{targets:{min?:number;max?:number}}};''')
rep('''  const eligibleTargetIds=automaticTargeting
    ?[actorId]
    :targeted?scene.entities.filter((entity)=>state.combatants[entity.id]).map((entity)=>entity.id):[actorId];''','''  const actorEntity=scene.entities.find((entity)=>entity.id===actorId);
  const selectorTargetIds=targeting&&actorEntity?commonPlayTargetCandidates(adapter,scene,state,actorEntity,targeting).map((candidate)=>candidate.id):[];
  const eligibleTargetIds=automaticTargeting
    ?[actorId]
    :targeting?selectorTargetIds:targeted?scene.entities.filter((entity)=>state.combatants[entity.id]).map((entity)=>entity.id):[actorId];''')
text=text.replace('projectedArtifactAction(actionId,actor.combatantId,action,snapshot.scene,state)','projectedArtifactAction(adapter,actionId,actor.combatantId,action,snapshot.scene,state)')
text=text.replace('projectedArtifactAction(definitionActionId,stored.ownerActorId,action,snapshot.scene,state)','projectedArtifactAction(adapter,definitionActionId,stored.ownerActorId,action,snapshot.scene,state)')

rep('''function damageDiceFaces(
  internal:AdapterState,''','''function commonPlayTargetCandidates(adapter:MockAdapter,scene:SceneVm,state:RulesRuntimeState,actor:SceneVm["entities"][number],selector:CommonPlaySelector) {
  const creatures=scene.entities.filter((target)=>Boolean(state.combatants[target.id])).map((target)=>commonPlaySelectorCandidate(adapter,scene,actor,target,selector.area));
  if(selector.from!=="targets") return creatures;
  const reservedIds=new Set(creatures.map((candidate)=>candidate.id));
  let supplied:CommonPlaySelectorCandidate[];
  try { supplied=commonPlayTargetCandidateProviders.get(adapter)?.candidates({sourceId:actor.id,selector:cp(selector)})??[]; }
  catch { return creatures; }
  const seen=new Set<string>();
  const external=supplied.filter((candidate)=>{
    const valid=candidate.id===candidate.targeting?.id&&(candidate.targeting.kind==="object"||candidate.targeting.kind==="point")&&!reservedIds.has(candidate.id)&&!seen.has(candidate.id);
    if(valid) seen.add(candidate.id);
    return valid;
  });
  return [...creatures,...cp(external)];
}

function damageDiceFaces(
  internal:AdapterState,''')

p.write_text(text,encoding='utf-8')

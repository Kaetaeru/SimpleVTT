from pathlib import Path

composition = Path("src/app/commonPlayActorTurnRuleComposition.ts")
text = composition.read_text()
binding_anchor = '''export interface InstalledCommonPlayActorTurnRuleBinding {
  artifactId:string;
  actorId:string;
  definitionId:string;
  rules:ActorTurnRule[];
}
'''
if binding_anchor not in text:
    raise SystemExit("actor turn binding anchor missing")
text = text.replace(binding_anchor, binding_anchor + '''\nexport interface InstalledCommonPlayActorTurnRuleCandidate {
  id:string;
  artifactId:string;
  actorId:string;
  definitionId:string;
  ruleId:string;
  event:TurnBoundaryKind;
}
''', 1)
compile_anchor = "export function compileInstalledCommonPlayActorTurnRuleOperations("
start = text.find(compile_anchor)
if start < 0:
    raise SystemExit("actor turn compiler anchor missing")
replacement = r'''export function collectInstalledCommonPlayActorTurnRuleCandidates(
  state:RulesRuntimeState,
  bindings:InstalledCommonPlayActorTurnRuleBinding[],
  input:{id:string;kind:TurnBoundaryKind;actorId:string},
):InstalledCommonPlayActorTurnRuleCandidate[] {
  const candidates:InstalledCommonPlayActorTurnRuleCandidate[]=[];
  for(const binding of bindings) {
    if(binding.actorId!==input.actorId) continue;
    const artifact=(state.artifacts??[]).find((candidate)=>candidate.id===binding.artifactId&&candidate.artifactKind==="actor"&&candidate.actor?.combatantId===input.actorId);
    if(!artifact) continue;
    for(const rule of binding.rules) {
      if(rule.event!==input.kind) continue;
      const frequency=resolveCommonPlayFrequency({
        ruleId:`${binding.definitionId}:${rule.id}`,
        subjectId:input.actorId,
        frequency:rule.frequency,
        resolutionId:input.id,
        clock:state.clock,
        markers:artifact.metadata??{},
      });
      if(!frequency.eligible) continue;
      candidates.push({
        id:`${artifact.id}:${binding.definitionId}:${rule.id}`,
        artifactId:artifact.id,
        actorId:input.actorId,
        definitionId:binding.definitionId,
        ruleId:rule.id,
        event:rule.event,
      });
    }
  }
  return candidates;
}

function orderedActorTurnCandidates(
  candidates:InstalledCommonPlayActorTurnRuleCandidate[],
  orderedCandidateIds:string[]|undefined,
) {
  if(!orderedCandidateIds) return candidates;
  const byId=new Map(candidates.map((candidate)=>[candidate.id,candidate]));
  if(orderedCandidateIds.length!==candidates.length
    ||new Set(orderedCandidateIds).size!==orderedCandidateIds.length
    ||orderedCandidateIds.some((id)=>!byId.has(id))) {
    throw new DomainEvaluationError("Common Play actor turn ordering must be an exact permutation of eligible rules");
  }
  return orderedCandidateIds.map((id)=>byId.get(id)!);
}

export function compileInstalledCommonPlayActorTurnRuleOperations(
  state:RulesRuntimeState,
  bindings:InstalledCommonPlayActorTurnRuleBinding[],
  input:{
    id:string;kind:TurnBoundaryKind;actorId:string;
    rechargeDieFace?:(ruleId:string,operationIndex:number,sides:number)=>number;
    orderedCandidateIds?:string[];
  },
):ResolutionOperation[] {
  const candidates=orderedActorTurnCandidates(
    collectInstalledCommonPlayActorTurnRuleCandidates(state,bindings,input),
    input.orderedCandidateIds,
  );
  const operations:ResolutionOperation[]=[];
  for(const candidate of candidates) {
    const binding=bindings.find((entry)=>entry.artifactId===candidate.artifactId&&entry.actorId===candidate.actorId&&entry.definitionId===candidate.definitionId);
    const rule=binding?.rules.find((entry)=>entry.id===candidate.ruleId&&entry.event===candidate.event);
    const artifact=(state.artifacts??[]).find((entry)=>entry.id===candidate.artifactId&&entry.artifactKind==="actor"&&entry.actor?.combatantId===input.actorId);
    if(!binding||!rule||!artifact) throw new DomainEvaluationError(`Common Play actor turn candidate is no longer available: ${candidate.id}`);
    const frequency=resolveCommonPlayFrequency({
      ruleId:`${binding.definitionId}:${rule.id}`,
      subjectId:input.actorId,
      frequency:rule.frequency,
      resolutionId:input.id,
      clock:state.clock,
      markers:artifact.metadata??{},
    });
    if(!frequency.eligible) throw new DomainEvaluationError(`Common Play actor turn candidate is no longer eligible: ${candidate.id}`);
    const entryPointId=`turn-rule-${rule.id}`;
    const resolutionId=`${input.id}:${artifact.id}:${rule.id}`;
    const definition=parseCommonPlayOperationDefinition({
      schemaVersion:"0.2-draft",
      id:binding.definitionId,
      entryPoints:[{id:entryPointId,invocation:"manual",operations:rule.operations}],
    },`Common Play actor turn rule ${binding.definitionId}:${rule.id}`);
    const rechargeDiceFaces=Object.fromEntries(rule.operations.flatMap((operation,index)=>{
      if(operation.kind!=="resource.recharge") return [];
      const die=operation.die as {sides?:unknown}|undefined;
      if(!die||!Number.isInteger(die.sides)||Number(die.sides)<2||Number(die.sides)>20) {
        throw new DomainEvaluationError(`Common Play actor turn rule ${rule.id} has an invalid recharge die`);
      }
      if(!input.rechargeDieFace) throw new DomainEvaluationError(`Common Play actor turn rule ${rule.id} requires authoritative recharge die input`);
      return [[index,[input.rechargeDieFace(rule.id,index,Number(die.sides))]]];
    }));
    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,definition,{
      resolutionId,actorId:input.actorId,entryPointId,
      ...(Object.keys(rechargeDiceFaces).length?{rechargeDiceFaces}:{}),
    });
    operations.push(...pending.operations);
    if(Object.keys(frequency.metadataPatch).length) operations.push({
      id:`${resolutionId}:frequency`,
      kind:"update-artifact",
      artifactId:artifact.id,
      metadataPatch:frequency.metadataPatch,
    });
  }
  return operations;
}
'''
composition.write_text(text[:start] + replacement)

lifecycle = Path("src/app/realTurnLifecycleService.ts")
text = lifecycle.read_text()
advance_anchor = "export function advanceTurnRuntimeLifecycle(session:TurnRuntimeSession,compileAdditional?:TurnRuntimeLifecycleOperationCompiler):TurnRuntimeLifecycleAdvanceResult {"
start = text.find(advance_anchor)
if start < 0:
    raise SystemExit("turn lifecycle advance anchor missing")
replacement = r'''export type TurnRuntimeLifecycleBoundaryPreview=Parameters<TurnRuntimeLifecycleOperationCompiler>[0];

export type TurnRuntimeLifecyclePreviewResult=
  | {
      status:"ready";
      currentActorId:string;
      nextActorId:string;
      nextIndex:number;
      nextRound:number;
      nextElapsedSeconds:number;
      roundWrap:boolean;
      expectedRevision:number;
      resolutionId:string;
      endBoundary:TurnRuntimeLifecycleBoundaryPreview;
      beginBoundary:TurnRuntimeLifecycleBoundaryPreview;
    }
  | {status:"rejected";error:string};

export function previewTurnRuntimeLifecycle(session:TurnRuntimeSession):TurnRuntimeLifecyclePreviewResult {
  if (!session.initiativeOrder.length) return { status:"rejected",error:"turn runtime has no initiative actors" };
  const currentActorId=session.state.clock.activeActorId ?? session.initiativeOrder[session.activeIndex];
  const currentIndex=session.initiativeOrder.indexOf(currentActorId);
  if (currentIndex<0) return { status:"rejected",error:`active actor is not in initiative order: ${currentActorId}` };
  const nextIndex=(currentIndex+1)%session.initiativeOrder.length;
  const nextActorId=session.initiativeOrder[nextIndex];
  const roundWrap=nextIndex===0;
  const nextRound=session.state.clock.round+(roundWrap ? 1 : 0);
  const nextElapsedSeconds=session.state.clock.elapsedSeconds+(roundWrap ? DND_ROUND_SECONDS : 0);
  const expectedRevision=session.state.revision;
  const resolutionId=`turn-runtime:${expectedRevision}:${currentActorId}->${nextActorId}`;
  const endState=structuredClone(session.state);
  endState.clock={...endState.clock,round:session.state.clock.round,activeActorId:currentActorId,phase:"end"};
  const beginState=structuredClone(session.state);
  beginState.clock={...beginState.clock,round:nextRound,elapsedSeconds:nextElapsedSeconds,activeActorId:nextActorId,phase:"start"};
  return {
    status:"ready",currentActorId,nextActorId,nextIndex,nextRound,nextElapsedSeconds,roundWrap,expectedRevision,resolutionId,
    endBoundary:{state:endState,resolutionId,kind:"turn-end",actorId:currentActorId,round:session.state.clock.round},
    beginBoundary:{state:beginState,resolutionId,kind:"turn-start",actorId:nextActorId,round:nextRound},
  };
}

export function advanceTurnRuntimeLifecycle(session:TurnRuntimeSession,compileAdditional?:TurnRuntimeLifecycleOperationCompiler):TurnRuntimeLifecycleAdvanceResult {
  const preview=previewTurnRuntimeLifecycle(session);
  if(preview.status==="rejected") return preview;
  const {
    currentActorId,nextActorId,nextIndex,nextRound,nextElapsedSeconds,roundWrap,expectedRevision,resolutionId,endBoundary,beginBoundary,
  }=preview;
  const afterEnd=compileAdditional?.(endBoundary)??[];
  const afterBegin=compileAdditional?.(beginBoundary)??[];
  const roundTimeOperations:ResolutionOperation[]=roundWrap ? [{
    id:`${resolutionId}:advance-time`,
    kind:"advance-time",
    elapsedSeconds:nextElapsedSeconds,
  }] : [];
  const resolved=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,session.state,{
    id:resolutionId,
    actorId:currentActorId,
    sourceId:"app:turn-runtime:lifecycle",
    expectedRevision,
    operations:[
      {
        id:`${resolutionId}:end`,
        kind:"end-turn",
        actorId:currentActorId,
        round:session.state.clock.round,
      },
      ...afterEnd,
      ...roundTimeOperations,
      {
        id:`${resolutionId}:begin`,
        kind:"begin-turn",
        actorId:nextActorId,
        round:nextRound,
      },
      ...afterBegin,
    ],
  });
  if (resolved.status==="rejected") return { status:"rejected",error:resolved.error };
  session.state=resolved.state;
  session.activeIndex=nextIndex;
  return {
    status:"committed",
    activeActorId:nextActorId,
    round:nextRound,
    resolutionId,
    additionalOperationCount:afterEnd.length+afterBegin.length,
    events:resolved.events.map((event)=>structuredClone(event)),
  };
}
'''
lifecycle.write_text(text[:start] + replacement)

adapter = Path("src/app/phase09EffectAwareTurnAdapter.ts")
text = adapter.read_text()
text = text.replace(
    'import { advanceTurnRuntimeLifecycle } from "./realTurnLifecycleService";',
    'import { advanceTurnRuntimeLifecycle, previewTurnRuntimeLifecycle, type TurnRuntimeLifecycleBoundaryPreview } from "./realTurnLifecycleService";',
    1,
)
old_actor_import = 'import { compileInstalledCommonPlayActorTurnRuleOperations, installedCommonPlayActorTurnRuleBindings } from "./commonPlayActorTurnRuleComposition";'
new_actor_import = 'import { collectInstalledCommonPlayActorTurnRuleCandidates, compileInstalledCommonPlayActorTurnRuleOperations, installedCommonPlayActorTurnRuleBindings, type InstalledCommonPlayActorTurnRuleBinding } from "./commonPlayActorTurnRuleComposition";'
if old_actor_import not in text:
    raise SystemExit("effect-aware actor turn import anchor missing")
text = text.replace(old_actor_import,new_actor_import,1)
resolution_import = 'import type { ResolutionEvent } from "../domain/resolutionTypes";'
if resolution_import not in text:
    raise SystemExit("effect-aware resolution import anchor missing")
text = text.replace(resolution_import,resolution_import + '\nimport { beginCommonPlaySimultaneousOrdering, respondToCommonPlaySimultaneousOrdering, type CommonPlaySimultaneousOrderingResponse, type CommonPlaySimultaneousOrderingState } from "../domain/commonPlaySimultaneousOrderingRuntime";',1)
map_anchor = 'const turnLifecycleUndo=new WeakMap<MockAdapter,AdapterTurnLifecycleUndo>();\n'
if map_anchor not in text:
    raise SystemExit("turn lifecycle undo map anchor missing")
text = text.replace(map_anchor,map_anchor + r'''
const turnSimultaneousOrdering=new WeakMap<MockAdapter,Map<string,CommonPlaySimultaneousOrderingState>>();

function simultaneousOrderingStates(adapter:MockAdapter) {
  let states=turnSimultaneousOrdering.get(adapter);
  if(!states) {
    states=new Map();
    turnSimultaneousOrdering.set(adapter,states);
  }
  return states;
}

export function peekAdapterTurnSimultaneousOrdering(adapter:MockAdapter) {
  const pending=[...(turnSimultaneousOrdering.get(adapter)?.values()??[])].find((state)=>state.status==="pending");
  return pending?structuredClone(pending):undefined;
}

export function respondToAdapterTurnSimultaneousOrdering(adapter:MockAdapter,response:CommonPlaySimultaneousOrderingResponse) {
  const states=turnSimultaneousOrdering.get(adapter);
  const current=states?.get(response.decisionId);
  if(!current) return undefined;
  const result=respondToCommonPlaySimultaneousOrdering(current,response);
  if(result.status==="resolved") states!.set(response.decisionId,result.state);
  return structuredClone(result);
}

function simultaneousOrderingAuthority(internal:EffectAwareTurnAdapterState,actorId:string) {
  const entity=internal.scene.entities.find((candidate)=>candidate.id===actorId);
  if(entity?.controllerId) return {kind:"actor-controller" as const,responderId:entity.controllerId};
  if(entity?.kind==="character") return {kind:"actor-controller" as const,responderId:entity.id};
  return {kind:"dm" as const,responderId:"dm"};
}

function ensureBoundaryOrdering(
  adapter:MockAdapter,
  internal:EffectAwareTurnAdapterState,
  boundary:TurnRuntimeLifecycleBoundaryPreview,
  bindings:InstalledCommonPlayActorTurnRuleBinding[],
) {
  const candidates=collectInstalledCommonPlayActorTurnRuleCandidates(boundary.state,bindings,boundary);
  if(candidates.length<=1) return true;
  const request={
    id:`${boundary.resolutionId}:simultaneous:${boundary.kind}:${boundary.actorId}`,
    revision:boundary.state.revision,
    timing:boundary.kind,
    authority:simultaneousOrderingAuthority(internal,boundary.actorId),
    candidates:candidates.map((candidate)=>({id:candidate.id})),
  };
  const states=simultaneousOrderingStates(adapter);
  let ordering=states.get(request.id);
  if(!ordering||ordering.request.revision!==request.revision) {
    ordering=beginCommonPlaySimultaneousOrdering(request);
    states.set(request.id,ordering);
  }
  return ordering.status==="resolved";
}

function orderedBoundaryCandidateIds(adapter:MockAdapter,boundary:TurnRuntimeLifecycleBoundaryPreview) {
  const id=`${boundary.resolutionId}:simultaneous:${boundary.kind}:${boundary.actorId}`;
  const ordering=turnSimultaneousOrdering.get(adapter)?.get(id);
  return ordering?.status==="resolved"?[...ordering.orderedCandidateIds]:undefined;
}
''',1)
preflight_anchor = '  const actorTurnRules=await installedCommonPlayActorTurnRuleBindings(this,session.state);\n  const rechargeDrawIndex={value:0};\n  const advanced=advanceTurnRuntimeLifecycle(session,(boundary)=>[\n'
if preflight_anchor not in text:
    raise SystemExit("effect-aware turn preflight anchor missing")
replacement = r'''  const actorTurnRules=await installedCommonPlayActorTurnRuleBindings(this,session.state);
  const preview=previewTurnRuntimeLifecycle(session);
  if(preview.status==="ready") {
    const endReady=ensureBoundaryOrdering(this,internal,preview.endBoundary,actorTurnRules);
    const beginReady=ensureBoundaryOrdering(this,internal,preview.beginBoundary,actorTurnRules);
    if(!endReady||!beginReady) return internal.getSnapshot();
  }
  const rechargeDrawIndex={value:0};
  const advanced=advanceTurnRuntimeLifecycle(session,(boundary)=>[
'''
text = text.replace(preflight_anchor,replacement,1)
old_compile = r'''    ...compileInstalledCommonPlayActorTurnRuleOperations(boundary.state,actorTurnRules,{
      id:boundary.resolutionId,kind:boundary.kind,actorId:boundary.actorId,
      rechargeDieFace:(_ruleId,_operationIndex,sides)=>authoritativeRechargeFace(this,`${boundary.resolutionId}:recharge`,sides,rechargeDrawIndex),
    }),
'''
new_compile = r'''    ...compileInstalledCommonPlayActorTurnRuleOperations(boundary.state,actorTurnRules,{
      id:boundary.resolutionId,kind:boundary.kind,actorId:boundary.actorId,
      rechargeDieFace:(_ruleId,_operationIndex,sides)=>authoritativeRechargeFace(this,`${boundary.resolutionId}:recharge`,sides,rechargeDrawIndex),
      orderedCandidateIds:orderedBoundaryCandidateIds(this,boundary),
    }),
'''
if old_compile not in text:
    raise SystemExit("effect-aware actor compiler call anchor missing")
text = text.replace(old_compile,new_compile,1)
success_anchor = '  turnLifecycleEvents.set(this,advanced.events.map((event)=>structuredClone(event)));\n'
if success_anchor not in text:
    raise SystemExit("effect-aware success anchor missing")
text = text.replace(success_anchor,'  turnSimultaneousOrdering.delete(this);\n' + success_anchor,1)
end_init_anchor = '  turnLifecycleUndo.delete(this);\n  const hadReady=readyActionConfigurationsFor(this).length>0;\n'
if end_init_anchor not in text:
    raise SystemExit("effect-aware end initiative anchor missing")
text = text.replace(end_init_anchor,'  turnLifecycleUndo.delete(this);\n  turnSimultaneousOrdering.delete(this);\n  const hadReady=readyActionConfigurationsFor(this).length>0;\n',1)
adapter.write_text(text)

test_file = Path("tests/ui/connectedActorTurnRuleProduction.test.ts")
text = test_file.read_text()
mock_import = 'import { MockAdapter } from "../../src/app/mockAdapter";\n'
if mock_import not in text:
    raise SystemExit("actor turn production test import anchor missing")
text = text.replace(mock_import,mock_import + 'import { peekAdapterTurnSimultaneousOrdering, respondToAdapterTurnSimultaneousOrdering } from "../../src/app/phase09EffectAwareTurnAdapter";\n',1)
install_anchor = 'async function install(adapter:MockAdapter,prefix:string) {\n  const pack=packageJson(prefix);\n'
if install_anchor not in text:
    raise SystemExit("actor turn install helper anchor missing")
text = text.replace(install_anchor,'async function install(adapter:MockAdapter,prefix:string,pack=packageJson(prefix)) {\n',1)
marker = 'production simultaneous turn rules pause before mutation and execute in the authorized external order'
if marker not in text:
    text += r'''

function simultaneousPackageJson(prefix:string) {
  const pack=packageJson(prefix);
  const payload=JSON.parse(pack.json) as {
    content:Array<{mechanics:Array<{config:{rules?:unknown[]}}>}>;
  };
  payload.content[0].mechanics[0].config.rules=[
    {id:"turn-gain",event:"turn-start",frequency:"once-per-turn",operations:[
      {kind:"resource.change",resource:pack.resourceId,amount:{value:1},target:"actor"},
    ]},
    {id:"turn-spend",event:"turn-start",frequency:"once-per-turn",operations:[
      {kind:"resource.change",resource:pack.resourceId,amount:{value:-1},target:"actor"},
    ]},
  ];
  return {...pack,json:JSON.stringify(payload)};
}

async function runSimultaneousOrdering(prefix:string) {
  const adapter=new MockAdapter();
  const source=simultaneousPackageJson(prefix);
  const pack=await install(adapter,prefix,source);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  let pending=peekAdapterTurnSimultaneousOrdering(adapter);
  for(let guard=0;guard<20&&!pending;guard++) {
    await adapter.endTurn();
    pending=peekAdapterTurnSimultaneousOrdering(adapter);
  }
  assert.ok(pending,"turn-start with two eligible external rules must pause for simultaneous ordering");
  if(!pending||pending.status!=="pending") throw new Error("simultaneous ordering did not remain pending");
  assert.equal(pending.request.timing,"turn-start");
  assert.equal(pending.request.authority.kind,"actor-controller");
  assert.equal(pending.request.authority.responderId,"char.aelar");
  assert.equal(pending.request.candidates.length,2);
  const spend=pending.request.candidates.find((candidate)=>candidate.id.endsWith(":turn-spend"))?.id;
  const gain=pending.request.candidates.find((candidate)=>candidate.id.endsWith(":turn-gain"))?.id;
  assert.ok(spend&&gain,JSON.stringify(pending.request.candidates));
  const response=respondToAdapterTurnSimultaneousOrdering(adapter,{
    decisionId:pending.request.id,
    revision:pending.request.revision,
    responderId:pending.request.authority.responderId,
    orderedCandidateIds:[spend!,gain!],
  });
  assert.equal(response?.status,"resolved");
  const snapshot=await adapter.endTurn();
  const state=actorState(adapter,snapshot,pack.summonId,pack.resourceId);
  assert.equal(state.clock.activeActorId,pack.summonId);
  return {
    resource:state.resource,
    markers:state.markers.length,
    timing:pending.request.timing,
    authority:pending.request.authority.kind,
    candidateCount:pending.request.candidates.length,
  };
}

test("production simultaneous turn rules pause before mutation and execute in the authorized external order",async()=>{
  const original=await runSimultaneousOrdering("unknown-simultaneous-a");
  const renamed=await runSimultaneousOrdering("fully-renamed-simultaneous-b");
  assert.deepEqual(renamed,original);
  assert.equal(original.resource,1,"spend-at-zero then gain must end at one; natural gain-then-spend would end at zero");
  assert.equal(original.markers,2);
});
'''
test_file.write_text(text)

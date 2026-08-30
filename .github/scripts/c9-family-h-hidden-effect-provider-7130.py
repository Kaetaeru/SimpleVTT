from pathlib import Path
import json


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


source = "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts"
replace_once(
    source,
    "function interceptorFactProvider(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution):CommonPlayFactProvider {",
    "function interceptorFactProvider(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution,runtime:RulesRuntimeState):CommonPlayFactProvider {",
)
replace_once(
    source,
    '      if(query.fact==="identity.same-entity")return {status:"answered",value:subjectId===candidate.sourceActorId};\n      const relation=authoritativeCommonPlaySpatialRelation(internal.scene,candidate.sourceActorId,subjectId);',
    '      if(query.fact==="identity.same-entity")return {status:"answered",value:subjectId===candidate.sourceActorId};\n      if(query.fact==="sense.hidden")return {status:"answered",value:runtime.effects.some((effect)=>effect.targetId===subjectId&&effect.tags.includes("hidden"))};\n      const relation=authoritativeCommonPlaySpatialRelation(internal.scene,candidate.sourceActorId,subjectId);',
)
replace_once(
    source,
    "async function interceptorEligible(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution) {",
    "async function interceptorEligible(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution,runtime:RulesRuntimeState) {",
)
replace_once(
    source,
    "    provider:interceptorFactProvider(internal,candidate,pending),",
    "    provider:interceptorFactProvider(internal,candidate,pending,runtime),",
)
replace_once(
    source,
    "      if(!await interceptorEligible(internal,candidate,projected.pending))continue;",
    "      if(!await interceptorEligible(internal,candidate,projected.pending,runtime))continue;",
)

test = "tests/ui/installedCommonPlayInterceptorProductionRuntime.test.ts"
replace_once(
    test,
    'import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";\n',
    'import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";\nimport { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";\nimport { SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/realResolutionService";\nimport { resolvePendingResolution } from "../../src/domain/resolution";\n',
)
replace_once(
    test,
    '                {id:"source-sees-trigger",fact:"sense.can-see",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"treat-false"},\n',
    '                {id:"source-sees-trigger",fact:"sense.can-see",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"treat-false"},\n                {id:"trigger-hidden",fact:"sense.hidden",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"block"},\n',
)
replace_once(
    test,
    '                {op:"eq",left:{ref:"source-sees-trigger"},right:{value:true}},\n',
    '                {op:"eq",left:{ref:"source-sees-trigger"},right:{value:true}},\n                {op:"eq",left:{ref:"trigger-hidden"},right:{value:true}},\n',
)
marker = '''function secondWind(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){
  return snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current;
}
'''
helper = '''
function seedHiddenRuntimeEffect(adapter:MockAdapter,targetId:string){
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state,"TurnRuntime state must exist before Hidden fact seeding");
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state!,{
    id:`resolution.hidden-fact.${targetId}`,
    actorId:internal.activeCharacter.id,
    sourceId:"external.hidden-fact-probe",
    expectedRevision:state!.revision,
    operations:[{
      id:"op.hidden-fact",
      kind:"apply-effect",
      effect:{
        id:`effect.hidden-fact.${targetId}`,
        sourceId:"external.hidden-fact-probe",
        sourceActorId:internal.activeCharacter.id,
        targetId,
        kind:"marker",
        tags:["hidden"],
        duration:{kind:"special",key:"test.hidden-fact"},
      },
    }],
  });
  assert.notEqual(committed.status,"rejected");
  if(committed.status==="rejected")return;
  assert.equal(commitAdapterTurnRuntimeState(adapter,internal.scene,state!.revision,committed.state),true);
}
'''
replace_once(test, marker, marker + helper)

old = '''test("portable production interceptor uses only authoritative spatial and visibility facts",async()=>{
  const renamed:Identity={...ORIGINAL,moduleId:"external.renamed-facts",contentId:"item.renamed-facts",mechanicId:"mechanic.renamed-facts",interceptorId:"interceptor.renamed-facts",interactionId:"interaction.renamed-facts",displayName:"Renamed Fact Reaction"};
  for(const [index,identity] of [ORIGINAL,renamed].entries()){
    const adapter=await prepare(identity,true);
    const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
    const relation={sourceId:internal.activeCharacter.id,targetId:OTHER_CHARACTER_ID,distanceFeet:30,visible:true,cover:"none" as const,targetCanSeeAttacker:true};
    if(index===0)setSpatialRelation(internal.scene,{...relation,provenance:"module:test-map:spatial"});
    else await adapter.setTheaterOfMindSpatialRelation(relation);
    const snapshot=await openAbilityCheckInterrupt(adapter);
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    await adapter.respondToInterrupt(false);
  }

  const unavailable=await prepare(ORIGINAL,true);
  const snapshot=await openAbilityCheckInterrupt(unavailable);
  assert.notEqual(snapshot.resolution?.stage,"interrupt","missing authority must not fabricate distance or visibility");
});
'''
new = '''test("portable production interceptor uses authoritative spatial, visibility, and Hidden facts",async()=>{
  const renamed:Identity={...ORIGINAL,moduleId:"external.renamed-facts",contentId:"item.renamed-facts",mechanicId:"mechanic.renamed-facts",interceptorId:"interceptor.renamed-facts",interactionId:"interaction.renamed-facts",displayName:"Renamed Fact Reaction"};
  for(const [index,identity] of [ORIGINAL,renamed].entries()){
    const adapter=await prepare(identity,true);
    const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
    const relation={sourceId:internal.activeCharacter.id,targetId:OTHER_CHARACTER_ID,distanceFeet:30,visible:true,cover:"none" as const,targetCanSeeAttacker:true};
    if(index===0)setSpatialRelation(internal.scene,{...relation,provenance:"module:test-map:spatial"});
    else await adapter.setTheaterOfMindSpatialRelation(relation);
    seedHiddenRuntimeEffect(adapter,OTHER_CHARACTER_ID);
    const snapshot=await openAbilityCheckInterrupt(adapter);
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
    await adapter.respondToInterrupt(false);
  }

  const visibleButNotHidden=await prepare(ORIGINAL,true);
  const visibleInternal=visibleButNotHidden as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  setSpatialRelation(visibleInternal.scene,{
    sourceId:visibleInternal.activeCharacter.id,targetId:OTHER_CHARACTER_ID,distanceFeet:30,visible:true,cover:"none",targetCanSeeAttacker:true,provenance:"module:test-map:spatial",
  });
  let snapshot=await openAbilityCheckInterrupt(visibleButNotHidden);
  assert.notEqual(snapshot.resolution?.stage,"interrupt","authoritative visible target must still fail a required Hidden fact when no Hidden effect exists");

  const unavailable=await prepare(ORIGINAL,true);
  seedHiddenRuntimeEffect(unavailable,OTHER_CHARACTER_ID);
  snapshot=await openAbilityCheckInterrupt(unavailable);
  assert.notEqual(snapshot.resolution?.stage,"interrupt","Hidden must not fabricate missing spatial or visibility authority");
});
'''
replace_once(test, old, new)

ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next((r for r in ledger["rows"] if r.get("family") == "H" and r.get("id") == "senses-visibility-hiding"), None)
if not row or row.get("disposition") != "INCOMPLETE":
    raise SystemExit("Family H row missing or no longer INCOMPLETE; refuse to overwrite concurrent authority")
implementation = "commonPlayInterceptorProductionRuntimeAdapter.ts answers standard sense.hidden from authoritative Resolver EffectState hidden tags before spatial fallback"
production = "installedCommonPlayInterceptorProductionRuntime.test.ts gates an unknown installed interceptor on authoritative spatial visibility plus Resolver-owned Hidden state, with external identity rename invariance and fail-closed missing facts"
if implementation not in row["implementationEvidence"]:
    row["implementationEvidence"].append(implementation)
if production not in row["productionEvidence"]:
    row["productionEvidence"].append(production)
ledger_path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

from pathlib import Path

runtime=Path('src/domain/commonPlayOperationRuntime.ts')
text=runtime.read_text(encoding='utf-8')
if 'type CommonPlayEffectRemove=' not in text:
    anchor='''type CommonPlayConditionChange={
  kind:"condition.apply"|"condition.remove";
  condition:ConditionId;
  target?:CommonPlayConditionTarget;
  when?:CommonPlayTestOutcomePredicate;
};
'''
    if anchor not in text: raise SystemExit('condition type anchor missing')
    text=text.replace(anchor,anchor+'''type CommonPlayEffectRemove={
  kind:"effect.remove";
  selector:CommonPlaySelector&{from:"effects"};
  when?:CommonPlayTestOutcomePredicate;
};
''',1)
    union='''  |CommonPlayMovementStand
  |CommonPlayConditionChange
  |CommonPlayRollModify;'''
    if union not in text: raise SystemExit('operation union anchor missing')
    text=text.replace(union,'''  |CommonPlayMovementStand
  |CommonPlayConditionChange
  |CommonPlayEffectRemove
  |CommonPlayRollModify;''',1)
    key_anchor='const CONDITION_CHANGE_KEYS=new Set(["kind","condition","target","when"]);'
    if key_anchor not in text: raise SystemExit('condition keys anchor missing')
    text=text.replace(key_anchor,key_anchor+'\nconst EFFECT_REMOVE_KEYS=new Set(["kind","selector","when"]);',1)
    parse_anchor='''  if(operation.kind==="condition.apply"||operation.kind==="condition.remove") {
    supportedKeys(operation,CONDITION_CHANGE_KEYS,label);
'''
    if parse_anchor not in text: raise SystemExit('condition parser anchor missing')
    text=text.replace(parse_anchor,'''  if(operation.kind==="effect.remove") {
    supportedKeys(operation,EFFECT_REMOVE_KEYS,label);
    const selector=parseCommonPlaySelector(operation.selector,`${label}.selector`);
    if(selector.from!=="effects") throw new DomainEvaluationError(`${label}.selector.from must be effects for portable Common Play effect.remove`);
    if(selector.selection==="manual") throw new DomainEvaluationError(`${label}.selector.selection must be automatic when removing effects`);
    const when=testOutcomePredicate(operation.when,`${label}.when`);
    return {kind:"effect.remove",selector:{...selector,from:"effects"},...(when?{when}:{})};
  }
'''+parse_anchor,1)
    validation='''  if(entryPoint.operations.some((operation)=>(operation.kind==="condition.apply"||operation.kind==="condition.remove")&&operation.when)&&!entryPoint.test) throw new DomainEvaluationError(`${label}.entryPoints[${index}] test.outcome condition requires a d20 test`);'''
    if validation not in text: raise SystemExit('conditional validation anchor missing')
    text=text.replace(validation,'''  if(entryPoint.operations.some((operation)=>(operation.kind==="condition.apply"||operation.kind==="condition.remove"||operation.kind==="effect.remove")&&operation.when)&&!entryPoint.test) throw new DomainEvaluationError(`${label}.entryPoints[${index}] test.outcome conditional operation requires a d20 test`);''',1)
    compile_anchor='''    if(operation.kind==="condition.apply"||operation.kind==="condition.remove") {
      const targetId=conditionOperationTarget(operation.target,input);
'''
    if compile_anchor not in text: raise SystemExit('condition compiler anchor missing')
    text=text.replace(compile_anchor,'''    if(operation.kind==="effect.remove") {
      const when=operation.when?{operationId:`${input.resolutionId}:test`,field:"outcome" as const,equals:operation.when.right.value}:undefined;
      const candidates=state.effects.filter(effectIsActive).map((effect)=>({
        id:effect.id,
        properties:{
          tags:[...effect.tags],
          targetId:effect.targetId,
          sourceId:effect.sourceId,
          kind:effect.kind,
          "target.selected":input.targetId!==undefined&&effect.targetId===input.targetId,
          "target.actor":effect.targetId===input.actorId,
          ...(effect.sourceActorId?{sourceActorId:effect.sourceActorId}:{}),
          ...(effect.conditionId?{conditionId:effect.conditionId}:{}),
        },
      }));
      const selected=resolveCommonPlaySelector({sourceId:input.actorId,selector:operation.selector,candidates,selection:"automatic",authority:"host"});
      if(selected.status!=="resolved") throw new DomainEvaluationError(`Common Play effect.remove selector rejected: ${selected.reason}`);
      selected.targetIds.forEach((effectId,removeIndex)=>operations.push({id:`${operationId}:remove:${removeIndex}`,kind:"remove-effect",effectId,...(when?{when}:{})}));
      continue;
    }

'''+compile_anchor,1)
    runtime.write_text(text,encoding='utf-8')

adapter=Path('src/app/sessionStatusEffectEventRuntimeAdapter.ts')
text=adapter.read_text(encoding='utf-8')
text=text.replace('import { authoritativeCommonPlaySpatialRelation } from "./realSpatialRuntimeService";\n','')
start=text.find('function detectedHiddenEffects(')
end=text.find('function removeAttackEndingEffects(',start)
if start!=-1 and end!=-1:
    text=text[:start]+text[end:]
named='''  if(snapshot.resolution?.id===resolution.id&&snapshot.resolution.stage==="complete") {
    const discovered=detectedHiddenEffects(this,internal,resolution);
    const events=removeDiscoveredHiddenEffects(this,internal,resolution,discovered);
    if(events?.length) {
      combineEvents(this,resolution.id,events);
      return internal.getSnapshot();
    }
  }
'''
text=text.replace(named,'')
if 'action.standard.search.' in text: raise SystemExit('named Search dispatch remains')
adapter.write_text(text,encoding='utf-8')

test=Path('tests/ui/c9FamilyHSearchDiscovery.test.ts')
test.write_text(r'''import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/realResolutionService";
import { resolvePendingResolution } from "../../src/domain/resolution";

const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.search`,mechanicId=`${prefix}.mechanic`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],entryPoints:[{id:"discover-hidden",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"ability-check",roller:"actor",dc:{value:10},perTarget:false},operations:[{kind:"effect.remove",selector:{from:"effects",where:{op:"all",args:[{op:"has-tag",ref:"tags",value:"hidden"},{op:"eq",left:{ref:"target.selected"},right:{value:true}}]},min:1,max:1,selection:"automatic"},when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]}]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family H portable discovery probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Discovery",locales:{en:{name:"Portable Discovery"}}},mechanics:[{kind:"common-play",config}]}]})};
}

function scene(adapter:MockAdapter){return (adapter as unknown as {scene:SceneVm}).scene;}
function hidden(adapter:MockAdapter,targetId=TARGET_ID){return snapshotAdapterTurnRuntimeState(adapter,scene(adapter))?.effects.some((effect)=>effect.targetId===targetId&&effect.tags.includes("hidden"))??false;}
function seedHidden(adapter:MockAdapter,actorId:string,targetId=TARGET_ID){
  const state=snapshotAdapterTurnRuntimeState(adapter,scene(adapter)); assert.ok(state);
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state!,{id:`resolution.portable-hidden.${targetId}`,actorId,sourceId:"external.portable-hidden",expectedRevision:state!.revision,operations:[{id:`op.portable-hidden.${targetId}`,kind:"apply-effect",effect:{id:`effect.portable-hidden.${targetId}`,sourceId:"external.portable-hidden",sourceActorId:targetId,targetId,kind:"marker",tags:["hidden"],duration:{kind:"special",key:"hidden-until-discovered"}}}]});
  assert.notEqual(committed.status,"rejected"); if(committed.status!=="rejected") assert.equal(commitAdapterTurnRuntimeState(adapter,scene(adapter),state!.revision,committed.state),true);
}

async function exercise(prefix:string){
  const adapter=new MockAdapter(); const pack=packagePayload(prefix); setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  let snapshot=await adapter.previewContentImport(pack.json); assert.ok(!snapshot.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(snapshot.contentImport?.validation));
  await adapter.activateContentImport(); await adapter.startInitiative(); const actorId=(await adapter.getSnapshot()).activeCharacter.id; await adapter.setCurrentActor(actorId); seedHidden(adapter,actorId);
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"discover-hidden"});
  await adapter.setQueuedD20(20); snapshot=await adapter.resolveAction(actionId,[TARGET_ID]); assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution)); assert.equal(hidden(adapter),false); assert.equal(snapshot.scene.economyByActor[actorId]?.action,false);
  snapshot=await adapter.undoLastResolution(); assert.equal(hidden(adapter),true); assert.equal(snapshot.scene.economyByActor[actorId]?.action,true);
  await adapter.setQueuedD20(1); snapshot=await adapter.resolveAction(actionId,[TARGET_ID]); assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution)); assert.equal(hidden(adapter),true);
  return {failurePreserved:hidden(adapter),actionSpent:snapshot.scene.economyByActor[actorId]?.action===false};
}

test("unknown installed Common Play discovers Hidden through generic effect.remove and is identity invariant",async()=>{assert.deepEqual(await exercise("external.unknown-family-h-discovery"),await exercise("external.fully-renamed-family-h-discovery"));});
''',encoding='utf-8')

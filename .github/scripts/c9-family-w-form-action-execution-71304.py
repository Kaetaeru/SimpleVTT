from pathlib import Path

runtime = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
text = runtime.read_text(encoding="utf-8")

prepared_anchor = "interface PreparedCommonPlayAction {\n"
authorization_helper = '''function authorizedUnprojectedFormAction(
  state:RulesRuntimeState|undefined,
  reference:{actorId:string;definitionActionId:string},
  snapshot:AppSnapshot,
) {
  if(!state) return false;
  return (state.artifacts??[]).some((artifact)=>{
    const form=artifact.artifactKind==="form"?artifact.form:undefined;
    if(!form||form.targetActorId!==reference.actorId||form.actionPolicy==="retain"||!form.actionDefinitionIds.includes(reference.definitionActionId)) return false;
    const controllerId=form.controllerId??form.targetActorId;
    return snapshot.role==="dm"||controllerId===snapshot.activeCharacter.id;
  });
}

'''
if authorization_helper not in text:
    if text.count(prepared_anchor) != 1:
        raise SystemExit(f"prepared action anchor count: {text.count(prepared_anchor)}")
    text = text.replace(prepared_anchor, authorization_helper + prepared_anchor, 1)

old_signature = '''  actorIdOverride?:string,
  allowOffTurn=false,
):PreparedCommonPlayAction|undefined {
'''
new_signature = '''  actorIdOverride?:string,
  allowOffTurn=false,
  allowUnprojectedRuntimeArtifact=false,
):PreparedCommonPlayAction|undefined {
'''
if old_signature in text:
    text = text.replace(old_signature, new_signature, 1)
elif new_signature not in text:
    raise SystemExit("prepareCommonPlayAction signature not found")

old_guard = '  if(actorIdOverride&&projectedAction?.actorId!==actorIdOverride) return undefined;\n'
new_guard = '  if(actorIdOverride&&projectedAction?.actorId!==actorIdOverride&&!allowUnprojectedRuntimeArtifact) return undefined;\n'
if old_guard in text:
    text = text.replace(old_guard, new_guard, 1)
elif new_guard not in text:
    raise SystemExit("runtime artifact projected-action guard not found")

old_resolve = '''  const runtimeArtifactReference=parseRuntimeArtifactCommonPlayActionId(actionId);
  const definitionActionId=runtimeArtifactReference?.definitionActionId??actionId;
  const action=await commonPlayAction(this,definitionActionId);
  if (!action) return previousResolveAction.call(this,actionId,targetIds);
  const prepared=prepareCommonPlayAction(this,actionId,targetIds,action,runtimeArtifactReference?.actorId);
'''
new_resolve = '''  const runtimeArtifactReference=parseRuntimeArtifactCommonPlayActionId(actionId);
  const definitionActionId=runtimeArtifactReference?.definitionActionId??actionId;
  const action=await commonPlayAction(this,definitionActionId);
  if (!action) return previousResolveAction.call(this,actionId,targetIds);
  const runtimeArtifactSnapshot=runtimeArtifactReference?await previousGetSnapshot.call(this):undefined;
  const runtimeArtifactState=runtimeArtifactReference?snapshotAdapterTurnRuntimeState(this,(this as unknown as AdapterState).scene):undefined;
  const allowUnprojectedRuntimeArtifact=Boolean(runtimeArtifactReference&&runtimeArtifactSnapshot&&authorizedUnprojectedFormAction(runtimeArtifactState,runtimeArtifactReference,runtimeArtifactSnapshot));
  const prepared=prepareCommonPlayAction(this,actionId,targetIds,action,runtimeArtifactReference?.actorId,false,allowUnprojectedRuntimeArtifact);
'''
if old_resolve in text:
    text = text.replace(old_resolve, new_resolve, 1)
elif new_resolve not in text:
    raise SystemExit("resolveAction runtime artifact block not found")

old_response = '''  const projected=Object.values(internal.scene.actionsByActor).flat().find((candidate)=>candidate.id===resolution.actionId&&candidate.actorId===resolution.actorId);
  if(resolution.actorId!==internal.activeCharacter.id&&!projected) {
    return finishInteraction(internal,resolution,"Common Play 상호작용 재검증 실패");
  }
  if(!accept) return finishInteraction(internal,resolution,"Common Play 상호작용 거절");

  const prepared=prepareCommonPlayAction(this,resolution.actionId,resolution.targetIds,action,runtimeArtifactReference?.actorId);
'''
new_response = '''  const projected=Object.values(internal.scene.actionsByActor).flat().find((candidate)=>candidate.id===resolution.actionId&&candidate.actorId===resolution.actorId);
  const runtimeArtifactSnapshot=runtimeArtifactReference?await previousGetSnapshot.call(this):undefined;
  const runtimeArtifactState=runtimeArtifactReference?snapshotAdapterTurnRuntimeState(this,internal.scene):undefined;
  const allowUnprojectedRuntimeArtifact=Boolean(runtimeArtifactReference&&runtimeArtifactSnapshot&&authorizedUnprojectedFormAction(runtimeArtifactState,runtimeArtifactReference,runtimeArtifactSnapshot));
  if(runtimeArtifactReference&&!projected&&!allowUnprojectedRuntimeArtifact) {
    return finishInteraction(internal,resolution,"Common Play 상호작용 재검증 실패");
  }
  if(!runtimeArtifactReference&&resolution.actorId!==internal.activeCharacter.id&&!projected) {
    return finishInteraction(internal,resolution,"Common Play 상호작용 재검증 실패");
  }
  if(!accept) return finishInteraction(internal,resolution,"Common Play 상호작용 거절");

  const prepared=prepareCommonPlayAction(this,resolution.actionId,resolution.targetIds,action,runtimeArtifactReference?.actorId,false,allowUnprojectedRuntimeArtifact);
'''
if old_response in text:
    text = text.replace(old_response, new_response, 1)
elif new_response not in text:
    raise SystemExit("respondToInterrupt runtime artifact block not found")

runtime.write_text(text, encoding="utf-8")

test_file = Path("tests/ui/commonPlayFormActionProjectionProduction.test.ts")
test_text = test_file.read_text(encoding="utf-8")
forged_test = r'''

test("runtime artifact action ids cannot bypass authoritative form state",async()=>{
  const {adapter,pack}=await prepare("unknown-form-actions-forged","grant");
  const before=await adapter.getSnapshot();
  const effectiveHpBefore=before.activeCharacter.hp+before.activeCharacter.tempHp;
  await adapter.resolveAction(pack.projectedActionId,[ACTOR_ID]);
  const after=await adapter.getSnapshot();
  assert.equal(after.activeCharacter.hp+after.activeCharacter.tempHp,effectiveHpBefore);
  assert.notEqual(after.resolution?.actionId,pack.projectedActionId);
});
'''
if "runtime artifact action ids cannot bypass authoritative form state" not in test_text:
    test_text += forged_test
test_file.write_text(test_text, encoding="utf-8")

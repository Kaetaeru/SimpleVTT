from pathlib import Path

runtime = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
text = runtime.read_text(encoding="utf-8")
old = '''  const actorId=actorIdOverride??projectedAction?.actorId??internal.activeCharacter.id;
  if(actorIdOverride&&projectedAction?.actorId!==actorIdOverride) return undefined;
  const actorEntity=internal.scene.entities.find((candidate)=>candidate.id===actorId);
'''
new = '''  const actorId=actorIdOverride??projectedAction?.actorId??internal.activeCharacter.id;
  if(actorIdOverride&&projectedAction?.actorId!==actorIdOverride) {
    const runtimeArtifactReference=parseRuntimeArtifactCommonPlayActionId(actionId);
    const runtimeState=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
    const formAuthorized=Boolean(runtimeArtifactReference&&runtimeState?.artifacts?.some((artifact)=>
      artifact.artifactKind==="form"&&
      artifact.form?.targetActorId===actorIdOverride&&
      artifact.form.actionPolicy!=="retain"&&
      artifact.form.actionDefinitionIds.includes(runtimeArtifactReference.definitionActionId)
    ));
    if(!formAuthorized) return undefined;
  }
  const actorEntity=internal.scene.entities.find((candidate)=>candidate.id===actorId);
'''
if new not in text:
    if text.count(old) != 1:
        raise SystemExit(f"form action authorization anchor count: {text.count(old)}")
    text = text.replace(old, new, 1)
runtime.write_text(text, encoding="utf-8")

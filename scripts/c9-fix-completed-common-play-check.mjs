import fs from 'node:fs';

function replaceOnce(path,needle,replacement){
  const text=fs.readFileSync(path,'utf8');
  if(!text.includes(needle)) throw new Error(`${path}: expected patch anchor missing`);
  fs.writeFileSync(path,text.replace(needle,replacement));
}

const path='src/app/commonPlayInterceptorProductionRuntimeAdapter.ts';

replaceOnce(path,
`import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";`,
`import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";`);

replaceOnce(path,
`function updateD20Presentation(resolution:ResolutionView,pending:PendingPassiveReaction,result:D20TestResult,authority?:CommonPlayInteractionAuthority) {`,
`function updateD20Presentation(resolution:ResolutionView,pending:PendingPassiveReaction,result:D20TestResult,authority:CommonPlayInteractionAuthority|undefined,scene:SceneVm) {`);

replaceOnce(path,
`  if(result.family==="ability-check"){
    resolution.checkTarget=result.target;`,
`  if(result.family==="ability-check"){
    const origin=Object.values(scene.actionsByActor).flat().find((entry)=>entry.id===resolution.actionId);
    resolution.checkTarget=result.target;`);

replaceOnce(path,
`    resolution.finalOutcome=resolution.checkOutcome;
  }else{`,
`    resolution.finalOutcome=origin?.checkOutcomeLabels?.[result.outcome]??resolution.checkOutcome;
  }else{`);

replaceOnce(path,
`async function commitAcceptedReaction(adapter:MockAdapter,pending:PendingPassiveReaction,result:Extract<ReturnType<typeof resumeCommonPlayInteraction>,{status:"committed"}>) {
  const internal=adapter as unknown as AdapterState;
  const current=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!current)return {status:"rejected" as const,error:"Common Play reaction lost TurnRuntime authority"};
  const durableEvents=paymentEvents(result.events);
  const writeBack=await persistCharacterResolutionEvents(adapter,durableEvents,"forward");
  if(writeBack.status==="rejected")return writeBack;
  if(!commitAdapterTurnRuntimeState(adapter,internal.scene,current.revision,result.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(adapter,durableEvents,"inverse");
    return {status:"rejected" as const,error:"Common Play reaction TurnRuntime revision changed before commit"};
  }
  if(durableEvents.length)appendAdapterInterruptEvents(adapter,pending.resolutionId,durableEvents);
  projectAdapterTurnRuntime(adapter);
  synchronizeProjectedCharacterResources(adapter,result.state);
  internal.syncChar();
  return {status:"committed" as const};
}`,
`async function commitAcceptedReaction(adapter:MockAdapter,pending:PendingPassiveReaction,result:Extract<ReturnType<typeof resumeCommonPlayInteraction>,{status:"committed"}>) {
  const internal=adapter as unknown as AdapterState;
  const current=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!current)return {status:"rejected" as const,error:"Common Play reaction lost TurnRuntime authority"};
  const durableEvents=paymentEvents(result.events);
  const resolution=internal.resolution;
  const completedCheck=resolution?.rollKind==="check"&&!pending.resumeCheckAfterResponse;
  const projected=completedCheck
    ? applyResolutionEvents(internal.scene,durableEvents,internal.activeCharacter.resources,internal.activeCharacter.items,current)
    : undefined;
  if(projected?.status==="rejected")return projected;
  const writeBack=await persistCharacterResolutionEvents(adapter,durableEvents,"forward");
  if(writeBack.status==="rejected")return writeBack;
  if(!commitAdapterTurnRuntimeState(adapter,internal.scene,current.revision,result.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(adapter,durableEvents,"inverse");
    return {status:"rejected" as const,error:"Common Play reaction TurnRuntime revision changed before commit"};
  }
  if(projected?.status==="committed"){
    internal.scene=projected.scene;
    internal.activeCharacter.resources=projected.resources;
    internal.activeCharacter.items=projected.items;
    if(resolution)resolution.stateChanges.push(...projected.stateChanges);
    const history=runtimeResolutionEventHistories.get(adapter);
    runtimeResolutionEventHistories.set(adapter,{
      resolutionId:pending.resolutionId,
      events:[...(history?.resolutionId===pending.resolutionId?history.events:[]),...durableEvents],
    });
  }else if(durableEvents.length)appendAdapterInterruptEvents(adapter,pending.resolutionId,durableEvents);
  projectAdapterTurnRuntime(adapter);
  synchronizeProjectedCharacterResources(adapter,result.state);
  internal.syncChar();
  return {status:"committed" as const};
}`);

replaceOnce(path,
`      updateD20Presentation(resolution,pending,d20,authority);`,
`      updateD20Presentation(resolution,pending,d20,authority,internal.scene);`);

replaceOnce('src/app/mockAdapter.ts',
`classLevels:[{classId:"dnd.srd521.class.fighter",level:5}]`,
`classLevels:[{classId:"dnd.srd521.class.fighter",className:"전사",level:5}]`);

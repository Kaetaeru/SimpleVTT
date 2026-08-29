import fs from "node:fs";

const runtimePath="src/app/installedCommonPlayRuntimeAdapter.ts";
let runtime=fs.readFileSync(runtimePath,"utf8");
const cleanup="actions.filter((action)=>!parseStoredInvocationCommonPlayActionId(action.id)&&!parseStoredInvocationCancelActionId(action.id)&&!parseZoneMembershipCommonPlayActionId(action.id));";
const cleanupNext="actions.filter((action)=>!parseStoredInvocationCommonPlayActionId(action.id)&&!parseStoredInvocationCancelActionId(action.id)&&!parseZoneMembershipCommonPlayActionId(action.id)&&!parseRuntimeArtifactCommonPlayActionId(action.id));";
const cleanupCount=runtime.split(cleanup).length-1;
if(cleanupCount!==2) throw new Error(`expected two runtime-artifact cleanup sites, found ${cleanupCount}`);
runtime=runtime.split(cleanup).join(cleanupNext);

const projectionMarker=[
  "    (adapter as unknown as AdapterState).scene.actionsByActor[actor.combatantId]=cp(actions);",
  "  }",
  "  for(const artifact of state.artifacts??[]) {",
  "    const stored=artifact.artifactKind===\"stored-invocation\"?artifact.storedInvocation:undefined;",
].join("\n");
const projectionReplacement=[
  "    (adapter as unknown as AdapterState).scene.actionsByActor[actor.combatantId]=cp(actions);",
  "  }",
  "  for(const artifact of state.artifacts??[]) {",
  "    const form=artifact.artifactKind===\"form\"?artifact.form:undefined;",
  "    if(!form||form.actionPolicy!==\"grant\"||!state.combatants[form.targetActorId]||!snapshot.scene.entities.some((entity)=>entity.id===form.targetActorId)) continue;",
  "    if(snapshot.role!==\"dm\"&&form.controllerId&&form.controllerId!==snapshot.activeCharacter.id) continue;",
  "    const actions=(await Promise.all(form.actionDefinitionIds.map(async(actionId)=>{",
  "      const action=await commonPlayAction(adapter,actionId);",
  "      return action?projectedArtifactAction(actionId,form.targetActorId,action,snapshot.scene,state):undefined;",
  "    }))).filter((action):action is ActionVm=>Boolean(action));",
  "    if(!actions.length) continue;",
  "    snapshot.scene.actionsByActor[form.targetActorId]=[...(snapshot.scene.actionsByActor[form.targetActorId]??[]),...cp(actions)];",
  "    const internalScene=(adapter as unknown as AdapterState).scene;",
  "    internalScene.actionsByActor[form.targetActorId]=[...(internalScene.actionsByActor[form.targetActorId]??[]),...cp(actions)];",
  "  }",
  "  for(const artifact of state.artifacts??[]) {",
  "    const stored=artifact.artifactKind===\"stored-invocation\"?artifact.storedInvocation:undefined;",
].join("\n");
if(!runtime.includes(projectionMarker)) throw new Error("form projection insertion marker missing");
runtime=runtime.replace(projectionMarker,projectionReplacement);
fs.writeFileSync(runtimePath,runtime);

const testPath="tests/ui/installedCommonPlayLoweredFamiliesProduction.test.ts";
let test=fs.readFileSync(testPath,"utf8");
const importFrom='import { installedCommonPlayActionId, parseStoredInvocationCancelActionId, parseStoredInvocationCommonPlayActionId, parseZoneMembershipCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";';
const importTo='import { installedCommonPlayActionId, parseStoredInvocationCancelActionId, parseStoredInvocationCommonPlayActionId, parseZoneMembershipCommonPlayActionId, runtimeArtifactCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";';
if(!test.includes(importFrom)) throw new Error("action reference import marker missing");
test=test.replace(importFrom,importTo);
const formFrom='{id:"form",artifactKind:"form",duration,lifetime,initialState:{targetActorId:"actor",propertyOverlay:{"movement.fly":30},retainedProperties:[],replacementProperties:["movement.fly"],hpPolicy:"retain",actionPolicy:"grant",spellcasting:"retain",actionDefinitionIds:[`${prefix}.claw`],resources:[]}},';
const formTo='{id:"form",artifactKind:"form",duration,lifetime,initialState:{targetActorId:"actor",propertyOverlay:{"movement.fly":30},retainedProperties:[],replacementProperties:["movement.fly"],hpPolicy:"retain",actionPolicy:"grant",spellcasting:"retain",actionDefinitionIds:[actorAction],resources:[]}},';
if(!test.includes(formFrom)) throw new Error("form fixture marker missing");
test=test.replace(formFrom,formTo);

const insertBefore='test("installed Zone membership is manually actionable and restores membership plus damage through Undo",async()=>{';
if(!test.includes(insertBefore)) throw new Error("form test insertion marker missing");
const formTests=[
  'test("portable form granted action projects through connected replay, reconnect, duplicate replay, and Undo",async()=>{',
  '  const prefix="unknown-connected-form",sessionId="session.common-play-form";',
  '  const host=new MockAdapter();const {action}=await install(host,prefix);',
  '  const hostConnected=connectedStateFor(host);hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));',
  '  const originalSend=tauriSessionTransport.send;',
  '  const runHost=async(operation:()=>Promise<unknown>)=>{',
  '    const wires:string[]=[];tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};',
  '    try { await operation(); } finally { tauriSessionTransport.send=originalSend; }',
  '    const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;',
  '    assert.ok(batch,JSON.stringify(wires));return batch;',
  '  };',
  '  const createBatch=await runHost(()=>host.resolveAction(action(3,"create-artifacts"),["char.aelar"]));',
  '  const formActionId=runtimeArtifactCommonPlayActionId("char.aelar",action(4,"bite"));',
  '  assert.ok((await host.getSnapshot()).scene.actionsByActor["char.aelar"]?.some((candidate)=>candidate.id===formActionId));',
  '',
  '  const client=new MockAdapter();await install(client,prefix);',
  '  const clientConnected=connectedStateFor(client);clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);',
  '  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"applied");',
  '  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"duplicate");',
  '  assert.ok((await client.getSnapshot()).scene.actionsByActor["char.aelar"]?.some((candidate)=>candidate.id===formActionId));',
  '',
  '  const reconnect=new MockAdapter();await install(reconnect,prefix);',
  '  const reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);',
  '  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");',
  '  assert.ok((await reconnect.getSnapshot()).scene.actionsByActor["char.aelar"]?.some((candidate)=>candidate.id===formActionId));',
  '',
  '  const undoBatch=await runHost(()=>host.undoLastResolution());',
  '  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");',
  '  assert.equal((await applyConnectedClientEvents(reconnect,undoBatch.events)).status,"applied");',
  '  assert.equal((await host.getSnapshot()).scene.actionsByActor["char.aelar"]?.some((candidate)=>candidate.id===formActionId),false);',
  '  assert.equal((await client.getSnapshot()).scene.actionsByActor["char.aelar"]?.some((candidate)=>candidate.id===formActionId),false);',
  '  assert.equal((await reconnect.getSnapshot()).scene.actionsByActor["char.aelar"]?.some((candidate)=>candidate.id===formActionId),false);',
  '});',
  '',
  'test("renaming an external form preserves granted action production semantics and Undo",async()=>{',
  '  const runForm=async(prefix:string)=>{',
  '    const adapter=new MockAdapter();const {action}=await install(adapter,prefix);',
  '    await adapter.resolveAction(action(3,"create-artifacts"),["char.aelar"]);',
  '    const formActionId=runtimeArtifactCommonPlayActionId("char.aelar",action(4,"bite"));',
  '    let snapshot=await adapter.getSnapshot();',
  '    const projected=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>candidate.id===formActionId);',
  '    assert.ok(projected,JSON.stringify(snapshot.scene.actionsByActor["char.aelar"]));',
  '    const before=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;',
  '    await adapter.setQueuedD20(20);',
  '    await adapter.resolveAction(formActionId,["combatant.goblin-a"]);',
  '    snapshot=await adapter.getSnapshot();',
  '    const after=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;',
  '    assert.ok(after<before);',
  '    assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);',
  '    await adapter.undoLastResolution();',
  '    snapshot=await adapter.getSnapshot();',
  '    assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before);',
  '    assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);',
  '    return {projection:{name:projected.name,economy:projected.economy,resolutionKind:projected.resolutionKind,target:projected.target},damage:before-after};',
  '  };',
  '  assert.deepEqual(await runForm("unknown-form-a"),await runForm("renamed-form-b"));',
  '});',
  '',
].join("\n");
test=test.replace(insertBefore,formTests+insertBefore);
fs.writeFileSync(testPath,test);

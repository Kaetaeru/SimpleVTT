import "./connectedSceneTopologyRuntimeAdapter";
import "./movementDeclarationRuntimeAdapter";
import "./sceneConditionRuntimeAdapter";
import "./encounterGroupRuntimeAdapter";
import "./engagementRuntimeAdapter";
import "./srdMonsterTimingRuntimeAdapter";
import "./resolutionPostHocRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import type { AppSnapshot, SceneVm } from "./contracts";
import type { MovementDeclarationKind } from "./movementDeclarationContracts";
import { commitConnectedSceneTopology, connectedInternal, connectedManifest, sendConnectedWireTo } from "./connectedSessionRuntimeAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { registerConnectedMovementRequestHandler } from "./connectedMovementRequestPort";
import { tauriSessionTransport } from "./tauriSessionTransport";

/**
 * V1.3 C1-02 — multiplayer parity for theater-of-mind play.
 *
 * The Host is authoritative for everything the V1.2 gates added (engagements, groups, badges, scene conditions,
 * movement declarations, the 물러남 prompt, monster timing, post-hoc toggles). Those live in the scene, so
 * they reach players through the scene topology: every DM edit below publishes the topology when it changed,
 * and the topology now carries the scene-level fields (`connectedSessionRuntimeAdapter.sceneTopology`).
 * A player's own 접근/물러남/그대로 is sent to the Host as a `movement-request`; the Host validates the peer's
 * character, declares on its behalf, and publishes.
 */
type RoutedMethod="declareMovement"|"answerWithdrawalPrompt"|"setEngagement"|"setCreatureStatus"|"setCreatureBadge"|"applyNarrativeDamage"|"setSceneCondition"|"instantiateCombatantGroup"|"groupCombatants"|"ungroupCombatants"|"useLegendaryResistance"|"resetMonsterTiming"|"applyPostHocToggle"|"endTurn"|"startInitiative"|"dismissResolution"|"undoLastResolution";

let requestSequence=0;
const requestId=()=>`movement.${Date.now()}.${requestSequence++}`;

/** Everything a player's screen derives from the scene besides HP/economy (those already travel as events). */
export function theaterTopologyFingerprint(scene:SceneVm) {
  return JSON.stringify({
    entities:scene.entities.map((entity)=>[entity.id,entity.status,entity.engagedWithIds,entity.groupId,entity.movementDeclaration,entity.runtimeMonsterTiming,entity.hp,entity.tempHp,entity.initiative]),
    groups:scene.groups,
    engagements:scene.engagements,
    sceneConditions:scene.sceneConditions,
    movementDeclarations:scene.movementDeclarations,
    pendingWithdrawal:scene.pendingWithdrawal,
    currentActorId:scene.currentActorId,
    round:scene.round,
  });
}

export async function publishTheaterTopologyIfChanged(adapter:MockAdapter,before:string,operation:string) {
  const app=connectedInternal(adapter);
  if (connectedStateFor(adapter).mode!=="host") return;
  // Projections (engagement chips, group folds, timing badges) are refreshed by a snapshot read.
  await app.getSnapshot();
  if (theaterTopologyFingerprint(app.scene)===before) return;
  await commitConnectedSceneTopology(adapter,[`Scene state changed: ${operation}`],["host-authoritative theater-of-mind scene state"]);
}

function wrapHostPublish(method:RoutedMethod) {
  const prototype=MockAdapter.prototype as unknown as Record<string,(...args:unknown[])=>Promise<AppSnapshot>>;
  const previous=prototype[method];
  if (typeof previous!=="function") return;
  prototype[method]=async function publishAfter(this:MockAdapter,...args:unknown[]) {
    const host=connectedStateFor(this).mode==="host";
    const before=host ? theaterTopologyFingerprint(connectedInternal(this).scene) : "";
    const result=await previous.apply(this,args);
    if (host) await publishTheaterTopologyIfChanged(this,before,method);
    return host ? connectedInternal(this).getSnapshot() : result;
  };
}

// Client side: a player's own movement declaration goes to the Host.
const previousDeclareMovement=MockAdapter.prototype.declareMovement;
MockAdapter.prototype.declareMovement=async function declareConnectedMovement(actorId:string,kind:MovementDeclarationKind,targetId?:string) {
  const state=connectedStateFor(this);
  const app=connectedInternal(this);
  if (state.mode==="client") {
    const character=connectedManifest(this).character;
    if (!state.sessionId||!state.replica||app.connectionState!=="connected"||!character||character.characterId!==actorId) {
      app.session.compatibility="warning";
      app.session.compatibilityMessage="이동 선언은 연결된 자신의 캐릭터에 대해서만 Host로 보낼 수 있습니다.";
      return app.getSnapshot();
    }
    await tauriSessionTransport.send(JSON.stringify({
      type:"movement-request",
      request:{ sessionId:state.sessionId, requestId:requestId(), actorId, kind, ...(targetId ? { targetId } : {}), knownEventCursor:state.replica.cursor },
    }));
    app.session.compatibility="compatible";
    app.session.compatibilityMessage=`이동 선언(${kind==="approach" ? "접근" : kind==="withdraw" ? "물러남" : "그대로"}) 전송 · Host event cursor ${state.replica.cursor}`;
    return app.getSnapshot();
  }
  const host=state.mode==="host";
  const before=host ? theaterTopologyFingerprint(app.scene) : "";
  const result=await previousDeclareMovement.call(this,actorId,kind,targetId);
  if (host) { await publishTheaterTopologyIfChanged(this,before,"declareMovement"); return app.getSnapshot(); }
  return result;
};

// Host side: validate the peer and declare on the player's behalf.
registerConnectedMovementRequestHandler(async (adapter,transportMessage,request)=>{
  const state=connectedStateFor(adapter);
  const ledger=state.ledger;
  if (state.mode!=="host"||!ledger) return;
  const peerManifest=state.peerManifests.get(transportMessage.peer);
  if (!peerManifest?.character||peerManifest.character.characterId!==request.actorId) {
    await sendConnectedWireTo(transportMessage.peer,{ type:"error", code:"actor-projection-mismatch", message:"movement request actor must match the peer Character projection from hello", hostCursor:ledger.cursor });
    return;
  }
  if (!connectedInternal(adapter).scene.entities.some((entity)=>entity.id===request.actorId)) {
    await sendConnectedWireTo(transportMessage.peer,{ type:"error", code:"actor-not-in-scene", message:`${request.actorId} is not in the scene`, hostCursor:ledger.cursor });
    return;
  }
  await adapter.declareMovement(request.actorId,request.kind,request.targetId);
});

for (const method of ["answerWithdrawalPrompt","setEngagement","setCreatureStatus","setCreatureBadge","applyNarrativeDamage","setSceneCondition","instantiateCombatantGroup","groupCombatants","ungroupCombatants","useLegendaryResistance","resetMonsterTiming","applyPostHocToggle","endTurn","startInitiative","dismissResolution","undoLastResolution"] as RoutedMethod[]) wrapHostPublish(method);

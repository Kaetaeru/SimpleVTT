import type { SessionRefusalVm } from "./contracts";

/**
 * V1.6 S1-01 — refusals in the rules' words.
 *
 * A refusal is a first-class outcome of a table command: what was refused and why, in Korean, on the peer that issued
 * it. Adapters set `snapshot.refusal` instead of returning silently; the connected client maps a Host `error` wire
 * message onto the same shape; the dock shows whichever is newest.
 */
export const REFUSAL_MESSAGES:Record<string,string>={
  "action-unknown":"알 수 없는 행동입니다.",
  "action-unavailable":"지금은 사용할 수 없는 행동입니다.",
  "target-ineligible":"그 대상에게는 사용할 수 없습니다.",
  "too-many-targets":"대상이 너무 많습니다.",
  "remote-pending":"플레이어의 행동이 처리 중입니다. 먼저 끝내세요.",
  "not-connected":"호스트와 연결이 끝나지 않아 행동을 보낼 수 없습니다.",
  "no-op":"행동이 처리되지 않았습니다. 현재 턴·자원·대상을 확인하세요.",
  // Host → client wire error codes.
  "action-rejected":"호스트가 행동을 거부했습니다.",
  "action-disabled":"지금은 사용할 수 없는 행동입니다.",
  "action-off-turn":"현재 Actor의 턴이 아닙니다.",
  "host-commit-rejected":"호스트가 행동을 확정하지 못했습니다.",
  "request-rejected":"호스트가 요청을 받지 않았습니다.",
  "action-resolution-error":"호스트에서 행동 처리 중 오류가 났습니다.",
  "ready-config-rejected":"준비 행동 설정이 맞지 않습니다.",
  "movement-request-rejected":"이동 선언이 거부되었습니다.",
  "interrupt-not-pending":"응답할 반응 창이 없습니다.",
  "interrupt-not-authorized":"이 반응은 당신의 캐릭터 것이 아닙니다.",
  "manual-reaction-not-authorized":"기회공격 선언은 현재 캐릭터만 할 수 있습니다.",
  "session-live":"준비 상태는 세션 시작 전에만 바꿀 수 있습니다.",
  "ready-not-authorized":"참가 확인이 끝나기 전에는 준비할 수 없습니다.",
  "ready-incompatible":"호환되지 않는 참가자는 준비할 수 없습니다.",
  "action-route-unavailable":"호스트가 행동 요청을 받을 수 없는 상태입니다.",
  "movement-route-unavailable":"호스트가 이동 요청을 받을 수 없는 상태입니다.",
  "common-play-fact-response-rejected":"호스트가 선택 응답을 받지 않았습니다.",
  "session-mismatch":"다른 세션의 메시지입니다. 다시 참가하세요.",
  "invalid-event-cursor":"호스트와 기록이 어긋났습니다. 동기화를 다시 시도합니다.",
  "malformed-wire":"호스트가 이해할 수 없는 메시지를 받았습니다.",
};

/** Host reasons that are already in the rules' words are shown as they are; internal English reasons get the code's sentence. */
export function refusalMessageFor(code:string,raw?:string):string {
  const base=REFUSAL_MESSAGES[code]??"요청이 거부되었습니다.";
  if(!raw) return base;
  const korean=/[ㄱ-힝]/.test(raw);
  return korean?raw:base;
}

let sequence=0;
export function makeRefusal(code:string,message:string,extra:Partial<Pick<SessionRefusalVm,"actionId"|"actorId"|"origin">>={}):SessionRefusalVm {
  sequence+=1;
  return {id:sequence,code,message,origin:extra.origin??"local",...(extra.actionId?{actionId:extra.actionId}:{}),...(extra.actorId?{actorId:extra.actorId}:{})};
}

/** UI-local refusals (a tile the projection already marked unavailable) travel on this bus so the notice is the same. */
export type RefusalListener=(refusal:SessionRefusalVm)=>void;
const listeners=new Set<RefusalListener>();
export function announceRefusal(code:string,message:string,extra:Partial<Pick<SessionRefusalVm,"actionId"|"actorId">>={}):SessionRefusalVm {
  const refusal=makeRefusal(code,message,extra);
  for(const listener of listeners) listener(refusal);
  return refusal;
}
export function subscribeRefusal(listener:RefusalListener):()=>void {
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}

/**
 * The targets a request names must be the targets the projection offers: the dock only lets a player pick from
 * `eligibleTargetIds`, so a request outside that list (a stale client, a script, a race) is refused the same way.
 * An action whose eligibility is not projected (empty list) is left to the resolution path.
 */
export function targetRefusalFor(action:{eligibleTargetIds?:string[];maxTargets?:number;target?:string}|undefined,targetIds:string[]):{code:string;message:string}|null {
  if(!action||!targetIds.length) return null;
  const eligible=action.eligibleTargetIds??[];
  if(eligible.length&&targetIds.some((id)=>!eligible.includes(id))) return {code:"target-ineligible",message:REFUSAL_MESSAGES["target-ineligible"]};
  const limit=action.maxTargets??(action.target==="multi-enemy"||action.target==="multi-ally"||action.target==="multi-any"?undefined:1);
  if(limit!==undefined&&targetIds.length>limit) return {code:"too-many-targets",message:`대상은 최대 ${limit}명입니다.`};
  return null;
}

/** True when a command left nothing behind: no new resolution, activity, refusal, economy or entity change. */
export function commandWasNoOp(before:{resolution:{id:string}|null;activity:{id:string}[];refusal?:SessionRefusalVm|null;scene:{economyByActor:unknown;entities:unknown}},after:{resolution:{id:string}|null;activity:{id:string}[];refusal?:SessionRefusalVm|null;scene:{economyByActor:unknown;entities:unknown}}):boolean {
  if((before.resolution?.id??null)!==(after.resolution?.id??null)) return false;
  if((before.activity[0]?.id??null)!==(after.activity[0]?.id??null)) return false;
  if((before.refusal?.id??0)!==(after.refusal?.id??0)) return false;
  if(JSON.stringify(before.scene.economyByActor)!==JSON.stringify(after.scene.economyByActor)) return false;
  if(JSON.stringify(before.scene.entities)!==JSON.stringify(after.scene.entities)) return false;
  return true;
}

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
  "spell-rejected":"주문을 시전할 수 없습니다.",
  "undo-rejected":"되돌릴 수 없습니다.",
  // Host → client wire error codes.
  "action-rejected":"호스트가 행동을 거부했습니다.",
  "action-disabled":"지금은 사용할 수 없는 행동입니다.",
  "action-off-turn":"현재 Actor의 턴이 아닙니다.",
  "host-commit-rejected":"호스트가 행동을 확정하지 못했습니다.",
  "request-rejected":"호스트가 요청을 받지 않았습니다.",
  "action-resolution-error":"호스트에서 행동 처리 중 오류가 났습니다.",
  "remote-action-not-event-native":"호스트가 이 행동을 공유 기록으로 만들지 못했습니다. DM에게 알리세요.",
  "action-unsupported":"호스트가 이 행동을 지원하지 않습니다.",
  "projection-activation-failed":"호스트가 캐릭터를 불러오지 못했습니다.",
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

/** The spell kernel's rejection texts, in the rules' words. */
export function spellRejectionMessage(error:string|undefined):string {
  const text=String(error??"").trim();
  if(!text) return REFUSAL_MESSAGES["spell-rejected"];
  if(/[가-힣]/.test(text)) return text;
  if(/^action is not available/.test(text)) return "행동을 이미 사용했습니다.";
  if(/^bonus[- ]action is not available/.test(text)) return "추가 행동을 이미 사용했습니다.";
  if(/^reaction is not available/.test(text)) return "반응을 이미 사용했습니다.";
  if(/already expended a spell slot/.test(text)) return "이번 턴에 이미 주문 슬롯을 썼습니다.";
  if(/spell slot/.test(text)&&/no |not available|insufficient|exhausted/.test(text)) return "주문 슬롯이 없습니다.";
  return `시전 거부 · ${text}`;
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
 * Two target rules no resolution path disputes: an enemy-only action cannot name the actor himself, and a
 * single-target action (enemy / ally / self) or a bounded multi-target action cannot name more targets than it allows.
 * Everything else (range, cover, visibility, membership of the projected list) is left to the resolution path and its
 * own facts — the spatial provider answers "적용 거부: beyond range", for instance.
 */
export function targetRefusalFor(action:{actorId?:string;maxTargets?:number;target?:string}|undefined,targetIds:string[]):{code:string;message:string}|null {
  if(!action||!targetIds.length) return null;
  if((action.target==="enemy"||action.target==="multi-enemy")&&action.actorId&&targetIds.includes(action.actorId)) return {code:"target-ineligible",message:REFUSAL_MESSAGES["target-ineligible"]};
  const single=action.target==="enemy"||action.target==="ally"||action.target==="self";
  const limit=action.maxTargets??(single?1:undefined);
  if(limit!==undefined&&targetIds.length>limit) return {code:"too-many-targets",message:`대상은 최대 ${limit}명입니다.`};
  return null;
}

/** The reasons the table's own economy produces (turn, action/bonus/reaction spent, 0 HP, resources, items) — the Host refuses these on its own path before any production path can swallow them; provider-specific reasons (range, cover) stay with their path. */
export function isTableEconomyReason(reason:string|undefined):boolean {
  return Boolean(reason&&/이미 사용했습니다|턴이 아닙니다|의식불명|쓰러진 상태|자원이 부족|아이템이 없습니다|수량이 부족|충전이 부족/.test(reason));
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

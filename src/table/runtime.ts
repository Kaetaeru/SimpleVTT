import type { RulesProfileLike } from "../domain/profileEngine";
import { SIMPLEVTT_APP_RULES_PROFILE } from "../app/realResolutionService";
import { HOST_ORIGIN, type CommandOrigin, type TableCommand } from "./commands";
import { randomDice, type Dice } from "./dice";
import { applyEvent, type TableEvent } from "./events";
import { act } from "./handlers/act";
import { addActors, removeActor, setActor } from "./handlers/actors";
import { object, posture } from "./handlers/objects";
import { answerQuestion, declare, ready, skipQuestion, triggerReady } from "./handlers/flow";
import { forgetRuling, improvise, narrate, rememberRuling, request, rule } from "./handlers/improvise";
import { ruling, rulingLabel } from "./handlers/ruling";
import { endInitiative, endTurn, setCurrentActor, setOrder, startInitiative } from "./handlers/turns";
import type { HandlerContext, HandlerResult } from "./handlers/types";
import { refused, type TableRefusal } from "./refusal";
import { cloneState, createTableState, type LogEntry, type ResolutionRecord, type TableState } from "./state";

export type Outcome=
  |{status:"committed";events:TableEvent[];resolution:ResolutionRecord|null}
  |{status:"refused";refusal:TableRefusal&{id:number}};

export interface TableRuntimeOptions {
  sessionId?:string;
  dice?:Dice;
  now?:()=>string;
  profile?:RulesProfileLike;
  historyLimit?:number;
}

function authorize(state:TableState,command:TableCommand,origin:CommandOrigin):TableRefusal|null {
  if(origin.role==="dm") return null;
  if(command.type==="answer-question") {
    const question=state.questions.find((entry)=>entry.id===command.questionId);
    if(!question) return {code:"question-unknown",message:"이미 처리된 질문입니다."};
    if(question.toPeer!==origin.peerId) return {code:"not-authorized",message:"이 질문은 당신에게 온 것이 아닙니다.",actorId:question.actorId};
    return null;
  }
  if(command.type==="narrate") {
    if(!command.actorId) return null;
    const actor=state.actors[command.actorId];
    if(!actor) return {code:"actor-unknown",message:"테이블에 없는 액터입니다.",actorId:command.actorId};
    if(actor.controllerPeer!==origin.peerId) return {code:"not-authorized",message:"자기 캐릭터로만 말할 수 있습니다.",actorId:command.actorId};
    return null;
  }
  if(command.type==="act"||command.type==="posture"||command.type==="object"||command.type==="declare"||command.type==="ready"||command.type==="improvise"||command.type==="request") {
    const actor=state.actors[command.actorId];
    if(!actor) return {code:"actor-unknown",message:"테이블에 없는 액터입니다.",actorId:command.actorId};
    if(actor.controllerPeer!==origin.peerId) return {code:"not-authorized",message:"자기 캐릭터만 조작할 수 있습니다.",actorId:command.actorId,...(command.type==="act"?{actionId:command.actionId}:{})};
    return null;
  }
  if(command.type==="end-turn") {
    const current=state.currentActorId?state.actors[state.currentActorId]:undefined;
    if(!current||current.controllerPeer!==origin.peerId) return {code:"not-authorized",message:"자기 턴만 끝낼 수 있습니다."};
    return null;
  }
  return {code:"not-authorized",message:"DM만 할 수 있습니다."};
}

function describe(state:TableState,command:TableCommand):string {
  switch(command.type) {
    case "act": return `${state.actors[command.actorId]?.name??command.actorId} · ${command.actionId}`;
    case "posture": return `${state.actors[command.actorId]?.name??command.actorId} · ${command.posture==="prone"?"엎드리기":"일어나기"}`;
    case "object": return `${state.actors[command.actorId]?.name??command.actorId} · ${{draw:"꺼내기",stow:"집어넣기",drop:"놓기","pick-up":"줍기",give:"건네기","throw-to":"던져서 건네기"}[command.op]}`;
    case "declare": return `${state.actors[command.actorId]?.name??command.actorId} · 이동 ${{approach:"접근",withdraw:"물러남",stay:"그대로"}[command.movement]}`;
    case "answer-question": return `질문 답변 · ${command.optionId}`;
    case "skip-question": return "질문 넘김";
    case "ready": return `${state.actors[command.actorId]?.name??command.actorId} · 준비 행동`;
    case "trigger-ready": return `${state.actors[command.actorId]?.name??command.actorId} · 준비 조건 발생`;
    case "improvise": return `${state.actors[command.actorId]?.name??command.actorId} · 즉흥 행동 선언`;
    case "narrate": return "서술";
    case "rule": return `DM 판정 · ${state.actors[command.actorId]?.name??command.actorId}`;
    case "request": return `${state.actors[command.actorId]?.name??command.actorId} · 요청`;
    case "remember-ruling": return `즉석 규칙 저장 · ${command.name}`;
    case "forget-ruling": return "즉석 규칙 삭제";
    case "ruling": return `DM 재량 · ${rulingLabel(state,command.ruling)}`;
    case "add-actors": return "액터 추가";
    case "remove-actor": return `액터 제거 · ${state.actors[command.actorId]?.name??command.actorId}`;
    case "set-actor": return "액터 변경";
    case "start-initiative": return "이니셔티브 시작";
    case "end-initiative": return "이니셔티브 종료";
    case "end-turn": return "턴 종료";
    case "set-current-actor": return "턴 이동";
    case "set-order": return "순서 변경";
    case "set-roll-visibility": return "굴림 공개 설정";
    case "undo": return "되돌리기";
  }
}

/**
 * The Host's table (TABLE_RUNTIME.md §5). `dispatch` is the only way in; every change leaves as events any replica can
 * apply with the same `applyEvent`. Undo restores the stored state before the last command and broadcasts it whole.
 */
export class TableRuntime {
  state:TableState;
  readonly ledger:TableEvent[]=[];
  lastRefusal:(TableRefusal&{id:number})|null=null;
  private seq=0;
  private refusals=0;
  private history:Array<{seq:number;before:TableState;label:string;commandType:TableCommand["type"]}>=[];
  private readonly dice:Dice;
  private readonly now:()=>string;
  private readonly profile:RulesProfileLike;
  private readonly historyLimit:number;
  private readonly listeners=new Set<(event:TableEvent)=>void>();

  constructor(options:TableRuntimeOptions={}) {
    this.state=createTableState(options.sessionId??"table.local");
    this.dice=options.dice??randomDice();
    this.now=options.now??(()=>"지금");
    this.profile=options.profile??SIMPLEVTT_APP_RULES_PROFILE;
    this.historyLimit=options.historyLimit??50;
  }

  subscribe(listener:(event:TableEvent)=>void) { this.listeners.add(listener); return ()=>{this.listeners.delete(listener);}; }

  dispatch(command:TableCommand,origin:CommandOrigin=HOST_ORIGIN):Outcome {
    const denied=authorize(this.state,command,origin);
    if(denied) return this.refuse(denied);
    if(command.type==="undo") return this.undo(origin.peerId===HOST_ORIGIN.peerId&&this.undoSkipsBookkeeping);
    if(command.type==="set-roll-visibility") {
      if(this.state.rollVisibility===command.visibility) return this.refuse({code:"visibility-same",message:"이미 그 설정입니다."});
      return this.commit(command,{status:"committed",events:[{payload:{type:"visibility-changed",rollVisibility:command.visibility},log:[]}]});
    }
    const ctx:HandlerContext={state:this.state,dice:this.dice,profile:this.profile,nextSeq:this.seq+1,now:this.now,origin};
    const result=this.handle(ctx,command);
    if(result.status==="refused") return this.refuse(result.refusal);
    const outcome=this.commit(command,result,{recordHistory:result.followUp?.type!=="undo"});
    if(result.followUp&&outcome.status==="committed") {
      this.undoSkipsBookkeeping=result.followUp.type==="undo";
      const followed=this.dispatch(result.followUp,HOST_ORIGIN);
      this.undoSkipsBookkeeping=false;
      if(followed.status==="committed") return {status:"committed",events:[...outcome.events,...followed.events],resolution:followed.resolution??outcome.resolution};
    }
    return outcome;
  }

  /** Replicas apply the Host's events in order; a gap is a protocol error the connected layer resolves by snapshot. */
  applyRemote(event:TableEvent) {
    if(event.seq!==this.seq+1) throw new Error(`event sequence gap: expected ${this.seq+1}, got ${event.seq}`);
    this.state=applyEvent(this.state,event);
    this.ledger.push(event);
    this.seq=event.seq;
    for(const listener of this.listeners) listener(event);
  }

  /** Replace the whole table (a reconnecting replica, or a test fixture). */
  restore(state:TableState) {
    this.state=cloneState(state);
    this.seq=state.revision;
    this.ledger.length=0;
    this.history.length=0;
  }

  private handle(ctx:HandlerContext,command:TableCommand):HandlerResult {
    switch(command.type) {
      case "add-actors": return addActors(ctx,command);
      case "remove-actor": return removeActor(ctx,command);
      case "set-actor": return setActor(ctx,command);
      case "start-initiative": return startInitiative(ctx);
      case "end-initiative": return endInitiative(ctx);
      case "end-turn": return endTurn(ctx);
      case "set-current-actor": return setCurrentActor(ctx,command);
      case "set-order": return setOrder(ctx,command);
      case "act": return act(ctx,command);
      case "posture": return posture(ctx,command);
      case "object": return object(ctx,command);
      case "declare": return declare(ctx,command);
      case "answer-question": return answerQuestion(ctx,command);
      case "skip-question": return skipQuestion(ctx,command);
      case "ready": return ready(ctx,command);
      case "trigger-ready": return triggerReady(ctx,command);
      case "improvise": return improvise(ctx,command);
      case "narrate": return narrate(ctx,command);
      case "rule": return rule(ctx,command);
      case "request": return request(ctx,command);
      case "remember-ruling": return rememberRuling(ctx,command);
      case "forget-ruling": return forgetRuling(ctx,command);
      case "ruling": return ruling(ctx,command);
      default: return refused("command-unknown","알 수 없는 명령입니다.");
    }
  }

  private commit(command:TableCommand,result:Extract<HandlerResult,{status:"committed"}>,options:{recordHistory?:boolean}={}):Outcome {
    const before=cloneState(this.state);
    const events:TableEvent[]=[];
    for(const draft of result.events) {
      const seq=this.seq+1;
      const event:TableEvent={seq,at:this.now(),commandType:command.type,log:draft.log.map((entry)=>({...entry,seq})),payload:draft.payload};
      this.state=applyEvent(this.state,event);
      this.seq=seq;
      this.ledger.push(event);
      events.push(event);
      for(const listener of this.listeners) listener(event);
    }
    if(events.length&&options.recordHistory!==false) {
      this.history.push({seq:events[0].seq,before,label:describe(before,command),commandType:command.type});
      if(this.history.length>this.historyLimit) this.history.splice(0,this.history.length-this.historyLimit);
    }
    this.lastRefusal=null;
    return {status:"committed",events,resolution:result.resolution??null};
  }

  /** Set while an approved undo request runs: the undo reaches past the request itself and other bookkeeping. */
  private undoSkipsBookkeeping=false;

  private undo(skipBookkeeping=false):Outcome {
    const bookkeeping=new Set<TableCommand["type"]>(["request","narrate","improvise","remember-ruling","forget-ruling","skip-question"]);
    let last=this.history.pop();
    while(skipBookkeeping&&last&&bookkeeping.has(last.commandType)) last=this.history.pop();
    if(!last) return this.refuse({code:"undo-empty",message:"되돌릴 행동이 없습니다."});
    const seq=this.seq+1;
    const log:LogEntry={id:`log.${seq}.undo`,seq,time:this.now(),actor:"DM",title:`되돌리기 · ${last.label}`,summary:`이벤트 ${last.seq}부터 되돌림`,detail:[],stateChanges:[],visibility:"public",undoOf:String(last.seq)};
    const event:TableEvent={seq,at:this.now(),commandType:"undo",log:[log],payload:{type:"state-restored",state:last.before}};
    this.state=applyEvent(this.state,event);
    this.seq=seq;
    this.ledger.push(event);
    for(const listener of this.listeners) listener(event);
    this.lastRefusal=null;
    return {status:"committed",events:[event],resolution:null};
  }

  private refuse(refusal:TableRefusal):Outcome {
    this.refusals+=1;
    this.lastRefusal={...refusal,id:this.refusals};
    return {status:"refused",refusal:this.lastRefusal};
  }
}

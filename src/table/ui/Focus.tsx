import { useState } from "react";
import type { AppSnapshot, ResolutionView } from "../../app/contracts";
import type { TableQuestion } from "../state";
import type { AttackOverrides, TableCommand } from "../index";

/** What sits in the middle of the table: the latest result card (with the DM's D42 menu), the questions, a held resolution, scene reminders and a refusal. */
export function Focus({snapshot,role,peerId,dispatch,onDismiss}:{snapshot:AppSnapshot;role:"dm"|"player";peerId:string;dispatch(command:TableCommand):Promise<unknown>;onDismiss():void}) {
  const scene=snapshot.scene;
  const questions=(scene.tableQuestions??[]) as TableQuestion[];
  const pending=scene.pendingResolution;
  return <>
    {scene.sceneReminders&&scene.sceneReminders.length>0&&<div className="tw-reminders"><span>장면: {scene.sceneName??""}</span>{scene.sceneReminders.map((reminder)=><span key={reminder} className="tw-chip">{reminder}</span>)}</div>}
    {snapshot.refusal&&<div className="tw-refusal" role="alert">{snapshot.refusal.message}</div>}
    {pending&&<div className="tw-card tw-pending">⏳ {pending.label} — 대기 중: {pending.waitingOn.join(", ")||pending.window}</div>}
    {questions.map((question)=><QuestionCard key={question.id} question={question} mine={role==="dm"?question.toPeer===undefined||question.toPeer===peerId:question.toPeer===peerId} isDm={role==="dm"} dispatch={dispatch}/>)}
    {snapshot.resolution&&<ResolutionCard resolution={snapshot.resolution} role={role} dispatch={dispatch} onDismiss={onDismiss}/>}
    {!snapshot.resolution&&!questions.length&&!pending&&<div className="tw-card" style={{color:"var(--quiet)",fontSize:"var(--text-sm)",boxShadow:"none",borderStyle:"dashed"}}>{role==="dm"?"토큰을 고르고 아래 명령 센터나 재량 바로 진행하세요. 결과 카드는 여기에 뜹니다.":"결과 카드와 질문이 여기에 뜹니다."}</div>}
  </>;
}

function QuestionCard({question,mine,isDm,dispatch}:{question:TableQuestion;mine:boolean;isDm:boolean;dispatch(command:TableCommand):Promise<unknown>}) {
  return <div className="tw-card tw-question" role="group" aria-label="질문">
    <h3>{question.prompt}</h3>
    <div className="tw-card-actions">
      {mine?question.options.map((option)=><button type="button" key={option.id} className={option.id==="decline"||option.id==="hold"?"":"primary"} onClick={()=>void dispatch({type:"answer-question",questionId:question.id,optionId:option.id})}>{option.label}{option.cost?` · ${option.cost}`:""}</button>):<span style={{color:"var(--muted)",fontSize:"var(--text-sm)"}}>{question.toPeer?"상대의 답을 기다립니다":"DM의 답을 기다립니다"}</span>}
      {isDm&&<button type="button" className="quiet" onClick={()=>void dispatch({type:"skip-question",questionId:question.id})}>넘기기</button>}
    </div>
  </div>;
}

const COVER:Array<{id:AttackOverrides["cover"]&string;label:string}>=[{id:"none",label:"없음"},{id:"half",label:"절반"},{id:"three-quarters",label:"3/4"},{id:"total",label:"완전"}];

/** The result card. For the DM an attack card carries the D42 palette as a "판정" menu: the same dice re-resolve with the changed facts. */
export function ResolutionCard({resolution,role,dispatch,onDismiss}:{resolution:ResolutionView;role:"dm"|"player";dispatch(command:TableCommand):Promise<unknown>;onDismiss():void}) {
  const [menu,setMenu]=useState(false);
  const [changes,setChanges]=useState<AttackOverrides>({});
  const [damageValue,setDamageValue]=useState(0);
  const attack=resolution.rollKind==="attack";
  const apply=()=>{ void dispatch({type:"override",resolutionId:resolution.id,changes}); setMenu(false); setChanges({}); };
  const seg=<T extends string>(label:string,current:T|undefined,options:Array<{id:T;label:string}>,set:(value:T|undefined)=>void)=><><span>{label}</span><span className="tw-seg">{options.map((option)=><button type="button" key={option.id} className={current===option.id?"active":""} onClick={()=>set(current===option.id?undefined:option.id)}>{option.label}</button>)}</span></>;
  return <div className="tw-card" role="group" aria-label="결과 카드" data-resolution-id={resolution.id}>
    <h3>{resolution.actionName}</h3>
    <div className="tw-compact">{resolution.compact}</div>
    {resolution.detail.length>0&&<ul>{resolution.detail.slice(0,6).map((line,index)=><li key={index}>{line}</li>)}</ul>}
    {resolution.stateChanges.length>0&&<ul>{resolution.stateChanges.map((line,index)=><li key={index}>{line}</li>)}</ul>}
    <div className="tw-card-actions">
      {role==="dm"&&attack&&<button type="button" className={menu?"active":""} onClick={()=>setMenu(!menu)}>판정 (DM 개입)</button>}
      {role==="dm"&&<button type="button" onClick={()=>void dispatch({type:"undo"})}>되돌리기</button>}
      <button type="button" className="quiet" onClick={onDismiss}>닫기</button>
    </div>
    {menu&&<div className="tw-override" role="group" aria-label="DM 개입 팔레트">
      {seg("결과",changes.outcome,[{id:"hit" as const,label:"강제 명중"},{id:"miss" as const,label:"강제 빗나감"},{id:"crit" as const,label:"강제 치명타"}],(value)=>setChanges({...changes,outcome:value}))}
      {seg("엄폐",changes.cover,COVER,(value)=>setChanges({...changes,cover:value}))}
      {seg("굴림",changes.rollState,[{id:"advantage" as const,label:"유리"},{id:"disadvantage" as const,label:"불리"},{id:"normal" as const,label:"보통"}],(value)=>setChanges({...changes,rollState:value}))}
      {seg("사거리",changes.range,[{id:"long" as const,label:"장거리"},{id:"out" as const,label:"사거리 밖"}],(value)=>setChanges({...changes,range:value}))}
      {seg("닿음",changes.reach,[{id:"out" as const,label:"닿지 않음"}],(value)=>setChanges({...changes,reach:value}))}
      <span>안 보임</span><span className="tw-seg"><button type="button" className={changes.unseen?.attacker?"active":""} onClick={()=>setChanges({...changes,unseen:{...changes.unseen,attacker:!changes.unseen?.attacker}})}>공격자</button><button type="button" className={changes.unseen?.target?"active":""} onClick={()=>setChanges({...changes,unseen:{...changes.unseen,target:!changes.unseen?.target}})}>대상</button></span>
      <span>피해</span><span className="tw-seg"><button type="button" className={changes.damage?.mode==="half"?"active":""} onClick={()=>setChanges({...changes,damage:changes.damage?.mode==="half"?undefined:{mode:"half"}})}>절반</button><button type="button" className={changes.damage?.mode==="zero"?"active":""} onClick={()=>setChanges({...changes,damage:changes.damage?.mode==="zero"?undefined:{mode:"zero"}})}>0</button><input type="number" min={0} value={damageValue} aria-label="피해 지정" onChange={(event)=>{ const value=Number(event.target.value); setDamageValue(value); setChanges({...changes,damage:{mode:"set",value}}); }}/></span>
      <span/><span className="tw-seg"><button type="button" className="primary" onClick={apply}>적용 (같은 눈으로 재판정)</button><button type="button" className="quiet" onClick={()=>{ setChanges({}); setMenu(false); }}>취소</button></span>
    </div>}
  </div>;
}

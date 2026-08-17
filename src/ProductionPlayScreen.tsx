import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, SceneEntity } from "./app/contracts";
import { OFFICIAL_PLAY_INTENTS, intentOptions, skillFactByActionId, type PlayIntentId } from "./playerExperienceModel";

function signed(value:number|undefined){ if (value===undefined) return ""; return value>=0?`+${value}`:`${value}`; }
function entitySummary(entity:SceneEntity){ return `HP ${entity.hp}/${entity.maxHp} · AC ${entity.ac}${entity.status.length?` · ${entity.status.join(" · ")}`:""}`; }

function intentIcon(id:PlayIntentId) {
  return ({attack:"⚔",dash:"↠",disengage:"↩",dodge:"◈",help:"✦",hide:"◐",influence:"◇",magic:"✧",ready:"◷",search:"⌕",study:"▤",utilize:"◆"} as const)[id];
}

function optionMeta(action:ActionVm) {
  const skill=skillFactByActionId(action.id);
  if (skill) return `${skill.name} ${signed(action.checkBonus)}`;
  if (action.resolutionKind==="attack") return action.summary;
  return action.summary||action.economy;
}

export function ProductionPlayScreen({role}:{role:"player"|"dm"}) {
  const {snapshot,resolveAction,selectDmActor,startInitiative,endInitiative,endTurn}=useSimpleVtt();
  const [intent,setIntent]=useState<PlayIntentId|null>(null);
  const [chosen,setChosen]=useState<ActionVm|null>(null);
  const [multiTargets,setMultiTargets]=useState<string[]>([]);
  if (!snapshot) return null;
  const scene=snapshot.scene;
  const dm=role==="dm";
  const actor=dm
    ? scene.entities.find((entity)=>entity.id===scene.selectedActorId)??scene.entities[0]
    : scene.entities.find((entity)=>entity.id===(snapshot.sessionMode==="initiative"?scene.currentActorId:snapshot.activeCharacter.id))??scene.entities.find((entity)=>entity.id===snapshot.activeCharacter.id);
  const actions=actor?scene.actionsByActor[actor.id]??[]:[];
  const selectedIntent=intent?OFFICIAL_PLAY_INTENTS.find((item)=>item.id===intent):null;
  const options=intent?intentOptions(intent,actions):[];
  const isCombat=snapshot.sessionMode==="initiative";
  const currentActor=scene.entities.find((entity)=>entity.id===scene.currentActorId);
  const economy=actor?scene.economyByActor[actor.id]:undefined;
  const targets=chosen?scene.entities.filter((entity)=>chosen.eligibleTargetIds.includes(entity.id)):[];
  const canEndTurn=!dm&&isCombat&&scene.currentActorId===snapshot.activeCharacter.id;
  const lastActivity=snapshot.activity[0];

  const closeFlow=()=>{setIntent(null);setChosen(null);setMultiTargets([]);};
  const chooseIntent=(id:PlayIntentId)=>{setIntent(id);setChosen(null);setMultiTargets([]);};
  const chooseOption=async(action:ActionVm)=>{
    if (!action.available) return;
    if (action.target==="none") { await resolveAction(action.id,[]); closeFlow(); return; }
    if (action.target==="self") { await resolveAction(action.id,[actor!.id]); closeFlow(); return; }
    setChosen(action); setMultiTargets([]);
  };
  const chooseTarget=async(entity:SceneEntity)=>{
    if (!chosen||!chosen.eligibleTargetIds.includes(entity.id)) return;
    if (chosen.target==="multi-enemy") {
      setMultiTargets((current)=>current.includes(entity.id)?current.filter((id)=>id!==entity.id):current.length>=(chosen.maxTargets??99)?current:[...current,entity.id]);
      return;
    }
    await resolveAction(chosen.id,[entity.id]); closeFlow();
  };
  const completeMulti=async()=>{if(chosen&&multiTargets.length){await resolveAction(chosen.id,multiTargets);closeFlow();}};

  if (!actor) return <div className="screen play-redesign-screen"><div className="play-redesign-empty"><span className="eyebrow accent">PLAY</span><h1>{snapshot.session.name||scene.name}</h1><p>{dm?"Encounter가 비어 있습니다. 세션 또는 Combatants에서 참가자를 추가하세요.":"플레이할 Character가 아직 장면에 없습니다."}</p></div></div>;

  return <div className={`screen play-redesign-screen ${isCombat?"combat-mode":"exploration-mode"}`}>
    <header className="play-redesign-header">
      <div><span className="eyebrow accent">{isCombat?"COMBAT":"EXPLORATION"}</span><h1>{snapshot.session.name||scene.name}</h1><p>{isCombat?`${scene.round}라운드 · ${currentActor?.name??"턴 대기"}`:"탐험 · 대화 · 자유 행동"}</p></div>
      <div className="play-redesign-header-actions">
        {dm&&<select aria-label="행동할 전투원" value={actor.id} onChange={(event)=>void selectDmActor(event.target.value)}>{scene.entities.map((entity)=><option key={entity.id} value={entity.id}>{entity.name}</option>)}</select>}
        {dm&&!isCombat&&<button className="primary" onClick={()=>void startInitiative()}>이니셔티브 시작</button>}
        {dm&&isCombat&&<><button className="primary" onClick={()=>void endTurn()}>다음 턴</button><button onClick={()=>void endInitiative()}>전투 종료</button></>}
        {canEndTurn&&<button className="primary" onClick={()=>void endTurn()}>턴 종료</button>}
      </div>
    </header>

    <section className="play-actor-bar">
      <div className="play-actor-avatar">{actor.name.slice(0,1)}</div>
      <div className="play-actor-identity"><strong>{actor.name}</strong><span>{entitySummary(actor)}</span></div>
      {isCombat&&economy&&<div className="play-economy" aria-label="행동 경제"><span className={economy.action?"available":"spent"}>행동</span><span className={economy.bonusAction?"available":"spent"}>추가 행동</span><span className={economy.reaction?"available":"spent"}>반응</span><span>이동 <b>{economy.movement}/{economy.movementMax}</b></span></div>}
      {!isCombat&&snapshot.session.role!=="offline"&&<div className={`play-connection ${snapshot.connectionState}`}>{snapshot.connectionState==="connected"?"연결됨":snapshot.connectionState==="reconnecting"?"재연결 중":"연결 끊김"}</div>}
    </section>

    <main className="play-redesign-main">
      <section className="play-intent-surface">
        <div className="play-section-heading"><div><span className="eyebrow accent">ACTION</span><h2>무엇을 하나요?</h2></div><p>기술을 먼저 고르지 말고 행동의 목적부터 선택합니다.</p></div>
        <div className="play-intent-grid">
          {OFFICIAL_PLAY_INTENTS.map((item)=>{
            const available=intentOptions(item.id,actions); const active=intent===item.id;
            return <button type="button" key={item.id} className={active?"play-intent active":"play-intent"} onClick={()=>chooseIntent(item.id)}><b>{intentIcon(item.id)}</b><div><strong>{item.label}</strong><span>{item.labelEn}</span></div><small>{item.summary}</small>{available.length>0&&<em>{available.length}</em>}</button>;
          })}
        </div>
      </section>

      {selectedIntent&&<section className="play-decision-panel" aria-live="polite">
        <header><div><span>{intentIcon(selectedIntent.id)}</span><div><strong>{selectedIntent.label}</strong><small>{selectedIntent.summary}</small></div></div><button onClick={closeFlow}>닫기</button></header>
        {!chosen&&<div className="play-option-grid">
          {options.map((action)=><button key={action.id} disabled={!action.available} onClick={()=>void chooseOption(action)}><div><strong>{skillFactByActionId(action.id)?.name??action.name}</strong><span>{optionMeta(action)}</span></div><small>{action.economy}</small>{!action.available&&<em>{action.disabledReason||"현재 사용할 수 없음"}</em>}</button>)}
          {options.length===0&&<div className="play-option-empty"><strong>현재 Character 런타임에 연결된 선택지가 없습니다.</strong><span>이 행동은 공식 행동으로 표시되지만, 실제 판정은 DM의 상황 판단 또는 해당 Character 기능이 필요합니다.</span></div>}
        </div>}
        {chosen&&<div className="play-target-step"><div><strong>{chosen.name}</strong><span>{chosen.target==="multi-enemy"?`대상을 최대 ${chosen.maxTargets??"여러"}개 선택하세요.`:"대상을 선택하세요."}</span></div><div className="play-target-grid">{targets.map((entity)=>{const selected=multiTargets.includes(entity.id);return <button key={entity.id} className={selected?"selected":""} onClick={()=>void chooseTarget(entity)}><strong>{entity.name}</strong><span>{entitySummary(entity)}</span></button>})}</div>{chosen.target==="multi-enemy"&&<button className="primary" disabled={!multiTargets.length} onClick={()=>void completeMulti()}>선택한 {multiTargets.length}명으로 판정</button>}</div>}
      </section>}

      <aside className="play-context-strip">
        {isCombat&&<section><span className="eyebrow accent">TURN ORDER</span><div className="play-turn-strip">{[...scene.entities].sort((a,b)=>b.initiative-a.initiative).map((entity)=><button key={entity.id} className={entity.id===scene.currentActorId?"current":""} onClick={dm?()=>void selectDmActor(entity.id):undefined}><span>{entity.initiative}</span><strong>{entity.name}</strong><small>{entity.hp}/{entity.maxHp}</small></button>)}</div></section>}
        {!isCombat&&scene.entities.length>1&&<section><span className="eyebrow accent">SCENE</span><div className="play-participant-strip">{scene.entities.filter((entity)=>entity.id!==actor.id).map((entity)=><div key={entity.id}><strong>{entity.name}</strong><small>{entity.side==="enemy"?"상대":"동료"}{entity.status.length?` · ${entity.status.join(" · ")}`:""}</small></div>)}</div></section>}
        {lastActivity&&<section className="play-last-result"><span className="eyebrow accent">LAST RESULT</span><strong>{lastActivity.title}</strong><p>{lastActivity.summary}</p></section>}
      </aside>
    </main>
  </div>;
}

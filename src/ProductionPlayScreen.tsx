import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, SceneEntity } from "./app/contracts";
import { OFFICIAL_PLAY_INTENTS, intentOptions, skillFactByActionId, type PlayIntent, type PlayIntentId } from "./playerExperienceModel";

type HotbarTab = "common" | "class" | "spells" | "items" | "passives" | "custom";
type IconKind = PlayIntentId | "weapon" | "spell" | "item" | "feature" | "heal" | "shield" | "utility";

const BASIC_INTENTS: PlayIntentId[] = ["attack", "dash", "disengage", "dodge", "help", "hide"];
const SITUATIONAL_INTENTS: PlayIntentId[] = ["influence", "ready", "search", "study", "utilize"];
const HOTBAR_TABS: Array<{id:HotbarTab; label:string}> = [
  {id:"common", label:"공통"},
  {id:"class", label:"클래스"},
  {id:"spells", label:"주문"},
  {id:"items", label:"아이템"},
  {id:"passives", label:"패시브"},
  {id:"custom", label:"커스텀"},
];

function signed(value:number|undefined) {
  if (value===undefined) return "";
  return value>=0?`+${value}`:`${value}`;
}

function entitySummary(entity:SceneEntity) {
  return `HP ${entity.hp}/${entity.maxHp}${entity.tempHp?` +${entity.tempHp} 임시`:""}${entity.status.length?` · ${entity.status.join(" · ")}`:""}`;
}

function targetLabel(target:ActionVm["target"]) {
  if (target==="self") return "자신";
  if (target==="ally") return "아군";
  if (target==="enemy") return "적";
  if (target==="multi-enemy") return "여러 적";
  if (target==="any") return "대상";
  return "대상 없음";
}

function actionFormula(action:ActionVm) {
  if (action.attackBonus!==undefined) return `공격 ${signed(action.attackBonus)}`;
  if (action.checkBonus!==undefined) return `판정 ${signed(action.checkBonus)}`;
  if (action.saveDc!==undefined) return `${action.saveAbility??"능력"} 내성 DC ${action.saveDc}`;
  return "자동 / 판정 없음";
}

function actionEffect(action:ActionVm) {
  if (action.damage?.length) {
    return action.damage.map((part)=>`${part.dice}${part.flat?signed(part.flat):""} ${part.type}`).join(" + ");
  }
  if (action.healing) return `${action.healing.dice}${action.healing.flat?signed(action.healing.flat):""} 회복`;
  return action.summary||"효과는 선택한 행동에 따릅니다.";
}

function actionResource(action:ActionVm) {
  const costs:string[]=[];
  if (action.resourceCost) costs.push(`자원 ${action.resourceCost.amount}`);
  if (action.itemCost) costs.push(`아이템 ${action.itemCost.quantity??action.itemCost.charges??1}`);
  return costs.length?costs.join(" · "):"추가 자원 없음";
}

function optionMeta(action:ActionVm) {
  const skill=skillFactByActionId(action.id);
  if (skill) return `${skill.name} ${signed(action.checkBonus)}`;
  return action.summary||actionFormula(action);
}

function actionIconKind(action:ActionVm):IconKind {
  if (action.itemCost) return "item";
  if (action.category==="magic") return action.resolutionKind==="healing"?"heal":"spell";
  if (action.category==="weapon"||action.resolutionKind==="attack") return "weapon";
  if (action.resolutionKind==="healing") return "heal";
  if (action.economy==="반응") return "shield";
  if (action.resourceCost) return "feature";
  return "utility";
}

function ActionGlyph({kind}:{kind:IconKind}) {
  const common={viewBox:"0 0 24 24", "aria-hidden":true, focusable:"false"} as const;
  if (kind==="attack"||kind==="weapon") return <svg {...common}><path d="M5 19 19 5M8 5l11 11M5 16l3 3M15 4l5 5"/></svg>;
  if (kind==="dash") return <svg {...common}><path d="M4 12h13M12 7l5 5-5 5M4 7h4M3 17h5"/></svg>;
  if (kind==="disengage") return <svg {...common}><path d="M6 7h8l4 5-4 5H6M10 10l-3 2 3 2"/></svg>;
  if (kind==="dodge") return <svg {...common}><path d="M4 12c4-7 12-7 16 0-4 7-12 7-16 0Z"/><path d="M12 8v8"/></svg>;
  if (kind==="help"||kind==="heal") return <svg {...common}><path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z"/></svg>;
  if (kind==="hide") return <svg {...common}><path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z"/><path d="m9 9 6 6"/></svg>;
  if (kind==="influence") return <svg {...common}><path d="M4 5h16v10H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>;
  if (kind==="magic"||kind==="spell") return <svg {...common}><path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/><path d="m18 4 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></svg>;
  if (kind==="ready") return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>;
  if (kind==="search") return <svg {...common}><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>;
  if (kind==="study") return <svg {...common}><path d="M4 5c4-2 6-1 8 1v14c-2-2-4-3-8-1V5Zm16 0c-4-2-6-1-8 1v14c2-2 4-3 8-1V5Z"/></svg>;
  if (kind==="item"||kind==="utilize") return <svg {...common}><path d="M5 5h14v14H5z"/><path d="M8 8h8v8H8z"/></svg>;
  if (kind==="shield") return <svg {...common}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/></svg>;
  if (kind==="feature") return <svg {...common}><path d="m12 3 2.5 5.2 5.5.8-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.8L12 3Z"/></svg>;
  return <svg {...common}><path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/></svg>;
}

function IntentTooltip({intent,options}:{intent:PlayIntent; options:ActionVm[]}) {
  return <span className="play-action-tooltip" role="tooltip">
    <strong>{intent.label}<small>{intent.labelEn}</small></strong>
    <span>{intent.summary}</span>
    <dl><dt>선택지</dt><dd>{options.length?`${options.length}개 연결됨`:"현재 연결된 capability 없음"}</dd><dt>실행</dt><dd>필요한 무기·기술·주문·대상을 다음 단계에서 선택</dd></dl>
    {!options.length&&<em>현재 Actor 런타임에서 실행할 수 있는 선택지가 없습니다.</em>}
  </span>;
}

function ActionTooltip({action}:{action:ActionVm}) {
  return <span className="play-action-tooltip" role="tooltip">
    <strong>{skillFactByActionId(action.id)?.name??action.name}<small>{action.economy} · {action.category}</small></strong>
    <span>{action.summary}</span>
    <dl>
      <dt>대상</dt><dd>{targetLabel(action.target)}</dd>
      <dt>판정</dt><dd>{actionFormula(action)}</dd>
      <dt>효과</dt><dd>{actionEffect(action)}</dd>
      <dt>자원</dt><dd>{actionResource(action)}</dd>
    </dl>
    {action.details.slice(0,3).map((detail)=><span className="play-tooltip-detail" key={`${detail.label}:${detail.value}`}>{detail.label}: {detail.value}</span>)}
    {!action.available&&<em>{action.disabledReason||"현재 사용할 수 없습니다."}</em>}
  </span>;
}

function ActorCard({entity,current,targetable,selected,onClick}:{entity:SceneEntity; current:boolean; targetable:boolean; selected:boolean; onClick():void}) {
  const classes=["play-v09-actor",entity.side==="enemy"?"hostile":"ally",current?"current":"",targetable?"targetable":"",selected?"target-selected":""].filter(Boolean).join(" ");
  return <button type="button" className={classes} onClick={onClick} aria-pressed={selected||undefined}>
    <span className="play-v09-actor-avatar">{entity.name.slice(0,1)}</span>
    <span className="play-v09-actor-copy"><strong>{entity.name}</strong><small>{entity.kind==="character"?"Character":"Combatant"}{entity.status.length?` · ${entity.status.join(" · ")}`:""}</small><span>HP {entity.hp}/{entity.maxHp}</span></span>
  </button>;
}

export function ProductionPlayScreen({role}:{role:"player"|"dm"}) {
  const {snapshot,resolveAction,selectDmActor,startInitiative,endInitiative,endTurn}=useSimpleVtt();
  const [tab,setTab]=useState<HotbarTab>("common");
  const [intent,setIntent]=useState<PlayIntentId|null>(null);
  const [chosen,setChosen]=useState<ActionVm|null>(null);
  const [multiTargets,setMultiTargets]=useState<string[]>([]);
  if (!snapshot) return null;

  const scene=snapshot.scene;
  const dm=role==="dm";
  const isCombat=snapshot.sessionMode==="initiative";
  const actor=dm
    ? scene.entities.find((entity)=>entity.id===scene.selectedActorId)??scene.entities[0]
    : scene.entities.find((entity)=>entity.id===(isCombat?scene.currentActorId:snapshot.activeCharacter.id))??scene.entities.find((entity)=>entity.id===snapshot.activeCharacter.id);

  if (!actor) return <div className="screen play-redesign-screen"><div className="play-redesign-empty"><span className="eyebrow accent">PLAY</span><h1>{snapshot.session.name||scene.name}</h1><p>{dm?"Encounter가 비어 있습니다. 세션 또는 Combatants에서 참가자를 추가하세요.":"플레이할 Character가 아직 장면에 없습니다."}</p></div></div>;

  const actions=scene.actionsByActor[actor.id]??[];
  const currentActor=scene.entities.find((entity)=>entity.id===scene.currentActorId);
  const economy=scene.economyByActor[actor.id];
  const selectedIntent=intent?OFFICIAL_PLAY_INTENTS.find((item)=>item.id===intent)??null:null;
  const options=intent?intentOptions(intent,actions):[];
  const orderedInitiative=[...scene.entities].sort((a,b)=>b.initiative-a.initiative);
  const sceneActors=scene.entities.filter((entity)=>entity.kind==="combatant");
  const partyActors=scene.entities.filter((entity)=>entity.kind==="character");
  const canPlayerEndTurn=!dm&&isCombat&&scene.currentActorId===snapshot.activeCharacter.id;
  const canEndTurn=isCombat&&(dm||canPlayerEndTurn);

  const mappedIntentActionIds=new Set(OFFICIAL_PLAY_INTENTS.flatMap((entry)=>intentOptions(entry.id,actions).map((action)=>action.id)));
  const itemActions=actions.filter((action)=>Boolean(action.itemCost));
  const spellActions=actions.filter((action)=>action.category==="magic"&&!action.itemCost);
  const classActions=actions.filter((action)=>action.category!=="magic"&&!action.itemCost&&!mappedIntentActionIds.has(action.id));

  const closeFlow=()=>{setIntent(null);setChosen(null);setMultiTargets([]);};
  const selectActor=async(entityId:string)=>{closeFlow();await selectDmActor(entityId);};
  const chooseIntent=(id:PlayIntentId)=>{setIntent((current)=>current===id?null:id);setChosen(null);setMultiTargets([]);};
  const chooseOption=async(action:ActionVm)=>{
    if (!action.available) return;
    setIntent(null);
    if (action.target==="none") { await resolveAction(action.id,[]); closeFlow(); return; }
    if (action.target==="self") { await resolveAction(action.id,[actor.id]); closeFlow(); return; }
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
  const sceneActorClick=async(entity:SceneEntity)=>{
    if (chosen&&chosen.eligibleTargetIds.includes(entity.id)) { await chooseTarget(entity); return; }
    if (dm) await selectActor(entity.id);
  };
  const completeMulti=async()=>{if(chosen&&multiTargets.length){await resolveAction(chosen.id,multiTargets);closeFlow();}};
  const finishTurn=async()=>{if(!canEndTurn)return;closeFlow();await endTurn();};

  const renderIntentButton=(id:PlayIntentId)=>{
    const item=OFFICIAL_PLAY_INTENTS.find((entry)=>entry.id===id)!;
    const availableOptions=intentOptions(id,actions);
    const unavailable=availableOptions.length===0;
    return <button type="button" key={id} className={`play-v09-action-icon ${intent===id?"selected":""}`} aria-label={item.label} aria-pressed={intent===id} aria-disabled={unavailable} onClick={()=>{if(!unavailable)chooseIntent(id);}}>
      <ActionGlyph kind={id}/><span className="visually-hidden">{item.label}</span><IntentTooltip intent={item} options={availableOptions}/>
    </button>;
  };
  const renderActionButton=(action:ActionVm)=> <button type="button" key={action.id} className={`play-v09-action-icon ${chosen?.id===action.id?"selected":""}`} aria-label={skillFactByActionId(action.id)?.name??action.name} aria-disabled={!action.available} onClick={()=>{if(action.available)void chooseOption(action);}}>
    <ActionGlyph kind={actionIconKind(action)}/><span className="visually-hidden">{skillFactByActionId(action.id)?.name??action.name}</span><ActionTooltip action={action}/>
  </button>;
  const renderGroup=(label:string,content:React.ReactNode,empty=false)=> <section className="play-v09-hot-group" key={label}><span className="play-v09-group-label">{label}</span><div className={`play-v09-icon-grid ${empty?"empty":""}`}>{empty?<span>현재 capability 없음</span>:content}</div></section>;

  const commonGroups=[
    renderGroup("기본 행동",BASIC_INTENTS.map(renderIntentButton)),
    renderGroup("상황 행동",SITUATIONAL_INTENTS.map(renderIntentButton)),
    renderGroup("클래스 · 특성",classActions.length?classActions.map(renderActionButton):null,!classActions.length),
    renderGroup("주문",<>{renderIntentButton("magic")}{spellActions.map(renderActionButton)}</>),
    renderGroup("아이템",itemActions.length?itemActions.map(renderActionButton):null,!itemActions.length),
  ];
  const tabGroups = tab==="common"?commonGroups
    : tab==="class"?[renderGroup("클래스 · 특성",classActions.length?classActions.map(renderActionButton):null,!classActions.length)]
    : tab==="spells"?[renderGroup("주문",spellActions.length?spellActions.map(renderActionButton):null,!spellActions.length)]
    : tab==="items"?[renderGroup("아이템",itemActions.length?itemActions.map(renderActionButton):null,!itemActions.length)]
    : [renderGroup(tab==="passives"?"패시브":"커스텀",null,true)];

  return <div className={`screen play-redesign-screen play-v09-screen ${isCombat?"combat-mode":"exploration-mode"}`}>
    <header className="play-redesign-header play-v09-header">
      <div><span className="eyebrow accent">{isCombat?"COMBAT":"FREEFORM"}</span><h1>{snapshot.session.name||scene.name}</h1><p>{isCombat?`${scene.round}라운드 · ${currentActor?.name??"턴 대기"}`:"탐험 · 대화 · 자유 행동"}</p></div>
      <div className="play-redesign-header-actions">
        {snapshot.session.role!=="offline"&&<span className={`play-v09-connection ${snapshot.connectionState}`}>{snapshot.connectionState==="connected"?"연결됨":snapshot.connectionState==="reconnecting"?"재연결 중":"연결 끊김"}</span>}
        {dm&&<select aria-label="행동할 Actor" value={actor.id} onChange={(event)=>void selectActor(event.target.value)}>{scene.entities.map((entity)=><option key={entity.id} value={entity.id}>{entity.name}</option>)}</select>}
        {dm&&!isCombat&&<button className="primary" onClick={()=>{closeFlow();void startInitiative();}}>이니셔티브 시작</button>}
        {dm&&isCombat&&<button onClick={()=>{closeFlow();void endInitiative();}}>전투 종료</button>}
      </div>
    </header>

    <section className={`play-v09-initiative ${isCombat?"active":"quiet"}`} aria-label="이니셔티브 순서">
      {isCombat?orderedInitiative.map((entity)=><button type="button" key={entity.id} className={entity.id===scene.currentActorId?"current":""} onClick={()=>{if(dm)void selectActor(entity.id);}} aria-current={entity.id===scene.currentActorId?"true":undefined}>
        <span className="play-v09-init-avatar">{entity.name.slice(0,1)}</span><span><strong>{entity.name}</strong><small>{entity.status.length?entity.status.join(" · "):entity.kind==="character"?"Character":"Combatant"}</small></span><b>{entity.initiative}</b>
      </button>):<span>이니셔티브가 시작되면 이 영역 하나에 전체 순서를 표시합니다.</span>}
    </section>

    <main className="play-v09-stage" aria-label="Scene Actors">
      <div className="play-v09-stage-label"><span>SCENE ACTORS</span><small>NPC · Combatant 상단 / Player · Party 하단</small></div>
      <div className="play-v09-scene-row upper" aria-label="NPC와 Combatant">
        {sceneActors.length?sceneActors.map((entity)=><ActorCard key={entity.id} entity={entity} current={entity.id===scene.currentActorId||entity.id===actor.id} targetable={Boolean(chosen?.eligibleTargetIds.includes(entity.id))} selected={multiTargets.includes(entity.id)} onClick={()=>void sceneActorClick(entity)}/>):<span className="play-v09-scene-empty">장면의 NPC 또는 Combatant가 여기에 표시됩니다.</span>}
      </div>
      <div className="play-v09-scene-focus" aria-live="polite">
        {chosen?<><strong>{chosen.name}</strong><span>{chosen.target==="multi-enemy"?`대상을 최대 ${chosen.maxTargets??"여러"}명 선택하세요.`:"장면에서 대상을 선택하세요."}</span></>:<><strong>{actor.name}</strong><span>{isCombat?"행동 HUD에서 capability를 선택하세요.":"자유 진행 · 행동 HUD에서 필요한 행동을 선택하세요."}</span></>}
      </div>
      <div className="play-v09-scene-row lower" aria-label="Player와 Party">
        {partyActors.length?partyActors.map((entity)=><ActorCard key={entity.id} entity={entity} current={entity.id===scene.currentActorId||entity.id===actor.id} targetable={Boolean(chosen?.eligibleTargetIds.includes(entity.id))} selected={multiTargets.includes(entity.id)} onClick={()=>void sceneActorClick(entity)}/>):<span className="play-v09-scene-empty">Player Character가 장면에 없습니다.</span>}
      </div>
    </main>

    <section className="play-v09-hud" aria-label="행동 HUD">
      <aside className="play-v09-active-actor">
        <div className="play-v09-portrait">{actor.name.slice(0,1)}</div>
        <div className="play-v09-actor-hud-copy"><div><strong>{actor.name}</strong><small>{actor.kind==="character"?"Character":"Combatant"}</small></div><span>{entitySummary(actor)}</span><div className="play-v09-hp"><i style={{width:`${Math.max(0,Math.min(100,actor.maxHp?actor.hp/actor.maxHp*100:0))}%`}}/></div>
          <div className="play-v09-resource-rail" aria-label="자원과 행동 경제">
            <span>행동 <b>{isCombat?(economy?.action?"●":"—"):"FREE"}</b></span>
            <span>보너스 <b>{isCombat?(economy?.bonusAction?"●":"—"):"FREE"}</b></span>
            <span>반응 <b>{isCombat?(economy?.reaction?"●":"—"):"FREE"}</b></span>
            <span>이동 <b>{isCombat&&economy?`${economy.movement}/${economy.movementMax}`:"FREE"}</b></span>
          </div>
        </div>
      </aside>

      <div className="play-v09-hotbar">
        <nav className="play-v09-tabs" aria-label="행동 카테고리">{HOTBAR_TABS.map((item)=><button type="button" key={item.id} className={tab===item.id?"active":""} aria-pressed={tab===item.id} onClick={()=>{setTab(item.id);closeFlow();}}>{item.label}</button>)}</nav>
        <div className="play-v09-context" aria-live="polite">
          {chosen?<><span><strong>{chosen.name}</strong> · {chosen.target==="multi-enemy"?`${multiTargets.length}/${chosen.maxTargets??"여러"}명 선택됨`:"Scene Actor를 대상으로 선택"}</span>{chosen.target==="multi-enemy"&&<button className="primary" aria-disabled={!multiTargets.length} onClick={()=>{if(multiTargets.length)void completeMulti();}}>선택한 대상으로 판정</button>}<button onClick={closeFlow}>취소</button></>
          :selectedIntent?<><span><strong>{selectedIntent.label}</strong> · {selectedIntent.summary}</span><div className="play-v09-option-strip">{options.map((action)=><button type="button" key={action.id} aria-disabled={!action.available} onClick={()=>{if(action.available)void chooseOption(action);}}><strong>{skillFactByActionId(action.id)?.name??action.name}</strong><small>{optionMeta(action)}</small>{!action.available&&<em>{action.disabledReason||"사용 불가"}</em>}</button>)}</div><button onClick={closeFlow}>닫기</button></>
          :<span>아이콘에 마우스를 올리거나 키보드 포커스를 두면 행동의 비용·대상·판정·효과를 확인할 수 있습니다.</span>}
        </div>
        <div className="play-v09-hot-groups">{tabGroups}</div>
      </div>

      <aside className="play-v09-turn-control">
        <button type="button" className="play-v09-cancel" onClick={closeFlow} aria-disabled={!intent&&!chosen}>행동 취소</button>
        <button type="button" className="play-v09-end-turn" aria-disabled={!canEndTurn} onClick={()=>void finishTurn()}><strong>{dm?"다음 턴":"턴 종료"}</strong><small>{isCombat?(canEndTurn?"END TURN":"현재 종료할 수 없음"):"프리폼에는 턴 없음"}</small></button>
      </aside>
    </section>
  </div>;
}

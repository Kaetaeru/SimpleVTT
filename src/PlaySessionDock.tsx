import { useMemo, useState } from "react";
import type { ActionVm, SceneEntity } from "./app/contracts";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { selectProductionCharacter, startProductionLocalPlay } from "./app/productionPlayRuntimeAdapter";

type PlayTab="actions"|"skills"|"spells"|"inventory";

const TAB_LABEL:Record<PlayTab,string>={actions:"행동",skills:"기술",spells:"주문",inventory:"인벤토리"};

function signed(value:number|undefined) {
  if (value===undefined) return "—";
  return value>=0?`+${value}`:`${value}`;
}

function actionGroup(action:ActionVm):PlayTab {
  if (action.id.startsWith("action.skill.")) return "skills";
  if (action.category==="magic"&&!action.itemCost) return "spells";
  return "actions";
}

export function PlaySessionDock() {
  const {
    snapshot,
    refresh,
    resolveAction,
    toggleItemEquipped,
    toggleItemAttunement,
    useItem,
  }=useSimpleVtt();
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<PlayTab>("actions");
  const [pendingActionId,setPendingActionId]=useState<string|null>(null);

  if (!snapshot) return null;
  const character=snapshot.activeCharacter;
  const scene=snapshot.scene;
  const actor=scene.entities.find((entity)=>entity.id===character.id);
  const actions=scene.actionsByActor[character.id]??[];
  const pending=actions.find((action)=>action.id===pendingActionId)??null;
  const targets=pending?scene.entities.filter((entity)=>pending.eligibleTargetIds.includes(entity.id)):[];

  const counts=useMemo(()=>({
    actions:actions.filter((action)=>actionGroup(action)==="actions").length,
    skills:actions.filter((action)=>actionGroup(action)==="skills").length,
    spells:actions.filter((action)=>actionGroup(action)==="spells").length,
    inventory:character.items.length,
  }),[actions,character.items.length]);

  const chooseCharacter=async(id:string)=>{
    await selectProductionCharacter(mockAdapter,id);
    await refresh();
    setPendingActionId(null);
  };
  const startLocal=async()=>{
    await startProductionLocalPlay(mockAdapter,"player");
    await refresh();
    setOpen(true);
  };
  const trigger=async(action:ActionVm)=>{
    if (!action.available) return;
    if (action.target==="none") {
      setPendingActionId(null);
      await resolveAction(action.id,[]);
      return;
    }
    if (action.target==="self") {
      setPendingActionId(null);
      await resolveAction(action.id,[character.id]);
      return;
    }
    setPendingActionId(action.id);
  };
  const chooseTarget=async(entity:SceneEntity)=>{
    if (!pending||!pending.eligibleTargetIds.includes(entity.id)) return;
    setPendingActionId(null);
    await resolveAction(pending.id,[entity.id]);
  };

  if (!open) return <button type="button" className="play-dock-launcher" onClick={()=>setOpen(true)} aria-label="플레이 도구 열기"><b>▶</b><span>플레이</span></button>;

  return <aside className="play-dock" aria-label="세션 플레이 도구">
    <header className="play-dock-head">
      <div>
        <span className="eyebrow accent">PRODUCTION PLAY</span>
        <strong>{character.name}</strong>
        <small>{character.className} {character.level} · HP {character.hp}/{character.maxHp} · AC {character.ac}</small>
      </div>
      <div className="play-dock-head-actions">
        <span className={`play-session-state ${snapshot.connectionState}`}>{snapshot.session.role==="offline"?"LOCAL":snapshot.session.role.toUpperCase()} · {snapshot.sessionMode==="initiative"?`R${scene.round}`:"FREE"}</span>
        <button type="button" onClick={()=>setOpen(false)} aria-label="플레이 도구 닫기">×</button>
      </div>
    </header>

    <section className="play-dock-session-strip">
      <div className="play-character-switcher" aria-label="플레이 캐릭터 선택">
        {snapshot.characters.map((entry)=><button type="button" key={entry.id} className={entry.id===character.id?"active":""} onClick={()=>void chooseCharacter(entry.id)}><strong>{entry.name}</strong><small>{entry.className} {entry.level}</small></button>)}
      </div>
      <button type="button" className="primary" onClick={()=>void startLocal()}>로컬 플레이 시작</button>
    </section>

    {!actor&&<div className="play-empty-state"><strong>플레이 Actor를 준비하는 중입니다.</strong><span>선택한 Character를 production Scene으로 투영합니다.</span></div>}

    <nav className="play-dock-tabs" aria-label="플레이 카테고리">
      {(Object.keys(TAB_LABEL) as PlayTab[]).map((id)=><button type="button" key={id} className={tab===id?"active":""} onClick={()=>{setTab(id);setPendingActionId(null);}}><span>{TAB_LABEL[id]}</span><b>{counts[id]}</b></button>)}
    </nav>

    <div className="play-dock-body">
      {tab!=="inventory"&&<ActionSurface actions={actions.filter((action)=>actionGroup(action)===tab)} pendingId={pendingActionId} onTrigger={trigger}/>} 
      {tab==="inventory"&&<InventorySurface actions={actions} onResolve={trigger} onQuickUse={useItem} onEquip={toggleItemEquipped} onAttune={toggleItemAttunement} />}
      {pending&&<div className="play-target-picker"><div><strong>{pending.name}</strong><span>대상을 선택하세요.</span></div>{targets.length?targets.map((entity)=><button type="button" key={entity.id} onClick={()=>void chooseTarget(entity)}><span>{entity.name}</span><small>HP {entity.hp}/{entity.maxHp} · AC {entity.ac}</small></button>):<p>현재 유효한 대상이 없습니다.</p>}<button type="button" onClick={()=>setPendingActionId(null)}>취소</button></div>}
    </div>

    <footer className="play-dock-footer">
      <span>{scene.name}</span>
      <span>{actor?`Actor ${actor.name}`:"Actor 없음"}</span>
      <span>{snapshot.resolution?`판정 · ${snapshot.resolution.actionName}`:"판정 대기"}</span>
    </footer>
  </aside>;
}

function ActionSurface({actions,pendingId,onTrigger}:{actions:ActionVm[];pendingId:string|null;onTrigger(action:ActionVm):Promise<void>}) {
  const [hovered,setHovered]=useState<string|null>(null);
  const detail=actions.find((action)=>action.id===hovered)??null;
  if (!actions.length) return <div className="play-empty-state"><strong>사용 가능한 항목이 없습니다.</strong><span>현재 Character source/runtime에서 이 카테고리의 행동을 찾지 못했습니다.</span></div>;
  return <div className="play-action-surface">
    <div className="play-action-grid">{actions.map((action)=><button type="button" key={action.id} disabled={!action.available} className={pendingId===action.id?"selected":""} onMouseEnter={()=>setHovered(action.id)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(action.id)} onClick={()=>void onTrigger(action)}><b>{action.name}</b><span>{action.summary}</span><small>{action.economy}{action.checkBonus!==undefined?` · ${signed(action.checkBonus)}`:""}</small>{!action.available&&<em>{action.disabledReason??"현재 사용할 수 없습니다."}</em>}</button>)}</div>
    {detail&&<article className="play-action-detail"><strong>{detail.name}</strong><p>{detail.summary}</p>{detail.details.map((row,index)=><div key={`${row.label}-${index}`}><span>{row.label}</span><b>{row.value}</b>{row.source&&<small>{row.source}</small>}</div>)}</article>}
  </div>;
}

function InventorySurface({actions,onResolve,onQuickUse,onEquip,onAttune}:{actions:ActionVm[];onResolve(action:ActionVm):Promise<void>;onQuickUse(itemId:string):Promise<void>;onEquip(itemId:string):Promise<void>;onAttune(itemId:string):Promise<void>}) {
  const { snapshot }=useSimpleVtt();
  const character=snapshot!.activeCharacter;
  if (!character.items.length) return <div className="play-empty-state"><strong>인벤토리가 비어 있습니다.</strong><span>Character 장비/아이템을 추가하면 세션 중 바로 사용할 수 있습니다.</span></div>;
  return <div className="play-inventory-list">{character.items.map((item)=>{
    const itemAction=actions.find((action)=>action.itemCost?.itemId===item.id);
    return <article key={item.id} className="play-item-card"><div className="play-item-main"><div><strong>{item.name}</strong><small>{item.nameEn??item.definitionId}</small></div><div className="play-item-badges"><span>×{item.quantity}</span>{item.equipped&&<span>장착</span>}{item.attuned&&<span>조율</span>}{item.charges&&<span>{item.charges.current}/{item.charges.max} 충전</span>}</div></div>{item.passiveEffects.length>0&&<p>{item.passiveEffects.join(" · ")}</p>}<div className="play-item-actions">{itemAction?<button type="button" className="primary" disabled={!itemAction.available} onClick={()=>void onResolve(itemAction)}>세션에서 사용</button>:<button type="button" disabled={item.kind==="equipment"} onClick={()=>void onQuickUse(item.id)}>빠른 사용</button>}<button type="button" onClick={()=>void onEquip(item.id)}>{item.equipped?"장착 해제":"장착"}</button>{item.attunementRequired&&<button type="button" onClick={()=>void onAttune(item.id)}>{item.attuned?"조율 해제":"조율"}</button>}</div><details><summary>출처 / 상세</summary>{item.provenance.map((source)=><p key={source}>{source}</p>)}</details></article>;
  })}</div>;
}

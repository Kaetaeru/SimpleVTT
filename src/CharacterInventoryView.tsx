import { useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, ItemInstanceVm } from "./app/contracts";
import type { CharacterSheetHostMode } from "./CharacterSheetPlayScreen";
import "./character-inventory.css";

type InventoryGroupId="active"|"consumable"|"stored";
type InventoryGroup={id:InventoryGroupId;label:string;description:string;items:ItemInstanceVm[]};

const KIND_LABEL:Record<ItemInstanceVm["kind"],string>={equipment:"장비",consumable:"소모품",magic:"마법 아이템"};
const KIND_GLYPH:Record<ItemInstanceVm["kind"],string>={equipment:"◇",consumable:"✦",magic:"◆"};

function handLabel(item:ItemInstanceVm) {
  if (item.wieldSlot==="main-hand") return "주무기";
  if (item.wieldSlot==="off-hand") return "보조손";
  if (item.wieldSlot==="two-hand") return "양손";
  return item.wielded?"손에 듦":null;
}

function itemSummary(item:ItemInstanceVm) {
  if (item.passiveEffects.length) return item.passiveEffects.join(" · ");
  if (item.grantedActionIds.length) return "플레이에서 실행 가능한 아이템 기능을 제공합니다.";
  return "추가 기계 효과가 기록되지 않은 소유 아이템입니다.";
}

function InventoryItem({item,actions,pending,onEquip,onAttune}:{
  item:ItemInstanceVm; actions:ActionVm[]; pending:boolean;
  onEquip():Promise<void>; onAttune():Promise<void>;
}) {
  const [open,setOpen]=useState(false);
  const granted=actions.filter((action)=>item.grantedActionIds.includes(action.id));
  const hand=handLabel(item);
  return <article className="character-inventory-item" data-item-kind={item.kind} data-item-equipped={item.equipped}>
    <button type="button" className="character-inventory-item-main" aria-expanded={open} onClick={()=>setOpen((current)=>!current)}>
      <span className="character-inventory-glyph" aria-hidden="true">{KIND_GLYPH[item.kind]}</span>
      <span className="character-inventory-copy"><strong>{item.name}</strong><small>{item.nameEn??item.definitionId}</small><span>{itemSummary(item)}</span></span>
      <span className="character-inventory-state">
        {item.quantity>1&&<b>×{item.quantity}</b>}
        {item.charges&&<b>{item.charges.current}/{item.charges.max} 충전</b>}
        {item.equipped&&<i>장착</i>}{hand&&<i>{hand}</i>}{item.attuned&&<i>조율</i>}
      </span>
      <span className="character-inventory-disclosure" aria-hidden="true">{open?"−":"＋"}</span>
    </button>
    {open&&<div className="character-inventory-detail">
      <div className="character-inventory-facts">
        <span><small>종류</small><strong>{KIND_LABEL[item.kind]}</strong></span>
        <span><small>수량</small><strong>{item.quantity}</strong></span>
        <span><small>활성 상태</small><strong>{item.equipped?hand??"장착됨":"보관 중"}</strong></span>
        {item.charges&&<span><small>충전</small><strong>{item.charges.current}/{item.charges.max}</strong></span>}
      </div>
      {granted.length>0&&<section className="character-inventory-actions"><small>플레이 기능</small>{granted.map((action)=><div key={action.id}><span><strong>{action.name}</strong><small>{action.summary}</small></span><b data-available={action.available}>{action.available?"Item 탭 사용 가능":action.disabledReason??"현재 사용 불가"}</b></div>)}</section>}
      <section className="character-inventory-provenance"><small>출처 / 근거</small>{item.provenance.map((source)=><span key={source}>{source}</span>)}</section>
      <div className="character-inventory-operations">
        {item.kind!=="consumable"&&<button type="button" disabled={pending} onClick={()=>void onEquip()}>{pending?"…":item.equipped?"장착 해제":"장착"}</button>}
        {item.attunementRequired&&<button type="button" disabled={pending} onClick={()=>void onAttune()}>{pending?"…":item.attuned?"조율 해제":"조율"}</button>}
        {granted.length>0&&<span>실제 사용과 수량·충전 소비는 세션 Item 행동에서 한 번에 처리됩니다.</span>}
      </div>
    </div>}
  </article>;
}

export function CharacterInventoryView({hostMode}:{hostMode:CharacterSheetHostMode}) {
  const {snapshot,toggleItemEquipped,toggleItemAttunement}=useSimpleVtt();
  const [pendingItemId,setPendingItemId]=useState<string|null>(null);
  const character=snapshot?.activeCharacter;
  const actions=character&&snapshot?snapshot.scene.actionsByActor[character.id]??[]:[];
  const groups=useMemo<InventoryGroup[]>(()=>{
    const items=character?.items??[];
    const active=items.filter((item)=>item.equipped||item.wielded||item.attuned);
    const consumable=items.filter((item)=>!active.includes(item)&&item.kind==="consumable");
    const stored=items.filter((item)=>!active.includes(item)&&!consumable.includes(item));
    return [
      {id:"active",label:"장착 / 활성",description:"현재 파생값이나 플레이 기능에 관여하는 아이템",items:active},
      {id:"consumable",label:"소모품",description:"수량과 원자적 사용 경로가 있는 아이템",items:consumable},
      {id:"stored",label:"보관 중",description:"현재 장착하지 않은 기타 소유 아이템",items:stored},
    ];
  },[character?.items]);
  if (!snapshot||!character) return null;

  const change=async(itemId:string,operation:()=>Promise<void>)=>{
    if(pendingItemId)return;
    setPendingItemId(itemId);
    try { await operation(); } finally { setPendingItemId(null); }
  };
  const attuned=character.items.filter((item)=>item.attuned).length;
  const totalQuantity=character.items.reduce((sum,item)=>sum+item.quantity,0);
  const executable=character.items.filter((item)=>item.grantedActionIds.length>0).length;

  return <section className="character-inventory-view" data-sheet-host={hostMode} aria-label={`${character.name} 인벤토리`}>
    <header className="character-inventory-heading">
      <div><span className="eyebrow accent">CHARACTER · MANAGE</span><h1>인벤토리</h1><p>소유·장착·조율·수량·충전을 관리합니다. 실행 가능한 아이템만 세션 Command Center에 투영됩니다.</p></div>
      <div className="character-inventory-summary" aria-label="인벤토리 요약">
        <span><small>보유 항목</small><strong>{character.items.length}</strong><i>총 수량 {totalQuantity}</i></span>
        <span><small>금화</small><strong>{character.goldGp??0}</strong><i>GP</i></span>
        <span><small>조율</small><strong>{attuned}</strong><i>현재 조율</i></span>
        <span><small>플레이 투영</small><strong>{executable}</strong><i>아이템 기능</i></span>
      </div>
    </header>

    <div className="character-inventory-groups">
      {groups.map((group)=><section className="character-inventory-group" key={group.id} data-inventory-group={group.id}>
        <header><span><strong>{group.label}</strong><small>{group.description}</small></span><b>{group.items.length}</b></header>
        <div>{group.items.map((item)=><InventoryItem key={item.id} item={item} actions={actions} pending={pendingItemId===item.id} onEquip={()=>change(item.id,()=>toggleItemEquipped(item.id))} onAttune={()=>change(item.id,()=>toggleItemAttunement(item.id))}/>)}{!group.items.length&&<p className="character-inventory-empty">이 그룹에 표시할 아이템이 없습니다.</p>}</div>
      </section>)}
    </div>

    <aside className="character-inventory-boundary" aria-label="아직 연결되지 않은 인벤토리 계약">
      <strong>다음 권위 계약 대기</strong><span>무게·운반 한도</span><span>컨테이너 이동</span><span>스택 분할/병합</span><span>캐릭터 간 전달</span><span>파티 보관함</span>
    </aside>
  </section>;
}

import { useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CatalogEntry, DmInventoryAdjustmentCommand, ItemInstanceVm, PartyStashTransferCommand } from "./app/contracts";
import "./session-inventory-pane.css";

const requestId=()=>globalThis.crypto?.randomUUID?.()??`dm-inventory.${Date.now()}.${Math.random()}`;

function PaneHeader({ eyebrow,title,onClose,action }:{eyebrow:string;title:string;onClose():void;action?:React.ReactNode}) {
  return <header className="session-inventory-head">
    <div><span>{eyebrow}</span><strong>{title}</strong></div>
    <div>{action}<button type="button" aria-label={`${title} 닫기`} onClick={onClose}>×</button></div>
  </header>;
}

function itemState(item:ItemInstanceVm) {
  const states=[];
  if (item.equipped) states.push("장착");
  if (item.wielded) states.push("손에 듦");
  if (item.attuned) states.push("조율");
  if (item.charges) states.push(`충전 ${item.charges.current}/${item.charges.max}`);
  return states.join(" · ")||"보관 중";
}

function catalogItemForDefinition(catalog:CatalogEntry[],definitionId:string) {
  const legacyAliases:Record<string,string>={
    "item.chain-mail":"dnd.srd521.item.armor.chain-mail",
    "item.shield":"dnd.srd521.item.shield",
    "item.potion-of-healing":"dnd.srd521.item.gear.potion-of-healing",
  };
  const compatibleDefinitionId=legacyAliases[definitionId]??definitionId;
  return catalog.find((entry)=>entry.category==="item"&&(entry.contentId===compatibleDefinitionId||entry.id===compatibleDefinitionId));
}

export function SessionPlayerInventoryPane({onClose,onOpenFull}:{onClose():void;onOpenFull(button:HTMLButtonElement):void}) {
  const {snapshot}=useSimpleVtt();
  if (!snapshot) return null;
  const character=snapshot.activeCharacter;
  const stash=snapshot.campaignSessionSystems?.partyStash;
  return <aside className="session-inventory-pane" aria-label={`${character.name} 세션 인벤토리`}>
    <PaneHeader eyebrow="MY CHARACTER" title="내 인벤토리" onClose={onClose} action={<button type="button" className="quiet" onClick={(event)=>onOpenFull(event.currentTarget)}>전체 시트</button>}/>
    <section className="session-inventory-owner">
      <div><strong>{character.name}</strong><span>{character.className} {character.level}레벨</span></div>
      <b>{character.goldGp??0}<small> GP</small></b>
    </section>
    <section className="session-inventory-section">
      <div className="session-inventory-section-title"><strong>소지품 {character.items.length}</strong><span>세션의 캐릭터 원본에서 읽는 현재 상태입니다.</span></div>
      <div className="session-owned-item-list">
        {character.items.map((item)=><article key={item.id}>
          <div><strong>{item.name}</strong><small>{item.nameEn||item.kind} · {itemState(item)}</small></div>
          <b>×{item.quantity}</b>
        </article>)}
        {!character.items.length&&<p className="session-inventory-empty">소지한 아이템이 없습니다.</p>}
      </div>
    </section>
    {stash&&<section className="session-inventory-section session-party-stash-view">
      <div className="session-inventory-section-title"><strong>파티 보관함</strong><span>DM 승인형 공유 자산 · 이 화면에서는 확인만 가능합니다.</span></div>
      <div className="session-party-stash-wallet"><span>공유 재화</span><strong>{stash.wallet.gp} GP</strong></div>
      <div className="session-owned-item-list">
        {stash.itemReferences.map((item)=>{const entry=catalogItemForDefinition(snapshot.catalog,item.definitionId);return <article key={item.instanceId}><div><strong>{entry?.nameKo??item.definitionId}</strong><small>{entry?.source??"캠페인 공유 보관함"}</small></div><b>×{item.quantity}</b></article>;})}
        {!stash.itemReferences.length&&<p className="session-inventory-empty">파티 보관함에 아이템이 없습니다.</p>}
      </div>
    </section>}
  </aside>;
}

function sourceLabel(entry:CatalogEntry) {
  if (entry.scope==="local") return "커스텀";
  if (entry.scope==="session") return "세션";
  return entry.source.includes("SRD") ? "SRD" : "룰북";
}

export function SessionDmInventoryPane({onClose}:{onClose():void}) {
  const {snapshot,selectDmActor,adjustDmInventory,undoLastDmInventoryAdjustment,transferPartyStash}=useSimpleVtt();
  const [query,setQuery]=useState("");
  const [quantity,setQuantity]=useState(1);
  const [gold,setGold]=useState(10);
  const [pending,setPending]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<{kind:"success"|"error";message:string;undo?:boolean}|null>(null);
  if (!snapshot) return null;

  const characters=snapshot.scene.entities.filter((entity)=>entity.kind==="character"&&entity.side==="ally");
  const selected=characters.find((entity)=>entity.id===snapshot.scene.selectedActorId)??characters[0]??null;
  const inventory=selected ? snapshot.sessionCharacterInventories?.[selected.id] : undefined;
  const campaign=snapshot.campaignSessionSystems;
  const stash=campaign?.partyStash;
  const normalized=query.trim().toLocaleLowerCase("ko-KR");
  const catalogItems=useMemo(()=>snapshot.catalog
    .filter((entry)=>entry.category==="item")
    .filter((entry)=>!normalized||`${entry.nameKo} ${entry.nameEn} ${entry.source}`.toLocaleLowerCase("ko-KR").includes(normalized))
    .sort((left,right)=>(left.scope==="local"?-1:0)-(right.scope==="local"?-1:0)||left.nameKo.localeCompare(right.nameKo,"ko-KR"))
    .slice(0,40),[normalized,snapshot.catalog]);

  const run=async(key:string,command:DmInventoryAdjustmentCommand,success:string)=>{
    if (pending) return;
    setPending(key);setFeedback(null);
    try {
      await adjustDmInventory(command);
      setFeedback({kind:"success",message:success,undo:true});
    } catch(error) {
      setFeedback({kind:"error",message:error instanceof Error?error.message:"소지품을 변경하지 못했습니다."});
    } finally { setPending(null); }
  };

  const runStash=async(key:string,command:PartyStashTransferCommand,success:string)=>{
    if (pending) return;
    setPending(key);setFeedback(null);
    try {
      await transferPartyStash(command);
      setFeedback({kind:"success",message:success});
    } catch(error) {
      setFeedback({kind:"error",message:error instanceof Error?error.message:"파티 보관함을 변경하지 못했습니다."});
    } finally { setPending(null); }
  };

  const undo=async()=>{
    if (pending) return;
    setPending("undo");
    try { await undoLastDmInventoryAdjustment();setFeedback({kind:"success",message:"직전 지급·회수를 되돌렸습니다."}); }
    catch(error) { setFeedback({kind:"error",message:error instanceof Error?error.message:"실행 취소에 실패했습니다."}); }
    finally { setPending(null); }
  };

  return <aside className="session-inventory-pane dm" aria-label="DM 아이템과 재화 지급 및 회수">
    <PaneHeader eyebrow="DM QUICK GIVE" title="아이템 · 재화" onClose={onClose}/>
    <section className="session-inventory-targets" aria-label="대상 플레이어">
      {characters.map((character)=><button type="button" key={character.id} className={character.id===selected?.id?"active":""} disabled={Boolean(pending)} onClick={()=>void selectDmActor(character.id)}>
        <span>{character.name.slice(0,2)}</span><strong>{character.name}</strong>
      </button>)}
    </section>

    {!selected||!inventory ? <p className="session-inventory-empty">아이템을 관리할 플레이어 캐릭터를 선택해 주세요.</p> : <>
      <section className="session-inventory-wallet">
        <div><span>{selected.name} 보유 재화</span><strong>{inventory.goldGp} GP</strong></div>
        <input type="number" min="1" step="1" value={gold} aria-label="변경할 GP" onChange={(event)=>setGold(Math.max(1,Math.floor(Number(event.target.value)||1)))}/>
        <button type="button" className="primary" disabled={Boolean(pending)} onClick={()=>void run("gold+",{requestId:requestId(),actorId:selected.id,operation:"grant-currency",amount:gold},`${selected.name}에게 ${gold} GP를 지급했습니다.`)}>지급</button>
        <button type="button" disabled={Boolean(pending||inventory.goldGp<gold)} onClick={()=>void run("gold-",{requestId:requestId(),actorId:selected.id,operation:"revoke-currency",amount:gold},`${selected.name}에게서 ${gold} GP를 회수했습니다.`)}>회수</button>
      </section>

      {feedback&&<div className={`session-inventory-feedback ${feedback.kind}`} role="status"><span>{feedback.message}</span>{feedback.undo&&<button type="button" disabled={Boolean(pending)} onClick={()=>void undo()}>실행 취소</button>}</div>}

      {campaign&&stash&&<section className="session-inventory-section session-party-stash-manage">
        <div className="session-inventory-section-title"><strong>파티 보관함</strong><span>{selected.name}과 캠페인 공유 자산을 바로 이동합니다.</span></div>
        <div className="session-party-stash-transfer">
          <div><span>캐릭터</span><strong>{inventory.goldGp} GP</strong></div>
          <div><span>보관함</span><strong>{stash.wallet.gp} GP</strong></div>
          <input type="number" min="1" step="1" value={gold} aria-label="보관함 이동 GP" onChange={(event)=>setGold(Math.max(1,Math.floor(Number(event.target.value)||1)))}/>
          <div className="session-party-stash-wallet-actions">
            <button type="button" disabled={Boolean(pending||inventory.goldGp<gold)} onClick={()=>void runStash("stash-gold-in",{requestId:requestId(),campaignId:campaign.campaignId,actorId:selected.id,direction:"character-to-stash",asset:"currency",amount:gold},selected.name+"의 "+gold+" GP를 파티 보관함으로 옮겼습니다.")}>보관함으로</button>
            <button type="button" className="primary" disabled={Boolean(pending||stash.wallet.gp<gold)} onClick={()=>void runStash("stash-gold-out",{requestId:requestId(),campaignId:campaign.campaignId,actorId:selected.id,direction:"stash-to-character",asset:"currency",amount:gold},"파티 보관함에서 "+selected.name+"에게 "+gold+" GP를 옮겼습니다.")}>캐릭터에게</button>
          </div>
        </div>
        <div className="session-owned-item-list manage session-party-stash-items">
          {stash.itemReferences.map((item)=>{const entry=catalogItemForDefinition(snapshot.catalog,item.definitionId);return <article key={item.instanceId}>
            <div><strong>{entry?.nameKo??item.definitionId}</strong><small>{entry?.source??"캠페인 공유 보관함"}</small></div><b>×{item.quantity}</b>
            <button type="button" className="primary" disabled={Boolean(pending||!entry)} title={entry?"선택 캐릭터에게 1개 이동":"활성 카탈로그에서 원본 아이템을 찾을 수 없습니다."} onClick={()=>entry&&void runStash("stash-out:"+item.instanceId,{requestId:requestId(),campaignId:campaign.campaignId,actorId:selected.id,direction:"stash-to-character",asset:"item",definitionId:item.definitionId,catalogEntryId:entry.id,quantity:1},"파티 보관함에서 "+selected.name+"에게 "+(entry.nameKo||item.definitionId)+" 1개를 옮겼습니다.")}>지급</button>
          </article>;})}
          {!stash.itemReferences.length&&<p className="session-inventory-empty">파티 보관함에 아이템이 없습니다. 아래 소지품에서 먼저 옮겨보세요.</p>}
        </div>
      </section>}

      <section className="session-inventory-section">
        <div className="session-inventory-section-title"><strong>빠른 지급</strong><span>룰북 모듈과 커스텀 아이템을 함께 검색합니다.</span></div>
        <div className="session-inventory-search">
          <input autoFocus value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="아이템 이름 또는 출처 검색" aria-label="지급할 아이템 검색"/>
          <label>수량<input type="number" min="1" max="99" value={quantity} onChange={(event)=>setQuantity(Math.max(1,Math.min(99,Math.floor(Number(event.target.value)||1))))}/></label>
        </div>
        <div className="session-catalog-item-list">
          {catalogItems.map((entry)=><article key={entry.id}>
            <div><strong>{entry.nameKo}</strong><small>{entry.nameEn} · {entry.source}</small></div>
            <span className={`source ${entry.scope}`}>{sourceLabel(entry)}</span>
            <button type="button" className="primary" disabled={Boolean(pending)} aria-label={`${entry.nameKo} ${quantity}개 지급`} onClick={()=>void run(`give:${entry.id}`,{requestId:requestId(),actorId:selected.id,operation:"grant-item",catalogEntryId:entry.id,quantity},`${selected.name}에게 ${entry.nameKo} ${quantity}개를 지급했습니다.`)}>{pending===`give:${entry.id}`?"…":`+${quantity}`}</button>
          </article>)}
          {!catalogItems.length&&<p className="session-inventory-empty">일치하는 활성 아이템이 없습니다.</p>}
        </div>
      </section>

      <section className="session-inventory-section">
        <div className="session-inventory-section-title"><strong>{selected.name} 소지품</strong><span>한 번에 1개씩 빠르게 회수합니다.</span></div>
        <div className="session-owned-item-list manage">
          {inventory.items.map((item)=>{
            const active=Boolean(item.equipped||item.wielded||item.attuned);
            return <article key={item.id}>
              <div><strong>{item.name}</strong><small>{itemState(item)} · {item.provenance[0]||"출처 없음"}</small></div>
              <b>×{item.quantity}</b>
              {campaign&&stash&&<button type="button" className="stash" disabled={Boolean(pending)} aria-label={`${item.name} 1개 파티 보관함으로 이동`} title={active?"장착·조율을 해제하고 파티 보관함으로 옮깁니다.":"파티 보관함으로 1개 이동"} onClick={()=>void runStash("stash-in:"+item.id,{requestId:requestId(),campaignId:campaign.campaignId,actorId:selected.id,direction:"character-to-stash",asset:"item",itemId:item.id,definitionId:item.definitionId,quantity:1,forceUnequip:active},selected.name+"의 "+item.name+" 1개를 파티 보관함으로 옮겼습니다.")}>보관함</button>}
              <button type="button" disabled={Boolean(pending)} aria-label={`${item.name} 1개 회수`} title={active?"장착·조율을 해제하고 1개 회수합니다.":"1개 회수"} onClick={()=>void run(`take:${item.id}`,{requestId:requestId(),actorId:selected.id,operation:"revoke-item",itemId:item.id,quantity:1,forceUnequip:active},`${selected.name}에게서 ${item.name} 1개를 회수했습니다.`)}>{pending===`take:${item.id}`?"…":active?"해제·−1":"−1"}</button>
            </article>;
          })}
          {!inventory.items.length&&<p className="session-inventory-empty">소지한 아이템이 없습니다.</p>}
        </div>
      </section>
    </>}
  </aside>;
}

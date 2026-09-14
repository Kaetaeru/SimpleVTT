import { useState } from "react";
import type { AppSnapshot, CatalogEntry } from "../../app/contracts";
import { weaponRuleById } from "../../domain/weaponRuleCatalog";
import type { ActorSpec, TableCommand } from "../commands";
import { blankNpc, bundleEntry, bundleFromActors, bundleSpecs, itemEntry, npcFromSrd, npcsFromJson, presetFromSheet, type HostLibrary, type LibraryEntry, type LibraryItemSpec } from "../library";
import { startDrag } from "./drag";
import { monsterListings } from "./model";
import { useHostLibrary } from "./useHostLibrary";

/**
 * Library panels shared by the session sidebar (액터·아이템) and the 준비실 (same lists, full width, no table).
 * Every list is the same three lines: search · + 추가 · items with verbs; rows are draggable.
 */
export interface LibraryPanelProps { library?:HostLibrary; mode:"session"|"prep"; snapshot?:AppSnapshot; dispatch?(command:TableCommand):Promise<unknown>; onFeedback?(message:string):void }

const CREATURE_KO:Record<string,string>={beast:"야수",humanoid:"인간형",undead:"언데드",fiend:"악마",dragon:"용",giant:"거인",monstrosity:"괴물",aberration:"이형",construct:"구조물",elemental:"정령",fey:"요정",celestial:"천상체",ooze:"점액",plant:"식물"};

export function NpcLibrary({library:given,mode,snapshot,dispatch,onFeedback}:LibraryPanelProps) {
  const library=useHostLibrary(given);
  const [query,setQuery]=useState("");
  const [checked,setChecked]=useState<string[]>([]);
  const [count,setCount]=useState(1);
  const [hidden,setHidden]=useState(false);
  const [adding,setAdding]=useState<null|"srd"|"blank"|"json">(null);
  const [editing,setEditing]=useState<string|null>(null);
  const q=query.trim();
  const npcs=library.entries("npc").filter((entry)=>!q||entry.name.includes(q)||entry.tags.some((tag)=>tag.includes(q)));
  const presets=library.entries("preset").filter((entry)=>!q||entry.name.includes(q));
  const bundles=library.entries("bundle").filter((entry)=>!q||entry.name.includes(q));
  const srd=mode==="session"||q?monsterListings(q,q?40:12):[];
  const summon=async(specs:ActorSpec[])=>{ if(!dispatch||!specs.length) return; const outcome=await dispatch({type:"add-actors",specs}) as {status:string}; if(outcome.status==="committed") onFeedback?.(`${specs.length}종 소환`); };
  const summonEntry=(entry:LibraryEntry,n=count)=>{
    if(entry.kind==="npc"&&entry.npc) void summon([{kind:"npc",definition:entry.npc,count:n,...(hidden?{hidden:true}:{})}]);
    if(entry.kind==="preset"&&entry.preset) { const sheet=structuredClone(entry.preset); sheet.id=`${sheet.id}.preset.${Date.now().toString(36)}`; void summon([{kind:"character",sheet,side:"ally"}]); }
    if(entry.kind==="bundle"&&entry.bundle) { void summon(bundleSpecs(library,entry.bundle)); if(entry.bundle.sceneName&&dispatch) void dispatch({type:"scene",name:entry.bundle.sceneName,conditions:entry.bundle.conditions}); }
    library.touch(entry.id);
  };
  const cloneChecked=()=>{ for(const monsterId of checked) npcFromSrd(library,monsterId); onFeedback?.(`${checked.length}종을 내 NPC로 복제`); setChecked([]); setAdding(null); };
  const saveTable=()=>{
    if(!snapshot) return;
    const actors=(snapshot.scene.entities.filter((entity)=>entity.tableKind==="npc").map((entity)=>({source:{kind:"monster",definitionId:entity.runtimeArtifactId??entity.id.replace(/\.instance-\d+$/,"")},side:entity.side,hidden:entity.hidden})));
    const byDefinition=Object.fromEntries(library.entries("npc").flatMap((entry)=>entry.npc?[[entry.npc.id,entry.id]]:[]));
    const name=window.prompt("장면 묶음 이름",snapshot.scene.sceneName||"새 장면")??"";
    if(!name.trim()) return;
    bundleEntry(library,name,{actors:bundleFromActors(actors,byDefinition),noteIds:[],sceneName:name.trim()});
    onFeedback?.(`장면 묶음 저장: ${name}`);
  };
  const row=(entry:LibraryEntry)=>{
    const summary=entry.kind==="npc"?`AC ${entry.npc?.ac} · HP ${entry.npc?.maxHp}${entry.tags[0]?` · ${CREATURE_KO[entry.tags[0]]??entry.tags[0]}`:""}`:entry.kind==="preset"?`${entry.preset?.className} ${entry.preset?.level}레벨 · PC 프리셋`:`${entry.bundle?.actors.reduce((sum,actor)=>sum+actor.count,0)??0}명${entry.bundle?.sceneName?` · 장면 ${entry.bundle.sceneName}`:""}`;
    return <div key={entry.id} className="tw-list-item" role="listitem" draggable onDragStart={(event)=>startDrag(event,entry.kind==="npc"?{kind:"npc",entryId:entry.id,count}:entry.kind==="preset"?{kind:"preset",entryId:entry.id}:{kind:"bundle",entryId:entry.id})}>
      <button type="button" className={`quiet sm tw-star ${entry.favorite?"on":""}`} aria-label="즐겨찾기" onClick={()=>library.toggleFavorite(entry.id)}>{entry.favorite?"★":"☆"}</button>
      <div className="tw-grow"><strong>{entry.name}</strong><small>{summary}</small></div>
      <span className="tw-verbs">
        {mode==="session"&&<button type="button" className="primary" onClick={()=>summonEntry(entry,entry.kind==="npc"?1:count)}>소환</button>}
        {mode==="session"&&entry.kind==="npc"&&count>1&&<button type="button" onClick={()=>summonEntry(entry,count)}>×{count}</button>}
        {entry.kind==="npc"&&<button type="button" onClick={()=>setEditing(editing===entry.id?null:entry.id)}>편집</button>}
        {entry.kind==="npc"&&<button type="button" onClick={()=>{ if(entry.npc) library.upsert({...entry,id:library.nextId("npc",`${entry.name} 사본`),name:`${entry.name} 사본`,npc:{...entry.npc,id:library.nextId("npc",`${entry.name} 사본`),name:`${entry.name} 사본`}}); }}>복제</button>}
        <button type="button" className="quiet" onClick={()=>{ if(window.confirm(`${entry.name}을(를) 라이브러리에서 삭제할까요?`)) library.remove(entry.id); }}>삭제</button>
      </span>
    </div>;
  };
  return <>
    <div className="tw-tabhead">
      <input type="search" value={query} placeholder="내 NPC · 묶음 · SRD 329종 검색" aria-label="액터 검색" onChange={(event)=>setQuery(event.target.value)}/>
      {mode==="session"&&<input type="number" min={1} max={20} value={count} aria-label="소환 수" onChange={(event)=>setCount(Math.max(1,Number(event.target.value)))}/>}
      <button type="button" className={adding?"active":""} onClick={()=>setAdding(adding?null:"srd")}>+ 추가</button>
    </div>
    <div className="tw-tabbody">
      {adding&&<div className="tw-form" role="group" aria-label="액터 추가">
        <div className="tw-seg"><button type="button" className={adding==="srd"?"active":""} onClick={()=>setAdding("srd")}>SRD에서 복제</button><button type="button" className={adding==="blank"?"active":""} onClick={()=>setAdding("blank")}>빈 NPC</button><button type="button" className={adding==="json"?"active":""} onClick={()=>setAdding("json")}>JSON</button>{snapshot&&<button type="button" onClick={()=>{ presetFromSheet(library,snapshot.activeCharacter); onFeedback?.(`PC 프리셋 저장: ${snapshot.activeCharacter.name}`); setAdding(null); }}>현재 캐릭터를 프리셋으로</button>}</div>
        {adding==="srd"&&<div className="tw-line"><span style={{color:"var(--muted)"}}>아래 SRD 목록에서 체크한 뒤</span><button type="button" className="primary" disabled={!checked.length} onClick={cloneChecked}>내 NPC로 복제 ({checked.length})</button></div>}
        {adding==="blank"&&<BlankNpcForm onSave={(input)=>{ try { blankNpc(library,input); onFeedback?.(`내 NPC 추가: ${input.name}`); setAdding(null); } catch(error) { onFeedback?.(error instanceof Error?error.message:String(error)); } }}/>}
        {adding==="json"&&<JsonForm placeholder='[{"name":"광신도","ac":12,"hp":9}]' onSave={(text)=>{ try { const made=npcsFromJson(library,text); onFeedback?.(`JSON에서 ${made.length}종 추가`); setAdding(null); } catch(error) { onFeedback?.(error instanceof Error?error.message:String(error)); } }}/>}
      </div>}
      {mode==="session"&&snapshot&&snapshot.scene.entities.some((entity)=>entity.tableKind==="npc")&&<button type="button" className="quiet sm" style={{alignSelf:"flex-end"}} onClick={saveTable}>현재 테이블을 묶음으로 저장</button>}
      <div className="tw-section">내 NPC · 프리셋 {npcs.length+presets.length>0&&<span>{npcs.length+presets.length}</span>}</div>
      {npcs.length+presets.length===0&&<div className="tw-empty">아직 내 NPC가 없습니다.<br/><button type="button" onClick={()=>setAdding("srd")}>+ 추가</button></div>}
      {[...npcs,...presets].map((entry)=><div key={entry.id}>{row(entry)}{editing===entry.id&&entry.npc&&<NpcEditor entry={entry} onSave={(patch)=>{ library.upsert({...entry,name:patch.name,npc:{...entry.npc!,name:patch.name,ac:patch.ac,maxHp:patch.maxHp}}); setEditing(null); }} onCancel={()=>setEditing(null)}/>}</div>)}
      <div className="tw-section">장면 묶음 {bundles.length>0&&<span>{bundles.length}</span>}</div>
      {bundles.length===0&&<div className="tw-empty">묶음이 없습니다. {mode==="session"?"테이블을 차린 뒤 '현재 테이블을 묶음으로 저장'하세요.":"세션에서 테이블을 차린 뒤 저장하거나, 여기서 만드세요."}</div>}
      {bundles.map(row)}
      {mode==="prep"&&<BundleComposer library={library} onFeedback={onFeedback}/>}
      {srd.length>0&&<>
        <div className="tw-section">SRD 몬스터 {q?"":"· 자주 쓰는 것"}</div>
        {mode==="session"&&<label className="tw-checkrow"><input type="checkbox" checked={hidden} onChange={(event)=>setHidden(event.target.checked)}/>숨긴 채 소환</label>}
        {srd.map((monster)=><div key={monster.id} className={`tw-list-item ${checked.includes(monster.id)?"selected":""}`} role="listitem" draggable onDragStart={(event)=>startDrag(event,{kind:"monster",monsterId:monster.id,count})}>
          <input type="checkbox" aria-label={`${monster.name} 선택`} checked={checked.includes(monster.id)} onChange={(event)=>setChecked(event.target.checked?[...checked,monster.id]:checked.filter((id)=>id!==monster.id))}/>
          <div className="tw-grow"><strong>{monster.name}</strong><small>CR {monster.cr} · HP {monster.hp} · AC {monster.ac} · {CREATURE_KO[monster.type]??monster.type}</small></div>
          <span className="tw-verbs">{mode==="session"?<><button type="button" onClick={()=>void summon([{kind:"monster",monsterId:monster.id,count:1,...(hidden?{hidden:true}:{})}])}>소환</button>{count>1&&<button type="button" onClick={()=>void summon([{kind:"monster",monsterId:monster.id,count,...(hidden?{hidden:true}:{})}])}>×{count}</button>}</>:<button type="button" onClick={()=>{ npcFromSrd(library,monster.id); onFeedback?.(`내 NPC로 복제: ${monster.name}`); }}>내 NPC로</button>}</span>
        </div>)}
        {mode==="session"&&checked.length>0&&<div className="tw-line"><button type="button" className="primary" onClick={()=>void summon(checked.map((monsterId)=>({kind:"monster" as const,monsterId,count,...(hidden?{hidden:true}:{})}))).then(()=>setChecked([]))}>체크한 {checked.length}종 소환 ×{count}</button><button type="button" onClick={cloneChecked}>내 NPC로 복제</button></div>}
      </>}
      {q&&srd.length===0&&npcs.length+presets.length+bundles.length===0&&<div className="tw-empty">일치하는 항목이 없습니다.</div>}
    </div>
  </>;
}

function BlankNpcForm({onSave}:{onSave(input:{name:string;ac:number;maxHp:number;attacks:Array<{name:string;bonus:number;dice:string;flat:number;type:string}>}):void}) {
  const [name,setName]=useState(""); const [ac,setAc]=useState(12); const [maxHp,setMaxHp]=useState(11); const [attack,setAttack]=useState("");
  const parse=(text:string)=>{ const match=/^(.+?)\s+([+-]?\d+)\s+(\d+d\d+)(?:\s*([+-]\s*\d+))?\s*(\S+)?$/.exec(text.trim()); return match?[{name:match[1],bonus:Number(match[2]),dice:match[3],flat:match[4]?Number(match[4].replace(/\s/g,"")):0,type:match[5]??"타격"}]:[]; };
  return <div className="tw-line">
    <input type="text" value={name} placeholder="이름" aria-label="NPC 이름" onChange={(event)=>setName(event.target.value)}/>
    <input type="number" value={ac} aria-label="AC" onChange={(event)=>setAc(Number(event.target.value))}/><span>AC</span>
    <input type="number" value={maxHp} aria-label="HP" onChange={(event)=>setMaxHp(Number(event.target.value))}/><span>HP</span>
    <input type="text" value={attack} placeholder="공격: 창 +3 1d6+1 관통" aria-label="공격" onChange={(event)=>setAttack(event.target.value)}/>
    <button type="button" className="primary" disabled={!name.trim()} onClick={()=>onSave({name,ac,maxHp,attacks:parse(attack)})}>저장</button>
  </div>;
}

function JsonForm({placeholder,onSave}:{placeholder:string;onSave(text:string):void}) {
  const [text,setText]=useState("");
  return <div className="tw-line" style={{alignItems:"stretch"}}><textarea value={text} placeholder={placeholder} aria-label="JSON" rows={4} style={{flex:1,minWidth:200,height:"auto",padding:8}} onChange={(event)=>setText(event.target.value)}/><button type="button" className="primary" disabled={!text.trim()} onClick={()=>onSave(text)}>가져오기</button></div>;
}

function NpcEditor({entry,onSave,onCancel}:{entry:LibraryEntry;onSave(patch:{name:string;ac:number;maxHp:number}):void;onCancel():void}) {
  const [name,setName]=useState(entry.name); const [ac,setAc]=useState(entry.npc?.ac??10); const [maxHp,setMaxHp]=useState(entry.npc?.maxHp??1);
  return <div className="tw-form"><div className="tw-line"><input type="text" value={name} aria-label="이름" onChange={(event)=>setName(event.target.value)}/><input type="number" value={ac} aria-label="AC" onChange={(event)=>setAc(Number(event.target.value))}/><span>AC</span><input type="number" value={maxHp} aria-label="HP" onChange={(event)=>setMaxHp(Number(event.target.value))}/><span>HP</span><button type="button" className="primary" onClick={()=>onSave({name,ac,maxHp})}>저장</button><button type="button" className="quiet" onClick={onCancel}>취소</button></div></div>;
}

/** 준비실: compose a bundle from library NPCs and SRD monsters without a table. */
function BundleComposer({library,onFeedback}:{library:HostLibrary;onFeedback?(message:string):void}) {
  const [name,setName]=useState(""); const [rows,setRows]=useState<Array<{ref:string;count:number;hidden:boolean}>>([]); const [pick,setPick]=useState(""); const [srdQuery,setSrdQuery]=useState("");
  const npcs=library.entries("npc");
  const options=[...npcs.map((entry)=>({ref:`entry:${entry.id}`,label:`내 NPC · ${entry.name}`})),...monsterListings(srdQuery,srdQuery?20:8).map((monster)=>({ref:`srd:${monster.id}`,label:`SRD · ${monster.name}`}))];
  const label=(ref:string)=>options.find((option)=>option.ref===ref)?.label??ref;
  return <div className="tw-form" role="group" aria-label="장면 묶음 만들기">
    <div className="tw-line"><input type="text" value={name} placeholder="묶음 이름" aria-label="묶음 이름" style={{flex:1}} onChange={(event)=>setName(event.target.value)}/></div>
    <div className="tw-line"><input type="search" value={srdQuery} placeholder="SRD 검색" aria-label="묶음용 SRD 검색" onChange={(event)=>setSrdQuery(event.target.value)}/><select value={pick} aria-label="묶음에 넣을 액터" onChange={(event)=>setPick(event.target.value)}><option value="">액터…</option>{options.map((option)=><option key={option.ref} value={option.ref}>{option.label}</option>)}</select><button type="button" disabled={!pick} onClick={()=>{ setRows([...rows,{ref:pick,count:1,hidden:false}]); setPick(""); }}>넣기</button></div>
    {rows.map((row,index)=><div key={index} className="tw-line"><span style={{flex:1}}>{label(row.ref)}</span><input type="number" min={1} value={row.count} aria-label="수" onChange={(event)=>setRows(rows.map((entry,i)=>i===index?{...entry,count:Math.max(1,Number(event.target.value))}:entry))}/><label className="tw-checkrow"><input type="checkbox" checked={row.hidden} onChange={(event)=>setRows(rows.map((entry,i)=>i===index?{...entry,hidden:event.target.checked}:entry))}/>숨김</label><button type="button" className="quiet sm" onClick={()=>setRows(rows.filter((_,i)=>i!==index))}>빼기</button></div>)}
    <div className="tw-line"><button type="button" className="primary" disabled={!name.trim()||!rows.length} onClick={()=>{ bundleEntry(library,name,{actors:rows.map((row)=>row.ref.startsWith("entry:")?{entryId:row.ref.slice(6),count:row.count,hidden:row.hidden}:{monsterId:row.ref.slice(4),count:row.count,hidden:row.hidden}),noteIds:[],sceneName:name.trim()}); onFeedback?.(`장면 묶음 저장: ${name}`); setName(""); setRows([]); }}>묶음 저장</button></div>
  </div>;
}

function itemKindOf(entry:CatalogEntry):"equipment"|"consumable"|"magic" {
  if(/potion|scroll|ammunition|ration|torch|oil/i.test(entry.id)) return "consumable";
  return "equipment";
}

/** 아이템: my items and the SRD catalog; 지급 to the selected character, drag onto a token, keep as my item. */
export function ItemLibrary({library:given,mode,snapshot,dispatch,onFeedback,targetId}:LibraryPanelProps&{targetId?:string|null}) {
  const library=useHostLibrary(given);
  const [query,setQuery]=useState("");
  const [adding,setAdding]=useState(false);
  const q=query.trim().toLowerCase();
  const mine=library.entries("item").filter((entry)=>!q||entry.name.toLowerCase().includes(q));
  const catalog=(snapshot?.catalog??[]).filter((entry)=>entry.category==="item"&&(q?`${entry.nameKo} ${entry.nameEn}`.toLowerCase().includes(q):true)).slice(0,q?40:12);
  const target=targetId&&snapshot?snapshot.scene.entities.find((entity)=>entity.id===targetId&&entity.tableKind==="character"):undefined;
  const grant=(item:LibraryItemSpec)=>{ if(!dispatch||!target) { onFeedback?.("지급할 캐릭터 토큰을 먼저 선택하세요."); return; } void dispatch({type:"grant-item",actorId:target.id,item}); };
  const specOf=(entry:CatalogEntry):LibraryItemSpec=>({definitionId:entry.id,name:entry.nameKo,nameEn:entry.nameEn,kind:itemKindOf(entry),quantity:1});
  return <>
    <div className="tw-tabhead">
      <input type="search" value={query} placeholder="내 아이템 · SRD 아이템 검색" aria-label="아이템 검색" onChange={(event)=>setQuery(event.target.value)}/>
      <button type="button" className={adding?"active":""} onClick={()=>setAdding(!adding)}>+ 추가</button>
    </div>
    <div className="tw-tabbody">
      {adding&&<div className="tw-form" role="group" aria-label="아이템 추가"><CustomItemForm onSave={(item)=>{ itemEntry(library,item); onFeedback?.(`내 아이템 추가: ${item.name}`); setAdding(false); }}/></div>}
      {mode==="session"&&<div className="tw-kv"><span>지급 대상 <strong>{target?target.name:"캐릭터 토큰을 선택"}</strong></span></div>}
      <div className="tw-section">내 아이템 {mine.length>0&&<span>{mine.length}</span>}</div>
      {mine.length===0&&<div className="tw-empty">아직 내 아이템이 없습니다. SRD 항목을 "내 아이템으로" 두거나 + 추가로 만드세요.</div>}
      {mine.map((entry)=><div key={entry.id} className="tw-list-item" role="listitem" draggable onDragStart={(event)=>entry.item&&startDrag(event,{kind:"item",entryId:entry.id,definitionId:entry.item.definitionId,name:entry.item.name,itemKind:entry.item.kind,quantity:entry.item.quantity})}>
        <div className="tw-grow"><strong>{entry.name}{(entry.item?.quantity??1)>1?` ×${entry.item?.quantity}`:""}</strong><small>{entry.item?.kind==="consumable"?"소모품":entry.item?.kind==="magic"?"마법 물건":"장비"}{weaponRuleById(entry.item?.definitionId??"")?" · 무기":""}</small></div>
        <span className="tw-verbs">{mode==="session"&&<button type="button" className="primary" disabled={!target} onClick={()=>entry.item&&grant(entry.item)}>지급</button>}<button type="button" className="quiet" onClick={()=>library.remove(entry.id)}>삭제</button></span>
      </div>)}
      <div className="tw-section">SRD 아이템 {q?"":"· 일부"}</div>
      {catalog.map((entry)=><div key={entry.id} className="tw-list-item" role="listitem" draggable onDragStart={(event)=>startDrag(event,{kind:"item",definitionId:entry.id,name:entry.nameKo,itemKind:itemKindOf(entry),quantity:1})}>
        <div className="tw-grow"><strong>{entry.nameKo}</strong><small>{entry.nameEn}{weaponRuleById(entry.id)?" · 무기":""}</small></div>
        <span className="tw-verbs">{mode==="session"&&<button type="button" disabled={!target} onClick={()=>grant(specOf(entry))}>지급</button>}<button type="button" onClick={()=>{ itemEntry(library,specOf(entry)); onFeedback?.(`내 아이템으로: ${entry.nameKo}`); }}>내 아이템으로</button></span>
      </div>)}
      {q&&catalog.length===0&&mine.length===0&&<div className="tw-empty">일치하는 아이템이 없습니다.</div>}
    </div>
  </>;
}

function CustomItemForm({onSave}:{onSave(item:LibraryItemSpec):void}) {
  const [name,setName]=useState(""); const [kind,setKind]=useState<"equipment"|"consumable"|"magic">("equipment"); const [quantity,setQuantity]=useState(1);
  return <div className="tw-line"><input type="text" value={name} placeholder="이름 (예: 낡은 열쇠)" aria-label="아이템 이름" onChange={(event)=>setName(event.target.value)}/><select value={kind} aria-label="종류" onChange={(event)=>setKind(event.target.value as typeof kind)}><option value="equipment">장비</option><option value="consumable">소모품</option><option value="magic">마법 물건</option></select><input type="number" min={1} value={quantity} aria-label="수량" onChange={(event)=>setQuantity(Math.max(1,Number(event.target.value)))}/><button type="button" className="primary" disabled={!name.trim()} onClick={()=>onSave({definitionId:`custom.item.${name.trim().toLowerCase().replace(/\s+/g,"-")}`,name:name.trim(),kind,quantity})}>저장</button></div>;
}

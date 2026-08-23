import { useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CampaignDmLibraryEntry, CampaignRecordV1 } from "./app/campaignPersistenceContracts";
import "./app/campaignDmLibraryOrganizationContracts";
import "./app/campaignDmLibraryOrganizationRuntimeAdapter";
import { mockAdapter } from "./app/mockAdapter";

function localId(prefix:string){return `${prefix}.${globalThis.crypto?.randomUUID?.()??`${Date.now()}.${Math.floor(Math.random()*1_000_000)}`}`;}
function csv(value:string){return [...new Set(value.split(",").map((item)=>item.trim()).filter(Boolean))];}

export function CampaignDmLibraryOrganizationPanel({campaign}:{campaign:CampaignRecordV1}){
  const api=useSimpleVtt();
  const folders=campaign.dmLibrary.folders??[];
  const [folderName,setFolderName]=useState("");
  const [folderFilter,setFolderFilter]=useState("all");
  const [presetName,setPresetName]=useState("");
  const [presetLevel,setPresetLevel]=useState("1");
  const [presetAc,setPresetAc]=useState("12");
  const [presetHp,setPresetHp]=useState("10");
  const [presetActions,setPresetActions]=useState("기본 공격");
  const [presetTags,setPresetTags]=useState("");
  const [presetFolder,setPresetFolder]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const perform=async(operation:()=>Promise<void>)=>{setBusy(true);setError(null);try{await operation();await api.refresh();}catch(reason){setError(reason instanceof Error?reason.message:"DM 라이브러리 작업을 완료하지 못했습니다.");}finally{setBusy(false);}};
  const createFolder=()=>perform(async()=>{
    const label=folderName.trim();if(!label)throw new Error("폴더 이름을 입력하세요.");
    await mockAdapter.upsertCampaignDmLibraryFolder(campaign.campaignId,{folderId:localId("dm-folder"),label});
    setFolderName("");
  });
  const removeFolder=(folderId:string)=>perform(async()=>{
    await mockAdapter.removeCampaignDmLibraryFolder(campaign.campaignId,folderId);
    if(folderFilter===folderId)setFolderFilter("all");
    if(presetFolder===folderId)setPresetFolder("");
  });
  const moveEntry=(entry:CampaignDmLibraryEntry,folderId:string)=>perform(()=>api.upsertCampaignDmLibraryEntry(campaign.campaignId,{...entry,folderId:folderId||undefined}));
  const createPreset=()=>perform(async()=>{
    const name=presetName.trim();if(!name)throw new Error("PC preset 이름을 입력하세요.");
    const level=Number(presetLevel),ac=Number(presetAc),maxHp=Number(presetHp);
    if(!Number.isInteger(level)||level<1||level>20)throw new Error("레벨은 1~20 정수여야 합니다.");
    if(!Number.isInteger(ac)||ac<0||!Number.isInteger(maxHp)||maxHp<1)throw new Error("AC와 최대 HP를 확인하세요.");
    const entryId=localId("dm-pc-preset");
    const definitionId=`local.${campaign.campaignId}.pc-preset.${entryId}`;
    await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{
      entryId,kind:"pc-preset",label:name,definitionId,folderId:presetFolder||undefined,favorite:false,tags:csv(presetTags),
      pcPreset:{definitionId,name,level,ac,maxHp,actions:csv(presetActions),statusImmunities:[],source:`Campaign DM Library · ${campaign.name}`,version:"1"},
    });
    setPresetName("");setPresetLevel("1");setPresetAc("12");setPresetHp("10");setPresetActions("기본 공격");setPresetTags("");
  });

  const visibleEntries=useMemo(()=>campaign.dmLibrary.entries.filter((entry)=>folderFilter==="all"?true:folderFilter==="root"?!entry.folderId:entry.folderId===folderFilter),[campaign.dmLibrary.entries,folderFilter]);
  const presets=visibleEntries.filter((entry)=>entry.kind==="pc-preset"&&entry.pcPreset);

  return <section className="campaign-capability-note" aria-label="DM 라이브러리 PC preset과 폴더">
    <span>DM LIBRARY ORGANIZATION</span><strong>PC Preset · 폴더</strong>
    <p>PC preset은 Campaign이 소유하는 DM용 Actor template입니다. Player Character 파일을 복사하거나 소유권을 가져오지 않습니다.</p>

    <div className="campaign-identity-lock"><span>폴더</span><strong>{folders.length}개 · 항목 {campaign.dmLibrary.entries.length}개</strong><small>폴더를 삭제해도 항목은 삭제되지 않고 최상위로 이동합니다.</small></div>
    <label><span>새 폴더</span><input value={folderName} disabled={busy} onChange={(event)=>setFolderName(event.target.value)} placeholder="예: 아군 NPC / 다음 세션"/></label>
    <button type="button" disabled={busy||!folderName.trim()} onClick={()=>void createFolder()}>폴더 추가</button>
    {folders.length>0&&<div className="campaign-option-list">{folders.map((folder)=><label key={folder.folderId}><span><strong>{folder.label}</strong><small>{campaign.dmLibrary.entries.filter((entry)=>entry.folderId===folder.folderId).length}개 항목</small></span><button type="button" disabled={busy} onClick={()=>void removeFolder(folder.folderId)}>폴더 제거</button></label>)}</div>}

    <label><span>정리 보기</span><select value={folderFilter} disabled={busy} onChange={(event)=>setFolderFilter(event.target.value)}><option value="all">전체</option><option value="root">최상위</option>{folders.map((folder)=><option key={folder.folderId} value={folder.folderId}>{folder.label}</option>)}</select></label>
    {visibleEntries.length>0&&<div className="campaign-option-list">{visibleEntries.map((entry)=><label key={entry.entryId}><span><strong>{entry.label}</strong><small>{entry.kind} · {entry.folderId?folders.find((folder)=>folder.folderId===entry.folderId)?.label??"알 수 없는 폴더":"최상위"}</small></span><select aria-label={`${entry.label} 폴더`} value={entry.folderId??""} disabled={busy} onChange={(event)=>void moveEntry(entry,event.target.value)}><option value="">최상위</option>{folders.map((folder)=><option key={folder.folderId} value={folder.folderId}>{folder.label}</option>)}</select></label>)}</div>}

    <div className="campaign-identity-lock"><span>PC PRESET</span><strong>DM 제어 Actor를 빠르게 준비</strong><small>Actor +1은 현재 Session/Scene에 Combatant를 materialize하며 Character Library에는 저장하지 않습니다.</small></div>
    <label><span>이름</span><input value={presetName} disabled={busy} onChange={(event)=>setPresetName(event.target.value)} placeholder="예: 호위 기사"/></label>
    <label><span>폴더</span><select value={presetFolder} disabled={busy} onChange={(event)=>setPresetFolder(event.target.value)}><option value="">최상위</option>{folders.map((folder)=><option key={folder.folderId} value={folder.folderId}>{folder.label}</option>)}</select></label>
    <label><span>레벨</span><input type="number" min="1" max="20" value={presetLevel} disabled={busy} onChange={(event)=>setPresetLevel(event.target.value)}/></label>
    <label><span>AC</span><input type="number" min="0" value={presetAc} disabled={busy} onChange={(event)=>setPresetAc(event.target.value)}/></label>
    <label><span>최대 HP</span><input type="number" min="1" value={presetHp} disabled={busy} onChange={(event)=>setPresetHp(event.target.value)}/></label>
    <label><span>행동</span><input value={presetActions} disabled={busy} onChange={(event)=>setPresetActions(event.target.value)} placeholder="쉼표로 구분"/></label>
    <label><span>태그</span><input value={presetTags} disabled={busy} onChange={(event)=>setPresetTags(event.target.value)} placeholder="쉼표로 구분"/></label>
    <button type="button" className="primary" disabled={busy||!presetName.trim()} onClick={()=>void createPreset()}>{busy?"저장 중…":"PC preset 저장"}</button>

    {presets.length>0&&<div className="campaign-option-list">{presets.map((entry)=><label key={entry.entryId}><span><strong>{entry.label}</strong><small>Lv.{entry.pcPreset!.level} · AC {entry.pcPreset!.ac} · HP {entry.pcPreset!.maxHp} · {entry.folderId?folders.find((folder)=>folder.folderId===entry.folderId)?.label??"폴더":"최상위"}</small></span><button type="button" disabled={busy} onClick={()=>void perform(()=>mockAdapter.instantiateCampaignDmLibraryPcPreset(campaign.campaignId,entry.entryId).then(()=>undefined))}>Actor +1</button></label>)}</div>}
    {error&&<div className="campaign-error" role="alert">{error}</div>}
  </section>;
}

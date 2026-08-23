import { useEffect, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CampaignRecordV1 } from "./app/campaignPersistenceContracts";
import "./app/campaignRationConversionRuntimeAdapter";
import type { CampaignRationConversionRuntimePreview } from "./app/campaignRationConversionRuntimeAdapter";
import { mockAdapter } from "./app/mockAdapter";
import { CampaignDmLibraryOrganizationPanel } from "./CampaignDmLibraryOrganizationPanel";
import { CampaignDmLibraryNotePanel } from "./CampaignDmLibraryNotePanel";

function requestId(){return globalThis.crypto?.randomUUID?.()??`campaign.ration-convert.${Date.now()}.${Math.floor(Math.random()*1_000_000)}`;}

export function CampaignRationConversionPanel({campaign}:{campaign:CampaignRecordV1}){
  const api=useSimpleVtt();
  const items=campaign.partyStash.itemReferences;
  const [itemId,setItemId]=useState(items[0]?.instanceId??"");
  const [quantity,setQuantity]=useState(1);
  const [preview,setPreview]=useState<CampaignRationConversionRuntimePreview|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [pending,setPending]=useState(false);

  useEffect(()=>{
    if(!items.some((item)=>item.instanceId===itemId))setItemId(items[0]?.instanceId??"");
    setPreview(null);
  },[campaign.partyStash.revision,itemId,items]);

  const selected=items.find((item)=>item.instanceId===itemId)??null;
  const runPreview=async()=>{
    if(!selected)return;
    setPending(true);setError(null);
    try{
      const next=await mockAdapter.previewCampaignPartyStashRationConversion(campaign.campaignId,{stashItemInstanceId:selected.instanceId,quantity});
      setPreview(next);
    }catch(reason){setPreview(null);setError(reason instanceof Error?reason.message:"식량 전환 미리보기를 만들지 못했습니다.");}
    finally{setPending(false);}
  };
  const commit=async()=>{
    if(!preview)return;
    setPending(true);setError(null);
    try{
      await mockAdapter.convertCampaignPartyStashItemToRations({
        requestId:requestId(),campaignId:campaign.campaignId,providerId:preview.providerId,providerVersion:preview.providerVersion,
        stashItemInstanceId:preview.stashItemInstanceId,quantity:preview.quantity,
      });
      setPreview(null);await api.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"식량 전환을 완료하지 못했습니다.");}
    finally{setPending(false);}
  };

  return <>
    <section className="campaign-capability-note" aria-label="파티 보관함 식량 전환">
      <span>STASH → RATIONS</span><strong>보관함 아이템을 식량 단위로 전환</strong>
      <p>활성 식량 공급자가 선언한 capability와 일치하는 아이템만 전환할 수 있습니다. 이름이나 설명으로 음식 여부를 추측하지 않습니다.</p>
      {!campaign.rations.capability.enabled?<p>식량 규칙을 켜야 전환할 수 있습니다.</p>:!items.length?<p>파티 보관함에 전환할 아이템이 없습니다.</p>:<>
        <label><span>보관함 아이템</span><select value={itemId} disabled={pending} onChange={(event)=>{setItemId(event.target.value);setPreview(null);setError(null);}}>{items.map((item)=><option key={item.instanceId} value={item.instanceId}>{item.itemTemplate?.name??item.definitionId} ×{item.quantity}</option>)}</select></label>
        <label><span>전환 수량</span><input type="number" min="1" max={selected?.quantity??1} step="1" value={quantity} disabled={pending} onChange={(event)=>{setQuantity(Math.max(1,Math.floor(Number(event.target.value)||1)));setPreview(null);setError(null);}}/></label>
        <button type="button" disabled={pending||!selected||quantity>(selected?.quantity??0)} onClick={()=>void runPreview()}>{pending?"확인 중…":"전환 미리보기"}</button>
        {preview&&<div className="campaign-identity-lock" role="status"><span>전환 미리보기</span><strong>{preview.itemName} ×{preview.quantity} → 식량 +{preview.rationUnits}</strong><small>아이템 {preview.stashQuantityBefore} → {preview.stashQuantityAfter} · 1개당 {preview.rationUnitsPerItem}식 · 식량 {preview.rationBalanceBefore} → {preview.rationBalanceAfter} · {preview.providerId}@{preview.providerVersion}</small></div>}
        {preview&&<button type="button" className="primary" disabled={pending} onClick={()=>void commit()}>{pending?"전환 중…":`식량 +${preview.rationUnits} 확정`}</button>}
      </>}
      {error&&<div className="campaign-error" role="alert">{error}</div>}
    </section>
    <CampaignDmLibraryOrganizationPanel campaign={campaign}/>
    <CampaignDmLibraryNotePanel campaign={campaign}/>
  </>;
}

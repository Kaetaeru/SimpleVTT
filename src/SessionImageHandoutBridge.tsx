import { useEffect, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { HANDOUT_IMAGE_MAX_BYTES, LOCAL_IMAGE_ACCEPT, readLocalImageFile, type LocalImageAssetV1 } from "./app/localImageAsset";
import {
  dismissSessionImageHandout,
  getSessionImageHandoutState,
  reopenSessionImageHandout,
  revealSessionImageHandout,
  subscribeSessionImageHandout,
  withdrawSessionImageHandout,
} from "./app/sessionImageHandoutRuntimeAdapter";

const PLAYER_HANDOUT_LAUNCHER_ID = "session-player-handout-launcher";

export function useSessionImageHandout() {
  const [handout, setHandout] = useState(() => getSessionImageHandoutState(mockAdapter));
  useEffect(() => subscribeSessionImageHandout(mockAdapter, setHandout), []);
  return handout;
}

export function dismissCurrentSessionImageHandout() {
  dismissSessionImageHandout(mockAdapter);
  window.requestAnimationFrame(() => document.getElementById(PLAYER_HANDOUT_LAUNCHER_ID)?.focus());
}

function imageLabel(asset: LocalImageAssetV1) {
  return asset.fileName ?? "공유 이미지";
}

function imageSize(asset: LocalImageAssetV1) {
  return `${(asset.byteLength / 1024).toFixed(0)} KiB`;
}

export function SessionDmHandoutPane({ onClose }: { onClose(): void }) {
  const { snapshot, revealCampaignDmLibraryImage } = useSimpleVtt();
  const handout = useSessionImageHandout();
  const [draft, setDraft] = useState<LocalImageAssetV1 | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (!snapshot || snapshot.session.role !== "host") return null;
  const campaignId=snapshot.campaignSessionSnapshot?.campaignId??snapshot.activeCampaignId??null;
  const campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===campaignId);
  const libraryImages=(campaign?.dmLibrary.entries??[]).filter((entry)=>entry.kind==="image"&&entry.imageAsset).sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||a.label.localeCompare(b.label,"ko-KR"));

  const choose = async (file: File | undefined) => {
    if (!file) return;
    try {
      setDraft(await readLocalImageFile(file, HANDOUT_IMAGE_MAX_BYTES));
      setError("");
    } catch (reason) {
      setDraft(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const reveal = async () => {
    if (!draft || pending) return;
    setPending(true);
    try {
      await revealSessionImageHandout(mockAdapter, draft);
      setDraft(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(false);
    }
  };

  const withdraw = async () => {
    if (!handout.asset || pending) return;
    setPending(true);
    try {
      await withdrawSessionImageHandout(mockAdapter);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(false);
    }
  };
  const revealLibrary=async(entryId:string)=>{if(!campaignId||pending)return;setPending(true);try{await revealCampaignDmLibraryImage(campaignId,entryId);setError("");}catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setPending(false);}};

  const preview = draft ?? handout.asset;
  const previewKind = draft ? "공유 전 미리보기" : "현재 플레이어에게 공유 중";

  return <aside className="session-handout-pane" aria-label="DM Handout 도구">
    <header className="session-handout-pane-head">
      <div><span>HANDOUT</span><strong>이미지 보여주기</strong></div>
      <button type="button" autoFocus aria-label="Handout 도구 닫기" onClick={onClose}>×</button>
    </header>

    <div className="session-handout-pane-body">
      <p className="session-handout-copy">로컬 이미지를 미리 본 뒤 현재 세션에 공개합니다. 새로 참가하거나 재연결한 Player에게도 현재 공유 이미지가 복원됩니다.</p>

      {campaign&&<section className="session-handout-library"><strong>캠페인 DM 라이브러리</strong>{libraryImages.length?<div>{libraryImages.map((entry)=><button type="button" key={entry.entryId} disabled={pending} onClick={()=>void revealLibrary(entry.entryId)}><img src={entry.imageAsset!.dataUrl} alt=""/><span>{entry.favorite?"★ ":""}{entry.label}</span></button>)}</div>:<small>저장된 이미지가 없습니다. 캠페인 탭에서 이미지를 추가할 수 있습니다.</small>}</section>}

      <label className="session-handout-file">
        <span>PNG / JPEG / WebP 선택 · 최대 4 MiB</span>
        <input type="file" accept={LOCAL_IMAGE_ACCEPT} disabled={pending} onChange={(event) => void choose(event.target.files?.[0])} />
      </label>

      {preview && <figure className="session-handout-preview">
        <img src={preview.dataUrl} alt={draft ? "공유 전 이미지 미리보기" : "현재 공유 중인 이미지"} />
        <figcaption><strong>{previewKind}</strong><span>{imageLabel(preview)} · {imageSize(preview)}</span></figcaption>
      </figure>}

      {!preview && <div className="session-handout-empty">현재 공유 중인 이미지가 없습니다.</div>}
      {(error || handout.error) && <p className="handout-error" role="status">{error || handout.error}</p>}
    </div>

    <footer className="session-handout-pane-actions">
      {handout.asset && <button type="button" disabled={pending} onClick={() => void withdraw()}>공유 철회</button>}
      <button type="button" className="primary" disabled={!draft || pending} onClick={() => void reveal()}>{pending ? "처리 중…" : "플레이어에게 공개"}</button>
    </footer>
  </aside>;
}

export function SessionPlayerHandoutRailButton() {
  const handout = useSessionImageHandout();
  if (!handout.asset) return null;
  return <button
    id={PLAYER_HANDOUT_LAUNCHER_ID}
    type="button"
    className={!handout.dismissed ? "active" : ""}
    aria-pressed={!handout.dismissed}
    aria-label={handout.dismissed ? "이미지 다시 열기" : "DM 공유 이미지 열림"}
    onClick={() => handout.dismissed ? reopenSessionImageHandout(mockAdapter) : dismissCurrentSessionImageHandout()}
  ><span>자료</span></button>;
}

export function SessionPlayerHandoutViewer() {
  const handout = useSessionImageHandout();
  if (!handout.asset || handout.dismissed) return null;
  return <figure className="session-handout-viewer" aria-label={`DM 공유 이미지 · ${imageLabel(handout.asset)}`}>
    <img src={handout.asset.dataUrl} alt="DM이 공유한 이미지" />
  </figure>;
}

export function SessionDmHandoutPreview() {
  const {snapshot}=useSimpleVtt();
  const handout=useSessionImageHandout();
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  if(snapshot?.session.role!=="host"||!handout.asset)return null;
  const withdraw=async()=>{if(pending)return;setPending(true);setError("");try{await withdrawSessionImageHandout(mockAdapter);}catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setPending(false);}};
  return <aside className="session-dm-handout-preview" aria-label="현재 공유 이미지">
    <img src={handout.asset.dataUrl} alt="현재 공유 중인 이미지 미리보기" />
    <span>{imageLabel(handout.asset)}</span>
    <button type="button" disabled={pending} aria-label="모든 화면에서 이미지 공유 철회" title="공유 철회" onClick={()=>void withdraw()}>×</button>
    {error&&<small role="status">{error}</small>}
  </aside>;
}

export function SessionPlayerHandoutError() {
  const handout = useSessionImageHandout();
  if (!handout.error) return null;
  return <div className="handout-client-error" role="status">{handout.error}</div>;
}

// Compatibility export only. Active-session presentation is owned by SessionModeRoot.
export function SessionImageHandoutBridge() {
  return null;
}

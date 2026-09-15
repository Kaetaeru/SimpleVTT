/**
 * The Art Library tab of the table sidebar (ROLL20_TABLE_SPEC.md §9): uploads (button, drop, paste) into folders,
 * search, rename/move/delete for what you own (the GM: everything), and a picker used by avatar fields. Images are
 * campaign assets referenced as `art:<id>`; bytes arrive from the host on demand and stay cached (CAMPAIGN_RESOURCES.md §3).
 */
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useArtUrl, useCampaigns } from "../app/campaigns";
import type { ArtAsset } from "../campaign/art";
import { artRef, canManageArt } from "../campaign/art";
import { Modal, Notice, Pill } from "../ui/components";

export const ART_DRAG_TYPE = "application/x-simplevtt-art";

function useViewer() {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const role = snapshot.players.find((player) => player.userId === c.userId)?.role ?? "player";
  return { userId: c.userId, role, isGm: role === "gm", snapshot };
}

const formatBytes = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Renders an `art:<id>` reference (or a plain data URL): the thumbnail first, the full image when it has arrived. */
export function ArtImage({ src, className, style, alt = "" }: { src: string | undefined; className?: string; style?: React.CSSProperties; alt?: string }) {
  const art = useArtUrl(src);
  if (art.status === "none") return null;
  if (art.url) return <img className={className} style={style} src={art.url} alt={alt} data-art-status="ready" />;
  if (art.thumb) return <img className={className} style={{ ...style, filter: art.status === "loading" ? "blur(1px)" : undefined }} src={art.thumb} alt={alt} data-art-status={art.status} title={art.status === "loading" ? "받는 중…" : "받지 못했습니다"} />;
  return <span className={className} style={{ ...style, display: "inline-grid", placeItems: "center" }} data-art-status={art.status} aria-label={art.status === "loading" ? "받는 중" : "받지 못함"}>{art.status === "loading" ? "…" : "!"}</span>;
}

/** Uploads dropped or chosen files; reports the first error. */
function useUploader() {
  const c = useCampaigns();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(0);
  const upload = async (files: Iterable<File>): Promise<string[]> => {
    const ids: string[] = [];
    for (const file of files) {
      setBusy((count) => count + 1);
      try { ids.push(await c.uploadArt(file)); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy((count) => count - 1); }
    }
    return ids;
  };
  return { upload, error, busy: busy > 0 };
}

export function ArtTab() {
  const c = useCampaigns();
  const viewer = useViewer();
  const { upload, error, busy } = useUploader();
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const assets = viewer.snapshot.art;
  const folders = useMemo(() => [...new Set(assets.map((asset) => asset.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")), [assets]);
  const shown = assets.filter((asset) => (!folder || asset.folder === folder) && (!query.trim() || asset.name.toLowerCase().includes(query.trim().toLowerCase()) || asset.tags.some((tag) => tag.includes(query.trim())))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const current = selected ? assets.find((asset) => asset.id === selected) ?? null : null;
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragOver(false); const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/")); if (files.length) void upload(files); };
  return (
    <div className={`cl-art${dragOver ? " drag-over" : ""}`} onDragOver={(event) => { if ([...event.dataTransfer.types].includes("Files")) { event.preventDefault(); setDragOver(true); } }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
      onPaste={(event) => { const files = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/")); if (files.length) { event.preventDefault(); void upload(files); } }}>
      <div className="cl-art-head">
        <div className="cl-row" style={{ gap: 4 }}>
          <input className="cl-input" style={{ flex: 1 }} placeholder="이름·태그로 찾기" aria-label="아트 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="cl-select" aria-label="폴더" value={folder} onChange={(event) => setFolder(event.target.value)} style={{ maxWidth: 130 }}>
            <option value="">모든 폴더</option>
            {folders.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="cl-row" style={{ gap: 4 }}>
          <button type="button" className="cl-btn small primary" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? "올리는 중…" : "이미지 올리기"}</button>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden aria-label="이미지 파일" onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) void upload(files); }} />
          <span className="cl-quiet cl-small">파일을 여기에 끌어 놓거나 붙여넣어도 됩니다 · 20MB까지</span>
          {c.table.artPending ? <Pill tone="accent">자료 받는 중 {c.table.artPending}</Pill> : null}
        </div>
        {error ? <Notice tone="bad">{error}</Notice> : null}
      </div>
      <div className="cl-art-grid" role="list">
        {shown.length === 0 ? <p className="cl-quiet cl-small" style={{ padding: 10, gridColumn: "1 / -1" }}>{assets.length === 0 ? (viewer.isGm ? "아직 올린 이미지가 없습니다. 올린 이미지는 핸드아웃·캐릭터의 아바타로, 다음 단계에서는 토큰과 페이지 배경으로 씁니다." : "아직 볼 수 있는 이미지가 없습니다. 직접 올린 이미지와 GM이 보여 준 항목의 이미지가 여기에 옵니다.") : "찾는 이미지가 없습니다."}</p> : shown.map((asset) => (
          <ArtCard key={asset.id} asset={asset} selected={asset.id === selected} onSelect={() => setSelected(asset.id === selected ? null : asset.id)} badge={viewer.isGm && asset.ownerId !== viewer.userId ? viewer.snapshot.players.find((player) => player.userId === asset.ownerId)?.displayName : undefined} />
        ))}
      </div>
      {current ? <ArtDetails asset={current} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function ArtCard({ asset, selected, onSelect, badge, onPick }: { asset: ArtAsset; selected?: boolean; onSelect: () => void; badge?: string; onPick?: () => void }) {
  return (
    <button type="button" role="listitem" className={`cl-art-card${selected ? " selected" : ""}`} title={`${asset.name} · ${formatBytes(asset.bytes)}${asset.width ? ` · ${asset.width}×${asset.height}` : ""}`} onClick={onPick ?? onSelect} onDoubleClick={onPick}
      draggable onDragStart={(event) => { event.dataTransfer.setData(ART_DRAG_TYPE, asset.id); event.dataTransfer.setData("text/plain", artRef(asset.id)); event.dataTransfer.effectAllowed = "copy"; }}>
      <span className="cl-art-thumb"><ArtImage src={artRef(asset.id)} alt={asset.name} /></span>
      <span className="cl-art-name">{asset.name}</span>
      {badge ? <span className="cl-art-badge">{badge}</span> : null}
    </button>
  );
}

function ArtDetails({ asset, onClose }: { asset: ArtAsset; onClose: () => void }) {
  const c = useCampaigns();
  const viewer = useViewer();
  const manage = canManageArt(asset, viewer);
  const [name, setName] = useState(asset.name);
  const [folder, setFolder] = useState(asset.folder);
  const [tags, setTags] = useState(asset.tags.join(", "));
  const commit = () => c.updateArt(asset.id, { name: name.trim() || asset.name, folder: folder.trim(), tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) });
  return (
    <div className="cl-art-details">
      <div className="cl-row" style={{ gap: 8, alignItems: "flex-start" }}>
        <span className="cl-art-thumb large"><ArtImage src={artRef(asset.id)} alt={asset.name} /></span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {manage ? <input className="cl-input" aria-label="아트 이름" value={name} onChange={(event) => setName(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} /> : <strong>{asset.name}</strong>}
          <span className="cl-quiet cl-small">{asset.mime.replace("image/", "")} · {formatBytes(asset.bytes)}{asset.width ? ` · ${asset.width}×${asset.height}` : ""} · {new Date(asset.createdAt).toLocaleDateString("ko-KR")}</span>
          {manage ? <div className="cl-row" style={{ gap: 4 }}>
            <input className="cl-input" style={{ flex: 1 }} aria-label="아트 폴더" placeholder="폴더 (예: 지도)" value={folder} onChange={(event) => setFolder(event.target.value)} onBlur={commit} />
            <input className="cl-input" style={{ flex: 1 }} aria-label="아트 태그" placeholder="태그, 쉼표" value={tags} onChange={(event) => setTags(event.target.value)} onBlur={commit} />
          </div> : asset.folder ? <span className="cl-small">📁 {asset.folder}</span> : null}
          <div className="cl-row" style={{ gap: 4 }}>
            <button type="button" className="cl-btn small" onClick={() => void navigator.clipboard?.writeText(artRef(asset.id)).catch(() => undefined)} title="핸드아웃 본문이나 다른 곳에 붙여 넣을 참조">참조 복사</button>
            {manage ? <button type="button" className="cl-btn small danger" onClick={() => { if (confirm(`"${asset.name}"을(를) 라이브러리에서 지울까요? 이 이미지를 쓰는 아바타는 비게 됩니다.`)) { c.removeArt(asset.id); onClose(); } }}>삭제</button> : null}
            <button type="button" className="cl-btn small quiet" style={{ marginLeft: "auto" }} onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Choose an image from the library (or upload one right here) — used by avatar fields; returns `art:<id>`. */
export function ArtPicker({ title = "라이브러리에서 고르기", onPick, onClose }: { title?: string; onPick: (ref: string) => void; onClose: () => void }) {
  const viewer = useViewer();
  const { upload, error, busy } = useUploader();
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const shown = viewer.snapshot.art.filter((asset) => !query.trim() || asset.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const uploadAndPick = async (files: File[]) => { const [id] = await upload(files); if (id) onPick(artRef(id)); };
  return (
    <Modal title={title} onClose={onClose} actions={<><button type="button" className="cl-btn" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? "올리는 중…" : "새 이미지 올리기"}</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden aria-label="아바타 이미지 파일" onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) void uploadAndPick(files); }} /></>}>
      <input className="cl-input" placeholder="이름으로 찾기" aria-label="아트 검색" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {shown.length === 0 ? <p className="cl-quiet cl-small">라이브러리가 비어 있습니다. "새 이미지 올리기"로 올리면 바로 선택됩니다.</p> : (
        <div className="cl-art-grid picker" role="list">{shown.map((asset) => <ArtCard key={asset.id} asset={asset} onSelect={() => onPick(artRef(asset.id))} onPick={() => onPick(artRef(asset.id))} />)}</div>
      )}
    </Modal>
  );
}

/** A drop target for library cards (and image files) that sets an `art:<id>` reference. */
export function ArtDropZone({ onRef, children, className }: { onRef: (ref: string) => void; children: ReactNode; className?: string }) {
  const { upload } = useUploader();
  const [over, setOver] = useState(false);
  return (
    <div className={`${className ?? ""}${over ? " drag-over" : ""}`}
      onDragOver={(event) => { const types = [...event.dataTransfer.types]; if (types.includes(ART_DRAG_TYPE) || types.includes("Files")) { event.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); const id = event.dataTransfer.getData(ART_DRAG_TYPE); if (id) { onRef(artRef(id)); return; } const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/")); if (files.length) void upload(files.slice(0, 1)).then(([uploaded]) => { if (uploaded) onRef(artRef(uploaded)); }); }}>
      {children}
    </div>
  );
}

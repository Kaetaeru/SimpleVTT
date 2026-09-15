/**
 * The Journal tab of the table sidebar and the floating journal windows (ROLL20_TABLE_SPEC.md §4): handouts and
 * characters in folders with two permission fields, "플레이어에게 보여주기", archive, Vault import/export, and a new
 * character made in a window. A character window has the three Roll20 tabs: 정보 (Bio & Info), 시트, 속성.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import type { Audience, JournalCharacter, JournalEntry, JournalFolder, TextSpan } from "../campaign/journal";
import { canEdit, findByName, journalFolders, journalTree, newHandout, newJournalCharacter, parseJournalText } from "../campaign/journal";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import { deriveCharacter } from "../character/derive";
import type { RollResult } from "../character/dice";
import type { CharacterRuntime } from "../character/runtime";
import { resolveRuntime } from "../character/save";
import type { CharacterSource } from "../character/types";
import { Modal, Notice, Pill, signed } from "../ui/components";
import { ArtDropZone, ArtImage, ArtPicker } from "./ArtPanel";
import { CreateScreen } from "./CreateScreen";
import { NpcWindow } from "./NpcSheet";
import { TrackerWindow } from "./TrackerWindow";
import { journalDragProps, PageSettingsWindow, placeCharacterToken, requestTargets, TokenWindow } from "./PageCanvas";
import { hasSmite, hasSneakAttack, smiteSlots, weaponRange } from "../rules/attackSpec";
import { isScene } from "../campaign/page";
import { SheetPlay } from "./SheetPlay";
import { SheetView } from "./SheetView";

/** What the table shows as windows: a journal entry, or the wizard for a new character. */
export type JournalWindow = { key: string; kind: "entry"; id: string } | { key: string; kind: "new-character" } | { key: string; kind: "token"; pageId: string; tokenId: string } | { key: string; kind: "page-settings"; pageId: string } | { key: string; kind: "tracker" };

function useViewer() {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const role = snapshot.players.find((player) => player.userId === c.userId)?.role ?? "player";
  return { userId: c.userId, role, isGm: role === "gm", snapshot };
}

/* ---------- Sidebar tab ---------- */

export function JournalTab({ onOpen, onNewCharacter }: { onOpen: (id: string) => void; onNewCharacter: () => void }) {
  const c = useCampaigns();
  const { userId, isGm, snapshot } = useViewer();
  const { characters, catalog } = useClient();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const entries = snapshot.journal.filter((entry) => (showArchived ? entry.archived : !entry.archived));
  const filtered = query.trim() ? entries.filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase())) : entries;
  const tree = useMemo(() => journalTree(filtered), [filtered]);
  const mayCreate = isGm || snapshot.settings.playersCanCreateCharacters;
  const addHandout = () => { const handout = newHandout(snapshot.campaignId, userId); c.putJournal(handout); onOpen(handout.id); };
  const importFromLibrary = (recordId: string) => {
    const record = characters.find((item) => item.id === recordId);
    if (!record) return;
    const entry = newJournalCharacter(snapshot.campaignId, userId, record.source, record.runtime, { vaultId: record.id });
    c.putJournal(entry);
    setImporting(false);
    onOpen(entry.id);
  };
  const renderFolder = (folder: JournalFolder, depth: number): ReactNode => (
    <div key={folder.path || "root"} className="cl-journal-folder">
      {folder.path ? <button type="button" className="cl-journal-folder-head" style={{ paddingLeft: 6 + depth * 12 }} onClick={() => setCollapsed((map) => ({ ...map, [folder.path]: !map[folder.path] }))}><span className="cl-quiet">{collapsed[folder.path] ? "▸" : "▾"}</span> 📁 {folder.name} <span className="cl-quiet cl-small">{countEntries(folder)}</span></button> : null}
      {folder.path && collapsed[folder.path] ? null : (
        <>
          {folder.folders.map((child) => renderFolder(child, folder.path ? depth + 1 : depth))}
          {folder.entries.map((entry) => (
            <div key={entry.id} className="cl-journal-row" style={{ paddingLeft: 8 + (folder.path ? depth + 1 : depth) * 12 }} role="button" tabIndex={0} onClick={() => onOpen(entry.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(entry.id); }} title={entry.kind === "handout" ? "핸드아웃" : "캐릭터 (캔버스로 끌어 놓으면 토큰이 됩니다)"} {...journalDragProps(entry)}>
              <EntryAvatar entry={entry} />
              <span className="cl-journal-name">{entry.name || "(이름 없음)"}</span>
              {entry.kind === "character" ? <span className="cl-quiet cl-small">{characterLine(entry, catalog)}</span> : entry.kind === "npc" ? <span className="cl-quiet cl-small">CR {entry.statBlock.crText}</span> : null}
              {(entry.kind === "character" || entry.kind === "npc") && canEdit(entry, { userId, role: isGm ? "gm" : "player" }) ? <button type="button" className="cl-btn small quiet" title="지금 보는 페이지 가운데에 이 캐릭터의 토큰을 놓습니다" aria-label={`${entry.name} 토큰 놓기`} onClick={(event) => { event.stopPropagation(); if (!placeCharacterToken(entry.id)) alert("열린 페이지가 없습니다."); }}>토큰</button> : null}
              {isGm ? <AudiencePill audience={entry.canView} players={snapshot.players.filter((player) => player.role !== "gm").length} /> : null}
            </div>
          ))}
        </>
      )}
    </div>
  );
  return (
    <div className="cl-journal">
      <div className="cl-journal-head">
        <input className="cl-input" placeholder="이름으로 찾기" aria-label="저널 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="cl-row" style={{ gap: 4 }}>
          {isGm ? <button type="button" className="cl-btn small" onClick={addHandout}>+ 핸드아웃</button> : null}
          {mayCreate ? <button type="button" className="cl-btn small" onClick={onNewCharacter}>+ 캐릭터</button> : null}
          {mayCreate ? <button type="button" className="cl-btn small" onClick={() => setImporting(true)} title="내 라이브러리의 캐릭터를 이 캠페인으로 복사합니다 (Vault 가져오기)">라이브러리에서</button> : null}
          {isGm ? <button type="button" className={`cl-btn small quiet${showArchived ? " active" : ""}`} onClick={() => setShowArchived((value) => !value)}>{showArchived ? "보관함 닫기" : "보관함 보기"}</button> : null}
        </div>
      </div>
      <div className="cl-journal-list">
        {filtered.length === 0 ? <p className="cl-quiet cl-small" style={{ padding: 10 }}>{showArchived ? "보관된 항목이 없습니다." : isGm ? "핸드아웃이나 캐릭터를 만들면 여기에 폴더별로 보입니다. 플레이어는 \"볼 수 있는 사람\"에 든 항목만 봅니다." : "아직 볼 수 있는 항목이 없습니다. GM이 핸드아웃을 공개하거나 캐릭터를 맡기면 여기에 나타납니다."}</p> : renderFolder(tree, 0)}
      </div>
      {importing ? (
        <Modal title="라이브러리에서 가져오기" onClose={() => setImporting(false)}>
          <p className="cl-muted cl-small">선택한 캐릭터의 사본이 이 캠페인에 생깁니다. 이후 캠페인의 사본이 원본이고, 라이브러리 것은 그대로 남습니다 (D73). "라이브러리로 내보내기"로 되돌려 보낼 수 있습니다.</p>
          {characters.length === 0 ? <Notice tone="warn">라이브러리에 캐릭터가 없습니다. 캐릭터 화면에서 먼저 만들거나 JSON으로 가져오세요.</Notice> : (
            <div className="cl-list" style={{ gap: 4, maxHeight: 360, overflow: "auto" }}>
              {characters.map((record) => { const derived = deriveCharacter(record.source, catalog); return (
                <button type="button" key={record.id} className="cl-option" onClick={() => importFromLibrary(record.id)}>
                  <span className="cl-name">{record.source.name || "(이름 없음)"}</span>
                  <span className="cl-summary">{derived.species?.name ?? "?"} · {derived.classes.map((cls) => `${cls.name} ${cls.level}`).join(" / ")} · HP {record.runtime.hp.current}/{derived.hp.max}</span>
                </button>
              ); })}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

const countEntries = (folder: JournalFolder): number => folder.entries.length + folder.folders.reduce((sum, child) => sum + countEntries(child), 0);

function characterLine(entry: JournalCharacter, catalog: ReturnType<typeof useClient>["catalog"]) {
  const derived = deriveCharacter(entry.source, catalog);
  return `${derived.classes.map((cls) => `${cls.name} ${cls.level}`).join("/") || "직업 없음"}`;
}

function EntryAvatar({ entry, size = 22 }: { entry: JournalEntry; size?: number }) {
  if (entry.avatar) return <ArtImage className="cl-journal-avatar" src={entry.avatar} style={{ width: size, height: size }} />;
  return <span className="cl-journal-avatar" style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">{entry.kind === "handout" ? "📜" : (entry.name || "?").slice(0, 1)}</span>;
}

function AudiencePill({ audience, players }: { audience: Audience; players: number }) {
  if (audience === "all") return <Pill tone="good">모두</Pill>;
  if (audience.length === 0) return <Pill>GM만</Pill>;
  return <Pill tone="accent">{audience.length}/{players}명</Pill>;
}

/* ---------- Windows ---------- */

export function JournalWindows({ windows, onClose, onFocus, onOpen }: { windows: JournalWindow[]; onClose: (key: string) => void; onFocus: (key: string) => void; onOpen: (id: string) => void }) {
  return (
    <div className="cl-windows">
      {windows.map((window, index) => (
        <FloatingWindow key={window.key} index={index} zIndex={10 + index} onClose={() => onClose(window.key)} onFocus={() => onFocus(window.key)} wide={window.kind === "new-character" || window.kind === "entry"}>
          {window.kind === "entry" ? <EntryWindow id={window.id} onClose={() => onClose(window.key)} onOpen={onOpen} />
            : window.kind === "token" ? <TitledWindow title="토큰 설정"><TokenWindow pageId={window.pageId} tokenId={window.tokenId} onClose={() => onClose(window.key)} /></TitledWindow>
            : window.kind === "page-settings" ? <TitledWindow title="페이지 설정"><PageSettingsWindow pageId={window.pageId} onClose={() => onClose(window.key)} /></TitledWindow>
            : window.kind === "tracker" ? <TitledWindow title="턴 트래커"><TrackerWindow onClose={() => onClose(window.key)} /></TitledWindow>
            : <NewCharacterWindow onClose={() => onClose(window.key)} onOpen={onOpen} />}
        </FloatingWindow>
      ))}
    </div>
  );
}

function FloatingWindow({ children, index, zIndex, onClose, onFocus, wide }: { children: ReactNode; index: number; zIndex: number; onClose: () => void; onFocus: () => void; wide: boolean }) {
  const [position, setPosition] = useState({ x: 40 + (index % 6) * 28, y: 70 + (index % 6) * 24 });
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest("button, input, textarea, select")) return;
    drag.current = { startX: event.clientX, startY: event.clientY, x: position.x, y: position.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => { if (drag.current) setPosition({ x: Math.max(0, drag.current.x + event.clientX - drag.current.startX), y: Math.max(52, drag.current.y + event.clientY - drag.current.startY) }); };
  const onPointerUp = () => { drag.current = null; };
  return (
    <section className={`cl-window${wide ? " wide" : ""}`} style={{ left: position.x, top: position.y, zIndex }} onPointerDownCapture={onFocus} role="dialog">
      <div className="cl-window-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <span className="cl-window-grip" aria-hidden="true">⋮⋮</span>
        <span className="cl-window-title" data-window-title />
        <button type="button" className="cl-btn quiet small" aria-label="창 닫기" onClick={onClose}>✕</button>
      </div>
      <div className="cl-window-body">{children}</div>
    </section>
  );
}

/** Puts the entry's name into the floating window's title slot (kept outside the body so dragging works on it). */
function useWindowTitle(title: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const slot = ref.current?.closest(".cl-window")?.querySelector("[data-window-title]"); if (slot) slot.textContent = title; }, [title]);
  return ref;
}

function TitledWindow({ title, children }: { title: string; children: ReactNode }) {
  const ref = useWindowTitle(title);
  return <div ref={ref}>{children}</div>;
}

function NewCharacterWindow({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const c = useCampaigns();
  const { catalog } = useClient();
  const { userId, snapshot } = useViewer();
  const ref = useWindowTitle("새 캐릭터");
  const save = (source: CharacterSource) => {
    const runtime = resolveRuntime(source, catalog, undefined, undefined);
    const entry = newJournalCharacter(snapshot.campaignId, userId, source, runtime);
    c.putJournal(entry);
    onClose();
    onOpen(entry.id);
  };
  return <div ref={ref}><CreateScreen onSave={save} onClose={onClose} title="새 캐릭터 (이 캠페인)" /></div>;
}

function EntryWindow({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { snapshot } = useViewer();
  const entry = snapshot.journal.find((item) => item.id === id);
  const ref = useWindowTitle(entry ? `${entry.kind === "handout" ? "핸드아웃" : entry.kind === "npc" ? "NPC" : "캐릭터"} · ${entry.name}` : "저널");
  if (!entry) return <div ref={ref}><Notice tone="warn">이 항목은 더 볼 수 없습니다 (지워졌거나 권한이 바뀌었습니다).</Notice><button type="button" className="cl-btn" onClick={onClose}>닫기</button></div>;
  return <div ref={ref}>{entry.kind === "handout" ? <HandoutWindow entry={entry} onClose={onClose} onOpen={onOpen} /> : entry.kind === "npc" ? <NpcWindow entry={entry} onClose={onClose} onOpen={onOpen} /> : <CharacterWindow entry={entry} onClose={onClose} onOpen={onOpen} />}</div>;
}

/* ---------- Shared editing pieces ---------- */

/** Local draft of an entry: typed text is sent 400 ms after the last keystroke; remote changes are adopted when nothing is pending. */
function useEntryDraft<T extends JournalEntry>(entry: T) {
  const c = useCampaigns();
  const [draft, setDraft] = useState<T>(entry);
  const pending = useRef<number | null>(null);
  const seen = useRef(entry.updatedAt);
  useEffect(() => {
    if (entry.updatedAt !== seen.current && pending.current === null) { seen.current = entry.updatedAt; setDraft(entry); }
  }, [entry]);
  const commit = (next: T) => { c.putJournal(next); seen.current = next.updatedAt; };
  const edit = (patch: Partial<T>) => {
    const next = { ...draft, ...patch, updatedAt: new Date().toISOString() } as T;
    setDraft(next);
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => { pending.current = null; commit(next); }, 400);
  };
  /** Immediate: permission toggles, archive, avatar. */
  const set = (patch: Partial<T>) => { const next = { ...draft, ...patch, updatedAt: new Date().toISOString() } as T; setDraft(next); if (pending.current !== null) { window.clearTimeout(pending.current); pending.current = null; } commit(next); };
  useEffect(() => () => { if (pending.current !== null) window.clearTimeout(pending.current); }, []);
  return { draft, edit, set };
}

function AudienceField({ label, value, onChange, hint }: { label: string; value: Audience; onChange: (next: Audience) => void; hint?: string }) {
  const { snapshot } = useViewer();
  const players = snapshot.players.filter((player) => player.role !== "gm");
  const mode = value === "all" ? "all" : value.length === 0 ? "none" : "some";
  return (
    <div className="cl-field">
      <label>{label}</label>
      <div className="cl-row" style={{ gap: 6 }}>
        <select className="cl-select" aria-label={label} value={mode} onChange={(event) => onChange(event.target.value === "all" ? "all" : event.target.value === "none" ? [] : players.slice(0, 1).map((player) => player.userId))}>
          <option value="none">없음 (GM만)</option>
          <option value="all">모든 플레이어</option>
          <option value="some">선택한 플레이어</option>
        </select>
        {mode === "some" ? players.map((player) => (
          <label key={player.userId} className="cl-row cl-small" style={{ gap: 4 }}>
            <input type="checkbox" checked={value !== "all" && value.includes(player.userId)} onChange={(event) => { const list = value === "all" ? [] : value; onChange(event.target.checked ? [...list, player.userId] : list.filter((item) => item !== player.userId)); }} />
            <span className="cl-swatch" style={{ background: player.color }} />{player.displayName}
          </label>
        )) : null}
        {mode === "some" && players.length === 0 ? <span className="cl-quiet cl-small">아직 참가한 플레이어가 없습니다</span> : null}
      </div>
      {hint ? <span className="cl-quiet cl-small">{hint}</span> : null}
    </div>
  );
}

function GmFields<T extends JournalEntry>({ draft, edit, set }: { draft: T; edit: (patch: Partial<T>) => void; set: (patch: Partial<T>) => void }) {
  const { snapshot } = useViewer();
  const folders = journalFolders(snapshot.journal);
  return (
    <div className="cl-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <AudienceField label="볼 수 있는 사람" value={draft.canView} onChange={(canView) => set({ canView } as Partial<T>)} hint="Roll20의 In Player's Journals. 여기 든 플레이어의 저널 목록에 나타납니다." />
      <AudienceField label="고칠 수 있는 사람" value={draft.canEdit} onChange={(canEdit) => set({ canEdit } as Partial<T>)} hint={draft.kind === "character" ? "Controlled By: 시트를 운용하고 정보를 고칩니다. 보통 그 캐릭터의 플레이어." : "본문을 고칠 수 있습니다."} />
      <div className="cl-row" style={{ gap: 6 }}>
        <div className="cl-field" style={{ flex: 1 }}><label htmlFor={`cl-folder-${draft.id}`}>폴더</label><input id={`cl-folder-${draft.id}`} className="cl-input" list={`cl-folders-${draft.id}`} placeholder="예: 괴물/동굴" value={draft.folder} onChange={(event) => edit({ folder: event.target.value } as Partial<T>)} /><datalist id={`cl-folders-${draft.id}`}>{folders.map((folder) => <option key={folder} value={folder} />)}</datalist></div>
        <div className="cl-field" style={{ flex: 1 }}><label htmlFor={`cl-tags-${draft.id}`}>태그</label><input id={`cl-tags-${draft.id}`} className="cl-input" placeholder="쉼표로 구분" value={draft.tags.join(", ")} onChange={(event) => edit({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) } as Partial<T>)} /></div>
      </div>
      <div className="cl-field"><label htmlFor={`cl-gmnotes-${draft.id}`}>GM 노트 (플레이어에게 안 보임)</label><textarea id={`cl-gmnotes-${draft.id}`} className="cl-textarea" rows={4} value={draft.gmNotes} onChange={(event) => edit({ gmNotes: event.target.value } as Partial<T>)} /></div>
    </div>
  );
}

function AvatarField({ entry, onChange, disabled }: { entry: JournalEntry; onChange: (avatar: string | undefined) => void; disabled: boolean }) {
  const c = useCampaigns();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    try { const id = await c.uploadArt(file); setError(null); onChange(`art:${id}`); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const body = (
    <>
      <EntryAvatar entry={entry} size={72} />
      {!disabled ? <div className="cl-row" style={{ gap: 4 }}>
        <button type="button" className="cl-btn small" onClick={() => setPicking(true)}>라이브러리에서</button>
        <label className="cl-btn small" style={{ cursor: "pointer" }}>이미지 올리기<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void pick(file); }} /></label>
        {entry.avatar ? <button type="button" className="cl-btn small quiet" onClick={() => onChange(undefined)}>지우기</button> : null}
      </div> : null}
      {error ? <span className="cl-small" style={{ color: "var(--bad)" }}>{error}</span> : null}
      {picking ? <ArtPicker title="아바타 고르기" onPick={(ref) => { onChange(ref); setPicking(false); }} onClose={() => setPicking(false)} /> : null}
    </>
  );
  if (disabled) return <div className="cl-journal-avatar-field">{body}</div>;
  return <ArtDropZone className="cl-journal-avatar-field" onRef={(ref) => onChange(ref)}>{body}</ArtDropZone>;
}

function CommonActions({ draft, set, onClose }: { draft: JournalEntry; set: (patch: Partial<JournalEntry>) => void; onClose: () => void }) {
  const c = useCampaigns();
  const { isGm } = useViewer();
  if (!isGm) return null;
  return (
    <div className="cl-row" style={{ gap: 6 }}>
      <button type="button" className="cl-btn small primary" onClick={() => c.showJournal(draft.id)} title="볼 수 있는 사람의 화면에 이 창이 열립니다">플레이어에게 보여주기</button>
      <button type="button" className="cl-btn small" onClick={() => set({ archived: !draft.archived })}>{draft.archived ? "보관 해제" : "보관"}</button>
      <button type="button" className="cl-btn small danger" onClick={() => { if (confirm(`"${draft.name}"을(를) 지울까요? 되돌릴 수 없습니다.`)) { c.removeJournal(draft.id); onClose(); } }}>삭제</button>
    </div>
  );
}

/* ---------- Handout ---------- */

function HandoutWindow({ entry, onClose, onOpen }: { entry: Extract<JournalEntry, { kind: "handout" }>; onClose: () => void; onOpen: (id: string) => void }) {
  const viewer = useViewer();
  const editable = canEdit(entry, viewer);
  const { draft, edit, set } = useEntryDraft(entry);
  const [editing, setEditing] = useState(false);
  return (
    <div className="cl-journal-window">
      <div className="cl-row" style={{ gap: 12, alignItems: "flex-start" }}>
        <AvatarField entry={draft} onChange={(avatar) => set({ avatar })} disabled={!editable} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {editable ? <input className="cl-input cl-journal-title" aria-label="이름" value={draft.name} onChange={(event) => edit({ name: event.target.value })} /> : <h2 className="cl-journal-title">{draft.name}</h2>}
          <div className="cl-row cl-small" style={{ gap: 6 }}>
            {viewer.isGm ? <><AudiencePill audience={draft.canView} players={viewer.snapshot.players.filter((player) => player.role !== "gm").length} /><span className="cl-quiet">볼 수 있음</span></> : null}
            {editable ? <button type="button" className="cl-btn small" onClick={() => setEditing((value) => !value)}>{editing ? "본문 보기" : "본문 편집"}</button> : null}
            {draft.archived ? <Pill>보관됨</Pill> : null}
          </div>
          <CommonActions draft={draft} set={set as (patch: Partial<JournalEntry>) => void} onClose={onClose} />
        </div>
      </div>
      {editing && editable ? (
        <div className="cl-field">
          <label htmlFor={`cl-notes-${draft.id}`}>본문 (# 제목 · - 항목 · **굵게** · *기울임* · [글](https://…) · @[다른 항목])</label>
          <textarea id={`cl-notes-${draft.id}`} className="cl-textarea" rows={12} value={draft.notes} onChange={(event) => edit({ notes: event.target.value })} />
        </div>
      ) : <JournalText text={draft.notes} onOpen={onOpen} empty={editable ? "본문이 비어 있습니다. \"본문 편집\"으로 적으세요." : "본문이 비어 있습니다."} />}
      {viewer.isGm ? <GmFields draft={draft} edit={edit} set={set} /> : null}
    </div>
  );
}

export function JournalText({ text, onOpen, empty }: { text: string; onOpen: (id: string) => void; empty?: string }) {
  const { snapshot } = useViewer();
  const blocks = useMemo(() => parseJournalText(text), [text]);
  if (!text.trim()) return <p className="cl-quiet cl-small">{empty ?? ""}</p>;
  const span = (item: TextSpan, index: number) => {
    switch (item.kind) {
      case "link": return <a key={index} href={item.href} target="_blank" rel="noreferrer">{item.text}</a>;
      case "journal": { const target = findByName(snapshot.journal, item.name); return target ? <button key={index} type="button" className="cl-journal-link" onClick={() => onOpen(target.id)}>{item.name}</button> : <span key={index} className="cl-journal-link missing" title="볼 수 없는 항목">{item.name}</span>; }
      default: { let node: ReactNode = item.text; if (item.bold) node = <strong>{node}</strong>; if (item.italic) node = <em>{node}</em>; return <span key={index}>{node}</span>; }
    }
  };
  return (
    <div className="cl-journal-text">
      {blocks.map((block, index) => block.kind === "heading" ? (block.level === 1 ? <h2 key={index}>{block.spans.map(span)}</h2> : block.level === 2 ? <h3 key={index}>{block.spans.map(span)}</h3> : <h4 key={index}>{block.spans.map(span)}</h4>)
        : block.kind === "list" ? <ul key={index}>{block.items.map((item, at) => <li key={at}>{item.map(span)}</li>)}</ul>
        : <p key={index}>{block.spans.map(span)}</p>)}
    </div>
  );
}

/* ---------- Character ---------- */

function CharacterWindow({ entry, onClose, onOpen }: { entry: JournalCharacter; onClose: () => void; onOpen: (id: string) => void }) {
  const c = useCampaigns();
  const viewer = useViewer();
  const { catalog, characters, saveCharacter } = useClient();
  const editable = canEdit(entry, viewer);
  const [tab, setTab] = useState<"info" | "sheet" | "attributes">("sheet");
  const [wizard, setWizard] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { draft, edit, set } = useEntryDraft(entry);
  // The sheet saves against the newest runtime we know: what the host echoed, or what we sent since (an echo takes a moment).
  const latest = useRef<{ runtime: CharacterRuntime; sentAt: string } | null>(null);
  const currentRuntime = () => (latest.current && latest.current.sentAt > entry.updatedAt ? latest.current.runtime : entry.runtime);
  const saveRuntime = (input: CharacterRuntime | ((current: CharacterRuntime) => CharacterRuntime)) => {
    const runtime = { ...resolveRuntime(entry.source, catalog, currentRuntime(), input), updatedAt: new Date().toISOString() };
    const sentAt = new Date().toISOString();
    latest.current = { runtime, sentAt };
    c.putJournal({ ...entry, runtime, updatedAt: sentAt });
  };
  const onRolled = (result: RollResult) => c.sendRoll({ formula: result.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: `${entry.name} · ${result.label}${result.note ? ` (${result.note})` : ""}` });
  const mayExport = viewer.isGm || viewer.snapshot.settings.playersCanExportToVault;
  const exportToVault = async () => {
    const existing = characters.find((record) => record.id === entry.source.id);
    if (existing && !confirm(`라이브러리에 같은 캐릭터("${existing.source.name}")가 있습니다. 캠페인의 사본으로 덮어쓸까요?`)) return;
    await saveCharacter(entry.source, entry.runtime);
    setMessage(`"${entry.name}"을(를) 내 라이브러리에 저장했습니다.`);
  };
  const saveEdited = (source: CharacterSource) => {
    const runtime = resolveRuntime(source, catalog, currentRuntime(), undefined);
    c.putJournal({ ...entry, name: source.name || entry.name, avatar: source.portrait ?? entry.avatar, source, runtime, updatedAt: new Date().toISOString() });
    setWizard(false);
  };
  const derived = useMemo(() => deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects }), [entry.source, entry.runtime, catalog]);
  /** ⚔ on the sheet's attack row: the character's token on the current page (if any) is the attacker; targets come from the canvas. */
  const attackFromSheet = async (attack: (typeof derived.attacks)[number]) => {
    const page = viewer.snapshot.pages.find((item) => item.tokens.some((token) => token.represents === entry.id));
    const token = page?.tokens.find((item) => item.represents === entry.id);
    const range = weaponRange(attack);
    const targets = await requestTargets(`${attack.name} 대상을 클릭하세요 (Esc 취소, 여러 대상은 Shift)`, { multi: true, from: token && !isScene(page) ? { tokenId: token.id, rangeFeet: range.rangeFeet, longRangeFeet: range.longRangeFeet } : undefined });
    if (!targets.length || !page) return;
    const sneak = hasSneakAttack(derived, attack);
    const slots = hasSmite(derived) ? smiteSlots(derived, entry.runtime) : [];
    const riders = sneak || slots.length ? { sneak: sneak && confirm("암습을 얹을까요? (유리하거나 아군이 대상 옆에 있을 때, 턴당 한 번)"), smiteSlot: slots.length ? Number(prompt(`신성한 강타 슬롯 레벨 (${slots.map((slot) => `${slot.level}: ${slot.free}`).join(", ")}; 비우면 안 씀)`, "") || 0) || undefined : undefined } : undefined;
    c.attack({ entryId: entry.id, pageId: page.id, tokenId: token?.id }, targets.map((id) => ({ pageId: page.id, tokenId: id })), { source: "weapon", attackId: attack.id }, riders);
  };
  if (wizard) return <CreateScreen existing={entry.source} initialStep="classes" onSave={saveEdited} onClose={() => setWizard(false)} title={`편집 · ${entry.name}`} />;
  return (
    <div className="cl-journal-window">
      <div className="cl-sidebar-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "info"} className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>정보</button>
        <button type="button" role="tab" aria-selected={tab === "sheet"} className={tab === "sheet" ? "active" : ""} onClick={() => setTab("sheet")}>시트</button>
        <button type="button" role="tab" aria-selected={tab === "attributes"} className={tab === "attributes" ? "active" : ""} onClick={() => setTab("attributes")}>속성</button>
      </div>
      {message ? <Notice tone="good">{message} <button type="button" className="cl-btn quiet small" onClick={() => setMessage(null)}>닫기</button></Notice> : null}
      {tab === "info" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="cl-row" style={{ gap: 12, alignItems: "flex-start" }}>
            <AvatarField entry={draft} onChange={(avatar) => set({ avatar })} disabled={!editable} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {editable ? <input className="cl-input cl-journal-title" aria-label="이름" value={draft.name} onChange={(event) => edit({ name: event.target.value })} /> : <h2 className="cl-journal-title">{draft.name}</h2>}
              <div className="cl-quiet cl-small">{derived.species?.name ?? "?"} · {derived.classes.map((cls) => `${cls.name}${cls.subclassName ? ` (${cls.subclassName})` : ""} ${cls.level}`).join(" / ")} · HP {entry.runtime.hp.current}/{derived.hp.max} · AC {derived.ac.value}{entry.vaultId ? " · 라이브러리에서 가져옴" : ""}</div>
              <div className="cl-row" style={{ gap: 6 }}>
                {editable ? <button type="button" className="cl-btn small" onClick={() => setWizard(true)}>편집 · 레벨 업</button> : null}
                {mayExport ? <button type="button" className="cl-btn small" onClick={() => void exportToVault()} title="사본을 내 라이브러리에 저장합니다 (Vault 내보내기)">라이브러리로 내보내기</button> : null}
                {viewer.isGm ? <button type="button" className="cl-btn small" onClick={() => { const copy = newJournalCharacter(entry.campaignId, viewer.userId, { ...entry.source, name: `${entry.source.name} (복제)` }, entry.runtime, { now: new Date().toISOString() }); c.putJournal({ ...copy, folder: entry.folder, canView: entry.canView, canEdit: entry.canEdit }); onOpen(copy.id); }}>복제</button> : null}
              </div>
              <CommonActions draft={draft} set={set as (patch: Partial<JournalEntry>) => void} onClose={onClose} />
            </div>
          </div>
          <div className="cl-field"><label htmlFor={`cl-bio-${draft.id}`}>소개 (Bio)</label>{editable ? <textarea id={`cl-bio-${draft.id}`} className="cl-textarea" rows={6} value={draft.bio} onChange={(event) => edit({ bio: event.target.value })} placeholder="외모, 성격, 배경 이야기…" /> : <JournalText text={draft.bio} onOpen={onOpen} empty="소개가 없습니다." />}</div>
          {viewer.isGm ? <GmFields draft={draft} edit={edit} set={set} /> : null}
        </div>
      ) : null}
      {tab === "sheet" ? (editable ? <SheetPlay embedded source={entry.source} runtime={entry.runtime} catalog={catalog} save={saveRuntime} onRolled={onRolled} onAttack={(attack) => void attackFromSheet(attack)} /> : <SheetView derived={derived} catalog={catalog} runtime={entry.runtime} />) : null}
      {tab === "attributes" ? <AttributesTab derived={derived} runtime={entry.runtime} /> : null}
    </div>
  );
}

function AttributesTab({ derived, runtime }: { derived: ReturnType<typeof deriveCharacter>; runtime: CharacterRuntime }) {
  const rows: Array<[string, string]> = [
    ["hp", `${runtime.hp.current} / ${derived.hp.max}${runtime.hp.temp ? ` (+${runtime.hp.temp} 임시)` : ""}`],
    ["ac", String(derived.ac.value)],
    ["initiative", signed(derived.initiative)],
    ["speed", `${derived.speed.walk} ft`],
    ["proficiency", signed(derived.proficiencyBonus)],
    ["passive_perception", String(derived.passivePerception)],
    ...ABILITY_KEYS.map((key): [string, string] => [key, `${derived.abilities[key].score} (${signed(derived.abilities[key].modifier)})`]),
    ...ABILITY_KEYS.map((key): [string, string] => [`${key}_save`, signed(derived.saves[key].bonus)]),
    ...derived.skills.map((skill): [string, string] => [skill.id, signed(skill.bonus)]),
  ];
  const label = (key: string) => key.endsWith("_save") ? `${ABILITY_KO[key.slice(0, 3) as keyof typeof ABILITY_KO]} 내성` : (ABILITY_KO as Record<string, string>)[key] ?? derived.skills.find((skill) => skill.id === key)?.name ?? ({ hp: "HP", ac: "AC", initiative: "이니셔티브", speed: "이동 속도", proficiency: "숙련 보너스", passive_perception: "패시브 지각" } as Record<string, string>)[key] ?? key;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p className="cl-muted cl-small">Roll20의 Attributes 탭에 해당합니다. 값은 시트에서 파생돼 자동으로 맞춰지며, 토큰 바(R5)가 여기의 HP·AC를 연결합니다. 능력(매크로)은 R10에서 옵니다.</p>
      <table className="cl-table"><thead><tr><th>속성</th><th>이름</th><th>값</th></tr></thead><tbody>{rows.map(([key, value]) => <tr key={key}><td><code>{key}</code></td><td>{label(key)}</td><td className="num">{value}</td></tr>)}</tbody></table>
    </div>
  );
}

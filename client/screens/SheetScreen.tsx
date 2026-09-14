/** A saved character: the full sheet, current HP adjustment, export, edit, level up, delete. */
import { useMemo, useState } from "react";
import { useClient } from "../app/context";
import { deriveCharacter } from "../character/derive";
import { exportCharacterFile, serializeCharacterFile } from "../character/json";
import { copyText, downloadText, Modal, Notice } from "../ui/components";
import { SheetView, ValidationList } from "./SheetView";

export function SheetScreen({ id }: { id: string }) {
  const { catalog, characters, navigate, saveCharacter, deleteCharacter } = useClient();
  const record = characters.find((item) => item.id === id);
  const derived = useMemo(() => (record ? deriveCharacter(record.source, catalog, { equipped: record.runtime.equipped }) : null), [record, catalog]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [hpInput, setHpInput] = useState<string>("");
  if (!record || !derived) return <div className="cl-page"><Notice tone="bad">캐릭터를 찾을 수 없습니다.</Notice><button type="button" className="cl-btn" onClick={() => navigate({ screen: "library" })}>라이브러리로</button></div>;

  const adjustHp = async (delta: number) => {
    const current = Math.max(0, Math.min(derived.hp.max, record.runtime.hp.current + delta));
    await saveCharacter(record.source, { ...record.runtime, hp: { ...record.runtime.hp, current } });
  };
  const setHp = async () => {
    const value = Number(hpInput);
    if (!Number.isFinite(value)) return;
    await saveCharacter(record.source, { ...record.runtime, hp: { ...record.runtime.hp, current: Math.max(0, Math.min(derived.hp.max, Math.round(value))) } });
    setHpInput("");
  };
  const remove = async () => {
    if (!confirm(`"${record.source.name}"을(를) 삭제할까요?`)) return;
    await deleteCharacter(record.id);
    navigate({ screen: "library" });
  };
  const text = () => serializeCharacterFile(exportCharacterFile(record.source, record.runtime, derived));
  return (
    <div className="cl-page">
      <div className="cl-page-head">
        <h1>시트</h1>
        <span className="cl-sub">저장 {new Date(record.savedAt).toLocaleString("ko-KR")}</span>
        <div className="cl-actions">
          <span className="cl-row" style={{ gap: 4 }}>
            <span className="cl-muted cl-small">현재 HP {record.runtime.hp.current}/{derived.hp.max}</span>
            <button type="button" className="cl-btn small" onClick={() => adjustHp(-1)}>−1</button>
            <button type="button" className="cl-btn small" onClick={() => adjustHp(1)}>+1</button>
            <input className="cl-input" style={{ width: 64, height: 26 }} placeholder="값" value={hpInput} onChange={(event) => setHpInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void setHp(); }} aria-label="현재 HP 설정" />
            <button type="button" className="cl-btn small" onClick={setHp}>설정</button>
          </span>
          <button type="button" className="cl-btn" onClick={() => setExporting(text())}>JSON 내보내기</button>
          <button type="button" className="cl-btn" onClick={() => navigate({ screen: "edit", id: record.id })}>편집 · 레벨 업</button>
          <button type="button" className="cl-btn danger" onClick={remove}>삭제</button>
          <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "library" })}>라이브러리</button>
        </div>
      </div>
      {derived.validation.blocking.length || derived.validation.warnings.length ? <div className="cl-card"><ValidationList derived={derived} /></div> : null}
      <SheetView derived={derived} catalog={catalog} runtime={record.runtime} />
      {exporting ? (
        <Modal title="JSON 내보내기" onClose={() => setExporting(null)} actions={<>
          <button type="button" className="cl-btn" onClick={() => void copyText(exporting)}>복사</button>
          <button type="button" className="cl-btn primary" onClick={() => downloadText(`${record.source.name || "character"}.simplevtt.json`, exporting)}>파일로 저장</button>
        </>}>
          <pre>{exporting}</pre>
        </Modal>
      ) : null}
    </div>
  );
}

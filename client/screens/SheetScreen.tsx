/**
 * A saved character as an offline session: the playable sheet (SheetPlay) with every op applied locally against the
 * stored runtime and saved; plus export, level up, edit, delete.
 */
import { useMemo, useState } from "react";
import { useClient } from "../app/context";
import { exportCharacterFile, serializeCharacterFile } from "../character/json";
import { applyOp, deriveLive, type SheetOp } from "../character/ops";
import { copyText, downloadText, Modal, Notice } from "../ui/components";
import { SheetPlay } from "./SheetPlay";

export function SheetScreen({ id }: { id: string }) {
  const { catalog, characters, navigate, saveCharacter, deleteCharacter } = useClient();
  const record = characters.find((item) => item.id === id);
  const derived = useMemo(() => (record ? deriveLive(record.source, catalog, record.runtime) : null), [record, catalog]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  if (!record || !derived) return <div className="cl-page"><Notice tone="bad">캐릭터를 찾을 수 없습니다.</Notice><button type="button" className="cl-btn" onClick={() => navigate({ screen: "library" })}>라이브러리로</button></div>;
  const runtime = record.runtime;

  // Ops are applied against the stored runtime (a roll settling seconds later must not overwrite an HP change made meanwhile).
  const dispatch = async (op: SheetOp) => {
    let refused: string | null = null;
    await saveCharacter(record.source, (current) => { const result = applyOp(current, record.source, catalog, op); refused = result.refused ?? null; return result.runtime; });
    return refused;
  };
  const remove = async () => {
    if (!confirm(`"${record.source.name}"을(를) 삭제할까요?`)) return;
    await deleteCharacter(record.id);
    navigate({ screen: "library" });
  };
  const text = () => serializeCharacterFile(exportCharacterFile(record.source, runtime, derived));

  return (
    <div className="cl-page">
      <div className="cl-page-head">
        <h1>시트</h1>
        <span className="cl-sub">저장 {new Date(record.savedAt).toLocaleString("ko-KR")}</span>
        <div className="cl-actions">
          <button type="button" className="cl-btn" onClick={() => setExporting(text())}>JSON 내보내기</button>
          <button type="button" className="cl-btn primary" onClick={() => navigate({ screen: "levelup", id: record.id })}>레벨 업</button>
          <button type="button" className="cl-btn" onClick={() => navigate({ screen: "edit", id: record.id })}>편집</button>
          <button type="button" className="cl-btn danger" onClick={remove}>삭제</button>
          <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "library" })}>라이브러리</button>
        </div>
      </div>
      <SheetPlay source={record.source} runtime={runtime} derived={derived} catalog={catalog} dispatch={dispatch} />
      {exporting ? (
        <Modal title="JSON 내보내기" onClose={() => { setExporting(null); setCopied(null); }} actions={<>
          <button type="button" className="cl-btn" onClick={async () => setCopied((await copyText(exporting)) ? "클립보드에 복사했습니다." : "복사할 수 없습니다. 아래 텍스트를 직접 선택하세요.")}>복사</button>
          <button type="button" className="cl-btn primary" onClick={() => downloadText(`${record.source.name || "character"}.simplevtt.json`, exporting)}>파일로 저장</button>
        </>}>
          {copied ? <Notice tone={copied.startsWith("클립보드") ? "good" : "bad"}>{copied}</Notice> : null}
          <pre>{exporting}</pre>
        </Modal>
      ) : null}
    </div>
  );
}

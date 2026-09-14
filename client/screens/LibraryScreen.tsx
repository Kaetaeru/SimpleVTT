/** Character library: cards with the derived summary, new/import/export/duplicate/delete. */
import { useMemo, useState } from "react";
import { useClient } from "../app/context";
import { deriveCharacter } from "../character/derive";
import { exportCharacterFile, importedRecord, parseCharacterFile, serializeCharacterFile, unknownContentIds } from "../character/json";
import { newCharacterId } from "../character/source";
import { copyText, downloadText, Modal, Notice, Pill, readFileText } from "../ui/components";

export function LibraryScreen() {
  const { ready, catalog, characters, navigate, saveCharacter, deleteCharacter, store } = useClient();
  const [exporting, setExporting] = useState<{ name: string; text: string } | null>(null);
  const [importing, setImporting] = useState<{ text: string; errors: string[]; warnings: string[]; missing: string[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cards = useMemo(() => characters.map((record) => ({ record, derived: deriveCharacter(record.source, catalog) })), [characters, catalog]);

  const exportRecord = (id: string) => {
    const card = cards.find((item) => item.record.id === id);
    if (!card) return;
    const text = serializeCharacterFile(exportCharacterFile(card.record.source, card.record.runtime, card.derived));
    setExporting({ name: `${card.record.source.name || "character"}.simplevtt.json`, text });
  };
  const duplicate = async (id: string) => {
    const card = cards.find((item) => item.record.id === id);
    if (!card) return;
    await saveCharacter({ ...card.record.source, id: newCharacterId(), name: `${card.record.source.name} (복제)` });
  };
  const remove = async (id: string) => {
    const card = cards.find((item) => item.record.id === id);
    if (!card || !confirm(`"${card.record.source.name}"을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await deleteCharacter(id);
  };
  const stageImport = (text: string) => {
    const parsed = parseCharacterFile(text);
    const missing = parsed.source ? unknownContentIds(parsed.source, catalog) : [];
    setImporting({ text, errors: parsed.errors, warnings: parsed.warnings, missing });
  };
  const commitImport = async () => {
    if (!importing) return;
    const parsed = parseCharacterFile(importing.text);
    if (!parsed.source) return;
    const exists = characters.some((record) => record.id === parsed.source!.id);
    const derived = deriveCharacter(parsed.source, catalog);
    const record = importedRecord(parsed, derived, exists ? { newId: newCharacterId() } : {});
    await saveCharacter(record.source, record.runtime);
    setImporting(null);
    setMessage(`"${record.source.name}" 가져옴${exists ? " (같은 id가 있어 새 id로 저장)" : ""}${importing.missing.length ? ` — 설치되지 않은 콘텐츠 ${importing.missing.length}개, 콘텐츠 화면에서 모듈을 설치하세요.` : ""}`);
  };

  return (
    <div className="cl-page">
      <div className="cl-page-head">
        <h1>캐릭터</h1>
        <span className="cl-sub">{characters.length}명 · 저장소 {store?.kind === "indexeddb" ? "IndexedDB" : store?.kind === "memory" ? "메모리(임시)" : "…"}</span>
        <div className="cl-actions">
          <label className="cl-btn">JSON 가져오기<input type="file" accept="application/json,.json" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (file) stageImport(await readFileText(file)); event.target.value = ""; }} /></label>
          <button type="button" className="cl-btn" onClick={() => setImporting({ text: "", errors: [], warnings: [], missing: [] })}>JSON 붙여넣기</button>
          <button type="button" className="cl-btn primary" onClick={() => navigate({ screen: "new" })}>새 캐릭터</button>
        </div>
      </div>
      {message ? <Notice tone="good">{message} <button type="button" className="cl-btn quiet small" onClick={() => setMessage(null)}>닫기</button></Notice> : null}
      {!ready ? <p className="cl-quiet">불러오는 중…</p> : cards.length === 0 ? (
        <div className="cl-empty">아직 캐릭터가 없습니다. <button type="button" className="cl-btn primary" onClick={() => navigate({ screen: "new" })}>새 캐릭터 만들기</button></div>
      ) : (
        <div className="cl-char-grid">
          {cards.map(({ record, derived }) => (
            <div className="cl-card cl-char-card" key={record.id}>
              <div className="cl-row">
                <div className="cl-avatar" aria-hidden="true">{(record.source.name || "?").slice(0, 1)}</div>
                <div>
                  <div className="cl-name">{record.source.name || "(이름 없음)"}</div>
                  <div className="cl-line">{derived.species?.name ?? "?"} · {derived.background?.name ?? "?"}</div>
                </div>
              </div>
              <div className="cl-line">{derived.classes.map((cls) => `${cls.name}${cls.subclassName ? ` (${cls.subclassName})` : ""} ${cls.level}`).join(" / ")} · 총 {derived.level}레벨</div>
              <div className="cl-row" style={{ gap: 6 }}>
                <Pill>HP {record.runtime.hp.current}/{derived.hp.max}</Pill>
                <Pill>AC {derived.ac.value}</Pill>
                {derived.validation.blocking.length ? <Pill tone="bad">막힘 {derived.validation.blocking.length}</Pill> : null}
                {record.source.rules.modules.length ? <Pill tone="accent">모듈 {record.source.rules.modules.length}</Pill> : null}
              </div>
              <div className="cl-foot">
                <button type="button" className="cl-btn small primary" onClick={() => navigate({ screen: "sheet", id: record.id })}>시트</button>
                <button type="button" className="cl-btn small" onClick={() => navigate({ screen: "edit", id: record.id })}>편집</button>
                <button type="button" className="cl-btn small" onClick={() => exportRecord(record.id)}>내보내기</button>
                <button type="button" className="cl-btn small" onClick={() => duplicate(record.id)}>복제</button>
                <button type="button" className="cl-btn small danger" onClick={() => remove(record.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {exporting ? (
        <Modal title="JSON 내보내기" onClose={() => setExporting(null)} actions={<>
          <button type="button" className="cl-btn" onClick={async () => { setMessage((await copyText(exporting.text)) ? "클립보드에 복사했습니다." : "복사할 수 없습니다. 아래 텍스트를 직접 선택하세요."); }}>복사</button>
          <button type="button" className="cl-btn primary" onClick={() => downloadText(exporting.name, exporting.text)}>파일로 저장</button>
        </>}>
          <p className="cl-muted cl-small">{exporting.name} — 원본(선택)과 사용량을 함께 담습니다. 같은 파일을 라이브러리에서 다시 가져올 수 있습니다.</p>
          <pre>{exporting.text}</pre>
        </Modal>
      ) : null}
      {importing ? (
        <Modal title="JSON 가져오기" onClose={() => setImporting(null)} actions={<button type="button" className="cl-btn primary" disabled={!importing.text.trim() || importing.errors.length > 0} onClick={commitImport}>가져오기</button>}>
          <textarea className="cl-textarea" style={{ minHeight: 160, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }} placeholder="캐릭터 JSON을 붙여넣으세요" value={importing.text} onChange={(event) => stageImport(event.target.value)} />
          {importing.errors.length ? <Notice tone="bad"><ul>{importing.errors.map((line) => <li key={line}>{line}</li>)}</ul></Notice> : importing.text.trim() ? <Notice tone="good">형식 확인됨.</Notice> : null}
          {importing.warnings.length ? <Notice tone="warn"><ul>{importing.warnings.map((line) => <li key={line}>{line}</li>)}</ul></Notice> : null}
          {importing.missing.length ? <Notice tone="warn">설치되지 않은 콘텐츠: {importing.missing.join(", ")} — 가져온 뒤 콘텐츠 화면에서 모듈을 설치하면 시트가 완성됩니다.</Notice> : null}
        </Modal>
      ) : null}
    </div>
  );
}

import { useState, type ChangeEvent } from "react";
import { useSimpleVtt } from "./app/AppProvider";

const MAX_ADDON_BYTES = 5 * 1024 * 1024;

export function V1ContentScreen() {
  const { snapshot, previewContentImport, activateContentImport, clearContentImport } = useSimpleVtt();
  const [payload, setPayload] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  if (!snapshot) return null;

  const localEntries = snapshot.catalog.filter((entry) => entry.scope === "local");
  const builtinEntries = snapshot.catalog.filter((entry) => entry.scope === "builtin");
  const groups = new Map<string, typeof localEntries>();
  for (const entry of localEntries) {
    const key = entry.sourceId || entry.source || "로컬 콘텐츠";
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const installedGroups = [...groups.entries()].map(([id, entries]) => ({ id, entries, source: entries[0]?.source ?? id, version: entries[0]?.version ?? "" }));

  const preview = snapshot.contentImport;
  const canInstall = Boolean(preview && (preview.entry || preview.package) && !preview.validation.some((item) => item.severity === "blocking"));

  const resetPreview = async () => {
    setPayload("");
    setFileName("");
    setFileError("");
    await clearContentImport();
  };

  const previewPayload = async (value = payload) => {
    setFileError("");
    if (!value.trim()) {
      setFileError("JSON 파일을 선택하거나 고급 입력에 내용을 붙여 넣어 주세요.");
      return;
    }
    await previewContentImport(value);
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_ADDON_BYTES) {
      setFileError("애드온 파일은 5MB 이하만 불러올 수 있습니다.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json") && file.type && file.type !== "application/json") {
      setFileError("현재 v1 애드온 설치는 JSON RuleModule 패키지를 지원합니다.");
      return;
    }
    try {
      const text = await file.text();
      setFileName(file.name);
      setPayload(text);
      setFileError("");
      await previewContentImport(text);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
    }
  };

  return (
    <div className="v1-content-screen">
      <header className="v1-page-head">
        <div><span className="v1-kicker">CONTENTS</span><h1>콘텐츠 · 애드온</h1><p>설치할 파일을 먼저 검토합니다. 기본 규칙과 로컬 애드온은 같은 카탈로그로 합쳐집니다.</p></div>
        <label className="primary v1-file-button">애드온 추가<input type="file" accept=".json,application/json" onChange={chooseFile} /></label>
      </header>

      <section className="v1-content-summary" aria-label="콘텐츠 상태">
        <div><small>기본 콘텐츠</small><strong>{builtinEntries.length}</strong><span>앱과 함께 제공됨</span></div>
        <div><small>추가 콘텐츠</small><strong>{localEntries.length}</strong><span>{installedGroups.length}개 소스</span></div>
        <div><small>저장 상태</small><strong>{snapshot.contentCatalogPersistence?.status === "error" ? "확인 필요" : "정상"}</strong><span>{snapshot.contentCatalogPersistence?.durability === "durable" ? "기기에 저장됨" : "현재 실행에서만 유지"}</span></div>
      </section>

      {(fileError || preview) && (
        <section className="v1-addon-review" aria-live="polite">
          <div className="v1-section-heading"><div><span className="v1-kicker">설치 전 검토</span><h2>{fileName || preview?.package?.moduleId || preview?.entry?.nameKo || "애드온 미리보기"}</h2></div><button className="quiet" onClick={() => void resetPreview()}>닫기</button></div>
          {fileError && <div className="v1-inline-error">{fileError}</div>}
          {preview?.package && (
            <div className="v1-addon-meta">
              <div><small>모듈</small><strong>{preview.package.moduleId}</strong></div>
              <div><small>버전</small><strong>{preview.package.moduleVersion}</strong></div>
              <div><small>출처</small><strong>{preview.package.source}</strong></div>
              <div><small>콘텐츠</small><strong>{preview.package.entries.length}개</strong></div>
            </div>
          )}
          {preview?.entry && !preview.package && (
            <div className="v1-addon-meta">
              <div><small>콘텐츠</small><strong>{preview.entry.nameKo}</strong></div>
              <div><small>종류</small><strong>{preview.entry.category}</strong></div>
              <div><small>출처</small><strong>{preview.entry.source}</strong></div>
            </div>
          )}
          {preview?.package && <div className="v1-addon-entry-list">{preview.package.entries.map((entry) => <div key={entry.contentId}><strong>{entry.nameKo}</strong><span>{entry.nameEn} · {entry.category}</span></div>)}</div>}
          {preview && (
            <div className="v1-validation-list">
              {preview.validation.length === 0 && <span className="info">검증을 통과했습니다.</span>}
              {preview.validation.map((item, index) => <span key={`${item.message}-${index}`} className={item.severity}>{item.message}</span>)}
            </div>
          )}
          {preview && <div className="v1-card-actions"><button onClick={() => void previewPayload()}>다시 검증</button><button className="primary" disabled={!canInstall} onClick={() => void activateContentImport()}>검토 완료 · 설치</button></div>}
        </section>
      )}

      <div className="v1-content-columns">
        <section>
          <div className="v1-section-heading"><div><span className="v1-kicker">INSTALLED</span><h2>설치된 애드온</h2></div></div>
          {installedGroups.length === 0 ? <div className="v1-empty"><strong>아직 추가한 애드온이 없습니다.</strong><span>기본 규칙만으로 바로 사용할 수 있습니다.</span></div> : <div className="v1-addon-groups">{installedGroups.map((group) => <article key={group.id}><div><strong>{group.source}</strong><span>{group.id} · v{group.version}</span></div><b>{group.entries.length}개</b><details><summary>포함 콘텐츠</summary>{group.entries.map((entry) => <p key={`${entry.id}-${entry.version}`}>{entry.nameKo} <small>{entry.nameEn} · {entry.category}</small></p>)}</details></article>)}</div>}
        </section>

        <aside className="v1-addon-guide">
          <span className="v1-kicker">ADDON GUIDE</span>
          <h2>애드온 만드는 방법</h2>
          <p>v1 애드온은 실행 코드를 넣는 플러그인이 아니라, 검증 가능한 선언형 RuleModule JSON입니다.</p>
          <ol>
            <li><code>schemaVersion</code>은 <code>0.1-draft</code>를 사용합니다.</li>
            <li><code>moduleId</code>, <code>moduleVersion</code>, <code>rulesProfile</code>과 출처 정보를 적습니다.</li>
            <li><code>content</code> 배열에 클래스, 서브클래스, 종족, 배경, 재주, 주문, 아이템, 상태, 전투원 또는 옵션을 넣습니다.</li>
            <li>파일을 여기서 선택하고 검증 결과를 확인한 뒤 설치합니다.</li>
          </ol>
          <p className="v1-muted">의존성·충돌·Capability도 설치 전에 검사합니다. 현재 generic Catalog가 실행할 수 없는 mechanics/progression 확장은 차단됩니다.</p>
          <button onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "직접 입력 닫기" : "고급: JSON 직접 입력"}</button>
          {showAdvanced && <div className="v1-json-input"><textarea value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="RuleModule JSON을 붙여 넣으세요."/><button onClick={() => void previewPayload()}>JSON 검증</button></div>}
        </aside>
      </div>
    </div>
  );
}

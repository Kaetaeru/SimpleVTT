/** Contents: builtin SRD modules (read-only) and installed RuleModule JSON files with preview before install. */
import { useMemo, useState } from "react";
import { useClient } from "../app/context";
import { BUILTIN_MODULES } from "../catalog/sources";
import { missingDependencies, parseModuleJson, summarizeModule, type ParsedModule } from "../catalog/install";
import { Modal, Notice, Pill, readFileText, Section } from "../ui/components";

const CATEGORY_KO: Record<string, string> = { class: "직업", subclass: "서브클래스", species: "종족", background: "배경", feat: "재주", spell: "주문", option: "옵션", weapon: "무기", armor: "방어구", shield: "방패", tool: "도구", item: "물품", "adventuring-gear": "모험 장비", ammunition: "탄약", focus: "매개체", "starting-loadout": "시작 장비", combatant: "괴물", condition: "상태" };
const countsLine = (counts: Record<string, number>) => Object.entries(counts).map(([category, count]) => `${CATEGORY_KO[category] ?? category} ${count}`).join(" · ");

export function ContentsScreen() {
  const { modules, installModule, removeModule, characters } = useClient();
  const [preview, setPreview] = useState<{ fileName?: string; parsed: ParsedModule } | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const builtin = useMemo(() => BUILTIN_MODULES.map((module) => summarizeModule(module)), []);
  const present = [...builtin.map((summary) => summary.moduleId), ...modules.map((row) => row.moduleId)];

  const stage = (text: string, fileName?: string) => setPreview({ fileName, parsed: parseModuleJson(text) });
  const commit = async () => {
    if (!preview?.parsed.module) return;
    await installModule(preview.parsed.module, preview.fileName);
    setMessage(`${preview.parsed.summary?.moduleId} 설치됨 — ${countsLine(preview.parsed.summary?.counts ?? {})}`);
    setPreview(null);
    setPasting(false);
    setPasteText("");
  };
  const remove = async (moduleId: string) => {
    const users = characters.filter((record) => record.source.rules.modules.includes(moduleId)).length;
    if (!confirm(`${moduleId}을(를) 제거할까요?${users ? ` 이 모듈을 쓰는 캐릭터 ${users}명의 시트에 막힘이 생깁니다.` : ""}`)) return;
    await removeModule(moduleId);
  };
  const missing = preview?.parsed.module ? missingDependencies(preview.parsed.module, present) : [];

  return (
    <div className="cl-page">
      <div className="cl-page-head">
        <h1>콘텐츠</h1>
        <span className="cl-sub">내장 SRD 5.2.1 모듈 {builtin.length}개 · 설치 모듈 {modules.length}개</span>
        <div className="cl-actions">
          <label className="cl-btn primary">모듈 JSON 설치<input type="file" accept="application/json,.json" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (file) stage(await readFileText(file), file.name); event.target.value = ""; }} /></label>
          <button type="button" className="cl-btn" onClick={() => setPasting(true)}>JSON 붙여넣기</button>
        </div>
      </div>
      {message ? <Notice tone="good">{message}</Notice> : null}
      <Section title="설치한 모듈" hint="RuleModule JSON(SRD 모듈과 보충 컴파일러 출력이 쓰는 형식)을 그대로 설치합니다. 설치한 종족·배경·재주·서브클래스·주문은 생성과 시트에서 내장 콘텐츠와 똑같이 흐릅니다.">
        {modules.length === 0 ? <div className="cl-empty">설치한 모듈이 없습니다.</div> : (
          <div className="cl-list">
            {modules.map((row) => {
              const summary = summarizeModule(row.module);
              return (
                <div className="cl-card" key={row.moduleId}>
                  <div className="cl-row">
                    <strong>{summary.moduleId}</strong>
                    {summary.moduleVersion ? <Pill>v{summary.moduleVersion}</Pill> : null}
                    {summary.document ? <span className="cl-muted">{summary.document}</span> : null}
                    {summary.license ? <Pill>{summary.license}</Pill> : null}
                    <span className="cl-quiet cl-small" style={{ marginLeft: "auto" }}>{row.fileName ?? ""} · {new Date(row.installedAt).toLocaleString("ko-KR")}</span>
                    <button type="button" className="cl-btn small danger" onClick={() => remove(row.moduleId)}>제거</button>
                  </div>
                  <p className="cl-muted cl-small">{countsLine(summary.counts)}</p>
                  <details className="cl-details"><summary className="cl-small">항목 {summary.entries.length}개 보기</summary>
                    <ul className="cl-small" style={{ columns: 3, marginTop: 6 }}>{summary.entries.map((entry) => <li key={entry.id}>{CATEGORY_KO[entry.category] ?? entry.category} · {entry.name}</li>)}</ul>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </Section>
      <Section title="내장 모듈 (SRD 5.2.1, CC-BY-4.0)">
        <div className="cl-list" style={{ gap: 2 }}>
          {builtin.map((summary) => <div className="cl-small" key={summary.moduleId}><strong>{summary.moduleId}</strong> <span className="cl-quiet">{countsLine(summary.counts)}</span></div>)}
        </div>
      </Section>
      {pasting ? (
        <Modal title="모듈 JSON 붙여넣기" onClose={() => { setPasting(false); setPasteText(""); }} actions={<button type="button" className="cl-btn primary" disabled={!pasteText.trim()} onClick={() => stage(pasteText)}>확인</button>}>
          <textarea className="cl-textarea" style={{ minHeight: 200, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder='{"moduleId": "...", "content": [...]}' />
        </Modal>
      ) : null}
      {preview ? (
        <Modal title="설치 미리보기" onClose={() => setPreview(null)} actions={<button type="button" className="cl-btn primary" disabled={!preview.parsed.module || missing.length > 0} onClick={commit}>설치</button>}>
          {preview.parsed.errors.length ? <Notice tone="bad"><ul>{preview.parsed.errors.map((line) => <li key={line}>{line}</li>)}</ul></Notice> : null}
          {preview.parsed.summary ? (
            <>
              <dl className="cl-kv">
                <dt>moduleId</dt><dd>{preview.parsed.summary.moduleId} {preview.parsed.summary.moduleVersion ? `v${preview.parsed.summary.moduleVersion}` : ""}</dd>
                <dt>문서</dt><dd>{preview.parsed.summary.document ?? "—"} {preview.parsed.summary.license ? `(${preview.parsed.summary.license})` : ""}</dd>
                <dt>내용</dt><dd>{countsLine(preview.parsed.summary.counts)}</dd>
                <dt>의존</dt><dd>{preview.parsed.summary.dependencies.join(", ") || "없음"}</dd>
              </dl>
              {present.includes(preview.parsed.summary.moduleId) ? <Notice tone="warn">같은 moduleId가 이미 있습니다. 설치하면 덮어씁니다.</Notice> : null}
              {missing.length ? <Notice tone="bad">먼저 설치해야 하는 모듈: {missing.join(", ")}</Notice> : null}
              {preview.parsed.warnings.length ? <Notice tone="warn"><ul>{preview.parsed.warnings.map((line) => <li key={line}>{line}</li>)}</ul></Notice> : null}
              <ul className="cl-small" style={{ columns: 2 }}>{preview.parsed.summary.entries.map((entry) => <li key={entry.id}>{CATEGORY_KO[entry.category] ?? entry.category} · {entry.name} <span className="cl-quiet">{entry.nameEn}</span></li>)}</ul>
            </>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

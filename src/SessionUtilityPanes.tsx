import { useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CatalogEntry } from "./app/contracts";
import "./session-utility-panes.css";

function searchable(entry: CatalogEntry) {
  return [entry.nameKo, entry.nameEn, entry.category, entry.source, entry.description, ...entry.capabilities]
    .join(" ")
    .toLowerCase();
}

function categoryLabel(category: CatalogEntry["category"]) {
  return ({
    class: "클래스",
    subclass: "서브클래스",
    species: "종족",
    background: "배경",
    feat: "재주",
    spell: "주문",
    item: "아이템",
    condition: "상태",
    combatant: "전투원",
    option: "규칙 옵션",
  } as Record<CatalogEntry["category"], string>)[category];
}

export function SessionRulesPane({ onClose }: { onClose(): void }) {
  const { snapshot } = useSimpleVtt();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!snapshot) return null;

  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    const source = snapshot.catalog.filter((entry) => entry.category !== "combatant");
    if (!normalized) return source.slice(0, 24);
    return source.filter((entry) => searchable(entry).includes(normalized)).slice(0, 60);
  }, [snapshot.catalog, normalized]);
  const selected = snapshot.catalog.find((entry) => entry.id === selectedId) ?? null;

  return <aside className="session-utility-pane session-rules-pane" aria-label="세션 규칙 찾아보기">
    <header className="session-utility-pane-head">
      <div><span className="eyebrow accent">RULES</span><strong>규칙 찾아보기</strong><small>세션을 떠나지 않고 확인합니다.</small></div>
      <button type="button" autoFocus aria-label="규칙 닫기" onClick={onClose}>×</button>
    </header>

    <div className="session-rules-search"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="주문, 상태, 행동, 기능 검색" aria-label="규칙 검색" /></div>

    {selected ? <section className="session-rule-detail">
      <button type="button" className="session-rule-back" onClick={() => setSelectedId(null)}>← 검색 결과</button>
      <span className="eyebrow">{categoryLabel(selected.category)} · {selected.source}</span>
      <h2>{selected.nameKo}</h2>
      {selected.nameEn && <small>{selected.nameEn}</small>}
      <p>{selected.description}</p>
      {selected.relationships.length > 0 && <div className="session-rule-related"><strong>관련 규칙</strong>{selected.relationships.slice(0, 8).map((relation) => <button type="button" key={`${relation.label}:${relation.targetId}`} onClick={() => setSelectedId(relation.targetId)}>{relation.label} · {relation.targetName}</button>)}</div>}
    </section> : <div className="session-rule-results" role="list">
      {results.map((entry) => <button type="button" role="listitem" key={entry.id} onClick={() => setSelectedId(entry.id)}><div><strong>{entry.nameKo}</strong>{entry.nameEn && <small>{entry.nameEn}</small>}</div><span>{categoryLabel(entry.category)}</span><p>{entry.description}</p></button>)}
      {results.length === 0 && <p className="session-utility-empty">일치하는 규칙이 없습니다.</p>}
    </div>}
  </aside>;
}

export function SessionActivityPane({ onClose }: { onClose(): void }) {
  const { snapshot, undoLastResolution } = useSimpleVtt();
  if (!snapshot) return null;
  const entries = snapshot.activity.slice(0, 20);
  const isDm = snapshot.session.role === "host";
  const latestUndoable = entries.find((entry) => !entry.reversed && !entry.undoOf);

  return <aside className="session-utility-pane session-activity-pane" aria-label="최근 세션 활동">
    <header className="session-utility-pane-head">
      <div><span className="eyebrow accent">ACTIVITY</span><strong>최근 결과</strong><small>필요할 때만 여는 세션 기록입니다.</small></div>
      <button type="button" autoFocus aria-label="활동 닫기" onClick={onClose}>×</button>
    </header>

    {isDm && latestUndoable && <div className="session-activity-undo"><div><strong>{latestUndoable.title}</strong><small>가장 최근 판정 결과를 기존 Undo 권위로 되돌립니다.</small></div><button type="button" onClick={() => void undoLastResolution()}>최근 판정 되돌리기</button></div>}

    <div className="session-activity-list">
      {entries.map((entry) => <article key={entry.id} className={entry.reversed ? "reversed" : ""}><div><time>{entry.time}</time><span>{entry.actor}</span></div><strong>{entry.title}</strong><p>{entry.summary}</p>{entry.stateChanges.length > 0 && <small>{entry.stateChanges.join(" · ")}</small>}</article>)}
      {entries.length === 0 && <p className="session-utility-empty">아직 기록된 결과가 없습니다.</p>}
    </div>
  </aside>;
}

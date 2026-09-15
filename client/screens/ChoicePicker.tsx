/**
 * One ChoiceRequest as a picker: selected values as removable pills, the option list grouped (spell level, feat
 * tier, ability), a search box past a few dozen options, disabled reasons shown instead of hidden, and an inline
 * detail line for the option under the cursor.
 */
import { useMemo, useState } from "react";
import type { ChoiceOption, ChoiceRequest } from "../character/types";

export function ChoicePicker({ choice, onToggle, onClear }: { choice: ChoiceRequest; onToggle: (value: string) => void; onClear?: () => void }) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selected = new Set(choice.selected);
  const full = choice.selected.length >= choice.count;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return choice.options;
    return choice.options.filter((option) => option.name.toLowerCase().includes(needle) || option.nameEn?.toLowerCase().includes(needle) || option.summary?.toLowerCase().includes(needle));
  }, [choice.options, query]);
  const groups = useMemo(() => {
    const map = new Map<string, ChoiceOption[]>();
    for (const option of filtered) { const key = option.group ?? ""; if (!map.has(key)) map.set(key, []); map.get(key)!.push(option); }
    return [...map.entries()];
  }, [filtered]);
  const byId = new Map(choice.options.map((option) => [option.id, option]));
  const collapsed = full && !showAll && choice.count === 1;
  return (
    <div className={`cl-choice${choice.satisfied ? "" : " unsatisfied"}`} data-choice={choice.id}>
      <div className="cl-choice-head">
        <span className="cl-label">{choice.label}</span>
        <span className="cl-quiet cl-small">{choice.sourceLabel}</span>
        <span className={`cl-count${choice.satisfied ? " done" : ""}`}>{choice.selected.length}/{choice.count}{choice.optional ? " · 선택 사항" : ""}</span>
      </div>
      {choice.description ? <p className="cl-choice-desc">{choice.description}</p> : null}
      {choice.selected.length > 0 ? (
        <div className="cl-choice-selected">
          {choice.selected.map((id) => <button type="button" key={id} className="cl-pill accent" title="눌러서 해제" onClick={() => onToggle(id)}>{byId.get(id)?.name ?? id} ✕</button>)}
          {choice.selected.length > 1 && onClear ? <button type="button" className="cl-btn quiet small" onClick={onClear}>모두 해제</button> : null}
          {collapsed ? <button type="button" className="cl-btn quiet small" onClick={() => setShowAll(true)}>바꾸기</button> : null}
        </div>
      ) : null}
      {collapsed ? null : (
        <>
          {choice.options.length > 24 ? <input className="cl-search" placeholder="검색" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
          <div className="cl-choice-options" role="listbox" aria-label={choice.label} aria-multiselectable={choice.count > 1}>
            {choice.options.length === 0 ? <p className="cl-quiet cl-small">고를 수 있는 항목이 없습니다.</p> : null}
            {groups.map(([group, options]) => (
              <div key={group || "_"}>
                {group ? <div className="cl-choice-group">{group}</div> : null}
                {options.map((option) => {
                  const isSelected = selected.has(option.id);
                  const disabled = Boolean(option.disabledReason) || (!isSelected && full && choice.count > 1);
                  return (
                    <div key={option.id} className="cl-option-wrap">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`cl-option${isSelected ? " selected" : ""}`}
                        disabled={Boolean(option.disabledReason)}
                        title={disabled && !option.disabledReason ? "이미 최대 수를 골랐습니다" : undefined}
                        onClick={() => { if (!isSelected && full && choice.count > 1) return; onToggle(option.id); if (choice.count === 1) setShowAll(false); }}
                        onMouseEnter={() => setDetail(option.id)}
                        onFocus={() => setDetail(option.id)}
                      >
                        <span className="cl-name">{option.name}</span>
                        {option.nameEn && option.nameEn !== option.name ? <span className="cl-en">{option.nameEn}</span> : null}
                        {option.summary ? <span className="cl-summary">{option.summary}</span> : null}
                        {option.disabledReason ? <span className="cl-why">{option.disabledReason}</span> : null}
                      </button>
                      {detail === option.id && (option.description || option.summary) ? <div className="cl-option-detail">{option.description ?? option.summary}</div> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

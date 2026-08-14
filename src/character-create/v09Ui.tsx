import type { ReactNode } from "react";
import type { CharacterCreationOptionVm, CharacterCreationSection, CharacterCreationSectionStatus } from "../app/contracts";
import { featDescription } from "../app/rulePresentation";

export const STATUS_LABEL: Record<CharacterCreationSectionStatus, string> = {
  complete: "완료",
  incomplete: "선택 필요",
  blocked: "대기",
  warning: "확인 필요",
  "not-applicable": "해당 없음",
};

export function SectionShell({ section, children, aside }: { section: CharacterCreationSection; children: ReactNode; aside?: ReactNode }) {
  return <section className="create-v09-section"><header><div><span className={`create-status-pill ${section.status}`}>{STATUS_LABEL[section.status]}</span><h2>{section.label}</h2><p>{section.description}</p></div>{aside}</header>{section.automaticGrants.length > 0 && <div className="automatic-grants"><span className="eyebrow">AUTOMATIC GRANTS</span>{section.automaticGrants.map((grant) => <span key={grant}>✓ {grant}</span>)}</div>}{children}{section.validation.length > 0 && <div className="validation-list section-validation">{section.validation.map((message, index) => <div className={`validation ${message.severity}`} key={`${message.message}-${index}`}>{message.severity.toUpperCase()} · {message.message}</div>)}</div>}</section>;
}

function inferredDetail(option: CharacterCreationOptionVm) {
  const description = option.description ?? featDescription(option.id) ?? option.summary;
  const detailLines = option.detailLines ?? [
    ...(option.id.startsWith("dnd.srd521.spell.") ? ["SRD 주문 · 상세 본문 materialization을 지원하는 presentation slot"] : []),
    ...(option.grants.length ? option.grants : []),
  ];
  return { description, detailLines };
}

export function OptionCard({ option, onClick }: { option: CharacterCreationOptionVm; onClick?: () => void }) {
  const detail = inferredDetail(option);
  const unavailable = !onClick && !option.selected;
  return <button
    type="button"
    className={`create-option-card compact ${option.selected ? "selected" : ""} ${unavailable ? "is-unavailable" : ""}`}
    onClick={onClick}
    aria-disabled={unavailable}
  >
    <div className="create-option-card-head">
      <span className="option-monogram">{option.name.slice(0, 1)}</span>
      <div><strong>{option.name}</strong><small>{option.nameEn}</small></div>
      <span className="option-card-state">{option.selected ? "✓" : option.recommended ? "추천" : ""}</span>
    </div>
    <p className="option-card-summary">{option.summary}</p>
    <div className="option-detail-popover" role="tooltip">
      <div className="option-detail-title"><strong>{option.name}</strong><small>{option.nameEn}</small></div>
      <p>{detail.description}</p>
      {detail.detailLines.length > 0 && <div className="option-detail-facts">{detail.detailLines.map((line) => <span key={line}>{line}</span>)}</div>}
      {option.choices.length > 0 && <div className="option-detail-followups"><b>이 선택 뒤에 결정할 것</b>{option.choices.map((choice) => <span key={choice}>{choice}</span>)}</div>}
      <small className="option-detail-source">{option.source}</small>
    </div>
  </button>;
}

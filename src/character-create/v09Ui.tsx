import type { ReactNode } from "react";
import type { CharacterCreationOptionVm, CharacterCreationSection, CharacterCreationSectionStatus } from "../app/contracts";

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

export function OptionCard({ option, onClick }: { option: CharacterCreationOptionVm; onClick?: () => void }) {
  return <button type="button" className={`create-option-card ${option.selected ? "selected" : ""}`} onClick={onClick} disabled={!onClick && !option.selected}><div className="create-option-card-head"><span className="option-monogram">{option.name.slice(0, 1)}</span><div><strong>{option.name}</strong><small>{option.nameEn}</small></div>{option.recommended && <span className="badge warning">추천</span>}{option.selected && <span className="badge">선택됨</span>}</div><p>{option.summary}</p><div className="option-grants">{option.grants.slice(0, 4).map((grant) => <span key={grant}>{grant}</span>)}</div>{option.choices.length > 0 && <div className="option-followups"><b>선택 후 질문</b>{option.choices.map((choice) => <span key={choice}>{choice}</span>)}</div>}<small className="option-source">{option.source}</small></button>;
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
    ...(option.id.startsWith("dnd.srd521.spell.") ? ["SRD 주문 · 전체 본문은 presentation materialization과 연결되는 슬롯입니다."] : []),
    ...option.grants,
  ];
  return { description, detailLines };
}

type PopoverPosition = { top: number; left: number; width: number };
function popoverPosition(rect: DOMRect): PopoverPosition {
  const width = Math.min(380, Math.max(300, window.innerWidth * 0.28));
  const left = rect.right + 10 + width <= window.innerWidth - 12 ? rect.right + 10 : Math.max(12, rect.left - width - 10);
  const top = Math.max(12, Math.min(rect.top, window.innerHeight - 390));
  return { top, left, width };
}

export function OptionCard({ option, onClick }: { option: CharacterCreationOptionVm; onClick?: () => void }) {
  const detail = inferredDetail(option);
  const unavailable = !onClick && !option.selected;
  const ref = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    const update = () => ref.current && setPosition(popoverPosition(ref.current.getBoundingClientRect()));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return <>
    <button
      ref={ref}
      type="button"
      className={`create-option-card compact ${option.selected ? "selected" : ""} ${unavailable ? "is-unavailable" : ""}`}
      onClick={onClick}
      aria-disabled={unavailable}
      aria-describedby={open ? tooltipId : undefined}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <div className="create-option-card-head">
        <span className="option-monogram">{option.name.slice(0, 1)}</span>
        <div><strong>{option.name}</strong><small>{option.nameEn}</small></div>
        <span className="option-card-state">{option.selected ? "✓" : option.recommended ? "추천" : ""}</span>
      </div>
      <p className="option-card-summary">{option.summary}</p>
    </button>
    {open && position && createPortal(
      <div id={tooltipId} className="option-detail-popover portal" role="tooltip" style={{ top: position.top, left: position.left, width: position.width }}>
        <div className="option-detail-title"><strong>{option.name}</strong><small>{option.nameEn}</small></div>
        <p>{detail.description}</p>
        {detail.detailLines.length > 0 && <div className="option-detail-facts">{detail.detailLines.map((line) => <span key={line}>{line}</span>)}</div>}
        {option.choices.length > 0 && <div className="option-detail-followups"><b>이 선택 뒤에 결정할 것</b>{option.choices.map((choice) => <span key={choice}>{choice}</span>)}</div>}
        <small className="option-detail-source">{option.source}</small>
      </div>,
      document.body,
    )}
  </>;
}

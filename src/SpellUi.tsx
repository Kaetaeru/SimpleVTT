import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  isConcentrationSpell,
  spellLevelLabel,
  spellPresentationById,
  spellSchoolLabel,
  spellVisual,
  type SpellPresentation,
  type SpellVisualKey,
} from "./app/spellPresentation";

type TooltipPosition = { top:number; left:number; width:number };

type SpellTileProps = {
  spellId: string;
  selected?: boolean;
  disabled?: boolean;
  status?: string;
  compact?: boolean;
  onClick?: () => void;
};

function tooltipPosition(rect: DOMRect): TooltipPosition {
  const width = Math.min(440, Math.max(330, window.innerWidth * .32));
  const right = rect.right + 12;
  const left = right + width <= window.innerWidth - 14 ? right : Math.max(14, rect.left - width - 12);
  const top = Math.max(14, Math.min(rect.top - 6, window.innerHeight - 510));
  return { top, left, width };
}

export function spellIconShape(key: SpellVisualKey) {
  if (key === "fire") return <path d="M13 2c1 4-2 5-1 8 1-2 3-2 4-4 3 4 4 8 2 12-2 4-9 5-12 1-3-4-1-9 3-12 0 3 2 4 3 5 0-4 2-7 4-10Z"/>;
  if (key === "cold") return <><path d="M12 2v20M4 6l16 12M20 6 4 18"/><path d="m12 2-2 3m2-3 2 3m-2 17-2-3m2 3 2-3"/></>;
  if (key === "lightning") return <path d="m13 2-7 12h6l-1 8 7-12h-6l1-8Z"/>;
  if (key === "acid") return <><path d="M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12Z"/><path d="M9 15c1 2 3 2 5 1"/></>;
  if (key === "poison") return <><circle cx="9" cy="9" r="2"/><circle cx="15" cy="9" r="2"/><path d="M7 15c3-2 7-2 10 0M8 18l8-6m0 6-8-6"/></>;
  if (key === "psychic") return <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>;
  if (key === "radiant") return <><circle cx="12" cy="12" r="4"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4M4 4l3 3m10 10 3 3M20 4l-3 3M7 17l-3 3"/></>;
  if (key === "necrotic") return <><path d="M17 3a8 8 0 1 0 4 14 7 7 0 1 1-4-14Z"/><path d="m17 14 4 4m0-4-4 4"/></>;
  if (key === "force") return <><path d="m12 2 7 4v12l-7 4-7-4V6l7-4Z"/><circle cx="12" cy="12" r="3"/></>;
  if (key === "thunder") return <><path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/></>;
  if (key === "healing") return <><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 7-6 12-6 12Z"/><path d="M12 8v6m-3-3h6"/></>;

  const school = key.slice("school:".length);
  if (school === "abjuration") return <path d="M12 2 20 5v6c0 5-3 9-8 11-5-2-8-6-8-11V5l8-3Zm0 5v10"/>;
  if (school === "conjuration") return <><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></>;
  if (school === "divination") return <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2"/></>;
  if (school === "enchantment") return <><path d="M12 20S4 15 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 6-6 11-6 11Z"/><path d="M12 4v4"/></>;
  if (school === "evocation") return <><path d="m12 2 2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7Z"/><circle cx="12" cy="12" r="2"/></>;
  if (school === "illusion") return <><path d="m5 6 7-4 7 4v8l-7 4-7-4V6Z"/><path d="m5 10 7 4 7-4M12 6v8"/></>;
  if (school === "necromancy") return <><path d="M6 11a6 6 0 1 1 12 0v5l-3 2H9l-3-2v-5Z"/><circle cx="10" cy="11" r="1"/><circle cx="14" cy="11" r="1"/><path d="M12 13v3"/></>;
  if (school === "transmutation") return <><path d="M7 6a7 7 0 0 1 11 2l2-1-1 5-5-1 2-1a5 5 0 0 0-8-2"/><path d="M17 18a7 7 0 0 1-11-2l-2 1 1-5 5 1-2 1a5 5 0 0 0 8 2"/></>;
  return <circle cx="12" cy="12" r="8"/>;
}

export function SpellGlyph({ spell, size = "md" }: { spell:SpellPresentation; size?:"xs" | "sm" | "md" | "lg" }) {
  const visual = spellVisual(spell);
  return <span className={`spell-glyph spell-glyph-${size} visual-${visual.key.replace(":", "-")}`} title={`${visual.label} ${visual.source === "school" ? "학파" : "속성"}`} aria-label={`${visual.label} ${visual.source === "school" ? "학파" : "속성"}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{spellIconShape(visual.key)}</svg>
  </span>;
}

export function SpellTooltip({ spellId, status, children, interactive = false }: { spellId:string; status?:string; children:ReactNode; interactive?:boolean }) {
  const spell = spellPresentationById(spellId);
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useEffect(() => {
    if (!open || !host.current) return;
    const update = () => host.current && setPosition(tooltipPosition(host.current.getBoundingClientRect()));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  if (!spell) return <>{children}</>;
  const visual = spellVisual(spell);
  const concentrated = isConcentrationSpell(spell);
  return <>
    <div
      ref={host}
      className="spell-tooltip-host"
      tabIndex={interactive ? undefined : 0}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >{children}</div>
    {open && position && createPortal(
      <div className="spell-rule-tooltip" role="tooltip" style={{ top:position.top, left:position.left, width:position.width }}>
        <header className="spell-tooltip-header">
          <SpellGlyph spell={spell} size="lg"/>
          <div>
            <strong>{spell.name}</strong>
            <small>{spell.nameEn}</small>
            <div className="spell-tooltip-badges">
              <span>{spellLevelLabel(spell)}</span>
              <span>{spellSchoolLabel(spell)}</span>
              <span>{visual.source === "property" ? `${visual.label} 속성` : `${visual.label} 아이콘`}</span>
              {spell.ritual && <span>의식</span>}
              {concentrated && <span>집중</span>}
              {status && <span>{status}</span>}
            </div>
          </div>
        </header>
        <div className="spell-tooltip-facts">
          <div><span>시전 시간</span><strong>{spell.castingTime}</strong></div>
          <div><span>사거리</span><strong>{spell.range}</strong></div>
          <div><span>구성요소</span><strong>{spell.components}</strong></div>
          <div><span>지속시간</span><strong>{spell.duration}</strong></div>
        </div>
        <div className="spell-tooltip-summary">{spell.summary}</div>
        <div className="spell-tooltip-description">{spell.description}</div>
        <footer>SRD 5.2.1 · {visual.source === "property" ? `대표 속성 ${visual.label}` : `속성 없음 · ${visual.label} 학파 아이콘`}</footer>
      </div>,
      document.body,
    )}
  </>;
}

export function SpellTile({ spellId, selected = false, disabled = false, status, compact = false, onClick }: SpellTileProps) {
  const spell = spellPresentationById(spellId);
  if (!spell) return null;
  const tile = <div className={`spell-tile ${selected ? "selected" : ""} ${disabled ? "disabled" : ""} ${compact ? "compact" : ""}`}>
    <SpellGlyph spell={spell} size={compact ? "sm" : "md"}/>
    <div className="spell-tile-copy">
      <strong>{spell.name}</strong>
      <small>{spellLevelLabel(spell)} · {spellSchoolLabel(spell)}</small>
    </div>
    <span className="spell-tile-state">{selected ? "✓" : status ?? ""}</span>
  </div>;

  if (onClick) return <SpellTooltip spellId={spellId} status={status} interactive><button type="button" className="spell-tile-button" disabled={disabled} onClick={onClick}>{tile}</button></SpellTooltip>;
  return <SpellTooltip spellId={spellId} status={status}>{tile}</SpellTooltip>;
}

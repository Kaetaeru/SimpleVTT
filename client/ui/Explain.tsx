/** A number with its provenance: hover or focus shows the addends that make it up. */
import type { ReactNode } from "react";
import type { Term } from "../character/types";
import { signed } from "./components";

export function Explain({ terms, total, label, children, className }: { terms: Term[]; total?: number; label?: string; children: ReactNode; className?: string }) {
  const sum = total ?? terms.reduce((acc, term) => acc + term.value, 0);
  const show = (term: Term) => (term.dice ? `+${term.dice}` : signed(term.value));
  const diceText = terms.filter((term) => term.dice).map((term) => `+${term.dice}`).join("");
  const text = `${label ? `${label}: ` : ""}${terms.map((term) => `${term.label} ${show(term)}`).join(" · ")} = ${sum}${diceText}`;
  return (
    <span className={`cl-explain${className ? ` ${className}` : ""}`} tabIndex={0} aria-label={text} data-explain={text}>
      {children}{diceText ? <small className="cl-dice-tag">{diceText}</small> : null}
      <span className="cl-pop" role="tooltip">
        {label ? <span className="cl-pop-title">{label}</span> : null}
        {terms.map((term, index) => (
          <span className="cl-pop-row" key={`${term.label}-${index}`}><span>{term.label}</span><span className="cl-pop-v">{show(term)}</span></span>
        ))}
        <span className="cl-pop-row cl-pop-total"><span>합계</span><span className="cl-pop-v">{typeof total === "number" && label === "최대 HP" ? sum : signed(sum)}{diceText}</span></span>
      </span>
    </span>
  );
}

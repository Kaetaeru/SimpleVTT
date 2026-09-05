import type { DamageSpecVm, ResolutionView, SceneEntity } from "./contracts";

/**
 * V1.2 T1-08 — table-facing presentation of engine ledger lines. The engine keeps its exact change ledger
 * (`<entityId> economy.action true → false`, `resource.<id> 3 → 2`, …) because tests and undo read it; the
 * activity pane and the result card show these through this presenter: entity names instead of ids, Korean
 * words instead of field paths, and dice formulas without zero-count dice.
 */
export interface PresentationContext {
  entities:ReadonlyArray<Pick<SceneEntity,"id"|"name">>;
  /** resource id → label (from the active character's resource rail) */
  resourceLabels?:ReadonlyMap<string,string>;
  /** actor id for lines that omit a subject */
  activeCharacterId?:string;
  activeCharacterName?:string;
}

const ECONOMY_FIELD:Record<string,string>={ action:"행동", bonusAction:"추가 행동", reaction:"반응", movement:"이동", movementMax:"최대 이동" };
const LIFE_FIELD:Record<string,string>={ downed:"쓰러짐", dead:"사망", stable:"안정", unconscious:"무의식", deathSaveSuccesses:"죽음 내성 성공", deathSaveFailures:"죽음 내성 실패" };

function nameOf(context:PresentationContext,id:string) {
  if (context.activeCharacterId===id && context.activeCharacterName) return context.activeCharacterName;
  return context.entities.find((entity)=>entity.id===id)?.name ?? id;
}

function trueFalse(value:string,truthy:string,falsy:string) {
  return value==="true" ? truthy : value==="false" ? falsy : value;
}

/** Strips zero-count dice from a formula ("0d2 + 3" → "3", "1d8 + 4" unchanged). */
export function presentDiceFormula(formula:string) {
  return formula
    .replace(/\b0d\d+\s*\+\s*/g,"")
    .replace(/\+\s*0d\d+\b/g,"")
    .replace(/\b0d\d+\b/g,"0")
    .replace(/\s{2,}/g," ")
    .trim();
}

export function presentDamageFormula(part:Pick<DamageSpecVm,"dice"|"flat"|"type">) {
  const dice=/^0d/.test(part.dice) ? "" : part.dice;
  const flat=part.flat ? (dice ? ` ${part.flat>0 ? "+" : "-"} ${Math.abs(part.flat)}` : String(part.flat)) : dice ? "" : "0";
  return `${dice}${flat} ${part.type}`.trim();
}

/** One ledger line → one table sentence. Unknown formats pass through with ids replaced by names. */
export function presentStateChange(line:string,context:PresentationContext):string {
  let match:RegExpMatchArray|null;
  if ((match=line.match(/^(\S+) economy\.(\w+) (\S+) → (\S+)$/))) {
    const [,id,field,before,after]=match;
    const who=nameOf(context,id);
    const label=ECONOMY_FIELD[field] ?? field;
    if (field==="movement" || field==="movementMax") return `${who} · ${label} ${before} → ${after}피트`;
    if (before==="true" && after==="false") return `${who} · ${label} 사용`;
    if (before==="false" && after==="true") return `${who} · ${label} 회복`;
    return `${who} · ${label} ${trueFalse(before,"가능","사용됨")} → ${trueFalse(after,"가능","사용됨")}`;
  }
  if ((match=line.match(/^(\S+) (HP|최대 HP|임시 HP) (\S+) → (\S+)$/))) {
    const [,id,field,before,after]=match;
    return `${nameOf(context,id)} · ${field} ${before} → ${after}`;
  }
  if ((match=line.match(/^(\S+) resource\.(\S+) (\S+) → (\S+)$/))) {
    const [,id,resourceId,before,after]=match;
    const label=context.resourceLabels?.get(resourceId) ?? resourceId.replace(/^resource\./,"").replace(/[-.]/g," ");
    return `${nameOf(context,id)} · ${label} ${before} → ${after}`;
  }
  if ((match=line.match(/^(\S+) item\.(\S+)\.(quantity|charges) (\S+) → (\S+)$/))) {
    const [,id,itemId,field,before,after]=match;
    return `${nameOf(context,id)} · ${itemId.split(".").pop()} ${field==="quantity" ? "수량" : "충전"} ${before} → ${after}`;
  }
  if ((match=line.match(/^(\S+) life\.(\w+) (\S+) → (\S+)$/))) {
    const [,id,field,before,after]=match;
    const label=LIFE_FIELD[field] ?? field;
    return `${nameOf(context,id)} · ${label} ${trueFalse(before,"예","아니오")} → ${trueFalse(after,"예","아니오")}`;
  }
  if ((match=line.match(/^(\S+) death-save\.(\w+) (\S+) → (\S+)$/))) {
    const [,id,field,before,after]=match;
    return `${nameOf(context,id)} · 죽음 내성 ${field==="successes" ? "성공" : field==="failures" ? "실패" : field} ${before} → ${after}`;
  }
  if ((match=line.match(/^(\S+) effect\.(\S+) (.+) → (.+)$/))) {
    const [,id,effectId,before,after]=match;
    const label=effectId.split(/[.:]/).pop() ?? effectId;
    if (before==="없음") return `${nameOf(context,id)} · 효과 시작: ${label}`;
    if (after==="없음") return `${nameOf(context,id)} · 효과 종료: ${label}`;
    return `${nameOf(context,id)} · 효과 갱신: ${label}`;
  }
  if ((match=line.match(/^(\S+) effect\.(\S+) (added|removed|updated)$/))) {
    const [,id,effectId,operation]=match;
    const label=effectId.split(/[.:]/).pop() ?? effectId;
    return `${nameOf(context,id)} · 효과 ${operation==="added" ? "시작" : operation==="removed" ? "종료" : "갱신"}: ${label}`;
  }
  if ((match=line.match(/^(\S+) concentration (.+) → (.+)$/))) {
    const [,id,before,after]=match;
    if (after==="없음") return `${nameOf(context,id)} · 집중 종료`;
    if (before==="없음") return `${nameOf(context,id)} · 집중 시작`;
    return `${nameOf(context,id)} · 집중 대상 변경`;
  }
  if ((match=line.match(/^(\S+) turn-clock .*→ round (\d+) · (\S+) · .*$/)) || (match=line.match(/^(\S+) round \d+ · \S+ · .*→ round (\d+) · (\S+) · .*$/))) {
    const [,,round,actorId]=match;
    return `턴 진행 · ${round}라운드 · ${nameOf(context,actorId)}`;
  }
  if ((match=line.match(/^(\S+) combatant (added|removed)$/))) {
    const [,id,operation]=match;
    return `${nameOf(context,id)} · ${operation==="added" ? "전투 참여" : "전투 이탈"}`;
  }
  if ((match=line.match(/^(\S+) spellcasting-turn .*$/))) return `${nameOf(context,match[1])} · 주문 시전 턴 갱신`;
  if ((match=line.match(/^(\S+) (inventory-item|artifact|zone-membership)\.(\S+) (\S+)$/))) {
    const [,id,kind,itemId,operation]=match;
    const label=itemId.split(/[.:]/).pop() ?? itemId;
    const verb=operation==="added"||operation==="created" ? "추가" : operation==="removed"||operation==="deleted" ? "제거" : operation;
    return `${nameOf(context,id)} · ${kind==="inventory-item" ? "아이템" : kind==="artifact" ? "효과물" : "영역"} ${label} ${verb}`;
  }
  // Generic pass: swap known ids for names, hide zero dice.
  let presented=presentDiceFormula(line);
  for (const entity of context.entities) presented=presented.split(entity.id).join(entity.name);
  if (context.activeCharacterId && context.activeCharacterName) presented=presented.split(context.activeCharacterId).join(context.activeCharacterName);
  return presented;
}

export function presentStateChanges(lines:readonly string[],context:PresentationContext):string[] {
  const seen=new Set<string>();
  const out:string[]=[];
  for (const line of lines) {
    const presented=presentStateChange(line,context);
    if (seen.has(presented)) continue;
    seen.add(presented);
    out.push(presented);
  }
  return out;
}

/** The roll on one line: "d20 15 + 7 = 22 vs AC 15" or "d20 15 / 3 (불리점) + 5 = 8 vs AC 14". */
export function presentDiceLine(resolution:Pick<ResolutionView,"rollKind"|"naturalD20"|"authoritativeDice"|"attackTotal"|"rollTotal"|"targetAc"|"rollStateContributions"|"saveResults"|"checkTarget">):string|null {
  const total=resolution.attackTotal ?? resolution.rollTotal;
  if (resolution.naturalD20!==undefined && total!==undefined) {
    const states=resolution.rollStateContributions ?? [];
    const advantage=states.filter((entry)=>entry.state==="advantage").length;
    const disadvantage=states.filter((entry)=>entry.state==="disadvantage").length;
    const stateLabel=advantage && disadvantage ? "상쇄" : advantage ? "이점" : disadvantage ? "불리점" : "";
    const faces=states.length && resolution.authoritativeDice.length>=2 && resolution.rollKind!=="damage" ? resolution.authoritativeDice.slice(0,2).join(" / ") : String(resolution.naturalD20);
    const modifier=total-resolution.naturalD20;
    const target=resolution.targetAc!==undefined ? ` vs AC ${resolution.targetAc}` : resolution.checkTarget!==undefined ? ` vs DC ${resolution.checkTarget}` : "";
    return `d20 ${faces}${stateLabel ? ` (${stateLabel})` : ""} ${modifier>=0 ? "+" : "-"} ${Math.abs(modifier)} = ${total}${target}`;
  }
  if (resolution.saveResults.length) return resolution.saveResults.map((save)=>`${save.targetName} d20 ${save.d20} ${save.total-save.d20>=0 ? "+" : "-"} ${Math.abs(save.total-save.d20)} = ${save.total} vs DC ${save.dc}`).join(" · ");
  return null;
}

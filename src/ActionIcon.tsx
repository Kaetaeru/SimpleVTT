import type { ActionVm } from "./app/contracts";
import { actionIconDescriptor, type ActionIconKey } from "./app/actionIconProjection";
import { spellIconShape } from "./SpellUi";

const SPELL_KEYS=new Set(["fire","cold","lightning","acid","poison","psychic","radiant","necrotic","force","thunder","healing"]);

function actionIconShape(key:ActionIconKey) {
  if (SPELL_KEYS.has(key)||key.startsWith("school:")) return spellIconShape(key as Parameters<typeof spellIconShape>[0]);
  if (key==="weapon-slashing") return <><path d="m5 19 3-3M7 17 17 4l3-1-1 3L9 19 7 17Z"/><path d="m4 16 4 4m-5 1 3-3"/></>;
  if (key==="weapon-piercing") return <><path d="M3 21 19 5"/><path d="m14 4 6-1-1 6M5 15l4 4M3 17l4 4"/></>;
  if (key==="weapon-bludgeoning") return <><path d="m7 21 8-12"/><path d="m12 3 7 5-3 4-7-5 3-4Z"/></>;
  if (key==="weapon-attack") return <><path d="m5 3 14 18M19 3 5 21"/><path d="m3 5 4-2-2 4m16-2-4-2 2 4M3 19l4 2-2-4m16 2-4 2 2-4"/></>;
  if (key==="item") return <><path d="M8 3h8l-1 4c3 2 5 5 5 9 0 3-3 5-8 5s-8-2-8-5c0-4 2-7 5-9L8 3Z"/><path d="M8 7h8M9 14h6m-3-3v6"/></>;
  if (key==="ability-check") return <><path d="m12 2 8 6-3 10-10 1L4 8l8-6Z"/><path d="M9 8h6l-1 7h-4L9 8Z"/></>;
  if (key==="saving-throw") return <><path d="M12 2 20 5v6c0 5-3 9-8 11-5-2-8-6-8-11V5l8-3Z"/><path d="m8 12 3 3 5-6"/></>;
  if (key==="magic") return <><path d="m12 2 2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7Z"/><path d="M4 4l2 2m12-2-2 2"/></>;
  return <><circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/></>;
}

export function ActionIcon({action}: {action:ActionVm}) {
  const icon=actionIconDescriptor(action);
  return <span className={`session-action-icon visual-${icon.key.replace(":","-")}`} data-action-icon={icon.key} data-icon-source={icon.source} title={icon.label} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{actionIconShape(icon.key)}</svg>
  </span>;
}

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
  if (key==="movement") return <><path d="M5 19c4-1 6-4 7-8l2-7 3 1-1 7 4 3-2 4H9l-4 2v-2Z"/><path d="m3 9 3-3m-3 7 4-4"/></>;
  if (key==="disengage") return <><path d="M8 5h10v10"/><path d="m18 5-9 9"/><path d="M4 10v9h9"/></>;
  if (key==="dodge") return <><circle cx="12" cy="12" r="3"/><path d="M12 3C7 3 4 6 4 10m8 11c5 0 8-3 8-7"/><path d="m3 6 1 4 4-1m13 9-1-4-4 1"/></>;
  if (key==="help") return <><path d="M12 20s-8-4.5-8-10a4 4 0 0 1 7-2.6A4 4 0 0 1 20 10c0 5.5-8 10-8 10Z"/><path d="M9 12h6m-3-3v6"/></>;
  if (key==="hide") return <><path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z"/><circle cx="12" cy="12" r="2"/><path d="M4 20 20 4"/></>;
  if (key==="ready") return <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M12 2V1m0 22v-1M2 12H1m22 0h-1"/></>;
  if (key==="utilize") return <><path d="m7 8 5-3 5 3v7l-5 3-5-3V8Z"/><path d="m7 8 5 3 5-3m-5 3v7"/><path d="M3 12h3m12 0h3"/></>;
  if (key==="influence") return <><path d="M4 5h11v8H9l-4 3v-3H4V5Z"/><path d="M9 16h6l4 3v-8h-2"/></>;
  if (key==="search") return <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M8 10h4m-2-2v4"/></>;
  if (key==="study") return <><path d="M3 5c4-1 7 0 9 2v13c-2-2-5-3-9-2V5Zm18 0c-4-1-7 0-9 2v13c2-2 5-3 9-2V5Z"/><path d="M6 9h3m-3 3h3m6-3h3m-3 3h3"/></>;
  if (key==="magic") return <><path d="m12 2 2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7Z"/><path d="M4 4l2 2m12-2-2 2"/></>;
  return <><circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/></>;
}

export function ActionIcon({action}: {action:ActionVm}) {
  const icon=actionIconDescriptor(action);
  return <span className={`session-action-icon visual-${icon.key.replace(":","-")}`} data-action-icon={icon.key} data-icon-source={icon.source} title={icon.label} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{actionIconShape(icon.key)}</svg>
  </span>;
}

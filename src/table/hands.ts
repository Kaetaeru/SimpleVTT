import type { CharacterSheet, ItemInstanceVm } from "../app/contracts";
import { weaponHasProperty, weaponRuleById } from "../domain/weaponRuleCatalog";

/**
 * Hands are not a separate state: they are the sheet's wielded items (`wielded` + `wieldSlot`), the same fields
 * character creation and the spell component check already read. Two hands; a two-handed item takes both.
 */
export type HandSlot="main-hand"|"off-hand"|"two-hand";

export function wieldedItems(sheet:Pick<CharacterSheet,"items">):ItemInstanceVm[] {
  return sheet.items.filter((item)=>item.wielded&&item.wieldSlot);
}

export function occupiedSlots(sheet:Pick<CharacterSheet,"items">):Set<"main-hand"|"off-hand"> {
  const occupied=new Set<"main-hand"|"off-hand">();
  for(const item of wieldedItems(sheet)) {
    if(item.wieldSlot==="two-hand") { occupied.add("main-hand"); occupied.add("off-hand"); }
    else if(item.wieldSlot) occupied.add(item.wieldSlot);
  }
  return occupied;
}

export function freeHands(sheet:Pick<CharacterSheet,"items">):number { return 2-occupiedSlots(sheet).size; }

export function isShieldItem(item:Pick<ItemInstanceVm,"definitionId"|"name">):boolean {
  return /shield/i.test(item.definitionId)||/방패/.test(item.name);
}

export function isTwoHandedItem(item:Pick<ItemInstanceVm,"definitionId">):boolean {
  const rule=weaponRuleById(item.definitionId);
  return rule?weaponHasProperty(rule,"two-handed"):false;
}

/** The slot an item goes to when drawn without a stated preference: shields to the off hand, two-handed weapons to both, else the first free hand. */
export function defaultSlotFor(sheet:Pick<CharacterSheet,"items">,item:Pick<ItemInstanceVm,"definitionId"|"name">):HandSlot|null {
  const occupied=occupiedSlots(sheet);
  if(isTwoHandedItem(item)) return occupied.size===0?"two-hand":null;
  if(isShieldItem(item)) return occupied.has("off-hand")?null:"off-hand";
  if(!occupied.has("main-hand")) return "main-hand";
  if(!occupied.has("off-hand")) return "off-hand";
  return null;
}

export function slotIsFree(sheet:Pick<CharacterSheet,"items">,slot:HandSlot):boolean {
  const occupied=occupiedSlots(sheet);
  if(slot==="two-hand") return occupied.size===0;
  return !occupied.has(slot);
}

const SLOT_LABEL:Record<HandSlot,string>={"main-hand":"주손","off-hand":"보조손","two-hand":"양손"};

/** "장검 (주손) · 방패 (보조손)" or "빈손". */
export function handsLabel(sheet:Pick<CharacterSheet,"items">):string {
  const held=wieldedItems(sheet).map((item)=>`${item.name} (${SLOT_LABEL[item.wieldSlot as HandSlot]})`);
  return held.length?held.join(" · "):"빈손";
}

/**
 * Using an item from the turn panel (D98): consumables are spent, healing potions roll their dice, everything
 * else is logged — the DM narrates the rest.
 *
 * H5d (D247): what an item does is its data — the catalog item's `consumable-definition` (`healing`) or a pasted
 * item's `use` — not a guess from its name.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { CustomItem } from "../character/customItem";

export interface ItemUse {
  /** One is removed from the stack. */
  consumes: boolean;
  /** Healing formula when the item is a healing potion. */
  heal?: string;
  text: string;
}

export function itemUse(item: { name: string; kind: string; itemId?: string; magic?: CustomItem }, catalog?: Pick<ContentCatalog, "itemById">): ItemUse {
  const view = item.itemId ? catalog?.itemById(item.itemId) : undefined;
  const heal = view?.consumable?.healing ?? item.magic?.use?.healing;
  const consumes = Boolean(view?.consumable) || item.kind === "consumable" || item.kind === "ammunition" || item.magic?.use?.consumes === true || Boolean(heal);
  if (heal) return { consumes, heal, text: `${item.name} 마심 (${heal} 회복)` };
  return { consumes, text: `${item.name} 사용` };
}

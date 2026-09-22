/**
 * Using an item from the turn panel (D98): consumables are spent, healing potions roll their dice, everything
 * else is logged — the DM narrates the rest.
 *
 * H5d (D247): what an item does is its data — the catalog item's `consumable-definition` (`healing`) or a pasted
 * item's `use` — not a guess from its name.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { CustomItem } from "../character/customItem";
import type { ActiveEffect } from "../character/types";
import { durationInRounds } from "./activation";

export interface ItemUse {
  /** One is removed from the stack. */
  consumes: boolean;
  /** Healing formula when the item is a healing potion. */
  heal?: string;
  text: string;
  /** D353: temporary hit points the drinker gets. */
  tempHp?: string;
  /** D353: what it starts on the drinker — an effect with the item's grants, or a spell's effect without concentration. */
  effect?: ActiveEffect;
}

export function itemUse(item: { name: string; kind: string; itemId?: string; magic?: CustomItem }, catalog?: Pick<ContentCatalog, "itemById" | "spellById">): ItemUse {
  const view = item.itemId ? catalog?.itemById(item.itemId) : undefined;
  const heal = view?.consumable?.healing ?? item.magic?.use?.healing;
  const use = item.magic?.use;
  const effect = itemEffect(item.name, use, catalog);
  const consumes = Boolean(view?.consumable) || item.kind === "consumable" || item.kind === "ammunition" || use?.consumes === true || Boolean(heal) || Boolean(effect) || Boolean(use?.tempHp);
  const parts = [...(heal ? [`${heal} 회복`] : []), ...(use?.tempHp ? [`임시 HP ${use.tempHp}`] : []), ...(effect ? [`${effect.name} ${effect.duration}`] : [])];
  const extra = { ...(use?.tempHp ? { tempHp: use.tempHp } : {}), ...(effect ? { effect } : {}) };
  if (parts.length) return { consumes, ...(heal ? { heal } : {}), ...extra, text: `${item.name} ${!item.magic || item.magic.type === "potion" ? "마심" : "사용"} (${parts.join(" · ")})` };
  return { consumes, text: `${item.name} 사용` };
}

/** D353: the effect a drink starts, keyed by the item so a second drink replaces the first. */
function itemEffect(name: string, use: CustomItem["use"], catalog?: Pick<ContentCatalog, "spellById">): ActiveEffect | undefined {
  if (use?.spell) {
    const spell = catalog?.spellById(use.spell.spellId);
    const duration = use.spell.duration ?? (spell?.duration ?? "").replace(/^집중[,\s]*(최대\s*)?/, "");
    const rounds = use.spell.rounds ?? durationInRounds(duration);
    return { key: `spell:${use.spell.spellId}`, name: spell?.name ?? name, source: "spell", duration, concentration: false, ...(rounds !== undefined ? { rounds } : {}), elapsed: 0, startedAt: "" };
  }
  const rounds = use?.effect ? use.effect.rounds ?? durationInRounds(use.effect.duration) : undefined;
  // D356: a permanent one (교본) is its own each time, so a second reading adds to the first.
  if (use?.effect) return { key: `item-effect:${name}${use.effect.permanent ? `:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}` : ""}`, name: use.effect.name ?? name, source: "feature", duration: use.effect.duration, concentration: false, ...(rounds !== undefined ? { rounds } : {}), elapsed: 0, startedAt: "", grants: use.effect.grants };
  return undefined;
}

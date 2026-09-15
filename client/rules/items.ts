/**
 * Using an item from the turn panel (D98): consumables are spent, healing potions roll their dice, everything
 * else is logged — the DM narrates the rest.
 */
export interface ItemUse {
  /** One is removed from the stack. */
  consumes: boolean;
  /** Healing formula when the item is a healing potion. */
  heal?: string;
  text: string;
}

const POTIONS: Array<{ test: RegExp; heal: string; label: string }> = [
  { test: /궁극|supreme/i, heal: "10d4+20", label: "궁극 치유 물약" },
  { test: /최상급|superior/i, heal: "8d4+8", label: "최상급 치유 물약" },
  { test: /상급|greater/i, heal: "4d4+4", label: "상급 치유 물약" },
  { test: /치유|healing/i, heal: "2d4+2", label: "치유 물약" },
];

export function itemUse(item: { name: string; kind: string; itemId?: string }): ItemUse {
  const potion = /물약|potion/i.test(`${item.name} ${item.itemId ?? ""}`) ? POTIONS.find((tier) => tier.test.test(item.name) || tier.test.test(item.itemId ?? "")) : undefined;
  if (potion) return { consumes: true, heal: potion.heal, text: `${item.name} 마심 (${potion.heal} 회복)` };
  const consumes = item.kind === "consumable" || item.kind === "ammunition" || /물약|potion|두루마리|scroll|횃불|torch|배급|ration/i.test(`${item.name} ${item.itemId ?? ""}`);
  return { consumes, text: `${item.name} 사용` };
}

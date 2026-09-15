/**
 * R19 (ROLL20_TABLE_SPEC.md D113): 주문 두루마리.
 *
 * SRD 5.2.1's item list carries no magic items at all, so the scroll is authored here rather than generated: a
 * scroll is an ordinary bag item whose `itemId` names the spell it holds. Reading one casts that spell at its own
 * level without a slot and destroys the scroll. A reader with spellcasting of their own uses their attack bonus and
 * save DC; a reader without one uses the scroll's (attack +5, DC 13 + the spell's level). A spell above the
 * reader's own highest slot level is the DM's call, and the card says so with the Arcana DC.
 */
export const SCROLL_PREFIX = "authored.scroll.";

export const scrollItemId = (spellId: string) => `${SCROLL_PREFIX}${spellId}`;
/** The spell a bag item holds, or undefined when the item is not a scroll. */
export const scrollSpellId = (itemId?: string) => (itemId && itemId.startsWith(SCROLL_PREFIX) ? itemId.slice(SCROLL_PREFIX.length) : undefined);
export const isScroll = (item: { itemId?: string }) => Boolean(scrollSpellId(item.itemId));
export const scrollName = (spellName: string, level: number) => `주문 두루마리 (${spellName}${level > 0 ? `, ${level}레벨` : ", 소마법"})`;
/** A scroll's own numbers, used when the reader has no spellcasting. */
export const scrollStats = (level: number) => ({ attackBonus: 5, saveDc: 13 + level });
/** Reading a spell of a higher level than you can cast: 지능(신비학) DC 10 + 주문 레벨. */
export const scrollCheckDc = (level: number) => 10 + level;
/** Rarity by spell level, so the DM can price one (2024 마법 물품 표). */
export const scrollRarity = (level: number) => (level <= 0 ? "흔함" : level <= 1 ? "흔함" : level <= 3 ? "고급" : level <= 5 ? "희귀" : level <= 8 ? "매우 희귀" : "전설");

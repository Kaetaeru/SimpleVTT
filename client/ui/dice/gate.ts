/**
 * V0.9 D346: the table waits for the dice.
 *
 * A card that arrives with dice used to land in the chat — and on the hit point bars — at the same moment the dice
 * started tumbling, so the answer was on screen before the roll had one. This is the gate between the two: while
 * dice are on screen the table shows what it showed before them, and the moment they settle the result appears.
 *
 * It is a module-level store rather than a context because the two sides live at opposite ends of the tree: the
 * dice overlay closes the gate, and the snapshot the screens read is what waits behind it.
 */
let busy = 0;
/** The chat cards whose dice are still on screen — those cards wait, the rest of the chat does not. */
let cards = new Set<string>();
const listeners = new Set<() => void>();

const tell = () => { for (const listener of [...listeners]) listener(); };

/** Dice are on screen: hold whatever the table would say about them. */
export function holdForDice() { busy += 1; tell(); }

/** Those dice are done: let the table catch up. */
export function releaseForDice() { busy = Math.max(0, busy - 1); tell(); }

/** How many rolls the table is still waiting on. */
export const diceHolding = () => busy;

export function subscribeToDice(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** This card's dice are on screen: keep it out of the chat until they have an answer. */
export function holdCard(id: string) { if (cards.has(id)) return; cards = new Set(cards).add(id); tell(); }

export function releaseCard(id: string) { if (!cards.has(id)) return; const next = new Set(cards); next.delete(id); cards = next; tell(); }

export const heldCards = () => cards;

/** Tests and a table that is left start from nothing held. */
export function resetDiceGate() { busy = 0; cards = new Set(); tell(); }

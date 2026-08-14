const selectedSlotByActor = new Map<string, number>();

export function selectedCombatSpellSlot(actorId: string, fallback = 1) {
  return selectedSlotByActor.get(actorId) ?? fallback;
}

export function setSelectedCombatSpellSlot(actorId: string, level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 9) return;
  selectedSlotByActor.set(actorId, level);
}

export function clearSelectedCombatSpellSlot(actorId: string) {
  selectedSlotByActor.delete(actorId);
}

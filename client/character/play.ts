/**
 * Play operations on the runtime (offline session on the sheet): HP damage/heal/temp, hit dice, short and long
 * rests, spell slots, resources, gold, bag changes, equip, conditions, death saves, inspiration. Every operation is a
 * pure function (runtime, derived) → runtime that also appends a log line, so the sheet can show what happened.
 */
import type { CharacterRuntime } from "./runtime";
import { emptyInventoryPatch } from "./runtime";
import type { DerivedCharacter } from "./types";

const MAX_LOG = 200;
const stamp = (runtime: CharacterRuntime, text: string): CharacterRuntime => ({ ...runtime, log: [...(runtime.log ?? []), { at: new Date().toISOString(), text }].slice(-MAX_LOG), updatedAt: new Date().toISOString() });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const CONDITIONS = ["장님", "매혹", "귀머거리", "공포", "붙잡힘", "행동불능", "투명", "마비", "석화", "중독", "넘어짐", "포박", "충격", "무의식"] as const;

// ---- hit points

export function applyDamage(runtime: CharacterRuntime, derived: DerivedCharacter, amount: number): CharacterRuntime {
  const damage = Math.max(0, Math.floor(amount));
  if (damage === 0) return runtime;
  const absorbed = Math.min(runtime.hp.temp, damage);
  const remaining = damage - absorbed;
  const current = clamp(runtime.hp.current - remaining, 0, derived.hp.max);
  const next = stamp({ ...runtime, hp: { ...runtime.hp, temp: runtime.hp.temp - absorbed, current } }, `피해 ${damage}${absorbed ? ` (임시 HP ${absorbed} 흡수)` : ""} → HP ${current}/${derived.hp.max}`);
  return current === 0 && runtime.hp.current > 0 ? stamp(next, "HP 0 — 죽음 내성 굴림 시작") : next;
}

export function applyHealing(runtime: CharacterRuntime, derived: DerivedCharacter, amount: number): CharacterRuntime {
  const healing = Math.max(0, Math.floor(amount));
  if (healing === 0) return runtime;
  const current = clamp(runtime.hp.current + healing, 0, derived.hp.max);
  const revived = runtime.hp.current === 0 && current > 0;
  return stamp({ ...runtime, hp: { ...runtime.hp, current }, ...(revived ? { deathSaves: { success: 0, failure: 0 } } : {}) }, `회복 ${healing} → HP ${current}/${derived.hp.max}`);
}

export function setCurrentHp(runtime: CharacterRuntime, derived: DerivedCharacter, value: number): CharacterRuntime {
  const current = clamp(Math.floor(value), 0, derived.hp.max);
  return stamp({ ...runtime, hp: { ...runtime.hp, current } }, `HP를 ${current}/${derived.hp.max}(으)로 설정`);
}

/** Temporary HP does not stack: the higher value stays. */
export function grantTempHp(runtime: CharacterRuntime, amount: number): CharacterRuntime {
  const temp = Math.max(runtime.hp.temp, Math.max(0, Math.floor(amount)));
  return stamp({ ...runtime, hp: { ...runtime.hp, temp } }, `임시 HP ${temp}`);
}

export function clearTempHp(runtime: CharacterRuntime): CharacterRuntime {
  return runtime.hp.temp === 0 ? runtime : stamp({ ...runtime, hp: { ...runtime.hp, temp: 0 } }, "임시 HP 제거");
}

// ---- hit dice and rests

export const hitDiceAvailable = (runtime: CharacterRuntime, derived: DerivedCharacter) =>
  Object.fromEntries(Object.entries(derived.hitDice).map(([die, count]) => [die, Math.max(0, count - (runtime.hitDiceSpent[die] ?? 0))])) as Record<string, number>;

export const rollDie = (die: string, random: () => number = Math.random) => {
  const sides = Number(die.replace(/^d/, "")) || 8;
  return 1 + Math.floor(random() * sides);
};

/** Spend one hit die: heal roll + CON modifier (at least 0). */
export function spendHitDie(runtime: CharacterRuntime, derived: DerivedCharacter, die: string, roll: number): CharacterRuntime {
  const available = hitDiceAvailable(runtime, derived)[die] ?? 0;
  if (available <= 0) return runtime;
  const healing = Math.max(0, roll + derived.abilities.con.modifier);
  const current = clamp(runtime.hp.current + healing, 0, derived.hp.max);
  return stamp({ ...runtime, hitDiceSpent: { ...runtime.hitDiceSpent, [die]: (runtime.hitDiceSpent[die] ?? 0) + 1 }, hp: { ...runtime.hp, current } }, `히트 다이스 ${die} 사용: ${roll} ${derived.abilities.con.modifier >= 0 ? "+" : "−"} ${Math.abs(derived.abilities.con.modifier)} = ${healing} 회복 → HP ${current}/${derived.hp.max}`);
}

/** Short rest: spend the given hit dice, then restore short-rest pools and Pact Magic slots. */
export function shortRest(runtime: CharacterRuntime, derived: DerivedCharacter, spends: Array<{ die: string; roll: number }> = []): CharacterRuntime {
  let next = runtime;
  for (const spend of spends) next = spendHitDie(next, derived, spend.die, spend.roll);
  const resourcesUsed = { ...next.resourcesUsed };
  const restored: string[] = [];
  for (const resource of derived.resources) {
    const used = resourcesUsed[resource.id] ?? 0;
    if (!used) continue;
    if (resource.restore.short === "all") { delete resourcesUsed[resource.id]; restored.push(resource.label); }
    else if (resource.restore.short > 0) { resourcesUsed[resource.id] = Math.max(0, used - resource.restore.short); restored.push(`${resource.label} ${Math.min(used, resource.restore.short)}회`); }
  }
  if (derived.pactMagic && next.pactSlotsUsed > 0) restored.push("계약 마법 슬롯");
  return stamp({ ...next, resourcesUsed, pactSlotsUsed: 0 }, `짧은 휴식${restored.length ? ` — 회복: ${restored.join(", ")}` : ""}`);
}

/** Long rest: full HP, no temp HP, all slots and pools, half the hit dice (at least one), one exhaustion level less. */
export function longRest(runtime: CharacterRuntime, derived: DerivedCharacter): CharacterRuntime {
  const total = Object.values(derived.hitDice).reduce((sum, count) => sum + count, 0);
  let toRestore = Math.max(1, Math.floor(total / 2));
  const hitDiceSpent = { ...runtime.hitDiceSpent };
  for (const die of Object.keys(derived.hitDice)) {
    const spent = hitDiceSpent[die] ?? 0;
    const back = Math.min(spent, toRestore);
    if (back > 0) { hitDiceSpent[die] = spent - back; toRestore -= back; }
    if (hitDiceSpent[die] === 0) delete hitDiceSpent[die];
  }
  return stamp({
    ...runtime,
    hp: { ...runtime.hp, current: derived.hp.max, temp: 0 },
    slotsUsed: {},
    pactSlotsUsed: 0,
    resourcesUsed: {},
    hitDiceSpent,
    exhaustion: Math.max(0, runtime.exhaustion - 1),
    deathSaves: { success: 0, failure: 0 },
  }, `긴 휴식 — HP ${derived.hp.max}/${derived.hp.max}, 슬롯·자원 전부 회복, 히트 다이스 절반 회복`);
}

// ---- slots and resources

export function useSpellSlot(runtime: CharacterRuntime, derived: DerivedCharacter, level: number): CharacterRuntime {
  const max = derived.spellSlots[level] ?? 0;
  const used = runtime.slotsUsed[level] ?? 0;
  if (used >= max) return runtime;
  return stamp({ ...runtime, slotsUsed: { ...runtime.slotsUsed, [level]: used + 1 } }, `${level}레벨 슬롯 사용 (${max - used - 1}/${max} 남음)`);
}

export function restoreSpellSlot(runtime: CharacterRuntime, level: number): CharacterRuntime {
  const used = runtime.slotsUsed[level] ?? 0;
  if (used <= 0) return runtime;
  return stamp({ ...runtime, slotsUsed: { ...runtime.slotsUsed, [level]: used - 1 } }, `${level}레벨 슬롯 회복`);
}

export function usePactSlot(runtime: CharacterRuntime, derived: DerivedCharacter): CharacterRuntime {
  const max = derived.pactMagic?.count ?? 0;
  if (runtime.pactSlotsUsed >= max) return runtime;
  return stamp({ ...runtime, pactSlotsUsed: runtime.pactSlotsUsed + 1 }, `계약 슬롯 사용 (${max - runtime.pactSlotsUsed - 1}/${max} 남음)`);
}

export function restorePactSlot(runtime: CharacterRuntime): CharacterRuntime {
  if (runtime.pactSlotsUsed <= 0) return runtime;
  return stamp({ ...runtime, pactSlotsUsed: runtime.pactSlotsUsed - 1 }, "계약 슬롯 회복");
}

export function useResource(runtime: CharacterRuntime, derived: DerivedCharacter, id: string): CharacterRuntime {
  const resource = derived.resources.find((item) => item.id === id);
  if (!resource) return runtime;
  const used = runtime.resourcesUsed[id] ?? 0;
  if (used >= resource.max) return runtime;
  return stamp({ ...runtime, resourcesUsed: { ...runtime.resourcesUsed, [id]: used + 1 } }, `${resource.label} 사용 (${resource.max - used - 1}/${resource.max} 남음)`);
}

export function restoreResource(runtime: CharacterRuntime, derived: DerivedCharacter, id: string): CharacterRuntime {
  const resource = derived.resources.find((item) => item.id === id);
  const used = runtime.resourcesUsed[id] ?? 0;
  if (!resource || used <= 0) return runtime;
  return stamp({ ...runtime, resourcesUsed: { ...runtime.resourcesUsed, [id]: used - 1 } }, `${resource.label} 회복`);
}

// ---- gold and bag

export function adjustGold(runtime: CharacterRuntime, delta: number, note?: string): CharacterRuntime {
  const gold = Math.max(0, Math.round((runtime.gold + delta) * 100) / 100);
  return stamp({ ...runtime, gold }, `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} GP${note ? ` (${note})` : ""} → ${gold} GP`);
}

export function setGold(runtime: CharacterRuntime, gold: number): CharacterRuntime {
  const value = Math.max(0, Math.round(gold * 100) / 100);
  return stamp({ ...runtime, gold: value }, `금화를 ${value} GP로 설정`);
}

const patchOf = (runtime: CharacterRuntime) => runtime.inventory ?? emptyInventoryPatch();

export function addItem(runtime: CharacterRuntime, item: { itemId?: string; name: string; quantity?: number }): CharacterRuntime {
  const patch = patchOf(runtime);
  const instanceId = `extra:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
  return stamp({ ...runtime, inventory: { ...patch, extra: [...patch.extra, { instanceId, itemId: item.itemId, name: item.name, quantity }] } }, `획득: ${item.name}${quantity > 1 ? ` ×${quantity}` : ""}`);
}

export function removeItem(runtime: CharacterRuntime, derived: DerivedCharacter, instanceId: string): CharacterRuntime {
  const patch = patchOf(runtime);
  const item = derived.inventory.find((entry) => entry.instanceId === instanceId);
  const equipped = { ...runtime.equipped };
  for (const slot of ["armor", "shield", "mainHand", "offHand"] as const) if (equipped[slot] === instanceId) delete equipped[slot];
  return stamp({ ...runtime, equipped, inventory: { ...patch, removed: patch.removed.includes(instanceId) ? patch.removed : [...patch.removed, instanceId] } }, `버림: ${item?.name ?? instanceId}`);
}

export function setItemQuantity(runtime: CharacterRuntime, derived: DerivedCharacter, instanceId: string, quantity: number): CharacterRuntime {
  const patch = patchOf(runtime);
  const item = derived.inventory.find((entry) => entry.instanceId === instanceId);
  const value = Math.max(0, Math.floor(quantity));
  if (value === 0) return removeItem(runtime, derived, instanceId);
  return stamp({ ...runtime, inventory: { ...patch, quantities: { ...patch.quantities, [instanceId]: value } } }, `${item?.name ?? instanceId} 수량 ${value}`);
}

/** Wear/hold an item in the slot its kind implies; wearing again takes it off. */
export function toggleEquip(runtime: CharacterRuntime, derived: DerivedCharacter, instanceId: string): CharacterRuntime {
  const item = derived.inventory.find((entry) => entry.instanceId === instanceId);
  if (!item) return runtime;
  const equipped = { ...runtime.equipped };
  const slot = item.kind === "armor" ? "armor" : item.kind === "shield" ? "shield" : item.kind === "weapon" ? (equipped.mainHand && equipped.mainHand !== instanceId && !equipped.offHand ? "offHand" : "mainHand") : null;
  if (!slot) return runtime;
  const wasOn = equipped.armor === instanceId || equipped.shield === instanceId || equipped.mainHand === instanceId || equipped.offHand === instanceId;
  if (wasOn) {
    for (const key of ["armor", "shield", "mainHand", "offHand"] as const) if (equipped[key] === instanceId) delete equipped[key];
    return stamp({ ...runtime, equipped }, `해제: ${item.name}`);
  }
  equipped[slot] = instanceId;
  return stamp({ ...runtime, equipped }, `${item.kind === "weapon" ? "손에 듦" : "착용"}: ${item.name}`);
}

// ---- conditions and the rest

export function toggleCondition(runtime: CharacterRuntime, condition: string): CharacterRuntime {
  const has = runtime.conditions.includes(condition);
  return stamp({ ...runtime, conditions: has ? runtime.conditions.filter((item) => item !== condition) : [...runtime.conditions, condition] }, `${condition} ${has ? "해제" : "적용"}`);
}

export function setExhaustion(runtime: CharacterRuntime, level: number): CharacterRuntime {
  const value = clamp(Math.floor(level), 0, 6);
  return stamp({ ...runtime, exhaustion: value }, `탈진 ${value}단계`);
}

export function recordDeathSave(runtime: CharacterRuntime, success: boolean): CharacterRuntime {
  const deathSaves = { success: runtime.deathSaves.success + (success ? 1 : 0), failure: runtime.deathSaves.failure + (success ? 0 : 1) };
  const text = deathSaves.success >= 3 ? "죽음 내성 성공 3회 — 안정" : deathSaves.failure >= 3 ? "죽음 내성 실패 3회 — 사망" : `죽음 내성 ${success ? "성공" : "실패"} (${deathSaves.success}/${deathSaves.failure})`;
  return stamp({ ...runtime, deathSaves: { success: Math.min(3, deathSaves.success), failure: Math.min(3, deathSaves.failure) } }, text);
}

export function resetDeathSaves(runtime: CharacterRuntime): CharacterRuntime {
  return stamp({ ...runtime, deathSaves: { success: 0, failure: 0 } }, "죽음 내성 초기화");
}

export function setInspiration(runtime: CharacterRuntime, value: boolean): CharacterRuntime {
  return runtime.heroicInspiration === value ? runtime : stamp({ ...runtime, heroicInspiration: value }, value ? "영웅적 영감 획득" : "영웅적 영감 사용");
}

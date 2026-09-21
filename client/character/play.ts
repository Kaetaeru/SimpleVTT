/**
 * Play operations on the runtime (offline session on the sheet): HP damage/heal/temp, hit dice, short and long
 * rests, spell slots, resources, gold, bag changes, equip, conditions, death saves, inspiration. Every operation is a
 * pure function (runtime, derived) → runtime that also appends a log line, so the sheet can show what happened.
 */
import type { FeatureActivation, ParsedDuration } from "../rules/activation";
import { durationInRounds, effectKeyForFeature, effectKeyForSpell, parseDuration, remainingText } from "../rules/activation";
import type { ActiveEffect, CharacterRuntime } from "./runtime";
import { emptyInventoryPatch } from "./runtime";
import type { DerivedCharacter } from "./types";
import { scrollSpellId } from "../rules/scrolls";
import { CONDITION_KO } from "../compendium/spells";
import { PACT_SLOT_RESOURCE } from "../rules/contract";
import type { CustomItem } from "./customItem";

const MAX_LOG = 200;
const stamp = (runtime: CharacterRuntime, text: string): CharacterRuntime => ({ ...runtime, log: [...(runtime.log ?? []), { at: new Date().toISOString(), text }].slice(-MAX_LOG), updatedAt: new Date().toISOString() });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Append a free log line (dice rolls, notes). */
export const noteLog = (runtime: CharacterRuntime, text: string) => stamp(runtime, text);

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

/**
 * R28 (D149): 1 HP or more and you are no longer dying — the death saves reset and Unconscious ends (Prone does
 * not; you stood up by yourself or you did not). The death saves were already being reset here, but 무의식 was
 * added when the character dropped and taken off nowhere, so a healed character kept a condition that hands every
 * attacker advantage and turns every melee hit into a critical.
 */
export function wakeUp(runtime: CharacterRuntime): CharacterRuntime {
  const conditions = runtime.conditions.filter((name) => name !== "무의식");
  return { ...runtime, conditions, deathSaves: { success: 0, failure: 0 } };
}

export function applyHealing(runtime: CharacterRuntime, derived: DerivedCharacter, amount: number): CharacterRuntime {
  const healing = Math.max(0, Math.floor(amount));
  if (healing === 0) return runtime;
  const current = clamp(runtime.hp.current + healing, 0, derived.hp.max);
  const revived = runtime.hp.current === 0 && current > 0;
  const healed = { ...runtime, hp: { ...runtime.hp, current } };
  return stamp(revived ? wakeUp(healed) : healed, `회복 ${healing} → HP ${current}/${derived.hp.max}${revived ? " (의식을 되찾음)" : ""}`);
}

export function setCurrentHp(runtime: CharacterRuntime, derived: DerivedCharacter, value: number): CharacterRuntime {
  const current = clamp(Math.floor(value), 0, derived.hp.max);
  const revived = runtime.hp.current === 0 && current > 0;
  const next = { ...runtime, hp: { ...runtime.hp, current } };
  return stamp(revived ? wakeUp(next) : next, `HP를 ${current}/${derived.hp.max}(으)로 설정${revived ? " (의식을 되찾음)" : ""}`);
}

/** Temporary HP does not stack: the higher value stays. */
export function grantTempHp(runtime: CharacterRuntime, amount: number): CharacterRuntime {
  const temp = Math.max(runtime.hp.temp, Math.max(0, Math.floor(amount)));
  return stamp({ ...runtime, hp: { ...runtime.hp, temp } }, `임시 HP ${temp}`);
}

export function clearTempHp(runtime: CharacterRuntime): CharacterRuntime {
  return runtime.hp.temp === 0 ? runtime : stamp({ ...runtime, hp: { ...runtime.hp, temp: 0 } }, "임시 HP 제거");
}

/**
 * One-box HP edit: "12" sets current HP, "-4" damages, "+4" heals, "++4" grants temporary HP. Returns null for
 * anything else.
 */
export function applyHpCommand(runtime: CharacterRuntime, derived: DerivedCharacter, text: string): CharacterRuntime | null {
  const value = text.trim();
  let match = /^\+\+(\d+)$/.exec(value);
  if (match) return grantTempHp(runtime, Number(match[1]));
  match = /^([+-])(\d+)$/.exec(value);
  if (match) return match[1] === "-" ? applyDamage(runtime, derived, Number(match[2])) : applyHealing(runtime, derived, Number(match[2]));
  match = /^(\d+)$/.exec(value);
  if (match) return setCurrentHp(runtime, derived, Number(match[1]));
  return null;
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
  const ended = (next.effects ?? []).filter((effect) => effect.concentration || (durationInRounds(effect.duration) ?? Infinity) <= 600);
  return stamp({ ...next, resourcesUsed, pactSlotsUsed: 0, effects: (next.effects ?? []).filter((effect) => !ended.includes(effect)) }, `짧은 휴식${restored.length ? ` — 회복: ${restored.join(", ")}` : ""}${ended.length ? ` — 종료: ${ended.map((effect) => effect.name).join(", ")}` : ""}`);
}

/** Long rest: full HP, no temp HP, all slots and pools, half the hit dice (at least one), one exhaustion level less. */
export function longRest(runtime: CharacterRuntime, derived: DerivedCharacter, /** D334: the host's own roller, for dice the rest records (전조). */ roll?: (sides: number) => number): CharacterRuntime {
  const total = Object.values(derived.hitDice).reduce((sum, count) => sum + count, 0);
  let toRestore = Math.max(1, Math.floor(total / 2));
  const hitDiceSpent = { ...runtime.hitDiceSpent };
  for (const die of Object.keys(derived.hitDice)) {
    const spent = hitDiceSpent[die] ?? 0;
    const back = Math.min(spent, toRestore);
    if (back > 0) { hitDiceSpent[die] = spent - back; toRestore -= back; }
    if (hitDiceSpent[die] === 0) delete hitDiceSpent[die];
  }
  // V4a (D263): a locked pool stays spent, and the lock counts one long rest down.
  const locked = Object.entries(runtime.resourceLockouts ?? {}).filter(([, rests]) => rests > 0);
  const stillUsed = Object.fromEntries(locked.map(([id]) => [id, derived.resources.find((resource) => resource.id === id)?.max ?? 1]));
  const resourceLockouts = Object.fromEntries(locked.map(([id, rests]) => [id, rests - 1] as const).filter(([, rests]) => rests > 0));
  // D334: the rest rolls the dice a contract says to record, and each number waits on the sheet as its own effect.
  const now = new Date().toISOString();
  const die = roll ?? ((sides: number) => Math.floor(Math.random() * sides) + 1);
  const recorded: ActiveEffect[] = (derived.longRestGains?.records ?? []).flatMap((record) =>
    Array.from({ length: record.count }, (_unused, index) => {
      const value = die(record.sides);
      return { key: `${record.key}#${index}`, name: `${record.name || record.key} (${value})`, source: "feature" as const, duration: "긴 휴식까지", concentration: false, elapsed: 0, startedAt: now, rescue: { value } };
    }));
  return stamp({
    ...runtime,
    hp: { ...runtime.hp, current: derived.hp.max, temp: 0 },
    slotsUsed: {},
    pactSlotsUsed: 0,
    resourcesUsed: stillUsed,
    ...(runtime.resourceLockouts ? { resourceLockouts } : {}),
    hitDiceSpent,
    exhaustion: Math.max(0, runtime.exhaustion - 1),
    deathSaves: { success: 0, failure: 0 },
    effects: recorded,
    // V4m (D275): what a contract says the end of a long rest hands over (인간의 수완).
    ...(derived.longRestGains?.heroicInspiration ? { heroicInspiration: true } : {}),
  }, `긴 휴식 — HP ${derived.hp.max}/${derived.hp.max}, 슬롯·자원 전부 회복, 히트 다이스 절반 회복${derived.longRestGains?.heroicInspiration ? ", 영웅적 영감" : ""}${(runtime.effects ?? []).length ? `, 효과 종료: ${runtime.effects.map((effect) => effect.name).join(", ")}` : ""}`);
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

export function addItem(runtime: CharacterRuntime, item: { itemId?: string; name: string; quantity?: number; custom?: CustomItem }): CharacterRuntime {
  const patch = patchOf(runtime);
  const instanceId = `extra:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
  return stamp({ ...runtime, inventory: { ...patch, extra: [...patch.extra, { instanceId, itemId: item.itemId, name: item.name, quantity, ...(item.custom ? { custom: item.custom } : {}) }] } }, `획득: ${item.name}${quantity > 1 ? ` ×${quantity}` : ""}`);
}

/** R75 (D210): attune to a pasted magic item, or end the attunement. Three at once is the rule; the fourth is refused. */
export function toggleAttune(runtime: CharacterRuntime, instanceId: string, limit = 3): CharacterRuntime {
  const patch = patchOf(runtime);
  const target = patch.extra.find((item) => item.instanceId === instanceId);
  if (!target?.custom?.attunement) return runtime;
  if (!target.attuned && patch.extra.filter((item) => item.attuned && !patch.removed.includes(item.instanceId)).length >= limit) return stamp(runtime, `조율할 수 없음: ${target.custom.name} (이미 ${limit}개 조율 중)`);
  const extra = patch.extra.map((item) => (item.instanceId === instanceId ? { ...item, attuned: !item.attuned } : item));
  return stamp({ ...runtime, inventory: { ...patch, extra } }, `${target.attuned ? "조율 해제" : "조율"}: ${target.custom.name}`);
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

// ---- effects (features and spells in effect), feature use, spell casting

/** Start (or restart) an effect. A concentration effect ends any other concentration effect first. */
export function startEffect(runtime: CharacterRuntime, effect: Omit<ActiveEffect, "elapsed" | "startedAt">): CharacterRuntime {
  let next = runtime;
  const effects = [...(next.effects ?? [])];
  if (effect.concentration) {
    for (const other of effects.filter((item) => item.concentration && item.key !== effect.key)) next = stamp(next, `집중 종료: ${other.name} (${effect.name}에 집중)`);
  }
  const kept = effects.filter((item) => item.key !== effect.key && !(effect.concentration && item.concentration));
  return { ...next, effects: [...kept, { ...effect, elapsed: 0, startedAt: new Date().toISOString() }] };
}

export function endEffect(runtime: CharacterRuntime, key: string, reason?: string): CharacterRuntime {
  const effect = (runtime.effects ?? []).find((item) => item.key === key);
  if (!effect) return runtime;
  return stamp({ ...runtime, effects: runtime.effects.filter((item) => item.key !== key) }, `${effect.source === "spell" ? "주문 종료" : "종료"}: ${effect.name}${reason ? ` (${reason})` : ""}`);
}

/**
 * D321: what an effect leaves on its bearer when it ends — 가속's lethargy. The conditions go on the sheet and an
 * aftermath effect carries them, so they come off by themselves once its own duration runs out.
 */
export function afterEffectsOf(ended: ActiveEffect[], now: string, nameOf: (condition: string) => string): { effects: ActiveEffect[]; conditions: string[] } {
  const effects: ActiveEffect[] = [];
  const conditions: string[] = [];
  for (const effect of ended) {
    const names = (effect.endConditions ?? []).map(nameOf);
    if (!names.length) continue;
    conditions.push(...names);
    effects.push({ key: `${effect.key}:after`, name: `${effect.name} 여파`, source: effect.source, duration: effect.endDuration ?? "다음 턴이 끝날 때까지", concentration: false, rounds: 1, elapsed: 0, startedAt: now, conditions: names, anchor: { who: "bearer", boundary: "end" } });
  }
  return { effects, conditions };
}

/** One round passes: every counted effect advances; those that reach their duration end. */
/**
 * R30 (D156): ageing timed effects is the same arithmetic for a character sheet and for a monster's runtime, so it
 * lives in one place: add the rounds, hand back whatever ran out. The caller writes the log line it wants.
 */
export function ageEffects<T extends { effects?: ActiveEffect[] }>(runtime: T, rounds = 1): { runtime: T; ended: ActiveEffect[]; running: ActiveEffect[] } {
  const effects = runtime.effects ?? [];
  if (!effects.length || rounds <= 0) return { runtime, ended: [], running: effects.filter((effect) => effect.rounds !== undefined) };
  // R85 (D220): an anchored effect counts on its anchor turn boundary (the host ticks it), not on the bearer clock.
  const aged = effects.map((effect) => (effect.rounds !== undefined && !effect.anchor ? { ...effect, elapsed: effect.elapsed + rounds } : effect));
  const ended = aged.filter((effect) => effect.rounds !== undefined && !effect.anchor && effect.elapsed >= effect.rounds);
  const kept = aged.filter((effect) => !ended.includes(effect));
  return { runtime: { ...runtime, effects: kept }, ended, running: kept.filter((effect) => effect.rounds !== undefined) };
}

/**
 * Time passes for this sheet's effects. `rounds` is how much (one round by default, ten per in-world minute), so
 * the turn tracker and the DM's clock age the same effects through the same door (R30, D156).
 */
export function advanceRound(runtime: CharacterRuntime, rounds = 1): CharacterRuntime {
  if (!(runtime.effects ?? []).length || rounds <= 0) return runtime;
  const aged = ageEffects(runtime, rounds);
  let next = aged.runtime;
  // D321: an effect that leaves conditions behind (가속) puts them on as it goes.
  const after = afterEffectsOf(aged.ended, new Date().toISOString(), (condition) => CONDITION_KO[condition] ?? condition);
  if (after.conditions.length) next = { ...next, effects: [...(next.effects ?? []), ...after.effects], conditions: [...next.conditions, ...after.conditions.filter((name) => !next.conditions.includes(name))] };
  for (const effect of aged.ended) next = stamp(next, `${effect.source === "spell" ? "주문 종료" : "종료"}: ${effect.name} (지속 시간 끝)`);
  const running = aged.running.map((effect) => `${effect.name} ${remainingText(effect.rounds, effect.elapsed)}`);
  return stamp(next, `${rounds === 1 ? "라운드 진행" : `${rounds}라운드 지남`} (${running.join(", ") || "진행 중인 효과 없음"})`);
}

/**
 * R52 (D187): spend a pool by id, for a rider declared in the attack dialog rather than pressed on the sheet. The
 * pool is capped at its own maximum, so a rider can never overdraw what `useFeature` would have refused.
 */
export function spendResource(runtime: CharacterRuntime, derived: DerivedCharacter, resourceId: string, cost: number, label: string): CharacterRuntime {
  // V4i (D271): R78's reserved ids are counters, not pools — a Pact Magic slot has its own (마력의 강타).
  if (resourceId === PACT_SLOT_RESOURCE) { let next = runtime; for (let step = 0; step < cost; step += 1) next = usePactSlot(next, derived); return next; }
  const resource = derived.resources.find((item) => item.id === resourceId);
  if (!resource || cost <= 0) return runtime;
  const used = runtime.resourcesUsed[resourceId] ?? 0;
  const spend = Math.min(cost, resource.max - used);
  if (spend <= 0) return runtime;
  return stamp({ ...runtime, resourcesUsed: { ...runtime.resourcesUsed, [resourceId]: used + spend } }, `${label}: ${resource.max - used - spend}/${resource.max} 남음`);
}

/** R59 (D194): the biggest hit die this sheet still has, or nothing when they are all spent. */
export function spendableHitDie(runtime: CharacterRuntime, derived: DerivedCharacter): string | undefined {
  const sizes = Object.keys(derived.hitDice).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  return sizes.find((die) => (runtime.hitDiceSpent[die] ?? 0) < derived.hitDice[die]);
}

export interface FeatureUseExtras { healRoll?: number; tempRoll?: number; points?: number; /** V4k (D273): the creature whose stat block this use takes on (야생 변신의 형태). */ form?: string; /** A logged roll ("브레스 무기 피해 14"). */ rolled?: { label: string; total: number } }

/** Press "사용" on a feature: spend the pool (one use or a number of points), heal or grant temp HP from a roll, start its timed effect, log. */
export function useFeature(runtime: CharacterRuntime, derived: DerivedCharacter, feature: { id: string; name: string }, activation: FeatureActivation, extras: FeatureUseExtras = {}): CharacterRuntime | null {
  let next = runtime;
  const parts: string[] = [];
  if (activation.resourceId) {
    const resource = derived.resources.find((item) => item.id === activation.resourceId);
    if (!resource) return null;
    const used = next.resourcesUsed[resource.id] ?? 0;
    const spend = activation.points ? Math.max(1, Math.floor(extras.points ?? 1)) : activation.cost ?? 1;
    if (used + spend > resource.max) return null;
    next = { ...next, resourcesUsed: { ...next.resourcesUsed, [resource.id]: used + spend } };
    parts.push(spend > 1 || activation.points ? `${spend}점 사용, ${resource.max - used - spend}/${resource.max} 남음` : `${resource.max - used - 1}/${resource.max} 남음`);
  }
  // R59 (D194): a hit die is spent from the sheet's own pool, largest first, and a rest gives it back like any other.
  if (activation.hitDie) {
    const die = spendableHitDie(next, derived);
    if (!die) return null;
    next = { ...next, hitDiceSpent: { ...next.hitDiceSpent, [die]: (next.hitDiceSpent[die] ?? 0) + 1 } };
    parts.push(`히트 다이스 ${die} 소비`);
  }
  // V4a (D263): a spell slot as the cost — the lowest one left.
  // V4j (D272): unless the contract names the level it burns (마법의 샘 turns that slot into sorcery points).
  if (activation.spellSlot) {
    const level = activation.slotLevel ?? Object.keys(derived.spellSlots).map(Number).sort((a, b) => a - b).find((slot) => (next.slotsUsed[slot] ?? 0) < (derived.spellSlots[slot] ?? 0));
    if (level === undefined || (next.slotsUsed[level] ?? 0) >= (derived.spellSlots[level] ?? 0)) return null;
    next = { ...next, slotsUsed: { ...next.slotsUsed, [level]: (next.slotsUsed[level] ?? 0) + 1 } };
    parts.push(`${level}레벨 슬롯 소비`);
  }
  // D307: a Pact Magic slot as the cost.
  if (activation.pactSlot) {
    if (!derived.pactMagic || next.pactSlotsUsed >= derived.pactMagic.count) return null;
    next = { ...next, pactSlotsUsed: next.pactSlotsUsed + 1 };
    parts.push("계약 슬롯 소비");
  }
  // V4j (D272): a use that hands a slot back instead (마법 점수로 슬롯 만들기, 야생 재발).
  if (activation.slotGain) {
    const level = activation.slotGain;
    if ((next.slotsUsed[level] ?? 0) <= 0) return null;
    next = { ...next, slotsUsed: { ...next.slotsUsed, [level]: (next.slotsUsed[level] ?? 0) - 1 } };
    parts.push(`${level}레벨 슬롯 회복`);
  }
  if (extras.rolled) parts.push(`${extras.rolled.label} ${extras.rolled.total}`);
  // The caller decides what was rolled or chosen (Second Wind roll, Lay on Hands points on self); apply whatever it passed.
  if (extras.healRoll !== undefined) { next = applyHealing(next, derived, extras.healRoll); parts.push(`${extras.healRoll} 회복`); }
  if (extras.tempRoll !== undefined) { next = grantTempHp(next, extras.tempRoll); parts.push(`임시 HP ${extras.tempRoll}`); }
  const duration = activation.duration?.(derived);
  if (duration && !duration.instantaneous) {
    next = startEffect(next, { key: effectKeyForFeature(feature.id), name: feature.name, source: "feature", duration: duration.text, concentration: duration.concentration, rounds: duration.rounds, ...(duration.anchor ? { anchor: duration.anchor } : {}), ...(duration.consumeOn ? { consumeOn: duration.consumeOn } : {}), ...(extras.form ? { form: extras.form } : {}) });
    parts.push(duration.text);
  }
  return stamp(next, `사용: ${feature.name}${parts.length ? ` (${parts.join(" · ")})` : ""}`);
}

export interface SpellSummary { id: string; name: string; level: number; duration?: string; ritual?: boolean; /** V4s (D281): the effect ends when its bearer attacks or casts (투명화). */ consumeOn?: "attack" | "cast" | "attack-or-cast" }
export type CastMethod = { kind: "slot"; level: number } | { kind: "pact" } | { kind: "ritual" } | { kind: "cantrip" } | { kind: "resource"; id: string } | { kind: "scroll"; instanceId: string } | /** R77 (D212): using a spell in effect again — no cost, no new effect. */ { kind: "sustain" };

/** Cast a spell: spend the slot, pact slot, free-cast pool or nothing (cantrip, ritual); a lasting spell becomes an effect. Null when the cost cannot be paid. */
export function castSpell(runtime: CharacterRuntime, derived: DerivedCharacter, spell: SpellSummary, method: CastMethod): CharacterRuntime | null {
  let next = runtime;
  let how = "";
  // R77 (D212): a repeat pays nothing and starts nothing; it only needs the spell to still be going.
  if (method.kind === "sustain") return (runtime.effects ?? []).some((effect) => effect.key === effectKeyForSpell(spell.id)) ? stamp(runtime, `지속: ${spell.name} (슬롯 없이)`) : null;
  switch (method.kind) {
    case "slot": {
      const max = derived.spellSlots[method.level] ?? 0;
      const used = next.slotsUsed[method.level] ?? 0;
      if (method.level < spell.level || used >= max) return null;
      next = { ...next, slotsUsed: { ...next.slotsUsed, [method.level]: used + 1 } };
      how = `${method.level}레벨 슬롯, 남은 ${max - used - 1}/${max}`;
      break;
    }
    case "pact": {
      if (!derived.pactMagic || next.pactSlotsUsed >= derived.pactMagic.count || derived.pactMagic.level < spell.level) return null;
      next = { ...next, pactSlotsUsed: next.pactSlotsUsed + 1 };
      how = `계약 슬롯 ${derived.pactMagic.level}레벨, 남은 ${derived.pactMagic.count - next.pactSlotsUsed}/${derived.pactMagic.count}`;
      break;
    }
    case "ritual": if (!spell.ritual) return null; how = "의식, 슬롯 없이 (+10분)"; break;
    case "cantrip": if (spell.level !== 0) return null; how = "소마법"; break;
    case "resource": {
      const resource = derived.resources.find((item) => item.id === method.id);
      const used = next.resourcesUsed[method.id] ?? 0;
      if (!resource || (!resource.atWill && used >= resource.max)) return null;
      // V4p (D278): a pool that pays for spells up to a level pays for nothing above it (신성 개입, 주문 회상).
      if (resource.freeCastMaxLevel !== undefined && resource.freeCastSpellId !== spell.id && (spell.level < 1 || spell.level > resource.freeCastMaxLevel)) return null;
      // V4q (D279): a pool that names its spells pays for those and nothing else (자연 회복).
      if (resource.freeCastSpellIds?.length && resource.freeCastSpellId !== spell.id && !resource.freeCastSpellIds.includes(spell.id)) return null;
      // V3g (D261): an at-will free cast spends nothing.
      if (resource.atWill) { how = `${resource.label} (무제한)`; break; }
      next = { ...next, resourcesUsed: { ...next.resourcesUsed, [method.id]: used + 1 } };
      how = `${resource.label}, 남은 ${resource.max - used - 1}/${resource.max}`;
      break;
    }
    case "scroll": {
      // R19: the scroll is the cost — no slot, and the scroll itself is destroyed.
      const item = derived.inventory.find((entry) => entry.instanceId === method.instanceId);
      if (!item || item.quantity <= 0 || scrollSpellId(item.itemId) !== spell.id) return null;
      next = setItemQuantity(next, derived, method.instanceId, item.quantity - 1);
      how = `두루마리 (${item.name}) — 슬롯 없이, 두루마리는 사라집니다`;
      break;
    }
  }
  const duration: ParsedDuration = parseDuration(spell.duration);
  if (!duration.instantaneous) next = startEffect(next, { key: effectKeyForSpell(spell.id), name: spell.name, source: "spell", duration: duration.text, concentration: duration.concentration, rounds: duration.rounds, ...(spell.consumeOn ? { consumeOn: spell.consumeOn } : {}), level: method.kind === "slot" ? method.level : method.kind === "pact" ? derived.pactMagic?.level ?? spell.level : spell.level });
  return stamp(next, `시전: ${spell.name} (${how})${duration.instantaneous ? "" : ` — ${duration.text}`}`);
}

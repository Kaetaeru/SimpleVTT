/**
 * Every change a sheet can make, as a serializable operation. The offline sheet applies an op locally; in a session
 * the same op travels to the host, which applies it with the same reducer and broadcasts the result (D65). Dice are
 * rolled by whoever presses the button and travel inside the op (`healRoll`, `tempHp`, log lines), so the host never
 * needs the dice overlay.
 */
import type { ContentCatalog } from "../catalog/catalog";
import { featureActivation } from "../rules/activation";
import { effectApplication } from "../rules/effects";
import { deriveCharacter } from "./derive";
import {
  addItem, adjustGold, advanceRound, applyDamage, applyHealing, applyHpCommand, castSpell, clearTempHp, endEffect, grantTempHp, longRest, noteLog, recordDeathSave, removeItem,
  resetDeathSaves, restorePactSlot, restoreResource, restoreSpellSlot, setCurrentHp, setExhaustion, setGold, setInspiration, setItemQuantity, shortRest, toggleCondition, toggleEquip,
  useFeature, usePactSlot, useResource, useSpellSlot, type CastMethod, type FeatureUseExtras,
} from "./play";
import type { CharacterRuntime } from "./runtime";
import type { CharacterSource, DerivedCharacter } from "./types";

export type SheetOp =
  | { type: "hp.command"; text: string }
  | { type: "hp.set"; value: number }
  | { type: "hp.damage"; amount: number }
  | { type: "hp.heal"; amount: number }
  | { type: "hp.temp"; amount: number }
  | { type: "hp.clearTemp" }
  | { type: "slot.use"; level: number }
  | { type: "slot.restore"; level: number }
  | { type: "pact.use" }
  | { type: "pact.restore" }
  | { type: "resource.use"; id: string }
  | { type: "resource.restore"; id: string }
  | { type: "gold.adjust"; delta: number; note?: string }
  | { type: "gold.set"; gold: number }
  | { type: "item.add"; item: { itemId?: string; name: string; quantity?: number } }
  | { type: "item.remove"; instanceId: string }
  | { type: "item.quantity"; instanceId: string; quantity: number }
  | { type: "item.equip"; instanceId: string }
  | { type: "condition.toggle"; condition: string }
  | { type: "exhaustion.set"; level: number }
  | { type: "deathSave"; success: boolean }
  | { type: "deathSave.reset" }
  | { type: "inspiration.set"; value: boolean }
  | { type: "rest.short"; spends: Array<{ die: string; roll: number }>; lines?: string[] }
  | { type: "rest.long" }
  | { type: "feature.use"; featureId: string; extras?: FeatureUseExtras; lines?: string[] }
  | { type: "effect.end"; key: string }
  | { type: "round.advance" }
  | { type: "spell.cast"; spellId: string; method: CastMethod; tempHp?: number; lines?: string[] }
  | { type: "log.note"; text: string };

export interface OpResult { runtime: CharacterRuntime; refused?: string }

const withLines = (runtime: CharacterRuntime, lines?: string[]) => (lines ?? []).reduce((acc, line) => noteLog(acc, line), runtime);

/** Derive the sheet as it is in play (worn items, bag, effects in force). */
export const deriveLive = (source: CharacterSource, catalog: ContentCatalog, runtime: CharacterRuntime): DerivedCharacter =>
  deriveCharacter(source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects });

/** Effects that just started may change the sheet at once (Aid: +5 current HP with the +5 maximum). */
function afterEffectStart(previous: CharacterRuntime, next: CharacterRuntime, source: CharacterSource, catalog: ContentCatalog, derived: DerivedCharacter): CharacterRuntime {
  const started = (next.effects ?? []).filter((effect) => !(previous.effects ?? []).some((item) => item.key === effect.key));
  let out = next;
  for (const effect of started) {
    const application = effectApplication(effect, derived, catalog);
    if (application?.onStart?.heal) out = applyHealing(out, deriveLive(source, catalog, out), application.onStart.heal);
  }
  return out;
}

/** Apply one op. `refused` names why nothing changed (no uses left, no slot); the runtime is then the input. */
export function applyOp(runtime: CharacterRuntime, source: CharacterSource, catalog: ContentCatalog, op: SheetOp): OpResult {
  const derived = deriveLive(source, catalog, runtime);
  switch (op.type) {
    case "hp.command": { const next = applyHpCommand(runtime, derived, op.text); return next ? { runtime: next } : { runtime, refused: "HP 입력 형식이 아닙니다" }; }
    case "hp.set": return { runtime: setCurrentHp(runtime, derived, op.value) };
    case "hp.damage": return { runtime: applyDamage(runtime, derived, op.amount) };
    case "hp.heal": return { runtime: applyHealing(runtime, derived, op.amount) };
    case "hp.temp": return { runtime: grantTempHp(runtime, op.amount) };
    case "hp.clearTemp": return { runtime: clearTempHp(runtime) };
    case "slot.use": return { runtime: useSpellSlot(runtime, derived, op.level) };
    case "slot.restore": return { runtime: restoreSpellSlot(runtime, op.level) };
    case "pact.use": return { runtime: usePactSlot(runtime, derived) };
    case "pact.restore": return { runtime: restorePactSlot(runtime) };
    case "resource.use": return { runtime: useResource(runtime, derived, op.id) };
    case "resource.restore": return { runtime: restoreResource(runtime, derived, op.id) };
    case "gold.adjust": return { runtime: adjustGold(runtime, op.delta, op.note) };
    case "gold.set": return { runtime: setGold(runtime, op.gold) };
    case "item.add": return { runtime: addItem(runtime, op.item) };
    case "item.remove": return { runtime: removeItem(runtime, derived, op.instanceId) };
    case "item.quantity": return { runtime: setItemQuantity(runtime, derived, op.instanceId, op.quantity) };
    case "item.equip": return { runtime: toggleEquip(runtime, derived, op.instanceId) };
    case "condition.toggle": return { runtime: toggleCondition(runtime, op.condition) };
    case "exhaustion.set": return { runtime: setExhaustion(runtime, op.level) };
    case "deathSave": return { runtime: recordDeathSave(runtime, op.success) };
    case "deathSave.reset": return { runtime: resetDeathSaves(runtime) };
    case "inspiration.set": return { runtime: setInspiration(runtime, op.value) };
    case "rest.short": return { runtime: shortRest(withLines(runtime, op.lines), derived, op.spends) };
    case "rest.long": return { runtime: longRest(runtime, derived) };
    case "feature.use": {
      const feature = derived.features.find((item) => item.id === op.featureId);
      if (!feature) return { runtime, refused: "그 특성이 없습니다" };
      const activation = featureActivation(feature, derived);
      if (!activation) return { runtime, refused: "사용할 수 없는 특성입니다" };
      const next = useFeature(withLines(runtime, op.lines), derived, feature, activation, op.extras ?? {});
      if (!next) return { runtime, refused: "남은 횟수가 없습니다" };
      return { runtime: afterEffectStart(runtime, next, source, catalog, derived) };
    }
    case "effect.end": return { runtime: endEffect(runtime, op.key) };
    case "round.advance": return { runtime: advanceRound(runtime) };
    case "spell.cast": {
      const spell = catalog.spellById(op.spellId);
      if (!spell) return { runtime, refused: "그 주문이 없습니다" };
      let next = castSpell(withLines(runtime, op.lines), derived, { id: spell.id, name: spell.name, level: spell.level, duration: spell.duration, ritual: spell.ritual }, op.method);
      if (!next) return { runtime, refused: "그 방법으로는 시전할 수 없습니다 (슬롯이나 횟수가 없습니다)" };
      if (op.tempHp) next = grantTempHp(next, op.tempHp);
      return { runtime: afterEffectStart(runtime, next, source, catalog, derived) };
    }
    case "log.note": return { runtime: noteLog(runtime, op.text) };
  }
}

/** One-line Korean description of an op for the shared session log ("DM: 피해 7"). */
export function describeOp(op: SheetOp): string {
  switch (op.type) {
    case "hp.command": return `HP ${op.text}`;
    case "hp.set": return `HP를 ${op.value}로`;
    case "hp.damage": return `피해 ${op.amount}`;
    case "hp.heal": return `회복 ${op.amount}`;
    case "hp.temp": return `임시 HP ${op.amount}`;
    case "rest.short": return "짧은 휴식";
    case "rest.long": return "긴 휴식";
    case "feature.use": return "특성 사용";
    case "spell.cast": return "주문 시전";
    case "round.advance": return "라운드 진행";
    case "condition.toggle": return `상태: ${op.condition}`;
    case "log.note": return op.text;
    default: return op.type;
  }
}

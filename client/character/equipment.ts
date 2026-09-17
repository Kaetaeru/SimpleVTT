/**
 * Starting equipment: the class and background loadout options (or starting gold), the item choices inside an
 * option (holy symbol kind, instrument, artisan tool) and the resulting inventory with default equip state.
 */
import type { LoadoutOption } from "../catalog/catalog";
import { artisanToolOptions, instrumentOptions, variantNameOf } from "./choices";
import type { Ledger } from "./ledger";
import type { ChoiceOption, DerivedItem } from "./types";

interface LoadoutOptionChoice { kind: string; itemIds?: string[]; categories?: string[]; quantity?: number }
type ItemOption = Extract<LoadoutOption, { items: unknown }> & { itemVariants?: Record<string, string>; choices?: LoadoutOptionChoice[] };


function optionSummary(ledger: Ledger, option: LoadoutOption): string {
  if ("startingGoldGp" in option) return `${option.startingGoldGp} GP`;
  const items = option.items.map((item) => `${ledger.catalog.itemById(item.itemId)?.name ?? item.itemId}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`);
  const extras = ((option as ItemOption).choices ?? []).map((choice) => (choice.kind === "tool-variant" ? "악기 1" : choice.kind === "catalog-filter" ? "장인 도구 또는 악기 1" : "선택 1"));
  return [...items, ...extras, option.gp ? `${option.gp} GP` : undefined].filter(Boolean).join(", ");
}

export function applyEquipment(ledger: Ledger) {
  const { catalog, source } = ledger;
  const classId = source.tracks[0]?.classId;
  const owners: Array<{ key: "class" | "background"; ownerId: string | undefined; label: string }> = [
    { key: "class", ownerId: classId, label: classId ? `직업 장비 · ${catalog.classById(classId)?.name ?? classId}` : "직업 장비" },
    { key: "background", ownerId: source.origin.backgroundId, label: `배경 장비 · ${catalog.backgroundById(source.origin.backgroundId)?.name ?? ""}` },
  ];
  if (source.equipment.mode === "gold") {
    let fallback = 0;
    for (const owner of owners) {
      const loadout = owner.ownerId ? catalog.loadoutFor(owner.ownerId) : undefined;
      const goldOption = loadout?.options.find((option) => "startingGoldGp" in option) as { startingGoldGp: number } | undefined;
      fallback += goldOption?.startingGoldGp ?? 0;
    }
    ledger.gold = source.equipment.startingGold ?? fallback;
    return;
  }
  for (const owner of owners) {
    const loadout = owner.ownerId ? catalog.loadoutFor(owner.ownerId) : undefined;
    if (!loadout) continue;
    const options: ChoiceOption[] = loadout.options.map((option) => ({ id: option.id, name: `${option.id}. ${"startingGoldGp" in option ? `${option.startingGoldGp} GP` : "장비 꾸러미"}`, summary: optionSummary(ledger, option) }));
    const picked = ledger.askOne({ scope: "equipment", sourceLabel: owner.label, id: `equipment.${owner.key}`, label: owner.key === "class" ? "직업 시작 장비" : "배경 시작 장비", options });
    const option = loadout.options.find((item) => item.id === picked);
    if (!option) continue;
    if ("startingGoldGp" in option) { ledger.gold += option.startingGoldGp; continue; }
    ledger.gold += option.gp ?? 0;
    const itemOption = option as ItemOption;
    for (const item of option.items) addItem(ledger, item.itemId, item.quantity, owner.label, itemOption.itemVariants?.[item.itemId]);
    (itemOption.choices ?? []).forEach((choice, index) => {
      const id = `equipment.${owner.key}.${option.id}.${index}`;
      if (choice.kind === "choose-one" && choice.itemIds) {
        const choiceOptions = choice.itemIds.map((itemId) => ({ id: itemId, name: catalog.itemById(itemId)?.name ?? itemId }));
        const chosen = ledger.askOne({ scope: "equipment", sourceLabel: owner.label, id, label: "장비 선택", options: choiceOptions });
        if (chosen) addItem(ledger, chosen, choice.quantity ?? 1, owner.label);
      } else if (choice.kind === "tool-variant") {
        const chosen = ledger.askOne({ scope: "equipment", sourceLabel: owner.label, id, label: "악기 선택", options: instrumentOptions(catalog) });
        if (chosen) { const [base, variant] = chosen.split(":"); addItem(ledger, base, 1, owner.label, variant); }
      } else if (choice.kind === "catalog-filter") {
        const choiceOptions = [
          ...((choice.categories ?? []).includes("artisan-tool") ? artisanToolOptions(catalog) : []),
          ...((choice.categories ?? []).includes("musical-instrument") ? instrumentOptions(catalog) : []),
        ];
        const chosen = ledger.askOne({ scope: "equipment", sourceLabel: owner.label, id, label: "도구 선택", options: choiceOptions });
        if (chosen) { const [base, variant] = chosen.split(":"); addItem(ledger, base, 1, owner.label, variant); }
      }
    });
  }
  // Default equip state: the first armor and shield are worn; the first weapon is in hand.
  let armorEquipped = false;
  let shieldEquipped = false;
  let weaponEquipped = false;
  for (const item of ledger.inventory) {
    const view = catalog.itemById(item.itemId);
    if (!view) continue;
    if (view.kind === "armor" && !armorEquipped) { item.equipped = true; armorEquipped = true; }
    if (view.kind === "shield" && !shieldEquipped) { item.equipped = true; shieldEquipped = true; }
    if (view.kind === "weapon" && !weaponEquipped) { item.equipped = true; item.wieldSlot = view.weapon?.properties.includes("two-handed") ? "two-hand" : "main-hand"; weaponEquipped = true; }
  }
}

function addItem(ledger: Ledger, itemId: string, quantity: number, sourceLabel: string, variant?: string) {
  const view = ledger.catalog.itemById(itemId);
  if (!view) { ledger.warnings.push(`장비 "${itemId}"을(를) 찾을 수 없습니다.`); return; }
  // A variant tool without a variant (the soldier's gaming set) takes the variant the character is trained in.
  if (!variant && Array.isArray(view.config.variants)) variant = [...ledger.tools.keys()].find((id) => id.startsWith(`${itemId}:`))?.split(":")[1];
  const bundle = view.kind === "ammunition" ? Number((view.config.quantity as number | undefined) ?? 1) : 1;
  const variantName = variant ? variantNameOf(view, variant) : undefined;
  const name = variantName ? (view.config.variantLabel === "alone" ? variantName : `${view.name} (${variantName})`) : view.name;
  const existing = ledger.inventory.find((item) => item.itemId === itemId && item.name === name);
  if (existing) { existing.quantity += quantity * bundle; return; }
  const item: DerivedItem = { instanceId: `${itemId}${variant ? `:${variant}` : ""}`, itemId, name, kind: view.kind, quantity: quantity * bundle, source: sourceLabel };
  ledger.inventory.push(item);
}

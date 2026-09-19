/**
 * Spell audit: what each spell's own text says against what the table will actually do with it.
 *
 * For every spell in the catalog (the SRD, plus any module files given), the text is read for the facts a table
 * computes — the damage dice and type, the saving throw, the spell attack, concentration, the conditions it names,
 * the dice it gains per slot level — and compared with the spell's execution (`spellExec`). A mismatch is not proof
 * of a bug (the text may describe an optional rider), but every real bug in this area shows up as one, so the list is
 * the place to start reading. It prints counts per kind and writes the full list as JSON.
 *
 *   npx tsx scripts/audit-spells.ts [--module <file.module.json> …] [--out <report.json>] [--only <spell-id-substring>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCatalog } from "../client/catalog";
import { bearerPartsOf, onHitOf, spellExec, sustainOf, weaponSpellOf, type SpellDice, type SpellExec } from "../client/compendium/spells";
import { CONDITION_KO } from "../client/compendium/spells";
import type { RuleModuleJson } from "../client/catalog/types";

const args = process.argv.slice(2);
const modules: RuleModuleJson[] = [];
let out = "spell-audit.json";
let only = "";
for (let at = 0; at < args.length; at += 1) {
  if (args[at] === "--module") modules.push(JSON.parse(readFileSync(resolve(args[++at]), "utf8")));
  else if (args[at] === "--out") out = args[++at];
  else if (args[at] === "--only") only = args[++at];
}

const catalog = createCatalog(modules);

const DAMAGE_KO: Record<string, string> = {
  acid: "산성", cold: "냉기", fire: "화염", lightning: "번개", necrotic: "사령", poison: "독", psychic: "정신",
  radiant: "광휘", thunder: "천둥", force: "역장", bludgeoning: "타격", piercing: "관통", slashing: "참격",
};
const ko = (type: string | undefined) => (type ? DAMAGE_KO[type] ?? type : undefined);
const DAMAGE_WORDS = Object.values(DAMAGE_KO).join("|");
const ABILITY: Record<string, string> = { 근력: "str", 민첩: "dex", 건강: "con", 지능: "int", 지혜: "wis", 매력: "cha" };
const CONDITIONS: Record<string, string> = {
  blinded: "장님|실명", charmed: "매혹", deafened: "귀머거리|청각상실|귀먹", frightened: "공포", grappled: "붙잡힘|붙잡힌",
  incapacitated: "행동불능|행동 불능", invisible: "투명 상태", paralyzed: "마비", petrified: "석화", poisoned: "중독",
  prone: "넘어짐|엎드림|넘어진", restrained: "포박|구속", stunned: "충격|기절", unconscious: "무의식",
};

interface Finding { spellId: string; name: string; kind: string; text: string; exec: string }
const findings: Finding[] = [];
const note = (spell: { id: string; name: string }, kind: string, text: string, exec: string) =>
  findings.push({ spellId: spell.id, name: spell.name, kind, text, exec });

const diceOf = (exec: SpellExec): { dice?: SpellDice; type?: string } => {
  const p = exec.primary as unknown as Record<string, unknown>;
  if (p.kind === "automatic-projectiles") return { dice: { count: Number(p.baseProjectiles ?? 1), sides: Number((p.projectileDice as { sides?: number })?.sides ?? 0) }, type: ko(String(p.damageType)) };
  if (p.kind === "multi-attack-damage") return { dice: p.dicePerAttack as SpellDice, type: ko(String(p.damageType)) };
  if (p.kind === "save-compound-damage") { const first = (p.components as Array<{ damageType: string; dice: SpellDice }>)[0]; return { dice: first?.dice, type: ko(first?.damageType) }; }
  return { dice: p.dice as SpellDice | undefined, type: ko(p.damageType as string | undefined) };
};

for (const spell of catalog.spells) {
  if (only && !spell.id.includes(only)) continue;
  const exec = spellExec(spell.id);
  const text = spell.description ?? spell.summary ?? "";
  if (!exec) { note(spell, "no-exec", "—", "실행 정의 없음"); continue; }
  // The body without its upcast paragraph (a source-built description is plain text, an older one markdown).
  const body = text.split(/\*{0,2}상위 레벨 주문 슬롯 사용/)[0].split(/\*{0,2}소마법 강화/)[0];
  const kind = exec.primary.kind;
  const { dice, type } = diceOf(exec);

  // The other roads a spell's numbers travel: the hit it rides on (강타), the effect it leaves (표식), its repeat
  // (구체), the weapon it is cast through, its own contract (turn-start damage, conditions). A fact carried by any of
  // them is executed, just not by `primary`.
  const onHit = onHitOf(exec);
  const bearer = bearerPartsOf(spell.id);
  const sustain = sustainOf(exec);
  const contract = catalog.contractFor(`spell:${spell.id}`);
  const contractOps = contract ? [...contract.entryPoints.flatMap((point) => point.operations), ...contract.interceptors.flatMap((item) => item.operations)] : [];
  const covered = {
    damage: Boolean(onHit?.damage || onHit?.save?.damage || bearer.some((part) => part.attackDamage) || (sustain?.primary && sustain.primary.kind !== "tracked-effect") || weaponSpellOf(spell.id) || contractOps.some((operation) => operation.kind === "damage.apply")),
    save: Boolean(onHit?.save || contractOps.some((operation) => (operation.kind === "damage.apply" && operation.save) || (operation.kind === "condition.apply" && operation.save))),
    conditions: new Set<string>([...(onHit?.inflicts ?? []), ...(onHit?.save?.conditions ?? []),
      ...contractOps.flatMap((operation) => (operation.kind === "condition.apply" ? [operation.condition] : []))]),
    upcast: Boolean(onHit?.damage?.perSlot || onHit?.save?.damage?.perSlot),
  };
  const conditionCovered = (id: string) => covered.conditions.has(id) || covered.conditions.has(CONDITION_KO[id] ?? id);

  // Damage: the first "NdM <type> 피해" the text names.
  const damage = new RegExp(`(\\d+)d(\\d+)(?:\\s*\\+[^\\s]+)?\\s*(?:의\\s*)?(${DAMAGE_WORDS})\\s*피해`).exec(body)
    ?? new RegExp(`(${DAMAGE_WORDS})\\s*피해\\s*(\\d+)d(\\d+)`).exec(body);
  if (damage) {
    const [count, sides, typeText] = /^\d+$/.test(damage[1]) ? [Number(damage[1]), Number(damage[2]), damage[3]] : [Number(damage[2]), Number(damage[3]), damage[1]];
    if ((kind === "tracked-effect" || kind === "save-effect") && !covered.damage) note(spell, "damage-not-executed", `${count}d${sides} ${typeText}`, kind);
    else if (kind === "tracked-effect" || kind === "save-effect") { /* carried by another road */ }
    else if (!dice) note(spell, "damage-missing", `${count}d${sides} ${typeText}`, kind);
    else {
      if (dice.count !== count || dice.sides !== sides) note(spell, "damage-dice", `${count}d${sides}`, `${dice.count}d${dice.sides}`);
      if (type && type !== typeText) note(spell, "damage-type", typeText, type);
    }
  } else if (dice && ["attack-damage", "save-damage", "area-damage"].includes(kind) && !/피해/.test(body)) {
    note(spell, "damage-unsupported-by-text", "피해 문구 없음", `${kind} ${dice.count}d${dice.sides}`);
  }

  // Healing.
  const healing = /(\d+)d(\d+)[^.]{0,30}(?:히트 포인트를 )?회복/.exec(body);
  if (healing && kind !== "healing" && kind !== "temporary-hp" && kind !== "full-healing") note(spell, "healing-not-executed", `${healing[1]}d${healing[2]} 회복`, kind);

  // Saving throw.
  const save = /(근력|민첩|건강|지능|지혜|매력)\s*내성/.exec(body);
  const execSave = (exec.primary as { saveAbility?: string }).saveAbility;
  if (save && !execSave && !covered.save && !["attack-damage", "multi-attack-damage"].includes(kind)) note(spell, "save-not-executed", `${save[1]} 내성`, kind);
  if (save && execSave && ABILITY[save[1]] !== execSave) note(spell, "save-ability", save[1], execSave);

  // Spell attack.
  if (/주문 (?:명중|공격) 굴림/.test(body) && !["attack-damage", "multi-attack-damage"].includes(kind)) note(spell, "attack-not-executed", "주문 명중 굴림", kind);

  // Concentration.
  const concentrationText = /집중/.test(spell.duration);
  if (concentrationText !== Boolean(exec.concentration)) note(spell, "concentration", spell.duration, String(Boolean(exec.concentration)));

  // Conditions the text names that the execution never applies.
  const applied = new Set((exec.effects ?? []).map((effect) => effect.conditionId));
  for (const [id, pattern] of Object.entries(CONDITIONS)) {
    if (new RegExp(`(${pattern})\\s*(?:상태|이 된다|이 되|에 걸)`).test(body) && !applied.has(id)) note(spell, "condition-not-applied", id, [...applied].join(",") || "없음");
  }

  // Upcasting: "슬롯 레벨마다 … NdM" against the dice per slot.
  const upcast = /(?:상위 레벨 주문 슬롯 사용|높은 주문 슬롯)[^\n]*?(\d+)d(\d+)/.exec(text);
  if (upcast && spell.level > 0) {
    const per = dice?.dicePerSlotAboveBase ?? (exec.primary as { projectilesPerSlotAboveBase?: number }).projectilesPerSlotAboveBase ?? (exec.primary as { attacksPerSlotAboveBase?: number }).attacksPerSlotAboveBase;
    if (!per && !covered.upcast && !exec.targeting.targetsPerSlotAboveBase) note(spell, "upcast-missing", `+${upcast[1]}d${upcast[2]}`, "상위 슬롯 증가 없음");
  }
}

const counts: Record<string, number> = {};
for (const finding of findings) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
const bySpell = new Set(findings.map((finding) => finding.spellId)).size;
console.log(`spells: ${catalog.spells.length}, with findings: ${bySpell}, findings: ${findings.length}`);
for (const [kind, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${kind}: ${count}`);
writeFileSync(out, JSON.stringify(findings, null, 1));
console.log(`written: ${out}`);

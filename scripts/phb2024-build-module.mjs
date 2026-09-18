/**
 * Build the PHB 2024 module from its source (docs/design/v3/PHB_2024_MODULE_PLAN.md §4, §6).
 *
 *   npx tsx scripts/phb2024-build-module.mjs <out>/phb-parsed.json <old>/phb-2024-supplement.module.json <out>/phb-2024.module.json
 *
 * The text of every entry comes from the source (the parser's output, `scripts/phb2024-parse-source.mjs`); the rule
 * decisions — definitions and contracts — come from the module the owner already plays with (§8), so nothing that
 * worked is decided twice. Where the old module had no decision to give (a paladin's oath spells, a subclass that
 * casts, the Battle Master's maneuvers) or had decided on text it never saw in full, the decision is written here.
 *
 * Like the parser, this script carries no book text — names and rule text are read from the source at build time,
 * and the few labels written here are short notes in this project's own words. It reads the source and the old module
 * from outside the repository and writes the new module outside it. It runs under tsx because it asks the app's own
 * catalog to resolve spell names.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createCatalog } from "../client/catalog/index.ts";

const [parsedPath, oldPath, out] = process.argv.slice(2);
if (!parsedPath || !oldPath || !out) { console.error("usage: npx tsx scripts/phb2024-build-module.mjs <phb-parsed.json> <old module.json> <out module.json>"); process.exit(2); }

const parsed = JSON.parse(readFileSync(parsedPath, "utf8"));
const old = JSON.parse(readFileSync(oldPath, "utf8"));
const oldById = new Map(old.content.map((entry) => [entry.id, entry]));
const problems = [];
const decisions = [];

/** The sections a table never plays with: the translator's review notes. */
const SKIPPED = new Set(["검수 기록"]);
const CONTRACT = { $schema: "https://simplevtt.local/schemas/common-play-contract.schema.json", schemaVersion: "0.2-draft" };

/** Markdown to the plain text a sheet shows: headings as their own line, bullets as •, no links or emphasis, tables as `a · b`. */
function plain(markdown) {
  return markdown
    .split("\n")
    .filter((line) => !/^\|\s*-+/.test(line) && !/^\|\s*-*:?-+:?\s*\|/.test(line))
    .map((line) => {
      let text = line.replace(/^#{1,6}\s+/, "").replace(/^>\s?/, "");
      if (/^\|.*\|$/.test(text.trim())) text = text.trim().slice(1, -1).split("|").map((cell) => cell.trim()).join(" · ");
      text = text.replace(/^(\s*)[-*]\s+/, "$1• ");
      text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
      return text.trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The document's whole text: the intro without its title, then every played section as `heading\ntext`. */
function fullText(doc) {
  const intro = plain(doc.intro.replace(/^#\s+.*\n?/, ""));
  const sections = doc.sections.filter((section) => !SKIPPED.has(section.head)).map((section) => `${section.head}\n${plain(section.text)}`);
  return [intro, ...sections].filter(Boolean).join("\n\n");
}

function presentation(name, originalName, description) {
  return { defaultLocale: "ko-KR", originalName, locales: { "ko-KR": { name, ...(description ? { description } : {}) }, en: { name: originalName } } };
}

/** The new entry: the source's text over the old entry's rule decisions. */
function rebuild(doc, id, previousId = id) {
  const previous = oldById.get(previousId);
  if (!previous) { problems.push(`옛 모듈에 ${previousId} 가 없다`); return undefined; }
  if (!doc.fm.name || !doc.fm.original_name) problems.push(`${doc.file}: frontmatter에 name/original_name 이 없다`);
  return { id, category: previous.category, presentation: presentation(doc.fm.name, doc.fm.original_name, fullText(doc)), tags: [...new Set([...(previous.tags ?? []), "phb-2024"])], mechanics: structuredClone(previous.mechanics ?? []) };
}

const content = [];
const counts = {};
const add = (kind, entry) => { if (!entry) return; content.push(entry); counts[kind] = (counts[kind] ?? 0) + 1; };

// ── P2: backgrounds, the species, feats ─────────────────────────────────────────────────────────────────────────

for (const doc of parsed.background) add("background", rebuild(doc, `phb2024.background.${doc.slug}`));

for (const doc of parsed.species) {
  const id = `phb2024.species.${doc.slug}`;
  const entry = rebuild(doc, id);
  add("species", entry);
  if (!entry) continue;
  const def = entry.mechanics.find((item) => item.kind === "species-definition")?.config ?? {};
  const headings = doc.sections.filter((section) => !SKIPPED.has(section.head) && section.head !== "기본 특성").map((section) => section.head);
  const traits = def.traits ?? [];
  if (headings.length !== traits.length) problems.push(`${doc.file}: 특성 절 ${headings.length}개와 species-definition.traits ${traits.length}개가 다르다`);
  // The catalog finds a trait's text by the name in `semantics.baseFeatures` (a trailing "(종족)" is ignored).
  (def.semantics?.baseFeatures ?? []).forEach((name, index) => { if (name.replace(/\s*\(.*\)\s*$/, "") !== headings[index]) problems.push(`${doc.file}: 특성 이름 "${name}"이 소스 절 "${headings[index]}"와 다르다`); });
  traits.forEach((raw, index) => {
    const key = raw.split("@")[0];
    const trait = oldById.get(`effect.trait.phb2024.${doc.slug}.${key}`);
    if (!trait) { problems.push(`옛 모듈에 ${doc.slug} 특성 ${key}의 계약이 없다`); return; }
    const copy = structuredClone(trait);
    copy.presentation = { ...copy.presentation, originalName: key, locales: { "ko-KR": { name: `${doc.fm.name}: ${headings[index] ?? key}`, summary: "종족 특성의 규칙 계약" } } };
    add("species-contract", copy);
  });
  for (const effect of old.content.filter((item) => item.id.startsWith(`effect.phb2024.${doc.slug}.`))) add("species-effect", structuredClone(effect));
}

for (const doc of parsed.feat) {
  const id = `phb2024.feat.${doc.slug}`;
  const entry = rebuild(doc, id);
  add("feat", entry);
  if (!entry) continue;
  const def = entry.mechanics.find((item) => item.kind === "feat-definition")?.config;
  if (def && doc.fm.feat_category && def.tier !== doc.fm.feat_category) problems.push(`${id}: 분류가 소스(${doc.fm.feat_category})와 옛 모듈(${def.tier})이 다르다`);
  const contract = oldById.get(`effect.feat.phb2024.${doc.slug}`);
  if (contract) {
    const copy = structuredClone(contract);
    copy.presentation = { ...copy.presentation, originalName: doc.fm.original_name, locales: { "ko-KR": { name: doc.fm.name, summary: "재주의 규칙 계약" } } };
    add("feat-contract", copy);
  } else problems.push(`${id}: 계약 항목이 없다`);
}

// ── P4: subclasses ───────────────────────────────────────────────────────────────────────────────────────────────

/** Korean spell name → id: the app's catalog (SRD and the old module's spells) and every list the old module resolved. */
const catalog = createCatalog([old]);
const spellIdByKo = new Map(catalog.spells.map((spell) => [spell.name, spell.id]));
// The source translates a few SRD spells differently from the app's catalog; those resolve by their English name.
const SOURCE_SPELL_NAMES = {
  "휘감는 강타": "Ensnaring Strike", "동물과 대화": "Speak with Animals", "돌가죽": "Stoneskin", "자연과 교감": "Commune with Nature",
  "나무 걸음": "Tree Stride", "능력 향상": "Enhance Ability", "강제": "Compulsion", "전설 지식": "Legend Lore", "재앙": "Bane",
  "사냥꾼의 징표": "Hunter's Mark", "수정구": "Scrying",
};
for (const [ko, en] of Object.entries(SOURCE_SPELL_NAMES)) { const spell = catalog.spellByName(en); if (spell) spellIdByKo.set(ko, spell.id); else problems.push(`주문 "${en}"이 카탈로그에 없다`); }
const subclassDocs = parsed.subclass;
const oldSubclasses = old.content.filter((entry) => entry.category === "subclass");
const levelSection = (section) => /^(\d+)레벨:\s*(.+)$/.exec(section.head);

/** The `| level | spells |` rows of an always-prepared table, spell names still in Korean. */
function spellTable(text) {
  const rows = {};
  for (const line of text.split("\n")) {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    if (cells.length < 2 || !/^\d+$/.test(cells[0])) continue;
    rows[cells[0]] = cells[1].split(/,\s*/).map((name) => name.replace(/`/g, "").trim()).filter(Boolean);
  }
  return rows;
}

// Every list the old module did resolve teaches the name map its ids (the same translation, in the same order).
for (const doc of subclassDocs) {
  const previous = oldSubclasses.find((entry) => entry.presentation.originalName === doc.fm.original_name);
  const spells = previous?.mechanics?.find((item) => item.kind === "subclass-definition")?.config?.spells;
  const section = doc.sections.find((item) => /항상 준비/.test(item.text) && /\|/.test(item.text));
  if (!spells || !section) continue;
  const table = spellTable(section.text);
  for (const [level, names] of Object.entries(table)) names.forEach((name, index) => { const id = spells[level]?.[index]; if (id && !spellIdByKo.has(name)) spellIdByKo.set(name, id); });
}

const FIGHTER = "dnd.srd521.class.fighter";
const fighterAt = (level) => ({ op: "gte", args: [{ ref: `actor.class-level:${FIGHTER}` }, { value: level }] });
/** The superiority die's size by fighter level (d8, d10 at 10, d12 at 18). */
const SUPERIORITY_DIE = { op: "if", args: [fighterAt(18), { value: 12 }, { op: "if", args: [fighterAt(10), { value: 10 }, { value: 8 }] }] };
const MANEUVER_DC = { op: "add", args: [{ value: 8 }, { ref: "proficiency.bonus" }, { op: "max", args: [{ ref: "ability.str.modifier" }, { ref: "ability.dex.modifier" }] }] };
const SUPERIORITY = "resource:phb2024.battle-master.superiority";
const spendDie = { kind: "resource.change", resource: SUPERIORITY, amount: -1, target: "self" };
const dieDamage = { kind: "damage.apply", dice: "1d8", diceSides: SUPERIORITY_DIE, damageType: "weapon", target: "attack-target" };
const payDie = [{ kind: "resource", resource: SUPERIORITY, amount: { value: 1 }, consumeAt: "commit" }];
const ask = (question, extra = {}) => ({ kind: "adjudication.request", question, ...extra });
const choice = (id) => ({ id, kind: "choice", responder: "actor-owner", mode: "blocking", input: { type: "boolean" }, revalidate: "if-revision-changed", stalePolicy: "reject" });

/**
 * The twenty maneuvers, in the source's order (it lists them alphabetically by their English names, which is how
 * they are keyed here). Each one is a contract the app runs: a hit's window adds the die and the rider, a missed
 * attack's window adds the die to the roll, a check's window adds it to the check, the rest are buttons.
 */
const MANEUVERS = [
  ["ambush", (id, name) => ({ payments: payDie, interceptors: [{ id: "ambush", timing: "d20.outcome-determined", slot: "d20.roll", families: ["ability-check"], outcomes: ["failure"], interaction: choice("use"), factQueries: [{ id: "stealth-or-initiative", fact: "table.judgement", unknownPolicy: "ask", question: `${name}: 민첩(은신) 판정이나 우선권 굴림입니까?` }], operations: [{ kind: "roll.modify", mode: "add-die", dice: "1d8", diceSides: SUPERIORITY_DIE }] }] })],
  ["bait-and-switch", (id, name) => ({ payments: payDie, entryPoints: [{ id: "use", invocation: "manual", label: name, targeting: { from: "targets", min: 1, max: 1 }, operations: [ask("자리 바꾸기(이동 5피트 이상, 기회 공격 없음)는 장면에서 옮긴다 — 좌표가 없다(D109). 둘 중 하나의 AC에 주사위 결과를 다음 자기 턴 시작까지 더한다", { amount: SUPERIORITY_DIE })] }] })],
  ["commanders-strike", (id, name) => ({ payments: payDie, entryPoints: [{ id: "use", invocation: "manual", label: name, targeting: { from: "targets", min: 1, max: 1 }, operations: [ask("공격 행동의 공격 하나를 포기한다 — 고른 아군이 반응으로 공격하고, 명중하면 피해에 우월성 주사위를 더한다(아군 카드에서 추가 피해로 적는다)", { amount: SUPERIORITY_DIE })] }] })],
  ["commanding-presence", (id, name) => ({ payments: payDie, interceptors: [{ id: "presence", timing: "d20.outcome-determined", slot: "d20.roll", families: ["ability-check"], outcomes: ["failure"], interaction: choice("use"), factQueries: [{ id: "persuade", fact: "table.judgement", unknownPolicy: "ask", question: `${name}: 매력(위협·공연·설득) 판정입니까?` }], operations: [{ kind: "roll.modify", mode: "add-die", dice: "1d8", diceSides: SUPERIORITY_DIE }] }] })],
  ["disarming-attack", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { oncePerTurn: false, requiresEffects: [] }, operations: [spendDie, dieDamage, ask("근력 내성에 실패하면 든 물체 하나를 떨어뜨린다 — 물체는 표가 정한다", { amount: MANEUVER_DC })] }] })],
  ["distracting-strike", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { oncePerTurn: false, requiresEffects: [] }, operations: [spendDie, dieDamage, { kind: "property.modify", property: "target.mark", operation: "set", value: 1, params: { mark: { name, nextAttack: { advantage: true, by: "others" } } } }] }] })],
  ["evasive-footwork", (id, name) => ({ payments: [...payDie, { kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit" }], entryPoints: [{ id: "use", invocation: "manual", label: name, operations: [ask("이탈 행동을 하고, 다음 자기 턴 시작까지 AC에 우월성 주사위 결과를 더한다 — 굴린 값을 시트의 AC 칸에 적는다", { amount: SUPERIORITY_DIE })] }] })],
  ["feinting-attack", (id, name) => ({ payments: [{ kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit" }], entryPoints: [{ id: "feint", invocation: "pre-roll-attack", label: name, attack: { oncePerTurn: true, requiresEffects: [] }, operations: [spendDie, dieDamage, ask("추가 행동으로 5피트 이내의 대상을 정한다 — 이 공격 굴림에 유리를 켠다")] }] })],
  ["goading-attack", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { oncePerTurn: false, requiresEffects: [] }, operations: [spendDie, dieDamage, ask("지혜 내성에 실패하면 다음 내 턴 끝까지 나 이외의 대상에게 하는 공격 굴림에 불리 — 대상 카드에서 불리를 켠다", { amount: MANEUVER_DC })] }] })],
  ["lunging-attack", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { scope: "melee", oncePerTurn: false, requiresEffects: [] }, operations: [ask(`${name}: 이 턴 추가 행동으로 질주했고, 명중 직전 직선으로 5피트 이상 이동했습니까?`, { fact: { id: "lunged", at: "on-hit" } }), { ...spendDie, when: { ref: "fact:lunged" } }, { ...dieDamage, when: { ref: "fact:lunged" } }] }] })],
  ["maneuvering-attack", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { oncePerTurn: false, requiresEffects: [] }, operations: [spendDie, dieDamage, ask("아군 하나가 반응으로 이동 속도 절반까지 움직이고, 대상의 기회 공격을 유발하지 않는다 — 장면에서 옮긴다(D109)")] }] })],
  ["menacing-attack", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { oncePerTurn: false, requiresEffects: [] }, operations: [spendDie, dieDamage, { kind: "condition.apply", condition: "frightened", target: "attack-target", save: { ability: "wis", dc: MANEUVER_DC }, duration: { kind: "rounds", amount: 1, boundary: "end", anchor: "source" } }] }] })],
  ["parry", (id, name) => ({ payments: payDie, interceptors: [{ id: "parry", timing: "reaction.window", slot: "reaction", trigger: "attack.hit-self", interaction: choice("use"), operations: [{ kind: "property.modify", property: "damage-taken.reduce", operation: "subtract", dice: "1d8", diceSides: SUPERIORITY_DIE, value: { op: "max", args: [{ ref: "ability.str.modifier" }, { ref: "ability.dex.modifier" }] } }, ask("근접 공격 굴림으로 받은 피해에만")] }] })],
  ["precision-attack", (id, name) => ({ payments: payDie, interceptors: [{ id: "precision", timing: "d20.outcome-determined", slot: "attack-roll", families: ["attack-roll"], outcomes: ["failure"], interaction: choice("use"), operations: [{ kind: "roll.modify", mode: "add-die", dice: "1d8", diceSides: SUPERIORITY_DIE }] }] })],
  ["pushing-attack", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { oncePerTurn: false, requiresEffects: [] }, operations: [spendDie, dieDamage, ask("대형 이하가 근력 내성에 실패하면 15피트까지 밀려난다 — 장면에서 옮긴다(D109)", { amount: MANEUVER_DC })] }] })],
  ["rally", (id, name) => ({ payments: [...payDie, { kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit" }], entryPoints: [{ id: "use", invocation: "manual", label: name, targeting: { from: "targets", min: 1, max: 1 }, operations: [{ kind: "temp-hp.grant", target: "targets", diceCount: { value: 1 }, diceSides: SUPERIORITY_DIE, amount: { op: "floor-div", args: [{ ref: `actor.class-level:${FIGHTER}` }, { value: 2 }] } }] }] })],
  ["riposte", (id, name) => ({ payments: [...payDie, { kind: "economy", bucket: "reaction", amount: { value: 1 }, consumeAt: "commit" }], entryPoints: [{ id: "use", invocation: "manual", label: name, targeting: { from: "targets", min: 1, max: 1 }, operations: [ask("근접 공격이 나를 빗나갔을 때 — 빗나감에 뜨는 반응 창이 없어 버튼으로 연다. 반격을 굴리고, 명중하면 이 버튼의 피해를 더한다"), { kind: "damage.apply", dice: "1d8", diceSides: SUPERIORITY_DIE, damageType: "weapon", target: "targets" }] }] })],
  ["sweeping-attack", (id, name) => ({ payments: payDie, entryPoints: [{ id: "use", invocation: "manual", label: name, targeting: { from: "targets", min: 1, max: 1 }, operations: [ask("근접 명중 직후, 원래 대상 5피트 이내이자 간격 안의 두 번째 생물 — 원래 공격 굴림이 그 AC에도 명중할 때만"), { kind: "damage.apply", dice: "1d8", diceSides: SUPERIORITY_DIE, damageType: "weapon", target: "targets" }] }] })],
  ["tactical-assessment", (id, name) => ({ payments: payDie, interceptors: [{ id: "assess", timing: "d20.outcome-determined", slot: "d20.roll", families: ["ability-check"], outcomes: ["failure"], interaction: choice("use"), factQueries: [{ id: "assess", fact: "table.judgement", unknownPolicy: "ask", question: `${name}: 지능(역사·조사)이나 지혜(통찰) 판정입니까?` }], operations: [{ kind: "roll.modify", mode: "add-die", dice: "1d8", diceSides: SUPERIORITY_DIE }] }] })],
  ["trip-attack", (id, name) => ({ entryPoints: [{ id: "hit", invocation: "on-hit", label: name, attack: { oncePerTurn: false, requiresEffects: [] }, operations: [spendDie, dieDamage, { kind: "condition.apply", condition: "prone", target: "attack-target", save: { ability: "str", dc: MANEUVER_DC } }, ask("대형 이하의 대상만")] }] })],
];

/** Subclasses that make their class cast (one-third casters): the source's own table decides the counts. */
function thirdCaster(doc, section) {
  const prepared = {};
  for (const line of section.text.split("\n")) {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    const level = /^(\d+)/.exec(cells[0] ?? "");
    if (level && /^\d+$/.test(cells[1] ?? "")) prepared[level[1]] = Number(cells[1]);
  }
  if (Object.keys(prepared).length < 10) problems.push(`${doc.file}: 준비 주문 표를 읽지 못했다`);
  decisions.push(`${doc.slug}: 1/3 시전자 — 준비 주문 ${JSON.stringify(prepared)}`);
  return { kind: "third", ability: "int", list: "dnd.srd521.class.wizard", cantrips: { "3": 2, "10": 3 }, prepared };
}

for (const doc of subclassDocs) {
  const [classSlug, ...rest] = doc.slug.split("-");
  const slug = rest.join("-");
  const classId = `dnd.srd521.class.${classSlug}`;
  const id = `phb2024.subclass.${classSlug}.${slug}`;
  const previous = oldSubclasses.find((entry) => entry.presentation.originalName === doc.fm.original_name);
  if (!previous) { problems.push(`${doc.file}: 옛 모듈에 ${doc.fm.original_name} 서브클래스가 없다`); continue; }
  const oldGrants = previous.progressionContributions.flatMap((contribution) => contribution.grants);
  const sections = doc.sections.filter(levelSection);
  if (oldGrants.length !== sections.length) problems.push(`${doc.file}: 특성 ${sections.length}개, 옛 모듈 ${oldGrants.length}개`);

  const grantsByLevel = new Map();
  let definition = structuredClone(previous.mechanics?.find((item) => item.kind === "subclass-definition")?.config ?? {});

  sections.forEach((section, index) => {
    const [, level, name] = levelSection(section);
    const featureId = `${id}.feature.${level}-${index + 1}`;
    const oldFeature = oldById.get(oldGrants[index]);
    if (!oldFeature) { problems.push(`${featureId}: 옛 특성 ${oldGrants[index]} 가 없다`); return; }
    if (oldFeature.presentation.locales["ko-KR"].name !== name) problems.push(`${featureId}: 이름 "${name}"이 옛 모듈 "${oldFeature.presentation.locales["ko-KR"].name}"와 다르다`);
    // Eight features open with their English name in italics; the rest have only the Korean one.
    const english = /^\*([A-Za-z][^*]*)\*\s*$/.exec(section.text.split("\n")[0] ?? "");
    const body = english ? section.text.split("\n").slice(1).join("\n") : section.text;
    const mechanics = structuredClone(oldFeature.mechanics ?? []);
    for (const item of mechanics) if (item.kind === "common-play") item.config.id = featureId;
    const entry = { id: featureId, category: "option", presentation: presentation(name, english?.[1] ?? `${doc.fm.original_name} — ${level}`, plain(body)), tags: ["subclass-feature", "phb-2024"], mechanics };
    add("subclass-feature", entry);
    grantsByLevel.set(level, [...(grantsByLevel.get(level) ?? []), featureId]);
    featureFixes(doc.slug, name, entry, definition, section);
  });

  // Always-prepared spells the source lists and the old module did not carry (a paladin's oath spells).
  const table = doc.sections.find((item) => /항상 준비/.test(item.text) && /\|/.test(item.text));
  if (table && !definition.spells) {
    const spells = {};
    for (const [level, names] of Object.entries(spellTable(table.text))) {
      spells[level] = names.map((name) => { const spellId = spellIdByKo.get(name); if (!spellId) problems.push(`${doc.file}: 주문 "${name}"을(를) 찾지 못했다`); return spellId ?? name; });
    }
    definition.spells = spells;
    decisions.push(`${doc.slug}: 항상 준비 주문을 소스 표에서 (${Object.values(spells).flat().length}개)`);
  }

  const mechanics = Object.keys(definition).length ? [{ kind: "subclass-definition", config: definition }] : [];
  add("subclass", {
    id, category: "subclass", presentation: presentation(doc.fm.name, doc.fm.original_name, fullText(doc)), tags: ["phb-2024"],
    relationships: [{ kind: "parent", target: classId }],
    progressionContributions: [...grantsByLevel].map(([level, grants]) => ({ track: classId, threshold: Number(level), grants })),
    mechanics,
  });
}

/**
 * Where the old module decided without the whole text, or could not say what the rule needed, the decision is
 * replaced here. Each case names the subclass by its source slug and the feature by its source heading.
 */
function featureFixes(docSlug, name, entry, definition, section) {
  const config = entry.mechanics.find((item) => item.kind === "common-play")?.config;
  const set = (next) => { entry.mechanics = [{ kind: "common-play", config: { ...CONTRACT, id: entry.id, ...next } }]; decisions.push(`${docSlug} ${name}: 계약을 다시 썼다`); };
  const castingSection = docSlug.endsWith("eldritch-knight") || docSlug.endsWith("arcane-trickster") ? /주문 시전$/.test(section.head) : false;

  if (castingSection) {
    definition.spellcasting = thirdCaster({ file: docSlug, slug: docSlug }, section);
    // The one-third caster is the subclass's own grammar now (D303); the feature keeps only what the grammar does not do.
    const tricks = docSlug.endsWith("arcane-trickster");
    set({ entryPoints: [
      ...(tricks ? [{ id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.spells", operation: "add", params: { spells: ["dnd.srd521.spell.mage-hand"], into: "cantrips" } }] }] : []),
      { id: "rule", invocation: "manual", operations: [{ kind: "property.modify", property: "rule.applied-elsewhere", operation: "add", note: "슬롯·소마법·준비 주문은 서브클래스의 주문 시전(1/3 시전자)이 시트에 넣는다" }, ask("레벨을 얻을 때 소마법 하나와 준비 주문 하나를 바꿀 수 있다 — 레벨업 창에서 다시 고른다")] },
    ] });
    return;
  }

  if (docSlug === "fighter-battle-master" && name === "전투 우월성") {
    definition.optionPools = [{ id: "maneuvers", list: "phb2024.maneuvers", label: "기동", known: { "3": 3, "7": 5, "10": 7, "15": 9 } }];
    // Keep the pool and the DC line; the generic "spend a die" button gives way to the maneuvers' own contracts.
    config.entryPoints = config.entryPoints.filter((point) => point.id !== "spend");
    const rule = config.entryPoints.find((point) => point.id === "rule");
    if (rule) rule.operations = rule.operations.filter((operation) => !/보충 자료 본문/.test(operation.question ?? ""));
    decisions.push("fighter-battle-master: 기동 20개를 선택지 목록과 계약으로, 3·7·10·15레벨에 3·5·7·9개");
    return;
  }

  if (docSlug === "barbarian-world-tree" && name === "세계수의 생명력") {
    const rageDice = { op: "if", args: [{ op: "gte", args: [{ ref: "actor.class-level:dnd.srd521.class.barbarian" }, { value: 16 }] }, { value: 4 }, { op: "if", args: [{ op: "gte", args: [{ ref: "actor.class-level:dnd.srd521.class.barbarian" }, { value: 9 }] }, { value: 3 }, { value: 2 }] }] };
    set({ entryPoints: [
      { id: "surge", invocation: "manual", label: `${name}: 생명력 쇄도`, operations: [{ kind: "temp-hp.grant", target: "self", amount: { ref: "actor.class-level:dnd.srd521.class.barbarian" } }, ask("격노를 활성화할 때 — 격노 버튼과 함께 누른다")] },
      { id: "life-giving", invocation: "manual", label: `${name}: 생명 부여의 힘`, targeting: { from: "targets", min: 1, max: 1 }, operations: [{ kind: "temp-hp.grant", target: "targets", diceCount: rageDice, diceSides: { value: 6 } }, ask("격노 중 자기 턴 시작에, 10피트 이내의 다른 생물 하나 — 거리는 장면에서(D109). 격노가 끝나면 남은 임시 HP는 사라진다")] },
    ] });
    return;
  }

  if (docSlug === "bard-dance" && name === "눈부신 발놀림") {
    const inspiration = { op: "if", args: [{ op: "gte", args: [{ ref: "actor.class-level:dnd.srd521.class.bard" }, { value: 15 }] }, { value: 12 }, { op: "if", args: [{ op: "gte", args: [{ ref: "actor.class-level:dnd.srd521.class.bard" }, { value: 10 }] }, { value: 10 }, { op: "if", args: [{ op: "gte", args: [{ ref: "actor.class-level:dnd.srd521.class.bard" }, { value: 5 }] }, { value: 8 }, { value: 6 }] }] }] };
    set({ entryPoints: [
      { id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.ac-formula", operation: "add", params: { abilities: ["dex", "cha"] }, note: name }] },
      { id: "rule", invocation: "manual", operations: [
        { kind: "property.modify", property: "ac.unarmored-base", operation: "set", value: { value: 10 }, note: "방어구·방패 없이 AC 10 + 민첩 + 매력" },
        ask("춤이 들어간 매력(공연) 판정에 유리 — 판정 창에서 유리를 켠다"),
        ask("바드의 영감을 쓰는 행동·추가 행동·반응에 비무장 타격 한 번을 더할 수 있다"),
      ] },
      { id: "bardic-damage", invocation: "on-hit", label: `${name}: 바드의 피해`, attack: { scope: "unarmed", oncePerTurn: false, requiresEffects: [] }, operations: [{ kind: "damage.apply", dice: "1d6", diceSides: inspiration, amount: { ref: "ability.dex.modifier" }, damageType: "타격", target: "attack-target" }, ask("비무장 타격의 일반 피해 대신 — 카드의 기본 피해 1은 표에서 뺀다. 영감은 소비하지 않는다")] },
    ] });
    return;
  }
  void config;
}

// The maneuvers: an option list, and one option entry with its contract for each.
const maneuverDoc = subclassDocs.find((doc) => doc.slug === "fighter-battle-master");
const maneuverText = maneuverDoc?.sections.find((section) => section.head === "기동 선택지")?.text ?? "";
const maneuvers = [...maneuverText.matchAll(/^-\s*\*\*([^*:]+):\*\*\s*(.+)$/gm)].map((match) => ({ name: match[1].trim(), text: match[2].trim() }));
if (maneuvers.length !== MANEUVERS.length) problems.push(`기동 ${maneuvers.length}개, 계약 ${MANEUVERS.length}개`);
const maneuverIds = [];
maneuvers.forEach((maneuver, index) => {
  const [slug, write] = MANEUVERS[index] ?? [];
  if (!slug) return;
  const optionId = `phb2024.option.maneuvers.${slug}`;
  maneuverIds.push(optionId);
  add("maneuver", { id: optionId, category: "option", presentation: presentation(maneuver.name, slug, plain(maneuver.text)), tags: ["maneuver", "phb-2024"], mechanics: [{ kind: "common-play", config: { ...CONTRACT, id: optionId, ...write(optionId, maneuver.name) } }] });
});
add("option-list", { id: "phb2024.maneuvers", category: "option", presentation: presentation("기동", "Maneuvers"), tags: ["phb-2024"], mechanics: [{ kind: "option-list-definition", config: { list: "phb2024.maneuvers", options: maneuverIds } }] });

// Effects the subclass features start keep their ids (their contracts are keyed `feature:<effect>`), so they come along whole.
for (const effect of old.content.filter((item) => item.id.startsWith("effect.phb2024.") && !item.id.startsWith("effect.phb2024.aasimar."))) add("subclass-effect", structuredClone(effect));

const { content: _unused, ...header } = old;
const module = { ...header, moduleId: "phb-2024", moduleVersion: "1", source: { ...header.source, version: "2024" }, content };
writeFileSync(out, JSON.stringify(module, null, 1));
console.log(JSON.stringify({ entries: content.length, ...counts }));
for (const line of decisions) console.log(`· ${line}`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

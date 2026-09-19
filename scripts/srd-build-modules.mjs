/**
 * Build the SRD 5.2.1 modules from the source text and the rule decisions (docs/design/v3/SRD_MODULE_PLAN.md §5).
 *
 * The text of every entry — its name, its lines (level, casting time, range …) and its whole description — comes from
 * the SRD translation (`scripts/srd-parse-source.mjs` output). The rule decisions — which class lists a spell is on,
 * how it executes — come from `content/srd-authoring/*.json`, edited by hand. This script joins the two and decides
 * nothing: an entry with no decision, or a decision with no entry, is reported and stops the build.
 *
 *   node scripts/srd-build-modules.mjs <out>/srd-parsed.json [content/modules/srd-5.2.1]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [parsedPath, outDir = "content/modules/srd-5.2.1"] = process.argv.slice(2);
if (!parsedPath) { console.error("usage: node scripts/srd-build-modules.mjs <srd-parsed.json> [out dir]"); process.exit(2); }
const parsed = JSON.parse(readFileSync(parsedPath, "utf8"));
const problems = [];

const HEADER = {
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft", moduleVersion: "1",
  rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" }, defaultLocale: "ko-KR",
  source: { document: "System Reference Document", version: "5.2.1", license: "CC-BY-4.0", srdDerived: true },
  localizationSource: { defaultLocale: "ko-KR", repository: "Kaetaeru/D-D-2024-", srdPathRoot: "10-RULEBOOKS/srd-5.2.1/" },
  dependencies: [], conflicts: [], capabilities: [], extensionPoints: [],
};

/** Markdown to the plain text a sheet shows: bullets as •, no links or emphasis, tables as `a · b`. */
function plain(markdown) {
  return markdown
    .split("\n")
    .filter((line) => !/^\|\s*:?-+/.test(line))
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
/** A node's text with its sub-headings as lines of their own. */
const nodeText = (node) => [node.text, ...node.children.map((child) => `${child.head}\n${nodeText(child)}`)].filter(Boolean).join("\n\n");
const slug = (english) => english.toLowerCase().replace(/'/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const presentation = (name, originalName, extra = {}) => ({ originalName, defaultLocale: "ko-KR", locales: { "ko-KR": { name, ...extra }, en: { name: originalName } } });
const decisions = (file) => JSON.parse(readFileSync(`content/srd-authoring/${file}`, "utf8"));

// The school words of the translation, to the catalog's keys (the table's vocabulary, not a rule).
const SCHOOL = { 방출술: "evocation", 환혹술: "enchantment", 방호술: "abjuration", 사령술: "necromancy", 변환술: "transmutation", 창조술: "conjuration", 예지술: "divination", 환영술: "illusion" };

function spells() {
  const decided = decisions("spells.json");
  const entries = [];
  const seen = new Set();
  for (const doc of parsed.docs.filter((item) => item.file.startsWith("spells/") && !item.file.endsWith("README.md"))) {
    for (const node of doc.tree.flatMap((top) => top.children)) {
      const field = (label) => new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, "m").exec(node.text)?.[1]?.trim();
      const english = field("원문명");
      if (!english) continue;
      const id = `dnd.srd521.spell.${slug(english)}`;
      const header = /^\*(.+)\*$/m.exec(node.text)?.[1] ?? "";
      const levelMatch = /(\d)레벨/.exec(header);
      const schoolWord = Object.keys(SCHOOL).find((word) => header.includes(word));
      if (!schoolWord) problems.push(`${id}: 학파를 읽지 못함 (${header})`);
      // The body: everything after the bullet lines, and the sub-headings (a summoned creature's block) under it.
      const body = node.text.split("\n").filter((line) => !/^- \*\*[^*]+:\*\*/.test(line) && line.trim() !== `*${header}*`).join("\n").trim();
      const description = plain([body, ...node.children.map((child) => `${child.head}\n${nodeText(child)}`)].join("\n\n"));
      const summary = plain(body.split(/\n\s*\n/)[0] ?? "");
      const decision = decided[id];
      if (!decision) { problems.push(`${id}: 결정 없음 (content/srd-authoring/spells.json)`); continue; }
      seen.add(id);
      entries.push({
        id, category: "spell", tags: ["spell", "srd-5.2.1"],
        presentation: presentation(node.head, english, { summary, description }),
        mechanics: [
          { kind: "spell-definition", config: { level: levelMatch ? Number(levelMatch[1]) : 0, school: SCHOOL[schoolWord] ?? "evocation", ritual: header.includes("의식"), castingTimeText: field("시전 시간"), rangeText: field("사거리"), componentsText: field("구성요소"), durationText: field("지속시간"), classes: decision.classes } },
          ...(decision.mechanic ? [{ kind: "spell-mechanic", config: decision.mechanic }] : []),
        ],
      });
    }
  }
  for (const id of Object.keys(decided)) if (!seen.has(id)) problems.push(`${id}: 원문에 없음`);
  return { moduleId: "dnd.srd-5.2.1.spells", content: entries.sort((a, b) => a.id.localeCompare(b.id)) };
}

/** A document by its path under the SRD root. */
const doc = (file) => parsed.docs.find((item) => item.file === file);
/** A document's whole text: its tree, headings as their own lines. */
const docText = (item) => plain([item.intro, ...item.tree.map((node) => `${node.head}\n${nodeText(node)}`)].filter(Boolean).join("\n\n"));
/** The `##`-or-deeper node whose heading, without a "N레벨: " prefix, is this one. */
function findHeading(nodes, heading) {
  for (const node of nodes) {
    // Without the level prefix (`4·8·12·16레벨: `) and a cost suffix (` — 비용 1d6`, ` — 1점`).
    if (node.head.replace(/^[\d·,\s]+레벨:\s*/, "").replace(/\s+—\s+.*$/, "") === heading) return node;
    const deeper = findHeading(node.children, heading);
    if (deeper) return deeper;
  }
  return undefined;
}

/** Species, backgrounds and feats: text from the source, definitions from `origins.json`. */
function origins() {
  const decided = decisions("origins.json");
  const content = [];
  for (const [id, decision] of Object.entries(decided.species)) {
    const file = `character-origins/species/${id.split(".").pop()}.md`;
    const source = doc(file);
    if (!source) { problems.push(`${id}: 원문 ${file} 없음`); continue; }
    const traits = decision.traits.map((trait) => {
      const node = findHeading(source.tree, trait.heading);
      if (!node) problems.push(`${id}: 특성 "${trait.heading}"을(를) 원문에서 찾지 못함 (content/srd-authoring/origins.json의 heading)`);
      return { key: trait.key, name: trait.heading, nameEn: trait.nameEn, ...(node ? { description: plain(nodeText(node)) } : {}), ...(trait.minLevel ? { minLevel: trait.minLevel } : {}) };
    });
    content.push({ id, category: "species", tags: ["species", "srd-5.2.1"], presentation: presentation(source.tree[0].head, source.fm.original_name, { description: docText(source) }),
      mechanics: [{ kind: "species-definition", config: { size: decision.size, speed: decision.speed, ...(decision.darkvision ? { darkvision: decision.darkvision } : {}), traits, choices: decision.choices, effects: decision.effects, semantics: decision.semantics } }] });
  }
  for (const [id, decision] of Object.entries(decided.backgrounds)) {
    const file = `character-origins/backgrounds/${id.split(".").pop()}.md`;
    const source = doc(file);
    if (!source) { problems.push(`${id}: 원문 ${file} 없음`); continue; }
    content.push({ id, category: "background", tags: ["background", "srd-5.2.1"], presentation: presentation(source.tree[0].head, source.fm.original_name, { description: docText(source) }), mechanics: [{ kind: "background-definition", config: decision.definition }] });
  }
  const feats = doc("feats/README.md");
  for (const [id, decision] of Object.entries(decided.feats)) {
    const node = findHeading(feats.tree, decision.heading);
    if (!node) { problems.push(`${id}: 재주 "${decision.heading}"을(를) 원문에서 찾지 못함`); continue; }
    content.push({ id, category: "feat", tags: decision.tags, presentation: presentation(decision.heading, decision.nameEn, { description: plain(nodeText(node)) }), mechanics: decision.mechanics });
  }
  return { moduleId: "dnd.srd-5.2.1.origins", content: content.sort((a, b) => a.id.localeCompare(b.id)) };
}

/**
 * Classes, subclasses, class features and class options: text from `classes/<class>.md`, definitions from
 * `classes.json`. A feature whose heading the source does not have keeps the old sentence and is listed, so the list of
 * texts still to map is visible rather than silently filled.
 */
const textMissing = [];
function classes() {
  const decided = decisions("classes.json");
  const rules = decisions("rules.json");
  const content = [];
  const classDoc = (classId) => doc(`classes/${classId.split(".").pop()}.md`);
  const feature = (id, decision, docOf) => {
    // `sourceHeading`: where the translation keeps this text when it names it differently (행동 폭증 2회 → 행동 폭증).
    const node = docOf ? findHeading(docOf.tree, decision.sourceHeading ?? decision.heading) : undefined;
    if (!node) textMissing.push(`${id}: "${decision.heading}"`);
    const description = node ? plain(nodeText(node)) : decision.fallback;
    // A contract the old SRD kept on the same entry id stays on it.
    return { id, category: "option", tags: ["srd-5.2.1"], presentation: presentation(decision.heading, decision.nameEn, description ? { description } : {}), mechanics: rules[id]?.mechanics ?? [] };
  };
  for (const [id, def] of Object.entries(decided.classes)) {
    const source = classDoc(id);
    if (!source) { problems.push(`${id}: 원문 classes/${id.split(".").pop()}.md 없음`); continue; }
    const top = source.tree[0];
    content.push({ id, category: "class", tags: ["class", "srd-5.2.1"], presentation: presentation(top.head, source.fm.original_name, { description: plain(nodeText(top)) }), mechanics: [{ kind: "class-definition", config: def }] });
  }
  for (const [id, decision] of Object.entries(decided.features)) content.push(feature(id, decision, classDoc(decision.classId)));
  for (const [id, decision] of Object.entries(decided.subclasses)) {
    const source = classDoc(decision.classId);
    const node = source?.tree.find((item) => item.head.replace(/^서브클래스:\s*/, "") === (decision.sourceHeading ?? decision.heading));
    if (!node) textMissing.push(`${id}: 서브클래스 "${decision.heading}"`);
    const byLevel = new Map();
    for (const item of decision.features) byLevel.set(item.level, [...(byLevel.get(item.level) ?? []), item.id]);
    content.push({
      id, category: "subclass", tags: ["subclass", "srd-5.2.1"],
      presentation: presentation(decision.heading, decision.nameEn, { ...(decision.summary ? { summary: decision.summary } : {}), ...(node ? { description: plain(node.text) } : {}) }),
      relationships: [{ kind: "parent", target: decision.classId }],
      progressionContributions: [...byLevel].sort((a, b) => a[0] - b[0]).map(([threshold, grants]) => ({ track: decision.classId, threshold, grants })),
      mechanics: [{ kind: "subclass-definition", config: decision.definition }, ...decision.mechanics],
    });
  }
  for (const [list, options] of Object.entries(decided.optionLists)) {
    const source = doc(`classes/${list.split(".")[0]}.md`);
    content.push({ id: `dnd.srd521.option-list.${list}`, category: "option", tags: ["srd-5.2.1"], presentation: presentation(list, list), mechanics: [{ kind: "option-list-definition", config: { list, options } }] });
    for (const item of options) content.push(feature(item.id, decided.options[item.id], source));
  }
  return { moduleId: "dnd.srd-5.2.1.classes", content: content.sort((a, b) => a.id.localeCompare(b.id)) };
}

/** Monsters: the stat block from `monsters.json`, the prose from `monsters/statblocks/<slug>.md`. */
function monsters() {
  const decided = decisions("monsters.json");
  const content = [];
  for (const [id, decision] of Object.entries(decided)) {
    const source = doc(`monsters/statblocks/${id.split(".").pop()}.md`);
    if (!source) problems.push(`${id}: 원문 monsters/statblocks/${id.split(".").pop()}.md 없음`);
    content.push({ id, category: "combatant", tags: ["monster", "srd-5.2.1"], presentation: presentation(decision.name, decision.nameEn, source ? { description: docText(source) } : {}), mechanics: [{ kind: "monster-definition", config: { statBlock: decision.statBlock } }] });
  }
  return { moduleId: "dnd.srd-5.2.1.monsters", content: content.sort((a, b) => a.id.localeCompare(b.id)) };
}

/** Areas whose decisions are module entries already (contracts, equipment): re-emitted as they are, in id order. */
function verbatim(file, moduleId, taken = new Set()) {
  return { moduleId, content: Object.values(decisions(file)).filter((entry) => !taken.has(entry.id)).sort((a, b) => a.id.localeCompare(b.id)) };
}

const classModule = classes();
// An entry the classes module writes (a feature whose contract sat on the same id) is not written twice.
const built = [spells(), origins(), classModule, monsters(), verbatim("rules.json", "dnd.srd-5.2.1.rules", new Set(classModule.content.map((entry) => entry.id))), verbatim("equipment.json", "dnd.srd-5.2.1.equipment")];
if (textMissing.length) console.warn(`원문에서 글을 찾지 못한 항목 ${textMissing.length}개 (옛 글을 씀):\n${textMissing.join("\n")}`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
mkdirSync(outDir, { recursive: true });
for (const module of built) {
  const file = `${outDir}/${module.moduleId.replace(/^dnd\.srd-5\.2\.1\./, "")}.module.json`;
  writeFileSync(file, `${JSON.stringify({ ...HEADER, moduleId: module.moduleId, content: module.content }, null, 1)}\n`);
  console.log(`${file}: ${module.content.length} entries`);
}

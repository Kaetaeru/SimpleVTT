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

const built = [spells()];
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
mkdirSync(outDir, { recursive: true });
for (const module of built) {
  const file = `${outDir}/${module.moduleId.replace(/^dnd\.srd-5\.2\.1\./, "")}.module.json`;
  writeFileSync(file, `${JSON.stringify({ ...HEADER, moduleId: module.moduleId, content: module.content }, null, 1)}\n`);
  console.log(`${file}: ${module.content.length} entries`);
}

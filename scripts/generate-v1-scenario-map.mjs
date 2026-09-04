import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// W8-03: derive the machine-readable map of the 120 multiplayer scenarios from the canonical
// catalog, the master roadmap gate tables, and the evidence ledger. Nothing here is hand-typed, and
// nothing depends on tree layout, so the map only changes when one of those three sources changes.
export const SCENARIO_MAP_PATH = "docs/roadmap/V1_SCENARIO_MAP.json";
const CATALOG_PATH = "docs/design/multiplayer-v1-scenario-catalog.md";
const ROADMAP_PATH = "docs/roadmap/V1_MASTER_ROADMAP.md";
const LEDGER_PATH = "docs/roadmap/V1_EVIDENCE_LEDGER.json";
export const FAMILY_SIZES = { A: 10, B: 8, C: 30, D: 13, E: 14, F: 10, G: 9, H: 12, I: 6, J: 8 };
const EVIDENCE_KINDS = new Set(["AUTO", "STRUCTURE", "WIN"]);

function scenarioRows(markdown) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\|\s*(MP-([A-J])(\d{2}))\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*([A-Z, ]+?)\s*\|\s*$/);
    if (!match) continue;
    const evidence = match[6].split(",").map((entry) => entry.trim()).filter(Boolean);
    rows.push({ id: match[1], family: match[2], index: Number(match[3]), title: match[4], observations: match[5], evidence });
  }
  return rows;
}

function gateRows(markdown) {
  const gates = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\|\s*`(W\d-\d\d)`\s*\|\s*(.+?)\s*\|\s*([RVB])\s*\|\s*(.+?)\s*\|\s*$/);
    if (!match) continue;
    gates.push({ id: match[1], title: match[2], classification: { R: "REUSE_LOCKED", V: "VERIFY_ONLY", B: "BUILD" }[match[3]], links: match[4].split(",").map((entry) => entry.trim()).filter(Boolean) });
  }
  return gates;
}

export function expandLink(link, scenarioIds) {
  const family = link.match(/^MP-([A-J])$/);
  if (family) return { scenarios: scenarioIds.filter((id) => id.startsWith(`MP-${family[1]}`)) };
  const familyRange = link.match(/^MP-([A-J])~(?:MP-)?([A-J])$/);
  if (familyRange) {
    const start = familyRange[1].charCodeAt(0);
    const end = familyRange[2].charCodeAt(0);
    if (end < start) return { scenarios: [], other: [link] };
    return { scenarios: scenarioIds.filter((id) => { const code = id.charCodeAt(3); return code >= start && code <= end; }) };
  }
  const range = link.match(/^MP-([A-J])(\d{2})(?:~(?:MP-)?([A-J])?(\d{2}))?$/);
  if (range) {
    const fam = range[1];
    const start = Number(range[2]);
    const end = range[4] === undefined ? start : Number(range[4]);
    const endFamily = range[3] ?? fam;
    if (endFamily !== fam) return { scenarios: [], other: [link] };
    const scenarios = [];
    for (let index = start; index <= end; index += 1) scenarios.push(`MP-${fam}${String(index).padStart(2, "0")}`);
    return { scenarios: scenarios.filter((id) => scenarioIds.includes(id)) };
  }
  const issue = link.match(/^MP-(\d{2})(?:~(?:MP-)?(\d{2}))?$/);
  if (issue) {
    const start = Number(issue[1]);
    const end = issue[2] === undefined ? start : Number(issue[2]);
    const issues = [];
    for (let index = start; index <= end; index += 1) issues.push(`MP-${String(index).padStart(2, "0")}`);
    return { scenarios: [], issues };
  }
  return { scenarios: [], other: [link] };
}

export function buildScenarioMap(repoRoot) {
  const catalog = readFileSync(join(repoRoot, CATALOG_PATH), "utf8");
  const roadmap = readFileSync(join(repoRoot, ROADMAP_PATH), "utf8");
  const ledger = JSON.parse(readFileSync(join(repoRoot, LEDGER_PATH), "utf8"));
  const scenarios = scenarioRows(catalog);
  const scenarioIds = scenarios.map((entry) => entry.id);
  const gates = gateRows(roadmap);
  const ledgerById = new Map(ledger.gates.map((gate) => [gate.id, gate]));

  const gateEntries = gates.map((gate) => {
    const scenarioSet = new Set();
    const issues = new Set();
    const other = new Set();
    for (const link of gate.links) {
      const expanded = expandLink(link, scenarioIds);
      expanded.scenarios.forEach((id) => scenarioSet.add(id));
      (expanded.issues ?? []).forEach((id) => issues.add(id));
      (expanded.other ?? []).forEach((id) => other.add(id));
    }
    const record = ledgerById.get(gate.id);
    return {
      id: gate.id,
      title: gate.title,
      classification: gate.classification,
      scenarios: [...scenarioSet].sort(),
      issues: [...issues].sort(),
      otherLinks: [...other].sort(),
      status: record?.status ?? "UNKNOWN",
      lastVerifiedSha: record?.lastVerifiedSha ?? null,
      commands: record?.evidence?.commands ?? [],
      windowsArtifacts: record?.evidence?.windowsArtifacts ?? [],
    };
  });

  const scenarioEntries = scenarios.map((scenario) => {
    const owningGates = gateEntries.filter((gate) => gate.scenarios.includes(scenario.id));
    const passGates = owningGates.filter((gate) => gate.status === "PASS");
    const requiresWin = scenario.evidence.includes("WIN");
    const winProven = passGates.some((gate) => gate.windowsArtifacts.length > 0);
    const autoProven = passGates.length > 0;
    return {
      id: scenario.id,
      family: scenario.family,
      title: scenario.title,
      observations: scenario.observations,
      evidence: scenario.evidence,
      gates: owningGates.map((gate) => gate.id),
      status: owningGates.length === 0 ? "UNMAPPED" : requiresWin ? (autoProven && winProven ? "PASS" : autoProven ? "AUTO_ONLY" : "PENDING") : (autoProven ? "PASS" : "PENDING"),
    };
  });

  const familyCounts = Object.fromEntries(Object.keys(FAMILY_SIZES).map((family) => [family, scenarioEntries.filter((entry) => entry.family === family).length]));
  const statusCounts = {};
  for (const entry of scenarioEntries) statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
  return {
    schemaVersion: 1,
    sources: { catalog: CATALOG_PATH, roadmap: ROADMAP_PATH, ledger: LEDGER_PATH, ledgerCreatedFromSha: ledger.createdFromSha, ledgerOfficialScore: ledger.officialScore },
    counts: { scenarios: scenarioEntries.length, families: familyCounts, byStatus: statusCounts, gates: gateEntries.length },
    scenarios: scenarioEntries,
    gates: gateEntries,
  };
}

export function validateScenarioMap(map) {
  const errors = [];
  if (map?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  const scenarios = Array.isArray(map?.scenarios) ? map.scenarios : [];
  const gates = Array.isArray(map?.gates) ? map.gates : [];
  const expected = Object.values(FAMILY_SIZES).reduce((sum, value) => sum + value, 0);
  if (scenarios.length !== expected) errors.push(`expected ${expected} scenarios, found ${scenarios.length}`);
  for (const [family, size] of Object.entries(FAMILY_SIZES)) {
    const actual = scenarios.filter((entry) => entry.family === family).length;
    if (actual !== size) errors.push(`family ${family}: expected ${size} scenarios, found ${actual}`);
  }
  const ids = new Set();
  for (const entry of scenarios) {
    if (ids.has(entry.id)) errors.push(`duplicate scenario ${entry.id}`);
    ids.add(entry.id);
    if (!entry.evidence?.length || entry.evidence.some((kind) => !EVIDENCE_KINDS.has(kind))) errors.push(`${entry.id}: evidence must be AUTO/STRUCTURE/WIN`);
    if (!entry.gates?.length) errors.push(`${entry.id}: no owning gate`);
  }
  if (gates.length !== 72) errors.push(`expected 72 gates, found ${gates.length}`);
  const gateIds = new Set();
  for (const gate of gates) {
    if (gateIds.has(gate.id)) errors.push(`duplicate gate ${gate.id}`);
    gateIds.add(gate.id);
    for (const id of gate.scenarios) if (!ids.has(id)) errors.push(`${gate.id}: unknown scenario ${id}`);
    if (gate.status === "UNKNOWN") errors.push(`${gate.id}: missing from ledger`);
    if (gate.otherLinks.some((link) => /^MP-(?:[A-J]\d|\d\d|[A-J](?:~|$))/.test(link))) errors.push(`${gate.id}: unparsed MP link ${gate.otherLinks.join(", ")}`);
  }
  for (const entry of scenarios) for (const gateId of entry.gates) if (!gateIds.has(gateId)) errors.push(`${entry.id}: unknown gate ${gateId}`);
  return { ok: errors.length === 0, errors };
}

const self = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? "") === self) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const repoRoot = resolve(args.find((entry) => !entry.startsWith("--")) ?? ".");
  const map = buildScenarioMap(repoRoot);
  const result = validateScenarioMap(map);
  const serialized = `${JSON.stringify(map, null, 2)}\n`;
  const target = join(repoRoot, SCENARIO_MAP_PATH);
  if (!result.ok) {
    console.error("V1 scenario map is inconsistent:");
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  if (check) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current !== serialized) { console.error(`${SCENARIO_MAP_PATH} is stale; run node scripts/generate-v1-scenario-map.mjs`); process.exit(1); }
    console.log(`V1 scenario map OK: ${map.counts.scenarios} scenarios, ${JSON.stringify(map.counts.byStatus)}`);
  } else {
    writeFileSync(target, serialized, "utf8");
    console.log(`Wrote ${SCENARIO_MAP_PATH}: ${map.counts.scenarios} scenarios, ${JSON.stringify(map.counts.byStatus)}`);
  }
}

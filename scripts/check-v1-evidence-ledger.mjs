import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LEDGER_PATH = "docs/roadmap/V1_EVIDENCE_LEDGER.json";

// Mirrors the Workstream dashboard in docs/roadmap/V1_MASTER_ROADMAP.md §2.
// Weighted score = Σ(weight × PASS gates / gates) — roadmap §1 "100점 공식".
export const ROADMAP_WORKSTREAMS = {
  W0: { gates: 6, weight: 5 },
  W1: { gates: 8, weight: 10 },
  W2: { gates: 8, weight: 15 },
  W3: { gates: 8, weight: 10 },
  W4: { gates: 8, weight: 10 },
  W5: { gates: 10, weight: 15 },
  W6: { gates: 8, weight: 10 },
  W7: { gates: 8, weight: 10 },
  W8: { gates: 4, weight: 5 },
  W9: { gates: 4, weight: 10 },
};

const STATUS_VOCABULARY = ["PENDING", "PASS", "FAIL", "BLOCKED"];
const CLASSIFICATIONS = new Set(["REUSE_LOCKED", "VERIFY_ONLY", "BUILD"]);
const GATE_KEYS = ["id", "workstream", "classification", "status", "lastVerifiedSha", "evidence", "remainingGap"];
const EVIDENCE_KEYS = ["commands", "testCount", "windowsArtifacts", "sources"];
const GATE_ID = /^W\d-\d\d$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function sameKeys(value, expected) {
  const keys = Object.keys(value ?? {});
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

export function computeScore(gates) {
  let score = 0;
  for (const [workstream, { gates: total, weight }] of Object.entries(ROADMAP_WORKSTREAMS)) {
    const pass = gates.filter((gate) => gate.workstream === workstream && gate.status === "PASS").length;
    score += (weight * pass) / total;
  }
  return Math.round(score * 10) / 10;
}

export function computeCounts(gates) {
  const count = (predicate) => gates.filter(predicate).length;
  return {
    gates: gates.length,
    reuseLocked: count((gate) => gate.classification === "REUSE_LOCKED"),
    verifyOnly: count((gate) => gate.classification === "VERIFY_ONLY"),
    build: count((gate) => gate.classification === "BUILD"),
    pass: count((gate) => gate.status === "PASS"),
    pending: count((gate) => gate.status === "PENDING"),
    fail: count((gate) => gate.status === "FAIL"),
    blocked: count((gate) => gate.status === "BLOCKED"),
  };
}

export function validateV1EvidenceLedger(ledger) {
  const errors = [];
  if (!ledger || typeof ledger !== "object") return { ok: false, errors: ["ledger is not an object"] };
  if (ledger.schemaVersion !== 1) errors.push(`unexpected schemaVersion: ${ledger.schemaVersion ?? "<missing>"}`);
  if (JSON.stringify(ledger.statusVocabulary) !== JSON.stringify(STATUS_VOCABULARY)) {
    errors.push(`statusVocabulary must be ${STATUS_VOCABULARY.join(",")}`);
  }
  if (!FULL_SHA.test(ledger.createdFromSha ?? "")) errors.push("createdFromSha must be a full 40-hex SHA");

  const gates = Array.isArray(ledger.gates) ? ledger.gates : [];
  if (!Array.isArray(ledger.gates)) errors.push("gates must be an array");

  const expectedTotal = Object.values(ROADMAP_WORKSTREAMS).reduce((sum, entry) => sum + entry.gates, 0);
  const expectedWeight = Object.values(ROADMAP_WORKSTREAMS).reduce((sum, entry) => sum + entry.weight, 0);
  if (expectedWeight !== 100) errors.push(`roadmap weights sum to ${expectedWeight}, expected 100`);
  if (gates.length !== expectedTotal) errors.push(`expected ${expectedTotal} gates, found ${gates.length}`);

  const seen = new Set();
  const perWorkstream = {};
  for (const [index, gate] of gates.entries()) {
    const label = typeof gate?.id === "string" ? gate.id : `gates[${index}]`;
    if (!gate || typeof gate !== "object") { errors.push(`${label}: not an object`); continue; }
    for (const key of Object.keys(gate)) if (!GATE_KEYS.includes(key)) errors.push(`${label}: unknown field ${key}`);
    for (const key of GATE_KEYS) if (!(key in gate)) errors.push(`${label}: missing field ${key}`);
    if (!GATE_ID.test(gate.id ?? "")) errors.push(`${label}: invalid gate id`);
    if (seen.has(gate.id)) errors.push(`${label}: duplicate gate id`);
    seen.add(gate.id);
    if (typeof gate.id === "string" && gate.workstream !== gate.id.slice(0, 2)) errors.push(`${label}: workstream ${gate.workstream} does not match id`);
    if (!(gate.workstream in ROADMAP_WORKSTREAMS)) errors.push(`${label}: unknown workstream ${gate.workstream}`);
    else perWorkstream[gate.workstream] = (perWorkstream[gate.workstream] ?? 0) + 1;
    if (!CLASSIFICATIONS.has(gate.classification)) errors.push(`${label}: invalid classification ${gate.classification ?? "<missing>"}`);
    if (!STATUS_VOCABULARY.includes(gate.status)) errors.push(`${label}: invalid status ${gate.status ?? "<missing>"}`);
    if (!(gate.remainingGap === null || typeof gate.remainingGap === "string")) errors.push(`${label}: remainingGap must be null or string`);

    const evidence = gate.evidence;
    if (!sameKeys(evidence, EVIDENCE_KEYS)) errors.push(`${label}: evidence must have exactly ${EVIDENCE_KEYS.join(",")}`);
    else {
      if (!isStringArray(evidence.commands)) errors.push(`${label}: evidence.commands must be string[]`);
      if (!isStringArray(evidence.windowsArtifacts)) errors.push(`${label}: evidence.windowsArtifacts must be string[]`);
      if (!isStringArray(evidence.sources)) errors.push(`${label}: evidence.sources must be string[]`);
      if (!(evidence.testCount === null || Number.isInteger(evidence.testCount))) errors.push(`${label}: evidence.testCount must be null or integer`);
    }

    if (gate.status === "PASS") {
      if (!FULL_SHA.test(gate.lastVerifiedSha ?? "")) errors.push(`${label}: PASS requires a full 40-hex lastVerifiedSha`);
      if (!(Array.isArray(evidence?.sources) && evidence.sources.length > 0)) errors.push(`${label}: PASS requires at least one evidence source`);
    } else if (!(gate.lastVerifiedSha === null || FULL_SHA.test(gate.lastVerifiedSha))) {
      errors.push(`${label}: lastVerifiedSha must be null or a full 40-hex SHA`);
    }
  }
  for (const [workstream, { gates: expected }] of Object.entries(ROADMAP_WORKSTREAMS)) {
    const actual = perWorkstream[workstream] ?? 0;
    if (actual !== expected) errors.push(`${workstream}: expected ${expected} gates, found ${actual}`);
  }

  const counts = computeCounts(gates);
  for (const [key, value] of Object.entries(counts)) {
    if (ledger.counts?.[key] !== value) errors.push(`counts.${key} is ${ledger.counts?.[key] ?? "<missing>"}, computed ${value}`);
  }
  for (const key of Object.keys(ledger.counts ?? {})) if (!(key in counts)) errors.push(`counts: unknown field ${key}`);

  const score = computeScore(gates);
  if (ledger.officialScore !== score) errors.push(`officialScore is ${ledger.officialScore ?? "<missing>"}, computed ${score}`);

  return { ok: errors.length === 0, errors, computed: { counts, score } };
}

export function checkV1EvidenceLedger(repoRoot) {
  const ledgerPath = join(repoRoot, LEDGER_PATH);
  if (!existsSync(ledgerPath)) return { ok: false, errors: [`missing ledger: ${ledgerPath}`] };
  let ledger;
  try { ledger = JSON.parse(readFileSync(ledgerPath, "utf8")); }
  catch (error) { return { ok: false, errors: [`ledger is not valid JSON: ${error instanceof Error ? error.message : String(error)}`] }; }
  return validateV1EvidenceLedger(ledger);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(process.argv[2] ?? ".");
  const result = checkV1EvidenceLedger(repoRoot);
  if (result.ok) {
    const { counts, score } = result.computed;
    console.log(`V1 evidence ledger OK: ${counts.pass}/${counts.gates} PASS, score ${score.toFixed(1)}/100.0`);
    process.exit(0);
  }
  console.error("V1 evidence ledger check failed:");
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}

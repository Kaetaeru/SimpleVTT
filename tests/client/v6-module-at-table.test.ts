/**
 * V0.9 D307: what the table sweep (`scripts/verify-module-at-table.ts`) found when the PHB module was played at a
 * host table, each as a synthetic module (CLAUDE.md §1.6) and, where the table is involved, through the host (§1.7):
 *
 * - a button's cost written as a payment was never spent (81 uses of the PHB module could be pressed forever);
 * - a condition named by its English id (`charmed`) was never taken off a sheet that carries `매혹`;
 * - a passive on a manual entry made a button that did nothing;
 * - in a hit's window, `target` was not read as the creature hit, so the save and its condition were dropped;
 * - an effect a use puts on a monster landed on nobody;
 * - a Pact Magic slot as a cost was read as a pool and refused;
 * - a feat's own gain contract never ran, so a pool it grants did not exist.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { activateFeature, usableFeatures } from "../../client/character/activate";
import { autofill } from "../../client/character/autofill";
import { rollFormula } from "../../client/character/dice";
import { initialRuntime, type CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { featureRuleKey } from "../../client/rules/activation";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { ids, sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SUB = "test.d307.subclass.fighter.warden";
const PACT = "test.d307.subclass.warlock.bargain";
const f = (sub: string, n: number) => `${sub}.feature.3-${n}`;
const option = (id: string, name: string, config: Record<string, unknown>) => ({ id, category: "option", presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name } } }, mechanics: [{ kind: "common-play", config: { id, ...config } }] });
const subclass = (id: string, cls: string, count: number) => ({ id, category: "subclass", presentation: { originalName: id, defaultLocale: "ko-KR", locales: { "ko-KR": { name: id } } }, relationships: [{ kind: "parent", target: ids.cls(cls) }], progressionContributions: [{ track: ids.cls(cls), threshold: 3, grants: Array.from({ length: count }, (_, index) => f(id, index + 1)) }] });

const MODULE = {
  moduleId: "test.d307", moduleVersion: "1",
  content: [
    subclass(SUB, "fighter", 4),
    // A pool, and a use that pays for it with a payment and takes off a condition named by its English id.
    option(f(SUB, 1), "수호의 샘", { entryPoints: [
      { id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.resource", operation: "add", value: { value: 3 }, params: { id: "resource.test.d307.well", label: "샘", recovery: "long-rest" } }] },
      { id: "use", invocation: "manual", payments: [{ kind: "resource", resource: "resource:test.d307.well", amount: { value: 1 }, consumeAt: "commit" }], operations: [{ kind: "condition.remove", condition: "charmed", target: "self" }, { kind: "healing.apply", target: "self", amount: { value: 5 } }] },
    ] }),
    // A passive: on the sheet, and no button.
    option(f(SUB, 2), "빠른 발", { entryPoints: [{ id: "rule", invocation: "manual", operations: [{ kind: "property.modify", property: "speed.walk", operation: "add", value: { value: 10 } }, { kind: "adjudication.request", question: "험지에서도" }] }] }),
    // A hit's choice whose condition names `target`.
    option(f(SUB, 3), "쓰러뜨리기", { entryPoints: [{ id: "hit", invocation: "on-hit", label: "쓰러뜨리기", attack: { oncePerTurn: false, requiresEffects: [] }, operations: [{ kind: "condition.apply", condition: "prone", target: "target", save: { ability: "str", dc: { value: 30 } } }] }] }),
    // A mark put on a creature the use is aimed at.
    option(f(SUB, 4), "사냥감 표시", { entryPoints: [{ id: "mark", invocation: "manual", targeting: { from: "targets", min: 1, max: 1 }, operations: [{ kind: "effect.apply", target: "targets", template: { key: "feature:test.d307.quarry", name: "사냥감" }, lifetime: "until-state" }] }] }),
    subclass(PACT, "warlock", 1),
    // A use bought back with a Pact Magic slot.
    option(f(PACT, 1), "거래", { entryPoints: [
      { id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.resource", operation: "add", value: { value: 1 }, params: { id: "resource.test.d307.deal", label: "거래", recovery: "long-rest" } }] },
      { id: "refresh", invocation: "manual", label: "거래: 계약 슬롯으로 회복", operations: [{ kind: "resource.change", resource: "resource:pact-slot", amount: { value: -1 }, target: "self" }, { kind: "resource.change", resource: "resource:test.d307.deal", amount: { value: 1 }, target: "self", upTo: true }] },
    ] }),
    // A feat whose pool lives in its own gain contract.
    { id: "test.d307.feat.charm", category: "feat", presentation: { originalName: "Charm", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "부적" } } }, mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } }] },
    { ...option("effect.feat.test.d307.charm", "부적", {}), mechanics: [{ kind: "common-play", config: { id: "feat:charm", entryPoints: [{ id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.resource", operation: "add", value: { ref: "proficiency.bonus" }, params: { id: "resource.test.d307.charm", label: "부적", recovery: "long-rest" } }] }] } }] },
  ],
} as unknown as RuleModuleJson;

const catalog = () => createCatalog([MODULE]);
const hero = (cls: string, sub: string) => {
  const cat = catalog();
  const made = autofill(sourceOf({ classes: cls, level: 3, choices: { "class.2.subclass": [sub] } }), cat, { prefer: { "class.2.subclass": [sub] } });
  return { cat, made };
};
async function press(cat: ReturnType<typeof catalog>, made: ReturnType<typeof hero>["made"], name: string, start: CharacterRuntime) {
  const use = usableFeatures(made.derived, start, cat).find((item) => item.feature.name === name);
  assert.ok(use, `a ${name} button: ${usableFeatures(made.derived, start, cat).map((item) => item.feature.name).join(", ")}`);
  let runtime = start;
  const outcome = await activateFeature(use!.feature, { source: made.source, catalog: cat, derived: made.derived, runtime, rollDice: async (spec) => rollFormula(spec, () => 0.5), save: (updater) => { runtime = updater(runtime); } });
  return { outcome, runtime };
}

test("D307: a use pays the pool its payment names, and takes off a condition named by its English id", async () => {
  const { cat, made } = hero("fighter", SUB);
  const base = initialRuntime(made.derived);
  const { outcome, runtime } = await press(cat, made, "수호의 샘", { ...base, hp: { ...base.hp, current: 5 }, conditions: ["매혹"] });
  assert.equal(outcome, "done");
  assert.equal(runtime.resourcesUsed["resource.test.d307.well"], 1, "the payment is spent");
  assert.deepEqual(runtime.conditions, [], "`charmed` takes off 매혹");
  assert.equal(runtime.hp.current, 10);
});

test("D307: a passive on a manual entry is on the sheet and makes no button", () => {
  const { cat, made } = hero("fighter", SUB);
  const passive = usableFeatures(made.derived, initialRuntime(made.derived), cat).find((item) => item.feature.name === "빠른 발");
  assert.ok(passive, "the feature is listed (it has a line for the table)");
  assert.equal(passive!.pressable, false, "but no button that does nothing");
});

test("D307: in a hit's window, `target` is the creature hit — the save and its condition are offered", () => {
  const { made } = hero("fighter", SUB);
  const rider = made.derived.attackRiders?.find((item) => item.key.startsWith(f(SUB, 3)));
  assert.ok(rider, JSON.stringify(made.derived.attackRiders?.map((item) => item.key)));
  assert.deepEqual(rider!.saves.map((save) => [save.ability, save.condition]), [["str", "넘어짐"]]);
});

test("D307: a Pact Magic slot pays for a use", async () => {
  const { cat, made } = hero("warlock", PACT);
  const { outcome, runtime } = await press(cat, made, "거래: 계약 슬롯으로 회복", { ...initialRuntime(made.derived), resourcesUsed: { "resource.test.d307.deal": 1 } });
  assert.equal(outcome, "done");
  assert.equal(runtime.pactSlotsUsed, 1, "one Pact Magic slot spent");
  assert.equal(runtime.resourcesUsed["resource.test.d307.deal"] ?? 0, 0, "and the use given back");
});

test("D307: a feat's gain contract runs — the pool it grants exists", () => {
  const cat = catalog();
  const made = autofill(sourceOf({ classes: "fighter", level: 4, choices: { "class.3.asi": ["test.d307.feat.charm"] } }), cat, { prefer: { "class.3.asi": ["test.d307.feat.charm"] } });
  assert.ok(made.derived.feats.some((feat) => feat.id === "test.d307.feat.charm"));
  assert.equal(made.derived.resources.find((pool) => pool.id === "resource.test.d307.charm")?.max, made.derived.proficiencyBonus);
});

test("D307: at the table, an effect a use puts on a monster lands on it", async () => {
  const { cat, made } = hero("fighter", SUB);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D307 시험", { userId: "dm", displayName: "DM" }), joinCode: "D307AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D307AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "숲", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const wolf = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "늑대", ac: 13, hp: 11, creatureType: "beast", abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, wolf]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), wolf: tokenForNpc(wolf) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const mark = made.derived.features.find((feature) => feature.name === "사냥감 표시")!;
  // The board names the target by its token only.
  dm.send({ type: "act.contract", actor: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, ruleKey: featureRuleKey(mark.id), targets: [{ pageId: scene.id, tokenId: tokens.wolf.id }] });
  await tick();
  const npc = host.journal.find((entry) => entry.id === wolf.id) as JournalNpc;
  assert.ok((npc.runtime.effects ?? []).some((effect) => effect.name === "사냥감"), JSON.stringify(npc.runtime.effects));
  const token = host.pageList.flatMap((page) => page.tokens).find((item) => item.id === tokens.wolf.id)!;
  assert.ok(token.markers.some((marker) => marker.name === "사냥감"), "and the token shows it");
});

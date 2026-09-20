/**
 * V0.9 D336 (SRD_MODULE_PLAN.md §27): a ward the casting tops up.
 *
 * A ward stands between its bearer and the damage, and casting the right kind of spell puts points back into it
 * (비전 방호). Two things were missing: a cast entry point could not tell *what* was cast, only how big the slot
 * was, and temporary hit points always replaced each other rather than accumulating up to a ceiling.
 *
 * - The scope of a `cast` entry point now reads `spell.school`, and the entry point's own `when` is honoured
 *   there, so a rule that answers one school says so once rather than on every operation.
 * - `temp-hp.grant` may say `accumulate` and a `maximum`: the ward gains points and never goes past its own size.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseContract } from "../../client/rules/contract";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const FEAT = "test.d336.feat.ward";

const MODULE = {
  moduleId: "test.d336", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Warded", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "방호막", description: "방호계 주문을 시전하면 방호막이 차오른다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: { id: "feat:ward", entryPoints: [
          { id: "top-up", invocation: "cast", when: { op: "eq", args: [{ ref: "spell.school" }, { value: "abjuration" }] }, operations: [
            { kind: "temp-hp.grant", target: "self", amount: { op: "mul", args: [{ value: 2 }, { ref: "spell.slot-level" }] }, accumulate: true, maximum: { value: 6 } },
          ] },
        ] } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

async function table(code: string) {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D336 시험", { userId: "dm", displayName: "DM" }), joinCode: code };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: code, hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: code, seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "서고", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "위자드", classes: "wizard", level: 4, abilities: { int: 16 }, choices: prefer }), cat, { prefer });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: token.id };
  const temp = () => (host.journal.find((entry) => entry.id === pc.id) as JournalCharacter).runtime.hp.temp;
  return { alice, me, temp };
}

test("D336: a grant may accumulate up to a ceiling, and the fields survive parsing", () => {
  const parsed = parseContract({ id: "feature:test.ward", entryPoints: [
    { id: "top-up", invocation: "cast", operations: [{ kind: "temp-hp.grant", target: "self", amount: { value: 4 }, accumulate: true, maximum: { value: 10 } }] },
  ] }, "test.d336.feature.ward");
  assert.deepEqual(parsed.unsupported, []);
  const operation = parsed.entryPoints[0].operations[0];
  assert.equal(operation.kind === "temp-hp.grant" && operation.accumulate, true);
  assert.deepEqual(operation.kind === "temp-hp.grant" ? operation.maximum : undefined, { value: 10 });
});

test("D336: casting the right school tops the ward up, never past its own size", async () => {
  const { alice, me, temp } = await table("D336AA");
  // 마법사의 갑옷 is abjuration: the ward gains twice the slot level.
  alice.send({ type: "act.cast", caster: me, spellId: "dnd.srd521.spell.mage-armor", targets: [me], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(temp(), 2, "one 1st-level abjuration spell");
  alice.send({ type: "act.cast", caster: me, spellId: "dnd.srd521.spell.mage-armor", targets: [me], method: { kind: "slot", level: 2 } });
  await tick();
  assert.equal(temp(), 6, "2 + 4, which is the whole ward");
  alice.send({ type: "act.cast", caster: me, spellId: "dnd.srd521.spell.mage-armor", targets: [me], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(temp(), 6, "and it stops there");
});

test("D336: a spell of another school leaves the ward where it is", async () => {
  const { alice, me, temp } = await table("D336BB");
  alice.send({ type: "act.cast", caster: me, spellId: "dnd.srd521.spell.magic-missile", targets: [me], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(temp(), 0, "evocation is not abjuration");
});

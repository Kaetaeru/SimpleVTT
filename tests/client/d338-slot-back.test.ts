/**
 * V0.9 D338 (SRD_MODULE_PLAN.md §29): a slot the casting hands back.
 *
 * Some rules give a spell slot back when you cast the right kind of spell, at a level worked out from the cast
 * itself — one below the slot spent, never past 5th (전문 예지). `resource.change` could only name a fixed level,
 * so the rule stayed a line for the DM. Its `level` may now be an expression, read in the scope of the cast.
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
const FEAT = "test.d338.feat.recall";
// One below the slot that was spent, and never past 5th.
const LEVEL = { op: "min", args: [{ value: 5 }, { op: "sub", args: [{ ref: "spell.slot-level" }, { value: 1 }] }] };

const MODULE = {
  moduleId: "test.d338", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Recall", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "주문 되짚기", description: "예지술 주문을 시전하면 낮은 슬롯 하나를 되찾는다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: { id: "feat:recall", entryPoints: [
          { id: "recall", invocation: "cast", when: { op: "gte", args: [{ ref: "spell.slot-level" }, { value: 2 }] }, operations: [
            { kind: "resource.change", resource: "resource:spell-slot", amount: { value: 1 }, target: "self", level: LEVEL },
          ] },
        ] } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

test("D338: a slot level may be an expression, and a plain number still parses", () => {
  const parsed = parseContract({ id: "feature:test.recall", entryPoints: [
    { id: "recall", invocation: "cast", operations: [{ kind: "resource.change", resource: "resource:spell-slot", amount: { value: 1 }, target: "self", level: LEVEL }] },
  ] }, "test.d338.feature.recall");
  assert.deepEqual(parsed.unsupported, []);
  const operation = parsed.entryPoints[0].operations[0];
  assert.deepEqual(operation.kind === "resource.change" ? operation.levelExpr : undefined, LEVEL);
  const plain = parseContract({ id: "feature:test.plain", entryPoints: [
    { id: "burn", invocation: "manual", operations: [{ kind: "resource.change", resource: "resource:spell-slot", amount: { value: -1 }, target: "self", level: 3 }] },
  ] }, "test.d338.feature.plain");
  const burn = plain.entryPoints[0].operations[0];
  assert.equal(burn.kind === "resource.change" ? burn.level : undefined, 3);
  assert.equal(burn.kind === "resource.change" ? burn.levelExpr : undefined, undefined);
});

test("D338: at the table the cast gives back the slot the contract worked out", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D338 시험", { userId: "dm", displayName: "DM" }), joinCode: "D338AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D338AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D338AA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "탑", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "위자드", classes: "wizard", level: 5, abilities: { int: 16 }, choices: prefer }), cat, { prefer });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: token.id };
  const slots = () => (host.journal.find((entry) => entry.id === pc.id) as JournalCharacter).runtime.slotsUsed;
  // Spend a 1st-level slot first, so there is one to hand back.
  alice.send({ type: "act.cast", caster: me, spellId: "dnd.srd521.spell.mage-armor", targets: [me], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(slots()[1], 1);
  // Now a 2nd-level cast: one below is 1st, and that is the slot that comes back.
  alice.send({ type: "act.cast", caster: me, spellId: "dnd.srd521.spell.mage-armor", targets: [me], method: { kind: "slot", level: 2 } });
  await tick();
  assert.equal(slots()[2], 1, "the 2nd-level slot was spent");
  assert.equal(slots()[1] ?? 0, 0, "and the 1st-level one came back");
  // A 1st-level cast asks for nothing: the entry point's own `when` keeps it shut.
  alice.send({ type: "act.cast", caster: me, spellId: "dnd.srd521.spell.mage-armor", targets: [me], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(slots()[1], 1, "spent, with nothing given back");
});

/**
 * R84 (ROLL20_TABLE_SPEC.md D219): a summon spell brings its own creature, filled in at the level it was cast.
 *
 * 야수 소환 and the other 2024 summons have no compendium monster; their stat block depends on the slot and on the
 * caster. The table said "DM이 괴물을 고릅니다". Now the spell's mechanics carry a template and the card's 소환 button
 * puts the creature for this cast on the board.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { initialRuntime } from "../../client/character/runtime";
import { spellExec } from "../../client/compendium/spells";
import { evaluateExpression, summonMonster } from "../../client/compendium/summonTemplate";
import { derivedOf } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const BEAST = "phb2024.spell.summon-beast";

function setup() {
  build({ name: "x", classes: "druid", level: 1 });
  const patch = JSON.parse(readFileSync("content/supplements/phb-2024.spell-mechanics-patch/module.json", "utf8")) as RuleModuleJson;
  const supplement = { moduleId: "phb-2024-supplement", moduleVersion: "1", content: [{ id: BEAST, category: "spell", presentation: { originalName: "Summon Beast", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "야수 소환" } } }, mechanics: [{ kind: "spell-definition", config: { level: 2, castingTimeText: "행동", rangeText: "90피트", durationText: "집중, 최대 1시간", classes: ["druid", "ranger"] } }] }] } as unknown as RuleModuleJson;
  return createCatalog([supplement, patch]);
}

test("R84: the expression reader and the template (D219)", () => {
  const vars = { level: 4, attack: 7, dc: 15, mod: 4 };
  assert.equal(evaluateExpression("30+5*(level-2)", vars), 40);
  assert.equal(evaluateExpression("floor(level/2)", { ...vars, level: 5 }), 2);
  assert.throws(() => evaluateExpression("process.exit()", vars), /모르는 이름/);
  setup();
  const land = spellExec(BEAST)!.summon!.forms.find((form) => form.name === "땅")!;
  const made = summonMonster(land, vars);
  assert.ok("monster" in made, JSON.stringify(made));
  const { monster } = made;
  assert.deepEqual([monster.ac, monster.hp, monster.speeds.climb], [15, 40, 30]);
  const rend = monster.actions.find((action) => action.name === "할퀴기")!;
  assert.deepEqual([rend.attack?.bonus, rend.attack?.damage[0].dice, rend.attack?.damage[0].flat], [7, "1d8", 8]);
  assert.equal(monster.actions.find((action) => action.kind === "multiattack")?.multiattack?.count, 2, "4th level: two attacks");
  for (const summon of ["summon-fey", "summon-undead", "summon-aberration", "summon-construct", "summon-elemental", "summon-celestial", "summon-fiend"]) {
    const exec = spellExec(`phb2024.spell.${summon}`);
    for (const form of exec?.summon?.forms ?? []) assert.ok("monster" in summonMonster(form, { ...vars, level: 6 }), `${summon} ${form.name}`);
  }
});

test("R84: at the table the card's 소환 puts this cast's creature down (D219)", async () => {
  const cat = setup();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R84 시험", { userId: "dm", displayName: "DM" }), joinCode: "R84AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s",
    pcSpell: (entry, spellId, method) => { const derived = derivedOf(entry, catalog()); derived.spellcasting[0].prepared.push(spellId); return pcSpell(entry, derived, cat, spellId, method); } });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R84AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "들판", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "드루이드", classes: "druid", level: 5 });
  const runtime = { ...initialRuntime(made.derived), effects: [{ key: `spell:${BEAST}`, name: "야수 소환", source: "spell" as const, duration: "집중", concentration: true, elapsed: 0, startedAt: "", level: 3 }] };
  const pc = newJournalCharacter(campaign.id, "dm", made.source, runtime);
  dm.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "act.summon", summoner: { entryId: pc.id, pageId: scene.id, tokenId: token.id }, monsterId: "", spellId: BEAST, form: 0 });
  await tick();
  const summoned = host.journal.find((entry) => entry.kind === "npc" && entry.summonedBy?.entryId === pc.id);
  assert.ok(summoned && summoned.kind === "npc", JSON.stringify(dm.snapshot!.chat.slice(-1)));
  const attack = made.derived.spellcasting[0].attackBonus;
  assert.deepEqual([summoned.statBlock.name, summoned.statBlock.ac, summoned.statBlock.hp], ["야수 정령 (하늘)", 14, 25], "3rd level: AC 11+3, HP 20+5");
  assert.equal(summoned.statBlock.actions.find((action) => action.name === "할퀴기")?.attack?.bonus, attack, "the druid's spell attack");
  assert.ok(host.pageList.find((page) => page.id === scene.id)!.tokens.some((item) => item.represents === summoned.id), "a token on the board");
});

/**
 * R17 (ROLL20_TABLE_SPEC.md D114): the dice grammar a table actually asks for, macros and rollable tables.
 * kh/kl/dh/dl keep or drop, r/ro reroll, ! explodes, >/< counts successes; `#이름` runs a macro; `/roll 2t[표]`
 * asks the host to draw, because a player never holds a table's rows.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newCampaign } from "../../client/campaign/model";
import { describeRoll, formatFormula, parseFormula, rollFormula } from "../../client/character/dice";
import { expandMacros, parseChatInput } from "../../client/session/chat";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** A die source that returns the given values in order, then repeats the last. */
const scripted = (...values: number[]) => { let at = 0; return (sides?: number) => { const value = values[Math.min(at++, values.length - 1)]; return (value - 0.5) / 20; }; };
const rollWith = (formula: string, values: number[], sides = 6) => rollFormula({ label: "시험", formula }, (() => { let at = 0; return () => { const value = values[Math.min(at++, values.length - 1)]; return (value - 0.5) / sides; }; })());

test("the plain grammar still parses and still rolls the same way", () => {
  assert.deepEqual(parseFormula("2d6+3"), { dice: [{ count: 2, sides: 6 }], modifier: 3 });
  assert.deepEqual(parseFormula("d20"), { dice: [{ count: 1, sides: 20 }], modifier: 0 });
  assert.deepEqual(parseFormula("1d8+1d6-1"), { dice: [{ count: 1, sides: 8 }, { count: 1, sides: 6 }], modifier: -1 });
  assert.equal(parseFormula("아무 말"), null);
  assert.equal(parseFormula(""), null);
  assert.equal(parseFormula("200d6"), null, "a hundred dice is the limit");
  assert.equal(formatFormula(parseFormula("2d6+3")!), "2d6+3");
});

test("keep and drop: 4d6kh3 is the ability-score roll, kl/dh/dl are its siblings", () => {
  const kept = rollWith("4d6kh3", [1, 5, 3, 6]);
  assert.equal(kept.total, 14, "5 + 3 + 6");
  assert.deepEqual(kept.dice.map((die) => die.dropped ?? false), [true, false, false, false]);
  assert.equal(rollWith("4d6k3", [1, 5, 3, 6]).total, 14, "k means kh");
  assert.equal(rollWith("4d6dl1", [1, 5, 3, 6]).total, 14, "dropping the lowest is the same roll");
  assert.equal(rollWith("4d6kl1", [1, 5, 3, 6]).total, 1);
  assert.equal(rollWith("4d6dh1", [1, 5, 3, 6]).total, 9, "6 dropped: 1 + 5 + 3");
  assert.equal(parseFormula("2d6kh5"), null, "you cannot keep more dice than you rolled");
  assert.equal(formatFormula(parseFormula("4d6kh3")!), "4d6kh3");
});

test("reroll: r goes again while the condition holds, ro exactly once", () => {
  const once = rollWith("2d6ro1", [1, 1, 4]);
  assert.deepEqual([once.total, once.dice.map((die) => die.value)], [5, [1, 4]], "the first die rerolled once (1 → 1), the second rolled 4");
  const until = rollWith("1d6r1", [1, 1, 1, 5]);
  assert.deepEqual([until.total, until.dice[0].rerolledFrom], [5, 1], "it keeps going until the 5");
  const below = rollWith("1d6r<2", [2, 6]);
  assert.equal(below.total, 6, "r<2 rerolls 1s and 2s");
  assert.equal(parseFormula("1d6r6"), null, "a reroll that can never fail is refused");
});

test("exploding: a die at its maximum rolls another, and !>n lowers the bar", () => {
  const boom = rollWith("1d6!", [6, 6, 2]);
  assert.deepEqual([boom.total, boom.dice.length, boom.dice[1].exploded], [14, 3, true]);
  const early = rollWith("1d6!>5", [5, 1]);
  assert.equal(early.total, 6, "a 5 explodes too");
  assert.equal(rollWith("1d6!", [3]).dice.length, 1, "no explosion, no extra die");
});

test("success counting: >n and <n count dice instead of summing, and the card says so", () => {
  const successes = rollWith("5d10>7", [7, 2, 10, 6, 8], 10);
  assert.deepEqual([successes.total, successes.successes], [3, 3]);
  assert.deepEqual(successes.dice.map((die) => die.success), [true, false, true, false, true]);
  const low = rollWith("3d10<3", [1, 5, 3], 10);
  assert.equal(low.successes, 2, "1 and 3 are at or under 3");
  assert.ok(describeRoll(successes).includes("성공 3"), describeRoll(successes));
  assert.ok(describeRoll(rollWith("4d6kh3", [1, 5, 3, 6])).includes("버림 1"), "the card names the dice it dropped");
  void scripted;
});

test("chat: `#이름` runs a macro (nesting and trailing words included); `/roll 2t[표]` asks the host to draw", () => {
  const macros = [{ name: "공격", text: "/roll 1d20+7" }, { name: "연속", text: "#공격" }, { name: "돌아감", text: "#돌아감" }];
  assert.equal(expandMacros("#공격", macros), "/roll 1d20+7");
  assert.equal(expandMacros("#공격 #명중", macros), "/roll 1d20+7 #명중", "what follows the name is kept");
  assert.equal(expandMacros("#연속", macros), "/roll 1d20+7", "one macro may call another");
  assert.ok(expandMacros("#돌아감", macros).startsWith("#돌아감"), "a macro that calls itself stops instead of looping");
  assert.equal(expandMacros("없는 매크로", macros), "없는 매크로");
  assert.deepEqual(parseChatInput("/roll 2t[야생 조우]"), { kind: "table", name: "야생 조우", count: 2, mode: "public" });
  assert.deepEqual(parseChatInput("/gmroll t[함정]"), { kind: "table", name: "함정", count: 1, mode: "gm" });
  const roll = parseChatInput("/roll 4d6kh3 #능력치");
  assert.deepEqual(roll, { kind: "roll", formula: "4d6kh3", label: "능력치", mode: "public" });
});

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R17 시험", { userId: "dm", displayName: "DM" }), joinCode: "R17AAA" };
  const dice = { value: 0.5 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R17AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R17AAA" });
  await tick();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  return { host, dm, alice, dice, refusals };
}

test("host: the GM saves macros and tables; a player sees shared macros and table names but never the rows", async () => {
  const { dm, alice, dice, refusals } = await table();
  dm.send({ type: "table.macros", macros: [{ id: "a", name: "비밀", text: "/gmroll 1d20" }, { id: "b", name: "모두", text: "/roll 1d20", shared: true }] });
  dm.send({ type: "table.tables", tables: [{ id: "t1", name: "조우", shared: true, rows: [{ text: "고블린 셋", weight: 3 }, { text: "아무것도 없음", weight: 1 }] }, { id: "t2", name: "비밀 조우", rows: [{ text: "붉은 용", weight: 1 }] }] });
  await tick();
  assert.deepEqual(dm.snapshot!.macros.map((macro) => macro.name), ["비밀", "모두"]);
  assert.deepEqual(alice.snapshot!.macros.map((macro) => macro.name), ["모두"], "a player only gets the shared ones");
  assert.deepEqual(alice.snapshot!.tables.map((item) => [item.name, item.rows.length]), [["조우", 0]], "the shared table's name, never its rows — and the GM's own table not at all (R25, D134)");
  assert.deepEqual(dm.snapshot!.tables[0].rows.length, 2);
  // A player may still roll on it — the host draws. 3:1 weights: 0.5 lands in the first row.
  dice.value = 0.5;
  alice.send({ type: "chat.table", name: "조우", count: 1, mode: "public" });
  await tick();
  const drawn = [...alice.snapshot!.chat].reverse().find((message) => message.type === "rollresult")!;
  assert.ok(drawn.content.includes("고블린 셋"), drawn.content);
  // The weight is respected: 0.9 of 4 tickets lands in the second row.
  dice.value = 0.9;
  alice.send({ type: "chat.table", name: "조우", count: 1, mode: "public" });
  await tick();
  assert.ok([...alice.snapshot!.chat].reverse().find((message) => message.type === "rollresult")!.content.includes("아무것도 없음"));
  // Players cannot edit either list, and an unknown table is refused.
  alice.send({ type: "table.macros", macros: [] });
  alice.send({ type: "chat.table", name: "없는 표", count: 1, mode: "public" });
  // R25 (D134): a table the GM did not share is not drawable either — drawing from it used to print its rows into
  // public chat, so repeated draws enumerated a secret encounter table.
  alice.send({ type: "chat.table", name: "비밀 조우", count: 20, mode: "public" });
  await tick();
  assert.ok(!alice.snapshot!.chat.some((message) => message.content.includes("붉은 용")), "the GM's own table never leaks a row");
  assert.ok(refusals.some((reason) => reason.includes("GM")), JSON.stringify(refusals));
  assert.ok(refusals.some((reason) => reason.includes("굴림표가 없습니다")), JSON.stringify(refusals));
  assert.deepEqual(dm.snapshot!.macros.length, 2, "the player's attempt changed nothing");
});

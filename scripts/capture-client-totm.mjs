/**
 * Theatre of the Mind on one PC (SESSION_SCENARIOS.md SC-44..49, 53..55): the table is a Theatre-of-the-Mind scene; "+ 장면" makes
 * a scene with no grid; a goblin from the compendium and the player's character appear as icons; the player's ⚔
 * resolves without any distance; the DM's ⚔ opens the pre-roll dialog and "반드시 치명타" forces a crit; on the
 * player's turn the 벗어남 button on the goblin's icon asks the DM for an opportunity attack, which lands as a
 * reaction card; the turn panel (D97) shows the official actions on your turn. Writes 63-70 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-totm.mjs
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import path from "node:path";
const require = createRequire(import.meta.url);
function loadPlaywright() { for (const candidate of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) { try { return require(candidate); } catch { /* next */ } } throw new Error("playwright not found"); }
const { chromium } = loadPlaywright();
const PORT = 1430;
const portOpen = (port) => new Promise((resolve) => { const s = connect(port, "127.0.0.1"); s.once("connect", () => { s.destroy(); resolve(true); }); s.once("error", () => { s.destroy(); resolve(false); }); });
let server = null;
if (!(await portOpen(PORT))) { server = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--config", "vite.client.config.ts", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true }); for (let i = 0; i < 100 && !(await portOpen(PORT)); i++) await new Promise((r) => setTimeout(r, 300)); }
const OUT = path.resolve("docs/evidence/new-client-m1");
const base = `http://127.0.0.1:${PORT}/`;
const failures = [];
const check = (condition, message) => { if (!condition) { failures.push(message); console.error("FAIL:", message); } else console.log("ok:", message); };
const tab = (page, name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
/**
 * R63 (D198): a player's landed swing may wait on the window a hit opens (야만적 공격자 from the 군인 background).
 * Poll for either the card or the window, let the window go, and name what the screen shows if neither comes.
 */
const letHitGo = async (player, cardLocator, onWindow) => {
  for (let at = 0; at < 60; at += 1) {
    if (await cardLocator.count()) return;
    const choices = player.locator(".cl-approval .cl-hit-choices");
    if (await choices.count()) { if (onWindow) await onWindow(); await player.locator(".cl-approval").getByRole("button", { name: "안 함" }).click(); }
    // An older prompt (a check's rescue left unanswered) sits in front of the window; let it go the way Escape would.
    else if (await player.locator(".cl-approval").count()) await player.locator(".cl-approval button").last().click();
    await player.waitForTimeout(250);
  }
  const shown = (await player.locator(".cl-approval, .cl-waiting-note").evaluateAll((nodes) => nodes.map((node) => node.textContent))).map((text) => (text ?? "").slice(0, 300));
  throw new Error(`neither the card nor the hit window appeared: ${shown.join(" | ") || "(nothing)"}`);
};
const iconOf = (page, name) => page.locator(`.cl-scene-card[data-token-name="${name}"]`);
const cardOf = (page, head) => page.locator(".cl-chat-msg.action", { hasText: head });

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 960 }, locale: "ko-KR" });
  const dm = await context.newPage();
  const player = await context.newPage();
  for (const [label, page] of [["dm", dm], ["player", player]]) {
    page.on("pageerror", (e) => { failures.push(`${label} page error: ${e.message}`); console.error(`${label} page error:`, e.message); });
    page.on("console", (m) => { if (m.type() === "error") console.error(`${label} console:`, m.text().slice(0, 200)); });
    page.on("dialog", (dialog) => void dialog.accept());
  }
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("여관 난투");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "여관 난투" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });

  // SC-44: "+ 장면" → a scene without a grid on both screens; the goblin and the fighter are icons.
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await player.locator(".cl-scene").waitFor({ timeout: 10000 });
  check((await player.locator(".cl-scene-title").innerText()).includes("장면"), "the player sees the scene's name on the stage and no page chrome");
  check(await player.locator(".cl-page-bar").count() === 0 && await player.locator(".cl-toolbar").count() === 0, "no page bar or tool column for a player on a scene");
  check(await player.locator(".cl-canvas-page").count() === 0, "no grid canvas on a scene");
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("goblin warrior");
  await dm.getByLabel("고블린 전사 캔버스에 놓기", { exact: true }).click();
  await iconOf(dm, "고블린 전사").waitFor({ timeout: 10000 });
  await iconOf(player, "고블린 전사").waitFor({ timeout: 10000 });
  check((await iconOf(player, "고블린 전사").innerText()).includes("10/10"), "the goblin's icon carries its own HP bar");
  await tab(dm, "채팅").click();
  await tab(player, "저널").click();
  await player.getByRole("button", { name: "+ 캐릭터" }).click();
  const wizard = player.locator(".cl-window").last();
  await wizard.getByLabel("이름").fill("앨리스의 파이터");
  await wizard.getByRole("button", { name: /^2 종족/ }).click();
  await wizard.getByRole("button", { name: /^드워프/ }).click();
  await wizard.getByRole("button", { name: /^3 배경/ }).click();
  await wizard.getByRole("button", { name: /^군인/ }).click();
  await wizard.getByRole("option", { name: /한 능력치 \+2/ }).click();
  await wizard.getByRole("option", { name: /^근력/ }).first().click();
  await wizard.getByRole("button", { name: /^4 능력치/ }).click();
  await wizard.getByRole("button", { name: "표준 배열" }).click();
  await wizard.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await wizard.getByLabel("추가할 직업").selectOption("dnd.srd521.class.fighter");
  for (let level = 0; level < 3; level += 1) await wizard.getByRole("button", { name: "레벨 추가" }).click();
  await wizard.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await wizard.getByRole("button", { name: /^7 검토·저장/ }).click();
  await wizard.getByRole("button", { name: "저장", exact: true }).first().click();
  await player.locator(".cl-window", { hasText: "앨리스의 파이터" }).locator(".cl-hp-big").waitFor({ timeout: 10000 });
  await player.locator(".cl-window").last().getByLabel("창 닫기").click();
  await player.getByLabel("앨리스의 파이터 토큰 놓기").click();
  await iconOf(dm, "앨리스의 파이터").waitFor({ timeout: 10000 });
  // The DM's screen seeing the token says nothing about the player's: wait for the player's own row before counting.
  await player.locator(".cl-scene-row[aria-label='플레이어'] .cl-scene-card[data-token-name='앨리스의 파이터']").waitFor({ timeout: 10000 }).catch(() => {});
  check(await player.locator(".cl-scene-row[aria-label='플레이어'] .cl-scene-card[data-token-name='앨리스의 파이터']").count() === 1, "the fighter is in the 플레이어 row");
  await tab(player, "채팅").click();

  // SC-45: the player's ⚔ on the goblin icon: no range, no distance on the card.
  await iconOf(player, "앨리스의 파이터").click();
  const playerBar = player.getByRole("toolbar", { name: "앨리스의 파이터 액션" });
  await playerBar.waitFor();
  await playerBar.getByRole("button", { name: /^⚔ 대검/ }).click();
  await player.locator(".cl-targeting-banner").waitFor();
  await iconOf(player, "고블린 전사").click();
  await player.locator(".cl-targeting-banner[data-picked='1']").waitFor({ timeout: 10000 });
  await player.screenshot({ path: path.join(OUT, "63-totm-scene-targeting.png") });
  await player.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  // R63 (D198): a player's swing no longer opens a dialog before the dice. If it lands, 야만적 공격자 (from the 군인
  // background) is offered in the window the hit opens — the player lets it go and the card is posted.
  const head = "앨리스의 파이터 → 고블린 전사: 대검";
  await letHitGo(player, cardOf(player, head));
  await cardOf(dm, head).waitFor({ timeout: 15000 });
  await cardOf(player, head).waitFor({ timeout: 15000 });
  check(!/\d+ ft/.test(await cardOf(player, head).innerText()), "the card carries no distance");

  // SC-46: the DM's ⚔ opens the pre-roll dialog; 반드시 치명타 forces a crit.
  await iconOf(dm, "고블린 전사").click();
  const goblinBar = dm.getByRole("toolbar", { name: "고블린 전사 액션" });
  await goblinBar.waitFor();
  await goblinBar.getByRole("button", { name: /^⚔ 시미터/ }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  await iconOf(dm, "앨리스의 파이터").click();
  await dm.locator(".cl-targeting-banner[data-picked='1']").waitFor({ timeout: 10000 });
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  await dm.getByLabel("반드시").waitFor({ timeout: 10000 });
  await dm.getByLabel("반드시").selectOption("crit");
  await dm.getByLabel("엄폐").selectOption("2");
  await dm.screenshot({ path: path.join(OUT, "64-totm-dm-preroll-dialog.png") });
  await dm.getByRole("button", { name: "공격", exact: true }).click();
  const head2 = "고블린 전사 → 앨리스의 파이터: 시미터";
  await cardOf(player, head2).waitFor({ timeout: 15000 });
  const critCard = await cardOf(player, head2).innerText();
  check(critCard.includes("치명타") && critCard.includes("엄폐 +2"), "the forced crit and the cover show on the player's card");

  // SC-47: on the player's turn, 벗어남 on the goblin's icon asks the DM; the DM's opportunity attack lands as a reaction.
  await dm.getByRole("button", { name: /^턴 트래커/ }).click();
  const tracker = dm.locator(".cl-window", { hasText: "턴 트래커" });
  await tracker.waitFor();
  await tracker.getByRole("button", { name: "전투 시작" }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  await iconOf(dm, "고블린 전사").click();
  await iconOf(dm, "앨리스의 파이터").click();
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  await tracker.locator(".cl-tracker-row[data-turn-name='앨리스의 파이터']").waitFor({ timeout: 10000 });
  for (let n = 0; n < 3 && (await player.locator(".cl-scene-card.turn[data-token-name='앨리스의 파이터']").count()) === 0; n += 1) { await dm.locator(".cl-turn-ribbon").getByRole("button", { name: "▶ 다음 턴" }).click(); await player.waitForTimeout(400); }
  await player.locator(".cl-turn-ribbon .cl-turn-ribbon-item.now[data-turn-name='앨리스의 파이터']").waitFor({ timeout: 10000 });
  // R27 (D143): the DM opening the tracker opens it for everyone now; the ribbon is still the at-a-glance order.
  check(await player.locator(".cl-window", { hasText: "턴 트래커" }).count() === 1, "the player gets the tracker window too");
  await player.locator(".cl-scene-card.turn[data-token-name='앨리스의 파이터']").waitFor({ timeout: 10000 });
  const leave = player.getByRole("button", { name: "고블린 전사에게서 벗어남" });
  await leave.waitFor({ timeout: 10000 });
  check(await player.getByRole("button", { name: "앨리스의 파이터에게서 벗어남" }).count() === 0, "no 벗어남 on one's own icon");
  await leave.click();
  const approval = dm.locator(".cl-approval-overlay .cl-approval", { hasText: "벗어납니다" });
  await approval.getByRole("button", { name: /⚔ 시미터/ }).waitFor({ timeout: 15000 });
  check(await dm.locator(".cl-chat-msg.prompt", { hasText: "벗어납니다" }).getByRole("button", { name: /⚔ 시미터/ }).count() === 1, "the chat record carries the same choices");
  check(await player.locator(".cl-approval-overlay").count() === 0 && (await player.locator(".cl-waiting-note").innerText()).includes("기다리는 중"), "the player sees a waiting note, not an approval");
  await dm.screenshot({ path: path.join(OUT, "65-totm-opportunity-prompt-dm.png") });
  await approval.getByRole("button", { name: /⚔ 시미터/ }).click();
  const head3 = "시미터 · 기회 공격";
  await cardOf(player, head3).waitFor({ timeout: 15000 });
  await player.locator(".cl-chat-msg.prompt .cl-pill", { hasText: "기회 공격" }).waitFor({ timeout: 15000 });
  check(true, "the opportunity attack is a card on both screens and the prompt shows 기회 공격");
  await player.screenshot({ path: path.join(OUT, "66-totm-opportunity-attack-player.png") });

  // SC-48: it is the fighter's turn, so the player has the turn panel; 회피 leaves a card and a 🛡 mark; 턴 마침 passes the turn.
  const panel = player.getByRole("region", { name: "앨리스의 파이터의 턴" });
  await panel.waitFor({ timeout: 10000 });
  check(await dm.getByRole("region", { name: "앨리스의 파이터의 턴" }).count() === 0, "the DM has no panel for a player's character");
  check((await panel.innerText()).includes("붙잡기") && (await panel.innerText()).includes("행동"), "the panel shows attacks, unarmed options and the menus");
  check(await panel.getByRole("button", { name: /^✨ 마법/ }).isDisabled(), "a fighter has no spells: ✨ 마법 stays off (D102)");
  await panel.getByRole("button", { name: /^공식 행동/ }).click();
  check(await player.getByRole("menuitem", { name: /^질주/ }).count() === 1, "the 행동 menu lists the official actions");
  await player.getByRole("menuitem", { name: /^회피/ }).click();
  await player.locator(".cl-chat-msg.act", { hasText: "회피" }).waitFor({ timeout: 15000 });
  check(await dm.locator(".cl-toast", { hasText: "회피" }).count() === 0, "no toast for what the board shows (the act floats over the card)");
  await iconOf(dm, "앨리스의 파이터").locator(".cl-marker[title='회피']").waitFor({ timeout: 15000 });
  check(true, "회피 lands as a card and a mark on the DM's screen");
  // R9: 준비 — the readied action waits as a ⏳ mark and goes off on someone else's turn (SC-55).
  await panel.getByRole("button", { name: /^공식 행동/ }).click();
  await player.getByRole("menuitem", { name: /^준비/ }).click();
  await player.getByLabel("조건 → 행동").fill("고블린이 다가오면 → 대검");
  await player.getByRole("button", { name: "준비", exact: true }).click();
  await iconOf(dm, "앨리스의 파이터").locator(".cl-marker[title='준비']").waitFor({ timeout: 15000 });
  check(true, "준비 leaves a ⏳ mark on the fighter");
  await panel.getByRole("button", { name: /^공식 행동/ }).click();
  await player.getByRole("menuitem", { name: /^영향/ }).click();
  await player.getByLabel("기술").selectOption("intimidation");
  await player.getByRole("button", { name: "영향", exact: true }).last().click();
  await player.locator(".cl-chat-msg.act", { hasText: "위협" }).waitFor({ timeout: 15000 });
  check(true, "영향 asks for the skill and rolls it");
  await panel.getByRole("button", { name: /^판정/ }).click();
  await player.getByRole("menuitem", { name: /근력\(운동\)/ }).click();
  await player.locator(".cl-roll-card", { hasText: "근력(운동)" }).waitFor({ timeout: 15000 });
  await dm.locator(".cl-toast", { hasText: "근력(운동)" }).waitFor({ timeout: 15000 });
  check(true, "판정 rolls a skill check into chat and a toast tells the DM");
  // R65 (D200): features are buttons on their row — 행동 폭증 costs nothing of the turn, so it sits with the actions.
  await panel.getByRole("button", { name: /^행동 폭증/ }).click();
  await player.locator(".cl-chat-msg.emote", { hasText: "행동 폭증" }).waitFor({ timeout: 20000 });
  check(true, "특성 uses the fighter's Action Surge and tells the table");
  await panel.getByRole("button", { name: /^재기의 바람/ }).click();
  await player.locator(".cl-chat-msg.emote", { hasText: "재기의 바람" }).waitFor({ timeout: 20000 });
  check(await player.locator(".cl-roll-card", { hasText: "재기의 바람" }).count() >= 1, "추가 행동 uses Second Wind: the heal roll lands in chat");
  await player.screenshot({ path: path.join(OUT, "67-turn-panel-player.png") });
  check((await panel.innerText()).includes("당신의 턴"), "the command bar shouts 당신의 턴");
  await panel.getByRole("button", { name: /턴 마침/ }).click();
  // SC-49: the goblin's turn belongs to no player, so the DM gets its panel; 붙잡기 targets the fighter and rolls its save.
  const dmPanel = dm.getByRole("region", { name: "고블린 전사의 턴" });
  // The round-counter row may sit between the two turns: the DM advances until the goblin's turn.
  for (let n = 0; n < 3 && (await dmPanel.count()) === 0; n += 1) { await dm.waitForTimeout(1200); if ((await dmPanel.count()) === 0) await dm.locator(".cl-turn-ribbon").getByRole("button", { name: "▶ 다음 턴" }).click(); }
  await dmPanel.waitFor({ timeout: 10000 });
  check(await player.getByRole("region", { name: "고블린 전사의 턴" }).count() === 0, "the player has no panel on the goblin's turn");
  await dm.screenshot({ path: path.join(OUT, "68-turn-panel-dm-goblin.png") });
  // SC-55 (R9): on the goblin's turn the fighter's quiet bar says the readied action can go off; ⚔ is back on for it.
  const waitingBar = player.getByRole("region", { name: "앨리스의 파이터 대기" });
  await waitingBar.waitFor({ timeout: 10000 });
  check((await waitingBar.innerText()).includes("준비한 행동"), "the free-mode bar announces the readied action");
  await waitingBar.getByRole("button", { name: /^⚔ 대검/ }).click();
  await player.locator(".cl-targeting-banner").waitFor();
  await iconOf(player, "고블린 전사").click();
  await player.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  // R63 (D198): no dialog before the dice; a hit asks about 야만적 공격자 afterwards, and the player lets it go.
  const readiedHead = "앨리스의 파이터 → 고블린 전사: 대검 · 준비한 행동";
  await letHitGo(player, cardOf(dm, readiedHead));
  await cardOf(dm, readiedHead).waitFor({ timeout: 15000 });
  await dm.waitForTimeout(600);
  check(await iconOf(dm, "앨리스의 파이터").locator(".cl-marker[title='준비']").count() === 0, "the readied action is spent with the mark");
  check(await waitingBar.getByRole("button", { name: /^⚔ 대검/ }).isDisabled(), "and the attack buttons go quiet again (the reaction is used)");
  await dmPanel.getByRole("button", { name: "붙잡기" }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  await iconOf(dm, "앨리스의 파이터").click();
  await dm.locator(".cl-chat-msg.act", { hasText: "붙잡기" }).waitFor({ timeout: 15000 });
  check(await dm.locator(".cl-canvas-viewport.scene").evaluate((el) => el.scrollHeight <= el.clientHeight + 1), "the scene never scrolls: it fits the frame");
  check((await dm.locator(".cl-chat-msg.act", { hasText: "붙잡기" }).last().innerText()).includes("내성"), "붙잡기 rolls the target's save against the DC");

  // SC-53 (D102): the DM places a mage; ✨ 마법 lists its stat-block spells; 파이어볼 at the goblin and the fighter rolls one damage die
  // for both, each saves against the mage's DC, and the HP bars fall on both screens.
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("mage");
  await dm.getByLabel("마법사 캔버스에 놓기", { exact: true }).click();
  await iconOf(player, "마법사").waitFor({ timeout: 10000 });
  await tab(dm, "채팅").click();
  await iconOf(dm, "마법사").click();
  const mageBar = dm.getByRole("toolbar", { name: "마법사 액션" });
  await mageBar.waitFor();
  await mageBar.getByRole("button", { name: /^✨ 마법/ }).click();
  const fireball = dm.getByRole("menuitem", { name: /파이어볼/ });
  await fireball.waitFor({ timeout: 5000 });
  check((await fireball.getAttribute("title") ?? "").includes("2/2 남음") && (await fireball.getAttribute("title") ?? "").includes("민첩 내성"), "the menu says how often and what the spell asks for");
  await fireball.click();
  await dm.locator(".cl-targeting-banner[data-multi='1']").waitFor();
  await iconOf(dm, "고블린 전사").click();
  await iconOf(dm, "앨리스의 파이터").click();
  await dm.locator(".cl-targeting-banner[data-picked='2']").waitFor({ timeout: 10000 });
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  const spellCard = player.locator(".cl-chat-msg.spell", { hasText: "파이어볼" });
  await spellCard.waitFor({ timeout: 15000 });
  await dm.locator(".cl-chat-msg.spell", { hasText: "파이어볼" }).waitFor({ timeout: 15000 });
  const spellText = await spellCard.innerText();
  check(spellCard && spellText.includes("고블린 전사") && spellText.includes("앨리스의 파이터") && /DC \d+/.test(spellText), "the spell card shows both targets' saves against the mage's DC");
  await dm.waitForTimeout(800);
  check(!(await iconOf(dm, "고블린 전사").innerText()).includes("10/10"), "the goblin's HP fell from the fireball on the DM's screen");
  check((await iconOf(player, "고블린 전사").locator(".cl-scene-gauge").innerText()) === (await iconOf(dm, "고블린 전사").locator(".cl-scene-gauge").innerText()), "the player's HP bar agrees with the DM's");
  await dm.screenshot({ path: path.join(OUT, "69-totm-spell-fireball.png") });
  // R10: the mage's per-day list counts the cast — the menu now says 1/2 left.
  await iconOf(dm, "마법사").click();
  await mageBar.waitFor();
  await mageBar.getByRole("button", { name: /^✨ 마법/ }).click();
  await dm.getByRole("menuitem", { name: /파이어볼/ }).waitFor({ timeout: 5000 });
  check((await dm.getByRole("menuitem", { name: /파이어볼/ }).getAttribute("title") ?? "").includes("1/2 남음"), "the per-day spell shows its remaining uses after the cast");
  await dm.keyboard.press("Escape");

  // SC-54 (R9, D103/D104): the DM's dragon — 다중공격 runs the routine (three 찢기 cards, one pre-roll dialog), ☄ 화염 브레스
  // rolls every target's save like a spell and waits for its recharge, 👑 전설 spends the per-round pool.
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("brass");
  await dm.getByLabel("성인 황동 드래곤 캔버스에 놓기", { exact: true }).click();
  await iconOf(player, "성인 황동 드래곤").waitFor({ timeout: 10000 });
  await tab(dm, "채팅").click();
  await iconOf(dm, "성인 황동 드래곤").click();
  const dragonBar = dm.getByRole("toolbar", { name: "성인 황동 드래곤 액션" });
  await dragonBar.waitFor();
  await dragonBar.getByRole("button", { name: /다중공격/ }).click();
  await dm.locator(".cl-targeting-banner[data-multi='1']").waitFor();
  await iconOf(dm, "마법사").click();
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  await dm.getByLabel("반드시").waitFor({ timeout: 10000 });
  await dm.getByRole("button", { name: "공격", exact: true }).click();
  const rendHead = "성인 황동 드래곤 → 마법사: 찢기";
  await cardOf(player, rendHead).nth(2).waitFor({ timeout: 20000 });
  check(await cardOf(player, rendHead).count() === 3, "다중공격 makes three 찢기 cards from one click and one dialog");
  // Targeting clears the selection, so the bar went back to the goblin's turn: pick the dragon again.
  await iconOf(dm, "성인 황동 드래곤").click();
  await dragonBar.waitFor();
  await dragonBar.getByRole("button", { name: /화염 브레스/ }).click();
  await dm.locator(".cl-targeting-banner[data-multi='1']").waitFor();
  await iconOf(dm, "마법사").click();
  await iconOf(dm, "고블린 전사").click();
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  const breath = player.locator(".cl-chat-msg.spell", { hasText: "화염 브레스" });
  await breath.waitFor({ timeout: 15000 });
  const breathText = await breath.innerText();
  check(breathText.includes("NPC 행동") && breathText.includes("vs DC 18") && breathText.includes("마법사") && breathText.includes("고블린 전사"), "the breath is a save card for both targets against DC 18");
  await iconOf(dm, "성인 황동 드래곤").click();
  await dragonBar.waitFor();
  check((await dragonBar.getByRole("button", { name: /화염 브레스/ }).innerText()).includes("재충전 대기"), "the breath waits for its recharge");
  await dragonBar.getByRole("button", { name: /전설 3\/3/ }).click();
  await dm.getByRole("menuitem", { name: /^급습/ }).click();
  await dm.locator(".cl-chat-msg.act", { hasText: "전설 행동 · 급습" }).waitFor({ timeout: 15000 });
  await dragonBar.getByRole("button", { name: /전설 2\/3/ }).waitFor({ timeout: 10000 });
  check(true, "a legendary action is a card and the pool shows 2/3");
  await dm.screenshot({ path: path.join(OUT, "70-totm-dragon-multiattack-breath-legendary.png") });

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }

/**
 * Attack and damage resolution on one PC (SESSION_SCENARIOS.md SC-40..43): the player's ⚔ on the command bar picks
 * the goblin in targeting mode (range dimming) and the host resolves the attack into a 판정 card on both screens;
 * the DM palette forces a hit, adds damage until the goblin dies (bar 0, 사망 marker) and undoes it (bar back,
 * 되돌림 card); the goblin's scimitar hits the fighter and the linked token bar and sheet HP drop.
 * Writes 59-62 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-attack.mjs
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
const tokenOf = (page, name) => page.locator(`.cl-scene-card[data-token-name="${name}"]`);
const reveal = async (locator) => { await locator.scrollIntoViewIfNeeded(); return locator.boundingBox(); };
const barOf = (page, name) => tokenOf(page, name).locator(".cl-scene-name small").first();
/** The live (not superseded) 판정 card whose head matches. */
const cardOf = (page, head) => page.locator(".cl-chat-msg.action", { hasText: head });
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
  const shown = await player.locator(".cl-approval, .cl-waiting-note").allInnerTexts();
  throw new Error(`neither the card nor the hit window appeared: ${shown.join(" | ") || "(nothing)"}`);
};
const pickTarget = async (page, name) => { const box = await reveal(tokenOf(page, name)); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); };

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
  await dm.getByLabel("새 캠페인 이름").fill("판정 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "판정 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await player.locator(".cl-scene").waitFor({ timeout: 10000 });

  // Setup: a goblin from the compendium one cell to the right of the page centre; the player's fighter at the centre.
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("goblin warrior");
  await dm.getByLabel("고블린 전사 캔버스에 놓기", { exact: true }).click();
  await tokenOf(dm, "고블린 전사").waitFor({ timeout: 10000 });
  await tokenOf(player, "고블린 전사").waitFor({ timeout: 10000 });
  await tokenOf(player, "고블린 전사").waitFor({ timeout: 10000 });
  await dm.keyboard.press("ArrowRight");
  await tokenOf(player, "고블린 전사").waitFor({ timeout: 10000 });
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
  await tokenOf(dm, "앨리스의 파이터").waitFor({ timeout: 10000 });
  await tab(player, "채팅").click();
  const pcHp = await barOf(player, "앨리스의 파이터").innerText();
  check(/^\d+\/\d+$/.test(pcHp), `the fighter's linked bar reads ${pcHp}`);

  // SC-40: the player's ⚔ 대검 → targeting mode → the goblin → the host resolves a 판정 card.
  await reveal(tokenOf(player, "앨리스의 파이터"));
  await tokenOf(player, "앨리스의 파이터").click();
  const playerBar = player.getByRole("toolbar", { name: "앨리스의 파이터 액션" });
  await playerBar.waitFor();
  await playerBar.getByRole("button", { name: /^⚔ 대검/ }).click();
  await player.locator(".cl-targeting-banner").waitFor();
  await pickTarget(player, "고블린 전사");
  await player.locator(".cl-targeting-banner[data-picked='1']").waitFor({ timeout: 10000 });
  await player.screenshot({ path: path.join(OUT, "59-attack-targeting-range.png") });
  await player.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  // R63 (D198): a player's swing no longer opens a dialog before the dice. If it lands, 야만적 공격자 (from the 군인
  // background) is offered in the window the hit opens — the player lets it go and the card is posted.
  const head = "앨리스의 파이터 → 고블린 전사: 대검";
  await letHitGo(player, cardOf(player, head), async () => {
    await player.screenshot({ path: path.join(OUT, "79-on-hit-window-player.png") });
    check((await player.locator(".cl-approval").innerText()).includes("야만적 공격자"), "the hit window offers 야만적 공격자");
    // R64 (D199): each offer carries its standing answer, so the question can stop being asked.
    check(await player.locator(".cl-approval select[aria-label='야만적 공격자 설정']").count() === 1, "the offer has a 매번 묻기/항상 사용/쓰지 않음 setting");
  });
  await cardOf(dm, head).waitFor({ timeout: 15000 });
  await cardOf(player, head).waitFor({ timeout: 15000 });
  const playerCard = await cardOf(player, head).innerText();
  check(/vs AC 15/.test(playerCard) && !/ ft/.test(playerCard), "the player's card shows the d20 and the AC, and no distance (D109)");
  check(/치명타|적중|빗나감|자동 실패/.test(playerCard), "the card carries an outcome");
  check(await cardOf(player, head).locator(".cl-palette").count() === 0, "the player has no DM palette");
  await dm.screenshot({ path: path.join(OUT, "60-attack-card-dm-palette.png") });

  // SC-41: the DM palette: 강제 적중 applies damage to the unlinked bar; +20 kills (bar 0, 사망 marker); 되돌리기 restores.
  await cardOf(dm, head).getByRole("button", { name: /^조정/ }).click();
  await cardOf(dm, head).getByRole("button", { name: "강제 적중" }).click();
  await dm.waitForFunction((name) => { const text = document.querySelector(`.cl-scene-card[data-token-name="${name}"] .cl-scene-name small`)?.textContent ?? ""; return /^\d+\/10$/.test(text) && text !== "10/10"; }, "고블린 전사", { timeout: 15000 });
  const afterHit = await barOf(dm, "고블린 전사").innerText();
  check(afterHit !== "10/10", `a forced hit took the goblin's own HP (${afterHit})`);
  check((await cardOf(dm, head).innerText()).includes("적중"), "the replaced card reads 적중");
  await cardOf(dm, head).getByRole("button", { name: /^조정/ }).click();
  await cardOf(dm, head).getByLabel("피해 수정").fill("+20");
  await cardOf(dm, head).getByLabel("피해 수정").press("Enter");
  await tokenOf(dm, "고블린 전사").locator(".cl-marker[title='사망']").waitFor({ timeout: 15000 });
  check((await barOf(dm, "고블린 전사").innerText()) === "0/10", "+20 damage drops the goblin to 0 and marks it 사망");
  await tokenOf(player, "고블린 전사").locator(".cl-marker[title='사망']").waitFor({ timeout: 15000 });
  check((await cardOf(player, head).innerText()).includes("사망"), "the player's card says the goblin died");
  await cardOf(dm, head).getByRole("button", { name: /^조정/ }).click();
  await cardOf(dm, head).getByRole("button", { name: "되돌리기" }).click();
  await dm.waitForFunction((name) => document.querySelector(`.cl-scene-card[data-token-name="${name}"] .cl-scene-name small`)?.textContent === "10/10", "고블린 전사", { timeout: 15000 });
  check(await tokenOf(dm, "고블린 전사").locator(".cl-marker[title='사망']").count() === 0, "undo restores the bar and removes 사망");
  await cardOf(player, head).locator(".cl-pill", { hasText: "되돌림" }).first().waitFor({ timeout: 15000 });
  check(true, "the player's card is replaced by a 되돌림 card");
  await player.screenshot({ path: path.join(OUT, "61-attack-undone-player.png") });

  // SC-42: the goblin's scimitar against the fighter: the linked bar and the sheet take the damage.
  await reveal(tokenOf(dm, "고블린 전사"));
  await tokenOf(dm, "고블린 전사").click();
  const goblinBar = dm.getByRole("toolbar", { name: "고블린 전사 액션" });
  await goblinBar.waitFor();
  await goblinBar.getByRole("button", { name: /^⚔ 시미터/ }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  await pickTarget(dm, "앨리스의 파이터");
  await dm.locator(".cl-targeting-banner[data-picked='1']").waitFor({ timeout: 10000 });
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  // The DM gets the pre-roll dialog (D95): roll as the dice fall.
  await dm.getByRole("button", { name: "공격", exact: true }).click();
  const head2 = "고블린 전사 → 앨리스의 파이터: 시미터";
  await cardOf(dm, head2).waitFor({ timeout: 15000 });
  await cardOf(dm, head2).getByRole("button", { name: /^조정/ }).click();
  await cardOf(dm, head2).getByRole("button", { name: "강제 적중" }).click();
  await player.waitForFunction(([name, before]) => { const text = document.querySelector(`.cl-scene-card[data-token-name="${name}"] .cl-scene-name small`)?.textContent ?? ""; return text !== before && /^\d+\/\d+$/.test(text); }, ["앨리스의 파이터", pcHp], { timeout: 15000 });
  const pcAfter = await barOf(player, "앨리스의 파이터").innerText();
  check(pcAfter !== pcHp, `the fighter's linked bar dropped (${pcHp} → ${pcAfter})`);
  await tab(player, "저널").click();
  await player.locator(".cl-journal-row", { hasText: "앨리스의 파이터" }).click();
  const sheet = player.locator(".cl-window", { hasText: "앨리스의 파이터" });
  await sheet.locator(".cl-hp-big").waitFor();
  const sheetHp = (await sheet.locator(".cl-hp-big").innerText()).replace(/\s/g, "");
  check(sheetHp.startsWith(pcAfter.split("/")[0]), `the sheet HP matches the bar (${sheetHp})`);
  await tab(player, "채팅").click();
  check((await cardOf(player, head2).innerText()).includes("HP"), "the player's card shows HP before → after");
  await player.screenshot({ path: path.join(OUT, "62-goblin-hits-fighter-player.png") });

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }

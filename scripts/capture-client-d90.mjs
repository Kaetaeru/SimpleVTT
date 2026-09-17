/**
 * D90 "DM 확인 후 적용" on one PC (SESSION_SCENARIOS.md SC-43): the campaign setting is on; the player's ⚔ on the
 * goblin makes a card that waits ("DM 확인 대기", HP untouched); the DM's approval overlay applies it. Writes 71 to
 * docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-d90.mjs
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import path from "node:path";
const require = createRequire(import.meta.url);
function loadPlaywright() { for (const candidate of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) { try { return require(candidate); } catch { /* next */ } } throw new Error("playwright not found"); }
const { chromium } = loadPlaywright();

const PORT = 1430;
const portOpen = (port) => new Promise((resolve) => { const socket = connect(port, "127.0.0.1"); socket.once("connect", () => { socket.end(); resolve(true); }); socket.once("error", () => resolve(false)); });
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
    // R66 (D201): every prompt addressed to the player is shown, so the window is one card among possibly several.
    const windowCard = player.locator(".cl-approval", { has: player.locator(".cl-hit-choices") });
    if (await windowCard.count()) { if (onWindow) await onWindow(); await windowCard.first().getByRole("button", { name: "안 함" }).click(); }
    // An older prompt (a check's rescue left unanswered) may still be open; let it go the way Escape would.
    else if (await player.locator(".cl-approval").count()) await player.locator(".cl-approval").first().locator("button").last().click();
    await player.waitForTimeout(250);
  }
  const shown = await player.locator(".cl-approval, .cl-waiting-note").allInnerTexts();
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
    page.on("dialog", (dialog) => void dialog.accept());
  }
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("확인 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "확인 시험" }).waitFor();
  // SC-43: the setting is on before the table opens.
  await dm.getByLabel(/플레이어의 판정 결과를 DM이 확인/).check();
  check(await dm.getByLabel(/플레이어의 판정 결과를 DM이 확인/).isChecked(), "the campaign asks the DM to confirm players' results (D90)");
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "코드로 입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await player.locator(".cl-scene").waitFor({ timeout: 10000 });
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("goblin warrior");
  await dm.getByLabel("고블린 전사 캔버스에 놓기", { exact: true }).click();
  await iconOf(player, "고블린 전사").waitFor({ timeout: 10000 });
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
  await tab(player, "채팅").click();

  // The player's attack waits for the DM.
  await iconOf(player, "앨리스의 파이터").click();
  const playerBar = player.getByRole("toolbar", { name: "앨리스의 파이터 액션" });
  await playerBar.waitFor();
  await playerBar.getByRole("button", { name: /^⚔ 대검/ }).click();
  await player.locator(".cl-targeting-banner").waitFor();
  await iconOf(player, "고블린 전사").click();
  await player.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  // R63 (D198): a player's swing no longer opens a dialog before the dice. If it lands, 야만적 공격자 (from the 군인
  // background) is offered in the window the hit opens — the player lets it go and the card is posted.
  const head = "앨리스의 파이터 → 고블린 전사: 대검";
  await letHitGo(player, cardOf(player, head));
  await cardOf(player, head).waitFor({ timeout: 15000 });
  check((await cardOf(player, head).innerText()).includes("DM 확인 대기"), "the player's card waits for the DM");
  check((await iconOf(player, "고블린 전사").innerText()).includes("10/10"), "the goblin's HP is untouched while the card waits");
  const overlay = dm.locator(".cl-approval-overlay");
  await overlay.waitFor({ timeout: 15000 });
  check((await overlay.innerText()).includes("DM 확인"), "the DM's approval overlay asks for the result");
  await dm.screenshot({ path: path.join(OUT, "71-d90-dm-approval.png") });
  await overlay.getByRole("button", { name: "적용", exact: true }).click();
  await player.waitForFunction((head) => { const cards = [...document.querySelectorAll(".cl-chat-msg.action")].filter((el) => (el.textContent ?? "").includes(head)); return cards.length === 1 && !(cards[0].textContent ?? "").includes("DM 확인 대기"); }, head, { timeout: 15000 });
  check(true, "적용 replaces the waiting card with the applied one (same card, no duplicate)");
  await dm.locator(".cl-approval-overlay").waitFor({ state: "detached", timeout: 10000 });
  check(true, "the overlay is gone once applied");
  const outcome = await cardOf(player, head).last().innerText();
  check(/치명타|적중|빗나감|자동 실패/.test(outcome), "the applied card carries the outcome");

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }

/**
 * Journal verification on one PC (SESSION_SCENARIOS.md SC-13..19): a DM tab and a player tab in one browser
 * profile. Handout hidden → shown to all → "플레이어에게 보여주기" pops it on the player; the player makes a character
 * in a journal window, plays it (HP, a roll that lands in chat), exports it to their library; the journal survives
 * a reconnect and a relaunch. Writes 36-42 to docs/evidence/new-client-m1 and fails loudly on any mismatch.
 *
 *   node scripts/capture-client-journal.mjs
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
const journalTab = (page) => page.getByRole("tab", { name: /^저널/ });
const chatTab = (page) => page.getByRole("tab", { name: "채팅" });
const topWindow = (page) => page.locator(".cl-window").last();

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 }, locale: "ko-KR" });
  const dm = await context.newPage();
  const player = await context.newPage();
  for (const [label, page] of [["dm", dm], ["player", player]]) {
    page.on("pageerror", (e) => { failures.push(`${label} page error: ${e.message}`); console.error(`${label} page error:`, e.message); });
    page.on("console", (m) => { if (m.type() === "error") console.error(`${label} console:`, m.text().slice(0, 200)); });
    page.on("dialog", (dialog) => void dialog.accept());
  }

  // Campaign, launch, join (SC-1..3 in short).
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("저널 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "저널 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "코드로 입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });

  // SC-13: the DM makes a handout with GM notes; the player's journal stays empty.
  await journalTab(dm).click();
  await dm.getByRole("button", { name: "+ 핸드아웃" }).click();
  const handout = topWindow(dm);
  await handout.getByLabel("이름").fill("동굴 지도");
  await handout.getByRole("button", { name: "본문 편집" }).click();
  await handout.getByLabel(/^본문/).fill("# 동쪽 입구\n횃불이 **두 개** 꽂혀 있다.\n- 왼쪽 통로는 물이 찼다\n- 오른쪽은 @[늑대 소굴]로 이어진다");
  await handout.getByLabel("GM 노트 (플레이어에게 안 보임)").fill("오른쪽 통로에 함정 (DC 13)");
  await dm.waitForTimeout(700);
  await journalTab(player).click();
  await player.getByText(/아직 볼 수 있는 항목이 없습니다/).waitFor();
  check(true, "a new handout is GM-only; the player's journal is empty");
  await dm.screenshot({ path: path.join(OUT, "36-journal-handout-gm.png") });

  // SC-14: 볼 수 있는 사람 = 모든 플레이어 → the player sees it, rendered, without GM notes.
  await handout.getByLabel("볼 수 있는 사람").selectOption("all");
  await player.locator(".cl-journal-row", { hasText: "동굴 지도" }).waitFor({ timeout: 10000 });
  await player.locator(".cl-journal-row", { hasText: "동굴 지도" }).click();
  const playerHandout = topWindow(player);
  await playerHandout.getByRole("heading", { name: "동쪽 입구" }).waitFor();
  check((await playerHandout.innerText()).includes("두 개") && !(await playerHandout.innerText()).includes("함정"), "the player sees the body but not the GM notes");
  check(await playerHandout.getByRole("button", { name: "본문 편집" }).count() === 0, "a viewer without edit rights has no edit button");
  await player.screenshot({ path: path.join(OUT, "37-journal-handout-player.png") });
  await playerHandout.getByLabel("창 닫기").click();

  // SC-15: "플레이어에게 보여주기" opens the window on the player.
  await handout.getByRole("button", { name: "플레이어에게 보여주기" }).click();
  await player.locator(".cl-window", { hasText: "동쪽 입구" }).waitFor({ timeout: 10000 });
  check(true, "show-to-players pops the handout on the player");
  await player.locator(".cl-window").last().getByLabel("창 닫기").click();
  await handout.getByLabel("창 닫기").click();

  // SC-16: the player makes a character in a journal window; the DM sees it, controlled by the player.
  await player.getByRole("button", { name: "+ 캐릭터" }).click();
  const wizard = topWindow(player);
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
  const sheetWindow = player.locator(".cl-window", { hasText: "앨리스의 파이터" });
  await sheetWindow.locator(".cl-hp-big").waitFor({ timeout: 10000 });
  await dm.locator(".cl-journal-row", { hasText: "앨리스의 파이터" }).waitFor({ timeout: 10000 });
  check((await dm.locator(".cl-journal-row", { hasText: "앨리스의 파이터" }).innerText()).includes("1/1명"), "the DM's list shows the character is visible to 1 of 1 players");
  await player.screenshot({ path: path.join(OUT, "38-journal-character-sheet-player.png") });

  // SC-17: HP -5 and a roll from the window: the DM's copy updates and the roll card names the character.
  const before = Number((await sheetWindow.locator(".cl-hp-big").innerText()).split("/")[0]);
  // R67 (D202): an amount and a button, not a signed command in one box.
  await sheetWindow.getByLabel("HP 입력").fill("5");
  await sheetWindow.getByRole("button", { name: "피해", exact: true }).first().click();
  await dm.locator(".cl-journal-row", { hasText: "앨리스의 파이터" }).click();
  const dmSheet = topWindow(dm);
  await dmSheet.locator(".cl-hp-big").waitFor();
  await dm.waitForFunction((expected) => Number(document.querySelector(".cl-window:last-child .cl-hp-big")?.textContent?.split("/")[0]) === expected, before - 5, { timeout: 10000 });
  check(true, `the DM's sheet shows HP ${before - 5} after the player's -5`);
  await sheetWindow.locator(".cl-sheet").getByRole("button", { name: "굴림" }).first().click();
  await player.waitForSelector(".visual-dice-overlay", { timeout: 5000 }).catch(() => {});
  await chatTab(dm).click();
  await dm.locator(".cl-roll-card", { hasText: "앨리스의 파이터" }).waitFor({ timeout: 15000 });
  check(true, "a sheet roll lands in chat as a roll card with the character's name");
  await dm.screenshot({ path: path.join(OUT, "39-journal-dm-sees-hp-and-roll.png") });
  await dmSheet.getByLabel("창 닫기").click();

  // SC-18: the player exports the character to their library (Vault).
  await sheetWindow.getByRole("tab", { name: "정보" }).click();
  await sheetWindow.getByRole("button", { name: "라이브러리로 내보내기" }).click();
  await sheetWindow.getByText(/내 라이브러리에 저장했습니다/).waitFor();
  await player.screenshot({ path: path.join(OUT, "40-journal-character-info-export.png") });
  await player.goto(`${base}?seat=player#/`);
  await player.locator(".cl-char-card", { hasText: "앨리스의 파이터" }).waitFor({ timeout: 10000 });
  check(true, "the exported character is in the library");
  await player.screenshot({ path: path.join(OUT, "41-library-after-vault-export.png") });

  // SC-19: reconnect and relaunch keep the journal.
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.reload();
  await player.getByRole("button", { name: "다시 입장" }).first().click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await journalTab(player).click();
  await player.locator(".cl-journal-row", { hasText: "앨리스의 파이터" }).waitFor({ timeout: 10000 });
  check(await player.locator(".cl-journal-row", { hasText: "동굴 지도" }).count() === 1, "after a reconnect the player's journal has the handout and the character");
  await dm.getByRole("button", { name: "게임 닫기" }).click();
  await dm.locator(".cl-card.clickable", { hasText: "저널 시험" }).first().click();
  await dm.getByText(/저널 항목 2개/).waitFor();
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await journalTab(dm).click();
  await dm.locator(".cl-journal-row", { hasText: "앨리스의 파이터" }).waitFor({ timeout: 10000 });
  check(await dm.locator(".cl-journal-row").count() === 2, "a relaunched table loads the journal from the campaign documents");
  await dm.screenshot({ path: path.join(OUT, "42-journal-after-relaunch.png") });

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }

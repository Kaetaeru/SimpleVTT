/**
 * Campaign + table verification on one PC (SESSION_SCENARIOS.md §A): a DM tab and a player tab in one browser
 * profile (BroadcastChannel carrier). Creates a campaign, launches it, joins by the fixed code, chats and rolls,
 * whispers, GM rolls, kicks, rejoins, and checks the chat archive survives a relaunch. Writes 28-35 to
 * docs/evidence/new-client-m1 and fails loudly on any mismatch between the two tabs.
 *
 *   node scripts/capture-client-table.mjs
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
const chatText = async (page) => (await page.locator(".cl-chat-list").innerText()).replace(/\s+/g, " ");

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1380, height: 900 }, locale: "ko-KR" });
  const dm = await context.newPage();
  const player = await context.newPage();
  for (const [label, page] of [["dm", dm], ["player", player]]) {
    page.on("pageerror", (e) => { failures.push(`${label} page error: ${e.message}`); console.error(`${label} page error:`, e.message); });
    page.on("console", (m) => { if (m.type() === "error") console.error(`${label} console:`, m.text().slice(0, 200)); });
    page.on("dialog", (dialog) => void dialog.accept());
  }

  // SC-1: the DM makes a campaign; the details page shows a fixed join code.
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("잃어버린 광산");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "잃어버린 광산" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  check(/^tab:camp_[a-z0-9-]+-[A-Z0-9]{6}$/.test(code), `campaign has a fixed join code: ${code}`);
  await dm.screenshot({ path: path.join(OUT, "28-campaign-details.png") });

  // SC-2: launch → table; the code on the table equals the campaign's.
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.getByRole("heading", { name: "잃어버린 광산" }).waitFor();
  await dm.locator(".cl-chat-input").waitFor();
  check((await dm.locator(".cl-code").first().textContent())?.trim() === code, "table shows the same join code");

  // SC-3: the player joins by code; presence on both tabs; "참가한 캠페인" remembers it.
  await player.goto(`${base}#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });
  check(await player.locator(".cl-avatar-chip", { hasText: "DM 민수" }).isVisible(), "player sees the DM in presence");
  check((await chatText(dm)).includes("지연 입장"), "DM chat logs the entry");
  await player.screenshot({ path: path.join(OUT, "29-table-player-joined.png") });

  // SC-4: chat both ways, an inline roll, a public /roll with the dice card on both tabs.
  await player.getByLabel("채팅 입력").fill("안녕하세요! 통찰 [[1d20+2]]");
  await player.getByLabel("채팅 입력").press("Enter");
  await dm.locator(".cl-chat-msg", { hasText: "안녕하세요! 통찰 [" }).waitFor({ timeout: 10000 });
  await dm.getByLabel("채팅 입력").fill("환영해요");
  await dm.getByLabel("채팅 입력").press("Enter");
  await player.locator(".cl-chat-msg", { hasText: "환영해요" }).waitFor({ timeout: 10000 });
  await player.getByLabel("채팅 입력").fill("/roll 2d6+3 # 피해");
  await player.getByLabel("채팅 입력").press("Enter");
  await player.waitForSelector(".visual-dice-overlay", { timeout: 5000 }).catch(() => {});
  await dm.locator(".cl-roll-card", { hasText: "피해" }).waitFor({ timeout: 15000 });
  const dmTotal = (await dm.locator(".cl-roll-card", { hasText: "피해" }).locator(".cl-total").textContent())?.trim();
  const playerTotal = (await player.locator(".cl-roll-card", { hasText: "피해" }).locator(".cl-total").textContent())?.trim();
  check(dmTotal === playerTotal && Number(dmTotal) >= 5, `roll card agrees on both tabs (${dmTotal})`);
  await player.screenshot({ path: path.join(OUT, "30-table-chat-roll.png") });

  // SC-5: whisper to the GM is seen by the GM; /gmroll by the player is seen by GM and the player only; /desc GM-only.
  await player.getByLabel("채팅 입력").fill("/w gm 문 뒤를 살펴볼게요");
  await player.getByLabel("채팅 입력").press("Enter");
  await dm.locator(".cl-chat-msg.whisper", { hasText: "문 뒤를 살펴볼게요" }).waitFor({ timeout: 10000 });
  await player.getByLabel("채팅 입력").fill("/gmroll 1d20 # 은신");
  await player.getByLabel("채팅 입력").press("Enter");
  await dm.locator(".cl-chat-msg.roll.gm", { hasText: "은신" }).waitFor({ timeout: 15000 });
  await dm.getByLabel("채팅 입력").fill("/desc 문이 삐걱 열리고 찬 바람이 분다.");
  await dm.getByLabel("채팅 입력").press("Enter");
  await player.locator(".cl-chat-msg.desc", { hasText: "찬 바람" }).waitFor({ timeout: 10000 });
  await player.getByLabel("채팅 입력").fill("/desc 플레이어는 못 씀");
  await player.getByLabel("채팅 입력").press("Enter");
  await player.getByText(/GM만 씁니다/).waitFor({ timeout: 10000 });
  check(true, "whisper, GM roll, /desc and its refusal behave");
  await dm.screenshot({ path: path.join(OUT, "31-table-whisper-gmroll.png") });

  // SC-6: the DM kicks from the campaign page; the player is refused; "다시 허용" lets them back in with the same code.
  await dm.getByRole("button", { name: "캠페인 설정" }).click();
  await dm.getByRole("button", { name: "내보내기" }).first().click();
  await player.getByText(/입장이 거절됐습니다/).waitFor({ timeout: 10000 });
  check(true, "kicked player is refused");
  await dm.getByRole("button", { name: "다시 허용" }).first().click();
  await player.getByRole("button", { name: "돌아가기" }).click();
  await player.getByRole("button", { name: "다시 입장" }).first().waitFor();
  await player.getByRole("button", { name: "다시 입장" }).first().click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  check((await chatText(player)).includes("환영해요"), "rejoin restores the chat history");
  await player.screenshot({ path: path.join(OUT, "32-table-rejoin.png") });

  // SC-7: the DM closes the game; the campaign page counts the archive; relaunch shows the history to the DM.
  await dm.getByRole("button", { name: "테이블로" }).click();
  await dm.getByRole("button", { name: "게임 닫기" }).click();
  await player.getByText(/닫힘|연결 끊김/).first().waitFor({ timeout: 10000 });
  await dm.locator(".cl-card.clickable", { hasText: "잃어버린 광산" }).first().click();
  await dm.getByText(/개의 메시지가 저장돼 있습니다/).waitFor();
  const stored = Number(((await dm.getByText(/개의 메시지가 저장돼 있습니다/).textContent()) ?? "0").match(/(\d+)개/)?.[1]);
  check(stored >= 8, `chat archive stored ${stored} messages`);
  await dm.screenshot({ path: path.join(OUT, "33-campaign-archive.png") });
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  check((await chatText(dm)).includes("환영해요"), "relaunched table shows the archived chat");
  await dm.screenshot({ path: path.join(OUT, "34-table-relaunched-history.png") });

  // SC-8: a wrong code is refused with a clear message.
  const stranger = await context.newPage();
  stranger.on("dialog", (dialog) => void dialog.accept());
  await stranger.goto(`${base}#/campaigns`);
  await stranger.getByLabel("참가 코드").fill(code.replace(/-[A-Z0-9]{6}$/, "-ZZZZZZ"));
  await stranger.getByRole("button", { name: "입장", exact: true }).click();
  await stranger.getByText(/참가 코드가 맞지 않습니다/).waitFor({ timeout: 10000 });
  check(true, "wrong code refused");
  await stranger.screenshot({ path: path.join(OUT, "35-join-wrong-code.png") });
  await stranger.close();

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }

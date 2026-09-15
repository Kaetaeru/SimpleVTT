/**
 * Session verification on one PC: a host tab and a player tab in the same browser profile (BroadcastChannel carrier).
 * Runs SESSION_SCENARIOS.md SC-1..SC-6 and writes 28-33 to docs/evidence/new-client-m1. Fails loudly on any
 * mismatch between the two tabs.
 *
 *   node scripts/capture-client-session.mjs
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

async function createCharacter(page, name, species, background, classId, levels) {
  await page.goto(`${base}#/new`);
  await page.getByLabel("이름").fill(name);
  await page.getByRole("button", { name: /^2 종족/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${species}`) }).click();
  await page.getByRole("button", { name: /^3 배경/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${background}`) }).click();
  await page.getByRole("button", { name: /^4 능력치/ }).click();
  await page.getByRole("button", { name: "표준 배열" }).click();
  await page.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await page.getByLabel("추가할 직업").selectOption(classId);
  for (let i = 0; i < levels; i++) await page.getByRole("button", { name: "레벨 추가" }).click();
  await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await page.getByRole("button", { name: /^7 검토·저장/ }).click();
  await page.getByText("막힘 없음").first().waitFor();
  await page.getByRole("button", { name: "저장하고 시트 열기" }).click();
  await page.getByRole("button", { name: "다음 라운드" }).waitFor();
}

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1380, height: 900 }, locale: "ko-KR" });
  const host = await context.newPage();
  const player = await context.newPage();
  for (const [label, page] of [["host", host], ["player", player]]) {
    page.on("pageerror", (e) => { failures.push(`${label} page error: ${e.message}`); console.error(`${label} page error:`, e.message); });
    page.on("console", (m) => { if (m.type() === "error") console.error(`${label} console:`, m.text().slice(0, 200)); });
    page.on("dialog", (dialog) => void dialog.accept());
  }

  // SC-1 setup: two characters exist in the (shared, same-PC) library.
  await createCharacter(host, "그로크", "드워프", "군인", "dnd.srd521.class.barbarian", 3);
  await createCharacter(player, "브란", "인간", "신앙 수행자", "dnd.srd521.class.cleric", 3);

  // SC-1: host opens a session and gets an invite code.
  await host.goto(`${base}#/session`);
  await host.getByLabel("내 이름 (참가자 표시)").fill("DM 민수");
  await host.getByLabel("세션 이름").fill("검증 테이블");
  await host.getByRole("button", { name: "세션 열기" }).click();
  await host.getByRole("heading", { name: "검증 테이블" }).waitFor();
  const invite = (await host.locator(".cl-code").first().textContent())?.trim() ?? "";
  check(/^tab:sess_[a-z0-9]+-[A-Z0-9]{6}$/.test(invite), `invite code issued: ${invite}`);
  await host.screenshot({ path: path.join(OUT, "28-session-host-open.png") });

  // SC-2: player joins with the code, both bring characters.
  await player.goto(`${base}#/session`);
  await player.getByLabel("내 이름 (참가자 표시)").fill("플레이어 지연");
  await player.getByLabel("초대 코드").fill(invite);
  await player.getByRole("button", { name: "참가" }).click();
  await player.getByRole("heading", { name: "검증 테이블" }).waitFor({ timeout: 10000 });
  await player.getByLabel("데려올 캐릭터").selectOption({ label: "브란" });
  await host.getByLabel("데려올 캐릭터").selectOption({ label: "그로크" });
  await host.locator(".cl-party-card", { hasText: "브란" }).waitFor({ timeout: 10000 });
  await player.locator(".cl-party-card", { hasText: "그로크" }).waitFor({ timeout: 10000 });
  check((await host.locator(".cl-party-card").count()) === 2 && (await player.locator(".cl-party-card").count()) === 2, "both tabs list both characters");
  check(await host.getByText("플레이어 지연").first().isVisible(), "host sees the player in the participant list");
  await player.screenshot({ path: path.join(OUT, "29-session-player-joined.png") });

  // SC-3: a wrong invite code is refused with a clear message.
  const intruder = await context.newPage();
  intruder.on("dialog", (dialog) => void dialog.accept());
  await intruder.goto(`${base}#/session`);
  await intruder.getByLabel("초대 코드").fill(invite.replace(/-[A-Z0-9]{6}$/, "-ZZZZZZ"));
  await intruder.getByRole("button", { name: "참가" }).click();
  await intruder.getByText(/입장이 거절됐습니다/).waitFor({ timeout: 10000 });
  check(true, "wrong token refused");
  await intruder.close();

  // SC-4: the player casts Bless on the own sheet; the host sees the effect, the log and the slot pip.
  const blessRow = player.locator(".cl-spell-row", { hasText: "축복" }).first();
  await blessRow.getByRole("button", { name: /^시전/ }).click();
  await player.getByRole("group", { name: /축복 시전 방법/ }).getByRole("button", { name: /^1레벨 슬롯/ }).click();
  await host.locator(".cl-party-card", { hasText: "브란" }).getByText("축복").waitFor({ timeout: 10000 });
  check(await host.locator(".cl-session-log").getByText(/브란: 시전: 축복/).first().isVisible(), "host log shows the player's cast");
  await player.screenshot({ path: path.join(OUT, "30-session-player-cast.png") });

  // SC-5: the DM damages the player's character; the player's own log names the DM; both HP agree.
  await host.locator(".cl-party-card", { hasText: "브란" }).click();
  await host.getByLabel("DM 수치").fill("7");
  await host.locator(".cl-dm-quick").getByRole("button", { name: "피해", exact: true }).click();
  await player.locator(".cl-log").first().getByText(/DM: 피해 7/).waitFor({ timeout: 10000 });
  const hostHp = (await host.locator(".cl-party-card", { hasText: "브란" }).locator(".cl-small span").first().textContent())?.trim();
  const playerHp = (await player.locator(".cl-party-card", { hasText: "브란" }).locator(".cl-small span").first().textContent())?.trim();
  check(hostHp === playerHp, `HP agrees on both tabs (${hostHp} / ${playerHp})`);
  check(await player.locator(".cl-session-log .kind-dm").first().isVisible(), "shared log marks the DM action");
  await host.screenshot({ path: path.join(OUT, "31-session-dm-damage.png") });

  // SC-6: the host advances the round; the player's timed effect ticks; chat flows both ways.
  await host.getByRole("button", { name: "다음 라운드" }).first().click();
  await player.getByText("라운드 1").first().waitFor({ timeout: 10000 });
  await player.getByLabel("채팅").fill("잘 보여요!");
  await player.getByRole("button", { name: "보내기" }).click();
  await host.locator(".cl-session-log").getByText(/플레이어 지연: 잘 보여요!/).waitFor({ timeout: 10000 });
  await host.getByLabel("채팅").fill("좋아, 계속 가자");
  await host.getByRole("button", { name: "보내기" }).click();
  await player.locator(".cl-session-log").getByText(/DM 민수: 좋아, 계속 가자/).waitFor({ timeout: 10000 });
  check(true, "round advanced and chat flows both ways");
  await player.screenshot({ path: path.join(OUT, "32-session-round-chat.png") });

  // SC-7: write-back — the player's library sheet holds the session HP after leaving.
  await player.getByRole("button", { name: "나가기" }).click();
  await player.goto(`${base}#/`);
  await player.locator(".cl-card", { hasText: "브란" }).first().getByRole("button", { name: "시트" }).click();
  await player.getByRole("button", { name: "다음 라운드" }).waitFor();
  const libraryHp = (await player.locator(".cl-hp-big").first().textContent())?.replace(/\s+/g, "");
  check(libraryHp?.startsWith(playerHp?.split("/")[0] ?? "x"), `library sheet kept the session HP (${libraryHp})`);
  check(await player.locator(".cl-log").first().getByText(/DM: 피해 7/).isVisible(), "library log kept the DM line");
  await player.screenshot({ path: path.join(OUT, "33-session-writeback-library.png") });

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }

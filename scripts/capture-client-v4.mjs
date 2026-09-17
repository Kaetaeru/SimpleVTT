/**
 * V4w (D285): the player-seat windows the V4 slices added, driven in a real browser — the cast window's metamagic
 * step (the sorcerer pays sorcery points and the card names what rode along) and the Font of Magic conversions on
 * the command bar (a slot level the sheet has no slots of is not offered).
 * Writes 90-91 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-v4.mjs
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
if (!(await portOpen(PORT))) { server = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--config", "vite.client.config.ts", "--port", String(PORT), "--strictPort"], { stdio: "inherit" }); for (let at = 0; at < 100 && !(await portOpen(PORT)); at += 1) await new Promise((r) => setTimeout(r, 300)); }
const OUT = path.resolve("docs/evidence/new-client-m1");
const base = `http://127.0.0.1:${PORT}/`;
const failures = [];
const check = (condition, message) => { if (!condition) { failures.push(message); console.error("FAIL:", message); } else console.log("ok:", message); };
const tab = (page, name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const tokenOf = (page, name) => page.locator(`.cl-scene-card[data-token-name="${name}"]`);

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 960 }, locale: "ko-KR" });
  const dm = await context.newPage();
  dm.on("pageerror", (e) => { failures.push(`page error: ${e.message}`); console.error("page error:", e.message); });
  dm.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text().slice(0, 200)); });
  dm.on("dialog", (dialog) => void dialog.accept());

  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("메타매직 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "메타매직 시험" }).waitFor();
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await dm.locator(".cl-scene").waitFor({ timeout: 10000 });

  // A sorcerer with metamagic, made at the table and put on the scene.
  await tab(dm, "저널").click();
  await dm.getByRole("button", { name: "+ 캐릭터" }).click();
  const wizard = dm.locator(".cl-window").last();
  await wizard.getByLabel("이름").fill("메타소서");
  await wizard.getByRole("button", { name: /^2 종족/ }).click();
  await wizard.getByRole("button", { name: /^인간/ }).click();
  await wizard.getByRole("button", { name: /^3 배경/ }).click();
  await wizard.getByRole("button", { name: /^군인/ }).click();
  await wizard.getByRole("button", { name: /^4 능력치/ }).click();
  await wizard.getByRole("button", { name: "표준 배열" }).click();
  await wizard.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await wizard.getByLabel("추가할 직업").selectOption("dnd.srd521.class.sorcerer");
  for (let level = 0; level < 5; level += 1) await wizard.getByRole("button", { name: "레벨 추가" }).click();
  await wizard.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await wizard.getByRole("button", { name: /^7 검토·저장/ }).click();
  await wizard.getByRole("button", { name: "저장", exact: true }).first().click();
  await dm.locator(".cl-window", { hasText: "메타소서" }).locator(".cl-hp-big").waitFor({ timeout: 10000 });
  await dm.locator(".cl-window").last().getByLabel("창 닫기").click();
  await dm.getByLabel("메타소서 토큰 놓기").click();
  await tokenOf(dm, "메타소서").waitFor({ timeout: 10000 });
  await tab(dm, "채팅").click();

  // V4j (D272): the Font of Magic conversions are buttons, and only for slot levels this sheet has.
  await tokenOf(dm, "메타소서").click();
  const bonusMenu = dm.getByRole("button", { name: /^✨ 추가 행동 마법/ });
  if (await bonusMenu.count()) await bonusMenu.first().click();
  const conversions = await dm.getByRole("button", { name: /마력의 샘: .*슬롯 → 마법 점수/ }).allInnerTexts();
  check(conversions.some((line) => line.includes("1레벨 슬롯")), `the 1st-level conversion is offered: ${conversions.join(" | ") || "(none)"}`);
  check(!conversions.some((line) => line.includes("6레벨 슬롯")), "no conversion for a slot level this sorcerer has none of");
  await dm.screenshot({ path: path.join(OUT, "90-table-font-of-magic.png") });

  // V4r (D280): casting asks for the slot, then the metamagic; the card names it and the points come off the sheet.
  await dm.getByRole("button", { name: /^✨ 마법/ }).first().click();
  await dm.getByText(/마법 화살/).first().click();
  const box = await tokenOf(dm, "메타소서").boundingBox();
  await dm.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await dm.getByRole("button", { name: "확정" }).click();
  await dm.getByRole("button", { name: /^1레벨 슬롯/ }).click();
  // The window itself is what matters: it lists the metamagics this sheet can pay for, and nothing it cannot use.
  const anyMetamagic = dm.getByRole("button", { name: /^메타매직/ });
  await anyMetamagic.first().waitFor({ timeout: 10000 });
  await dm.screenshot({ path: path.join(OUT, "91-table-metamagic-window.png") });
  const offered = await anyMetamagic.allInnerTexts();
  check(offered.length > 0, `the cast window asked for a metamagic: ${offered.join(" | ")}`);
  check(!offered.some((line) => line.includes("고양 주문")), `a metamagic this spell cannot use is not offered: ${offered.join(" | ")}`);
  const chosen = (await anyMetamagic.first().innerText()).replace(/^메타매직:\s*/, "").split(" (")[0];
  await anyMetamagic.first().click();
  await dm.locator(".cl-chat-msg", { hasText: chosen }).first().waitFor({ timeout: 10000 });
  check(true, `the card names the metamagic that rode along (${chosen})`);
  // The points come off the sheet, so the sheet's own log is where that is written.
  await tab(dm, "저널").click();
  await dm.getByLabel("메타소서 토큰 놓기").locator("xpath=ancestor::*[contains(@class,\"cl-journal-row\")][1]").getByText("메타소서").first().click({ trial: true }).catch(() => undefined);
  await dm.getByRole("button", { name: /^메타소서/ }).first().click({ force: true });
  const sheetLog = dm.locator(".cl-window", { hasText: "메타소서" }).last();
  await sheetLog.getByText(new RegExp(`${chosen}: .*남음`)).first().waitFor({ timeout: 10000 });
  check(true, "the sorcery points came off the sheet");

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { server?.kill(); }

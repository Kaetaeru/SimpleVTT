/**
 * Evidence capture for the new client M1 (docs/design/v3/NEW_CLIENT.md §4): drives the wizard end to end in Chromium,
 * installs the fixture supplement module, builds a character from it, and writes screenshots + a README to
 * docs/evidence/new-client-m1/.
 *
 *   node --import tsx scripts/capture-client-m1.mjs
 *
 * Needs Playwright (local `playwright` package, or PLAYWRIGHT_MODULE pointing at a global install) and a Chromium the
 * package can find (PLAYWRIGHT_BROWSERS_PATH). The Vite dev server is started on port 1430 for the run.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { connect } from "node:net";
import path from "node:path";
import process from "node:process";
import { compileSupplement } from "../tools/supplement/compileSupplement.ts";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean);
  for (const candidate of candidates) { try { return require(candidate); } catch { /* next */ } }
  throw new Error("playwright not found: npm i -D playwright, or set PLAYWRIGHT_MODULE");
}

const PORT = 1430;
const OUT = path.resolve("docs/evidence/new-client-m1");
mkdirSync(OUT, { recursive: true });

function waitForPort(port, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("error", () => { socket.destroy(); if (Date.now() - started > timeoutMs) reject(new Error(`port ${port} not open`)); else setTimeout(attempt, 400); });
    };
    attempt();
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
  });
}

// Reuse a dev server that is already up; otherwise start one in its own process group so it can be stopped cleanly.
let server = null;
if (!(await portOpen(PORT))) {
  server = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--config", "vite.client.config.ts", "--port", String(PORT), "--strictPort"], { stdio: ["ignore", "ignore", "pipe"], detached: true });
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
}
const captured = [];
try {
  await waitForPort(PORT);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1380, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error("page error:", error.message));
  const shot = async (name, fullPage = false) => { const file = path.join(OUT, `${name}.png`); await page.screenshot({ path: file, fullPage }); captured.push(name); console.log(`captured ${name}`); };
  const base = `http://127.0.0.1:${PORT}/`;

  await page.goto(`${base}#/`);
  await page.getByText("아직 캐릭터가 없습니다").waitFor();
  await shot("01-library-empty");

  // Wizard: dwarf soldier fighter 4, standard array, remaining choices auto-filled.
  await page.getByRole("button", { name: "새 캐릭터" }).first().click();
  await page.getByLabel("이름").fill("토린 브론즈비어드");
  await page.getByLabel("성향").selectOption("질서 선");
  await shot("02-wizard-basics");
  await page.getByRole("button", { name: /^2 종족/ }).click();
  await page.getByRole("button", { name: /^드워프/ }).click();
  await shot("03-wizard-species");
  await page.getByRole("button", { name: /^3 배경/ }).click();
  await page.getByRole("button", { name: /^군인/ }).click();
  await page.getByRole("option", { name: /한 능력치 \+2/ }).click();
  await page.getByRole("option", { name: /^근력/ }).first().click();
  await shot("04-wizard-background");
  await page.getByRole("button", { name: /^4 능력치/ }).click();
  await page.getByRole("button", { name: "표준 배열" }).click();
  await shot("05-wizard-abilities");
  await page.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await page.getByLabel("추가할 직업").selectOption("dnd.srd521.class.fighter");
  for (let level = 0; level < 4; level += 1) await page.getByRole("button", { name: "레벨 추가" }).click();
  await page.getByText("4레벨 — 파이터 4").waitFor();
  await shot("06-wizard-classes", true);
  await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await page.getByRole("button", { name: /^7 검토·저장/ }).click();
  await page.getByText("막힘 없음").first().waitFor();
  await shot("07-wizard-review", true);
  await page.getByRole("button", { name: "저장하고 시트 열기" }).click();
  await page.getByText("드워프의 강인함").first().waitFor();
  await shot("08-sheet-fighter", true);

  // Level up to 5 from the sheet (edit → add a level → save).
  await page.getByRole("button", { name: "편집 · 레벨 업" }).click();
  await page.getByRole("button", { name: "레벨 추가" }).click();
  await page.getByText("총 5레벨").first().waitFor();
  await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("총 5레벨").first().waitFor();
  await shot("09-sheet-fighter-level5");

  // JSON export modal.
  await page.getByRole("button", { name: "JSON 내보내기" }).click();
  await page.getByText('"format": "simplevtt.character"').waitFor();
  await shot("10-sheet-export-json");
  await page.getByRole("button", { name: "닫기" }).click();

  // Contents: install the fixture supplement by pasting its JSON.
  const module = compileSupplement({ sourceRoot: "tests/fixtures/supplement/translation", semanticsRoot: "tests/fixtures/supplement/semantics", moduleId: "fixture-supplement", moduleVersion: "1", idPrefix: "fx", document: "Fixture Supplement" }).module;
  await page.goto(`${base}#/contents`);
  await page.getByRole("button", { name: "JSON 붙여넣기" }).click();
  await page.locator("textarea").fill(JSON.stringify(module));
  await page.getByRole("button", { name: "확인" }).click();
  await page.getByText("설치 미리보기").waitFor();
  await shot("11-contents-preview");
  await page.getByRole("button", { name: "설치", exact: true }).click();
  await page.getByText("fixture-supplement 설치됨").waitFor();
  await shot("12-contents-installed");

  // A character from installed content: mothfolk lighthouse keeper fighter 3 (storm knight).
  await page.goto(`${base}#/new`);
  await page.getByLabel("이름").fill("루멘");
  await page.getByRole("button", { name: /^2 종족/ }).click();
  await page.getByRole("button", { name: /^나방족/ }).click();
  await page.getByRole("button", { name: /^3 배경/ }).click();
  await page.getByRole("button", { name: /^등대지기/ }).click();
  await page.getByRole("button", { name: /^4 능력치/ }).click();
  await page.getByRole("button", { name: "표준 배열" }).click();
  await page.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await page.getByLabel("추가할 직업").selectOption("dnd.srd521.class.fighter");
  for (let level = 0; level < 3; level += 1) await page.getByRole("button", { name: "레벨 추가" }).click();
  await page.getByText("3레벨 — 파이터 3").waitFor();
  await page.getByRole("option", { name: /^폭풍 기사/ }).click();
  await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await page.getByRole("button", { name: /^7 검토·저장/ }).click();
  await page.getByText("막힘 없음").first().waitFor();
  await page.getByRole("button", { name: "저장하고 시트 열기" }).click();
  await page.getByText("가루 날개").first().waitFor();
  await shot("13-sheet-installed-content", true);

  await page.goto(`${base}#/`);
  await page.getByText("루멘").first().waitFor();
  await shot("14-library-two-characters");
  await page.getByRole("button", { name: "어둡게" }).or(page.getByRole("button", { name: "밝게" })).click();
  await shot("15-library-light-theme");
  await browser.close();
  const readme = [
    "# 새 클라이언트 M1 증거 (자동 캡처)",
    "",
    `생성: ${new Date().toISOString()} · \`node --import tsx scripts/capture-client-m1.mjs\``,
    "",
    "Chromium이 Vite 개발 서버(포트 1430)에서 마법사를 처음부터 끝까지 진행하고, 보충 모듈(합성 픽스처)을 설치한 뒤 설치 콘텐츠로 캐릭터를 만든다.",
    "",
    ...captured.map((name) => `- \`${name}.png\``),
    "",
  ].join("\n");
  writeFileSync(path.join(OUT, "README.md"), readme, "utf8");
  console.log(`done: ${captured.length} captures in ${OUT}`);
} finally {
  if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); } }
}

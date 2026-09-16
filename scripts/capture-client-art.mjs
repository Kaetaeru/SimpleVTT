/**
 * Art library verification on one PC (SESSION_SCENARIOS.md SC-22..25): the DM uploads an image (large enough to
 * travel in several chunks), uses it as a handout avatar, shows the handout; the player receives the image, uploads
 * their own, and after a reload the images come from the cache. Writes 43-46 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-art.mjs
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import path from "node:path";
import zlib from "node:zlib";
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

/** A real PNG (RGBA, noisy so it does not compress below the chunk size): width×height with a colour theme. */
function png(width, height, seed) {
  const crcTable = []; for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable.push(c >>> 0); }
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  let state = seed;
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state >>> 24; };
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) { raw[y * (width * 4 + 1)] = 0; for (let x = 0; x < width; x += 1) { const at = y * (width * 4 + 1) + 1 + x * 4; raw[at] = (x * 255 / width) | 0; raw[at + 1] = rand(); raw[at + 2] = (y * 255 / height) | 0; raw[at + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

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
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("아트 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "아트 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });

  // SC-22: the DM uploads a 240KB-ish PNG (several chunks); the card shows; the player's library stays empty.
  const map = png(320, 240, 7);
  check(map.length > 48 * 1024, `the test image is larger than one chunk (${map.length} bytes)`);
  await tab(dm, "아트").click();
  await dm.getByLabel("이미지 파일").setInputFiles({ name: "dungeon-map.png", mimeType: "image/png", buffer: map });
  await dm.locator(".cl-art-card", { hasText: "dungeon-map" }).waitFor({ timeout: 15000 });
  await dm.locator(".cl-art-card img[data-art-status=ready]").first().waitFor({ timeout: 15000 });
  await tab(player, "아트").click();
  await player.getByText(/아직 볼 수 있는 이미지가 없습니다/).waitFor();
  check(true, "a GM upload shows in the GM's library and not in the player's");
  await dm.screenshot({ path: path.join(OUT, "43-art-library-gm-upload.png") });

  // SC-23: the DM uses it as a handout avatar and shows the handout; the player receives the image itself.
  await tab(dm, "저널").click();
  await dm.getByRole("button", { name: "+ 핸드아웃" }).click();
  const handout = dm.locator(".cl-window").last();
  await handout.getByLabel("이름").fill("던전 지도");
  await handout.getByRole("button", { name: "라이브러리에서" }).click();
  await dm.getByRole("dialog", { name: "아바타 고르기" }).locator(".cl-art-card").first().click();
  await handout.locator(".cl-journal-avatar[data-art-status=ready]").waitFor({ timeout: 10000 });
  await handout.getByLabel("볼 수 있는 사람").selectOption("all");
  await handout.getByRole("button", { name: "플레이어에게 보여주기" }).click();
  const shown = player.locator(".cl-window", { hasText: "던전 지도" });
  await shown.waitFor({ timeout: 10000 });
  await shown.locator(".cl-journal-avatar[data-art-status=ready]").waitFor({ timeout: 20000 });
  const natural = await shown.locator(".cl-journal-avatar[data-art-status=ready]").evaluate((img) => img.naturalWidth);
  check(natural === 320, `the player's avatar is the full image (naturalWidth ${natural})`);
  await tab(player, "아트").click();
  await player.locator(".cl-art-card", { hasText: "dungeon-map" }).waitFor({ timeout: 10000 });
  check(true, "the referenced image is now in the player's library");
  await player.screenshot({ path: path.join(OUT, "44-art-handout-avatar-player.png") });
  await shown.getByLabel("창 닫기").click();

  // SC-24: the player uploads a portrait; the GM sees it with the uploader's name; the player renames it.
  await player.getByLabel("이미지 파일").setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: png(96, 96, 3) });
  await player.locator(".cl-art-card", { hasText: "portrait" }).waitFor({ timeout: 15000 });
  await tab(dm, "아트").click();
  const gmCard = dm.locator(".cl-art-card", { hasText: "portrait" });
  await gmCard.waitFor({ timeout: 10000 });
  check((await gmCard.innerText()).includes("지연"), "the GM's card names the uploader");
  await player.locator(".cl-art-card", { hasText: "portrait" }).click();
  await player.getByLabel("아트 이름").fill("지연의 초상");
  await player.getByLabel("아트 폴더").fill("초상");
  await player.getByLabel("아트 폴더").blur();
  await dm.locator(".cl-art-card", { hasText: "지연의 초상" }).waitFor({ timeout: 10000 });
  check(true, "a rename by the owner reaches the GM");
  await dm.screenshot({ path: path.join(OUT, "45-art-library-gm-two-uploads.png") });

  // SC-25: after a reload the player's images come back (metadata from the host, bytes from the local cache).
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.reload();
  await player.getByRole("button", { name: "다시 입장" }).first().click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await tab(player, "아트").click();
  await player.locator(".cl-art-card", { hasText: "dungeon-map" }).locator("img[data-art-status=ready]").waitFor({ timeout: 10000 });
  await player.locator(".cl-art-card", { hasText: "지연의 초상" }).locator("img[data-art-status=ready]").waitFor({ timeout: 10000 });
  check(await player.locator(".cl-art-card").count() === 2, "after a reconnect the player's library has both images");
  await player.screenshot({ path: path.join(OUT, "46-art-library-player-after-reload.png") });

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }

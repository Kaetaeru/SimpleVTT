/**
 * V0.9 D349: build the offline sheet printer as one HTML file.
 *
 *   npm run build:sheet   →   dist-sheet/simplevtt-sheet.html
 *
 * Vite builds client/print; this folds the script and stylesheet it emitted into the page itself. A module script
 * loaded from a file:// page is refused by the browser, but an inline one is not — so the result opens straight
 * from disk (double-click), with no server and no network.
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { build } from "vite";

const out = path.resolve("dist-sheet");
await build({ configFile: path.resolve("vite.sheet.config.ts"), logLevel: "warn" });

let html = readFileSync(path.join(out, "index.html"), "utf8");
const assets = new Set();
// Inline every emitted script, keeping it a module (its imports are already bundled into it).
html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_all, file) => {
  assets.add(file);
  const code = readFileSync(path.join(out, file), "utf8").replaceAll("</script", "<\\/script");
  return `<script type="module">${code}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_all, file) => {
  assets.add(file);
  return `<style>${readFileSync(path.join(out, file), "utf8")}</style>`;
});
if (!assets.size) throw new Error("no emitted script was found to inline — the Vite output changed shape");

const target = path.join(out, "simplevtt-sheet.html");
writeFileSync(target, html);
rmSync(path.join(out, "index.html"));
rmSync(path.join(out, "assets"), { recursive: true, force: true });
console.log(`built ${path.relative(process.cwd(), target)} (${Math.round(Buffer.byteLength(html) / 1024)} KB, ${assets.size} asset(s) inlined)`);

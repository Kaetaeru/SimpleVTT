import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The new client (client/) may import only itself and modules under content/modules/srd-5.2.1. Nothing from the old
 * app (src/**) — the rebuild does not inherit the old adapters or screens — and, since D314, none of the SRD's old
 * channels either (src/generated catalogs, content/indexes, content/srd-extras, the old dnd-srd-5.2.1.* modules): the
 * SRD is the modules built from its source, read the way any installed module is.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = join(root, "client");
const errors = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = match[1];
      if (!spec.startsWith(".")) continue;
      const target = resolve(dirname(path), spec);
      const rel = relative(root, target).replaceAll("\\", "/");
      const ok = rel.startsWith("client/") || rel.startsWith("content/modules/srd-5.2.1/");
      if (!ok) errors.push(`${relative(root, path)} imports ${spec} (${rel})`);
    }
  }
}
walk(clientRoot);
if (errors.length) {
  console.error("Client boundary violations:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else console.log("Client boundary OK");

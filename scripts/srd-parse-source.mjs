/**
 * Read the SRD 5.2.1 source documents into one structured JSON (docs/design/v3/SRD_MODULE_PLAN.md §3).
 *
 * The SRD translation lives in the owner's repository (`Kaetaeru/D-D-2024-`, `10-RULEBOOKS/srd-5.2.1`) as Korean
 * markdown with YAML frontmatter. Unlike the PHB supplement, one document often holds many entries — a class with its
 * subclass, every spell of a letter, every feat — so this keeps the whole heading tree (`#`, `##`, `###`) and decides
 * nothing about rules. The module builder downstream reads entries out of the tree.
 *
 *   node scripts/srd-parse-source.mjs <source>/10-RULEBOOKS/srd-5.2.1 <out>/srd-parsed.json
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const [root, out] = process.argv.slice(2);
if (!root || !out) { console.error("usage: node scripts/srd-parse-source.mjs <srd-5.2.1 dir> <out.json>"); process.exit(2); }

/** Every `.md` under a folder, sorted by path. */
function documents(dir) {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...documents(path));
    else if (name.endsWith(".md")) found.push(path);
  }
  return found;
}

/** Frontmatter and the heading tree: `{ depth, head, text, children }`, with the text before the first heading as `intro`. */
function parse(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  const fm = {};
  let body = text;
  if (match) {
    for (const line of match[1].split("\n")) {
      const at = line.indexOf(":");
      if (at > 0) fm[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^"(.*)"$/, "$1");
    }
    body = match[2];
  }
  const top = { depth: 0, head: "", text: "", children: [] };
  const stack = [top];
  let lines = [];
  let fence = false;
  const flush = () => { stack[stack.length - 1].text = lines.join("\n").trim(); lines = []; };
  for (const line of body.split("\n")) {
    if (/^```/.test(line)) fence = !fence;
    const heading = !fence && /^(#{1,4})\s+(.*)$/.exec(line);
    if (!heading) { lines.push(line); continue; }
    flush();
    const node = { depth: heading[1].length, head: heading[2].trim(), text: "", children: [] };
    while (stack[stack.length - 1].depth >= node.depth) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  flush();
  return { fm, intro: top.text, tree: top.children };
}

const docs = documents(root).map((path) => ({ file: relative(root, path).split(sep).join("/"), ...parse(path) }));
writeFileSync(out, JSON.stringify({ root: "10-RULEBOOKS/srd-5.2.1", docs }, null, 1));
const count = (nodes, depth) => nodes.reduce((sum, node) => sum + (node.depth === depth ? 1 : 0) + count(node.children, depth), 0);
console.log(JSON.stringify({ docs: docs.length, h1: docs.reduce((s, d) => s + count(d.tree, 1), 0), h2: docs.reduce((s, d) => s + count(d.tree, 2), 0), h3: docs.reduce((s, d) => s + count(d.tree, 3), 0) }));

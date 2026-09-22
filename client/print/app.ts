/**
 * V0.9 D349: the offline sheet printer.
 *
 * A page on its own, apart from the table: choose a character file (the app's `simplevtt.character` export), and
 * optionally the module files the character was built with, and it works the character out with the same engine
 * the app uses and lays it out as a sheet. "PDF로 저장" is the browser's own print dialog — pick "PDF로 저장" there.
 * Nothing leaves the machine: there is no server, and the built file runs from disk.
 */
import { createCatalog } from "../catalog";
import type { RuleModuleJson } from "../catalog/types";
import { deriveCharacter } from "../character/derive";
import { parseCharacterFile } from "../character/json";
import { SHEET_CSS, sheetHtml } from "./sheetHtml";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const style = document.createElement("style");
style.textContent = SHEET_CSS;
document.head.appendChild(style);

function report(lines: string[], tone: "bad" | "note") {
  const box = $("messages");
  box.hidden = !lines.length;
  box.className = `messages ${tone}`;
  box.innerHTML = lines.map((line) => `<li>${line.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!)}</li>`).join("");
}

async function build() {
  const characterFile = $<HTMLInputElement>("character").files?.[0];
  const pasted = $<HTMLTextAreaElement>("pasted").value.trim();
  if (!characterFile && !pasted) { report(["캐릭터 파일을 고르거나 JSON을 붙여 넣으세요."], "bad"); return; }
  const text = characterFile ? await characterFile.text() : pasted;

  const modules: RuleModuleJson[] = [];
  const problems: string[] = [];
  for (const file of Array.from($<HTMLInputElement>("modules").files ?? [])) {
    try { modules.push(JSON.parse(await file.text()) as RuleModuleJson); }
    catch { problems.push(`${file.name}: 모듈 JSON을 읽을 수 없습니다`); }
  }

  const parsed = parseCharacterFile(text);
  if (!parsed.source) { report([...problems, ...parsed.errors], "bad"); return; }
  try {
    const catalog = createCatalog(modules);
    const runtime = parsed.runtime;
    const derived = deriveCharacter(parsed.source, catalog, { equipped: runtime?.equipped, inventory: runtime?.inventory, effects: runtime?.effects });
    $("sheet").innerHTML = sheetHtml({ derived, runtime, catalog, notes: parsed.source.notes });
    document.title = `${derived.name} — 캐릭터 시트`;
    $<HTMLButtonElement>("print").disabled = false;
    report([...problems, ...parsed.warnings, ...parsed.errors], "note");
  } catch (error) {
    report([...problems, `시트를 만들 수 없습니다: ${error instanceof Error ? error.message : String(error)}`], "bad");
  }
}

$("make").addEventListener("click", () => { void build(); });
$("character").addEventListener("change", () => { void build(); });
$("print").addEventListener("click", () => window.print());

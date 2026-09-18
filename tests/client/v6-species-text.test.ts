/**
 * V0.9 D304: an installed species trait whose text runs over several paragraphs keeps all of them on the sheet, up to
 * the next trait. A synthetic module (CLAUDE.md §1.6).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import { sectionOf } from "../../client/catalog/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";

const DESCRIPTION = [
  "하늘빛 사람들.",
  "빛의 피\n광휘 피해에 저항을 가진다.",
  "변신\n추가 행동으로 변신한다.",
  "변신한 동안 턴마다 한 번 추가 피해를 준다.",
  "날개\n비행 속도를 얻는다.",
  "마지막 숨\n0 HP가 되면 한 번 버틴다.",
].join("\n\n");

const MODULE = {
  moduleId: "test.d304", moduleVersion: "1",
  content: [{
    id: "test.d304.species.skyborn", category: "species",
    presentation: { originalName: "Skyborn", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "하늘족", description: DESCRIPTION } } },
    mechanics: [{ kind: "species-definition", config: { size: ["medium"], speed: 30, traits: ["blood", "change", "last-breath"], semantics: { baseFeatures: ["빛의 피 (하늘족)", "변신 (하늘족)", "마지막 숨 (하늘족)"] } } }],
  }],
} as unknown as RuleModuleJson;

test("D304: a trait keeps every paragraph up to the next trait, its sub-headings included", () => {
  const species = createCatalog([MODULE]).species.find((item) => item.id === "test.d304.species.skyborn")!;
  const [blood, change, last] = species.traits;
  assert.equal(blood.description, "광휘 피해에 저항을 가진다.");
  assert.equal(change.description, "추가 행동으로 변신한다.\n\n변신한 동안 턴마다 한 번 추가 피해를 준다.\n\n날개\n비행 속도를 얻는다.");
  assert.equal(last.description, "0 HP가 되면 한 번 버틴다.");
});

test("D304: a heading reads its own block, and a missing heading reads nothing", () => {
  assert.equal(sectionOf("가\n첫째 줄\n둘째 줄", "가"), "첫째 줄 둘째 줄");
  assert.equal(sectionOf(DESCRIPTION, "없는 제목"), undefined);
});

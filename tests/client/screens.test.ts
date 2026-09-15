/**
 * Screens render from real data: the sheet shows every derived section, the wizard shows the engine's choices with
 * their state, the library and contents screens list what the store holds. Rendered to static markup (no DOM).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../../client/app/App";
import { ClientProvider } from "../../client/app/context";
import { initialRuntime } from "../../client/character/runtime";
import { SheetView, ValidationList } from "../../client/screens/SheetView";
import { ChoicePicker } from "../../client/screens/ChoicePicker";
import { MemoryStore } from "../../client/storage/store";
import { build, catalog, choice, derive, ids } from "./support";

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("the sheet view renders every section of a level-5 life cleric with descriptions and numbers", () => {
  const { derived } = build({ species: "dwarf", background: "acolyte", classes: "cleric", level: 5, abilities: { wis: 16, con: 14 } }, { "class.2.subclass": ["dnd.srd521.subclass.cleric.life-domain"] });
  const html = renderToStaticMarkup(createElement(SheetView, { derived, catalog: catalog(), runtime: initialRuntime(derived) }));
  const text = strip(html);
  for (const needle of ["테스트", "드워프", derived.background!.name, "클레릭 (생명 권역) 5", "숙련 보너스 +3", "최대 HP", String(derived.hp.max), "AC", "패시브 지각", "암시야 120", "기술", "숙련", "방어", "독", "자원", "신성 변환", "가방", "공격", "주문", "DC", "항상 준비", "Bless", "종족 특성", "드워프의 강인함", "직업 특성", "서브클래스 특성", "생명 보존", "재주", "마법 입문자"]) {
    assert.ok(text.includes(needle), `missing "${needle}"`);
  }
  assert.ok(html.includes(`title="${derived.hp.breakdown.join("\n")}"`) || html.includes("1레벨 클레릭 d8"), "HP breakdown is attached as a title");
  const compact = renderToStaticMarkup(createElement(SheetView, { derived, catalog: catalog(), compact: true }));
  assert.ok(compact.includes("cl-sheet compact"));
});

test("validation list shows blocking lines first, or the green note when clean", () => {
  const fresh = derive({ classes: "fighter" });
  const html = strip(renderToStaticMarkup(createElement(ValidationList, { derived: fresh })));
  assert.ok(html.includes("✕") && html.includes("기술 숙련"));
  const done = build({ classes: "fighter" }).derived;
  assert.ok(strip(renderToStaticMarkup(createElement(ValidationList, { derived: done }))).includes("막힘 없음"));
});

test("the choice picker shows counts, groups, disabled reasons and a search box for long lists", () => {
  const derived = derive({ classes: "wizard", level: 4, abilities: { str: 8, dex: 8 } });
  const asi = choice(derived, "class.3.asi")!;
  const html = renderToStaticMarkup(createElement(ChoicePicker, { choice: asi, onToggle: () => undefined }));
  assert.ok(html.includes("0/1"));
  assert.ok(html.includes("근력 또는 민첩 13 이상"), "disabled reason rendered");
  assert.ok(html.includes("일반 재주"), "grouped by tier");
  assert.ok(!html.includes("cl-search"), "short lists have no search box");
  const spellbook = choice(derived, "class.0.spellbook")!;
  const long = renderToStaticMarkup(createElement(ChoicePicker, { choice: spellbook, onToggle: () => undefined }));
  assert.ok(long.includes("cl-search"));
  assert.ok(long.includes("1레벨") && long.includes("2레벨"), "grouped by spell level");
  assert.ok(long.includes(`0/${spellbook.count}`) && spellbook.count === 12, "wizard 4 has 6 + 2×3 spellbook spells");
});

test("the app renders the library, the wizard and the contents screen against a memory store", async () => {
  const store = new MemoryStore();
  const { source, derived } = build({ name: "엘라", species: "elf", background: "sage", classes: "wizard", level: 3 });
  await store.putCharacter({ id: source.id, source, runtime: initialRuntime(derived), savedAt: new Date().toISOString() });
  const library = strip(renderToStaticMarkup(createElement(ClientProvider, { store, initialRoute: { screen: "library" }, children: createElement(App) })));
  assert.ok(library.includes("캐릭터") && library.includes("콘텐츠"));
  const wizard = strip(renderToStaticMarkup(createElement(ClientProvider, { store, initialRoute: { screen: "new" }, children: createElement(App) })));
  for (const needle of ["새 캐릭터", "기본", "종족", "배경", "능력치", "직업·레벨", "언어·장비", "검토·저장", "이름", "검증", "이름을 정하세요"]) assert.ok(wizard.includes(needle), `wizard missing "${needle}"`);
  const contents = strip(renderToStaticMarkup(createElement(ClientProvider, { store, initialRoute: { screen: "contents" }, children: createElement(App) })));
  assert.ok(contents.includes("내장 SRD 5.2.1 모듈 36개"));
  assert.ok(contents.includes("dnd.srd-5.2.1.classes"));
  void ids;
});

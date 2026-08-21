import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inventory=readFileSync(new URL("../../src/CharacterInventoryView.tsx",import.meta.url),"utf8");
const workspace=readFileSync(new URL("../../src/CharacterSheetPlayScreen.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/character-inventory.css",import.meta.url),"utf8");
const contracts=readFileSync(new URL("../../src/app/contracts.ts",import.meta.url),"utf8");

test("Inventory is a Character Sheet management section instead of a global route or Play database",()=>{
  assert.match(workspace,/useState<"sheet"\|"inventory">/);
  assert.match(workspace,/role="tablist" aria-label="캐릭터 관리 섹션"/);
  assert.match(workspace,/<CharacterInventoryView hostMode=\{hostMode\}/);
  assert.doesNotMatch(inventory,/setRoute|AppRoute|navigate\(|SessionModeRoot|CommandCenter/);
});

test("Inventory groups canonical owned ItemInstances without name-specific mechanics branches",()=>{
  assert.match(inventory,/character\?\.items\?\?\[\]/);
  assert.match(inventory,/item\.equipped\|\|item\.wielded\|\|item\.attuned/);
  assert.match(inventory,/item\.kind==="consumable"/);
  assert.match(inventory,/장착 \/ 활성/);
  assert.match(inventory,/소모품/);
  assert.match(inventory,/보관 중/);
  for(const name of ["치유 물약","마법 미사일 완드","롱소드","수호 부적"]) assert.doesNotMatch(inventory,new RegExp(name));
});

test("Inventory exposes only supported durable operations and treats Item actions as live projections",()=>{
  assert.match(inventory,/toggleItemEquipped/);
  assert.match(inventory,/toggleItemAttunement/);
  assert.match(inventory,/item\.grantedActionIds\.includes\(action\.id\)/);
  assert.match(inventory,/실제 사용과 수량·충전 소비는 세션 Item 행동에서 한 번에 처리/);
  assert.doesNotMatch(inventory,/useItem|quantity\s*[-+]=|charges\.current\s*[-+]=/);
  assert.match(contracts,/itemCost\?: \{ itemId: string; quantity\?: number; charges\?: number \}/);
});

test("unsupported inventory authority remains explicit rather than React-local",()=>{
  for(const label of ["무게·운반 한도","컨테이너 이동","스택 분할\/병합","캐릭터 간 전달","파티 보관함"]) assert.match(inventory,new RegExp(label));
  assert.doesNotMatch(inventory,/localStorage|sessionStorage/);
});

test("Inventory management remains responsive and uses the shared Home/Session theme tokens",()=>{
  assert.match(css,/\.character-inventory-view/);
  for(const token of ["--bg","--surface","--surface-2","--recess","--line","--accent"]) assert.match(css,new RegExp(token));
  assert.match(css,/@media \(max-width:900px\)/);
  assert.match(css,/@media \(max-width:560px\)/);
});

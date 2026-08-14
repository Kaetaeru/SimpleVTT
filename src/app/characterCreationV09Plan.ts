import type { AbilityKey, CharacterCreateDraft, CharacterCreationOptionVm, CharacterCreationPlan, CharacterCreationSection, ValidationMessage } from "./contracts";
import { BACKGROUNDS, CLASSES, FIGHTER, SPECIES, SPELLS, opt, type Option } from "./characterCreationV09Catalog";
import { acFromEquipmentPreset } from "./srdCatalogBridge";
import { META, classId, meta } from "./characterCreationV09Meta";
export { FIGHTER, META, classId, meta };

const FIGHTER_ID = "dnd.srd521.class.fighter";
const choose = (xs: Option[], value: string | string[] | undefined) => {
  const values = Array.isArray(value) ? value : [value];
  return xs.map((x) => ({ ...x, selected: values.includes(x.id) || values.includes(x.name) }));
};
const MANAGED = /종족을 선택|배경을 선택|클래스를 선택|종족 세부 선택|배경 세부 선택|전투 방식 Choice|주문 목록은 아직|주문 시전 클래스|기술 숙련|semantic map|카탈로그 ChoiceDefinition/;

export function validate(d: CharacterCreateDraft): ValidationMessage[] {
  const out = d.validation.filter((x) => !MANAGED.test(x.message));
  const id = classId(d);
  const m = meta(d);
  const selectedSpecies = SPECIES.find((entry) => entry.name === d.species);
  const selectedBackground = BACKGROUNDS.find((entry) => entry.name === d.background);
  const selectedClass = CLASSES.find((entry) => entry.name === d.className);
  const spellcasting = selectedClass?.grants.some((grant) => grant.startsWith("주문 시전")) ?? false;
  const spells = SPELLS[id] ?? [];

  if (!d.species) out.push({ severity: "blocking", message: "종족을 선택해야 합니다." });
  if (!d.background) out.push({ severity: "blocking", message: "배경을 선택해야 합니다." });
  if (!d.className) out.push({ severity: "blocking", message: "클래스를 선택해야 합니다." });
  if (selectedSpecies?.choices.length) out.push({ severity: "warning", message: `종족 세부 선택 UI 미연결: ${selectedSpecies.choices.join(", ")}` });
  if (selectedBackground?.choices.length) out.push({ severity: "warning", message: `배경 세부 선택 UI 미연결: ${selectedBackground.choices.join(", ")}` });
  if (id === FIGHTER_ID && (d.selectedClassChoices?.length ?? 0) !== 1) out.push({ severity: "blocking", message: "현재 레벨의 전투 방식 Choice를 1개 선택해야 합니다." });
  if (d.className && m.skillsMapped && d.selectedSkills.length !== m.skillCount) out.push({ severity: "blocking", message: `현재 클래스 기술 숙련은 ${m.skillCount}개가 필요합니다. 현재 ${d.selectedSkills.length}/${m.skillCount}` });
  if (d.className && !m.skillsMapped) out.push({ severity: "warning", message: "이 클래스의 기술 숙련 후보 semantic map은 아직 카탈로그에서 검토 중입니다. 데모에서는 선택을 건너뜁니다." });
  const bad = m.skillsMapped ? d.selectedSkills.filter((x) => !m.skills.includes(x)) : [];
  if (bad.length) out.push({ severity: "warning", message: `현재 클래스 후보에 없는 기술 숙련: ${bad.join(", ")}` });
  if (spells.length > 0) out.push({ severity: "warning", message: "주문 목록은 아직 SRD class spell-list mapping 전이라 DEMO fallback을 표시합니다." });
  else if (spellcasting) out.push({ severity: "warning", message: "주문 시전 클래스이지만 SRD class spell-list와 known/prepared Choice mapping이 아직 연결되지 않았습니다." });
  if (m.pendingChoices.length) out.push({ severity: "warning", message: `카탈로그 ChoiceDefinition UI 미연결: ${m.pendingChoices.join(", ")}` });
  return out;
}

export function normalize(d: CharacterCreateDraft) {
  d.activeSectionId ||= "identity";
  d.selectedClassChoices ||= [];
  if (d.level <= 1 && !d.editingCharacterId) d.subclassName = "";
  const m = meta(d);
  const dex = Math.floor((d.abilities.dex - 10) / 2);
  const con = Math.floor((d.abilities.con - 10) / 2);
  const ac = acFromEquipmentPreset(d.equipmentPreset, dex);
  d.derived = {
    proficiencyBonus: d.level >= 5 ? 3 : 2,
    hp: d.overrides.hp ?? Math.max(1, m.hit + con),
    ac: d.overrides.ac ?? ac,
    speed: d.overrides.speed ?? 30,
  };
  d.validation = validate(d);
  return d;
}

const st = (req: boolean, blocked: boolean, done: boolean, warn = false): CharacterCreationSection["status"] => blocked ? "blocked" : warn ? "warning" : !req ? "not-applicable" : done ? "complete" : "incomplete";

export function buildPlan(d: CharacterCreateDraft): CharacterCreationPlan {
  const id = classId(d);
  const m = meta(d);
  const fighter = id === FIGHTER_ID ? FIGHTER : [];
  const spells = SPELLS[id] ?? [];
  const selectedSpecies = SPECIES.find((entry) => entry.name === d.species);
  const selectedBackground = BACKGROUNDS.find((entry) => entry.name === d.background);
  const selectedClass = CLASSES.find((entry) => entry.name === d.className);
  const spellcasting = selectedClass?.grants.some((grant) => grant.startsWith("주문 시전")) ?? false;
  const v = validate(d);
  const mk = (id: string, kind: CharacterCreationSection["kind"], label: string, description: string, status: CharacterCreationSection["status"], required: boolean, dependsOn: string[], options: CharacterCreationOptionVm[] = [], automaticGrants: string[] = [], filter?: RegExp): CharacterCreationSection => ({ id, kind, label, description, status, required, dependsOn, options, automaticGrants, validation: filter ? v.filter((x) => filter.test(x.message)) : [] });
  const abilityBlock = d.validation.some((x) => x.severity === "blocking" && /배열|Roll Slot|포인트 구매/.test(x.message));
  const skillWarning = Boolean(d.className && !m.skillsMapped);
  const sections = [
    mk("rules", "rules-profile", "규칙", "규칙 의미와 호환 콘텐츠 범위를 결정합니다.", "complete", true, [], [{ ...opt(d.rulesProfileId, "D&D SRD 5.2.1", "D&D SRD 5.2.1", "현재 integration은 PR #38 builtin RuleModule catalog를 직접 읽습니다.", ["ko-KR 기본 표시", "stable content IDs"]), selected: true }], ["RulesProfile identity/version 저장"]),
    mk("identity", "identity", "정체성", "이름과 서술 정보는 규칙 선택과 분리합니다.", st(true, false, !!d.name.trim()), true, []),
    mk("species", "species", "종족", "SRD catalog의 종족을 독립적으로 선택합니다.", st(true, false, !!d.species, Boolean(selectedSpecies?.choices.length)), true, ["rules"], choose(SPECIES, d.species), selectedSpecies?.grants ?? [], /종족 세부 선택/),
    mk("background", "background", "배경", "SRD catalog의 배경 source를 선택합니다.", st(true, false, !!d.background, Boolean(selectedBackground?.choices.length)), true, ["rules"], choose(BACKGROUNDS, d.background), selectedBackground?.grants ?? [], /배경 세부 선택/),
    mk("class", "class", "클래스", "12개 SRD 클래스 정의와 시작 레벨 metadata를 catalog에서 읽습니다.", st(true, false, !!d.className), true, ["rules"], choose(CLASSES, d.className), selectedClass?.grants ?? []),
    mk("abilities", "abilities", "능력치", "현재 RulesProfile 방식으로 능력치를 생성합니다.", st(true, !d.className, !abilityBlock), true, ["class"], [], [], /배열|Roll Slot|포인트 구매|커스텀/),
    mk("proficiencies", "proficiencies", "숙련 · 언어 · 도구", skillWarning ? "이 클래스의 skill candidate semantic map은 아직 catalog review 대기입니다." : `카탈로그 semantic map에서 기술 숙련 ${m.skillCount}개를 선택합니다.`, st(true, !d.className, m.skillsMapped && d.selectedSkills.length === m.skillCount, skillWarning || d.selectedSkills.some((x) => !m.skills.includes(x))), true, ["class", "background"], m.skills.map((x) => ({ ...opt(`skill.${x}`, x, x, "검토된 class semantic map의 기술 숙련 Choice", ["기술 숙련"]), selected: d.selectedSkills.includes(x) })), [`${m.saves.join(" · ")} 내성`], /기술 숙련|semantic map/),
    mk("class-choices", "class-choices", "클래스 초기 선택", "현재 integration에서 표현 가능한 레벨 1 Choice만 표시합니다.", fighter.length ? st(true, !d.className, (d.selectedClassChoices?.length ?? 0) === 1, m.pendingChoices.length > 0) : m.pendingChoices.length ? "warning" : "not-applicable", fighter.length > 0 || m.pendingChoices.length > 0, ["class"], choose(fighter, d.selectedClassChoices), m.features, /전투 방식|ChoiceDefinition/),
    mk("equipment", "equipment", "장비", "SRD starting-loadout-definition과 stable ItemDefinition ID를 사용합니다.", m.gear.length ? st(true, !d.className, !!d.equipmentPreset) : "warning", m.gear.length > 0, ["class"], m.gear.map((g, i) => ({ ...opt(g.id, g.label, g.id, "SRD starting-loadout-definition", ["stable ItemDefinition IDs", "파생 AC 재계산"], [], i === 0), selected: d.equipmentPreset === g.id }))),
    mk("spells", "spells", "주문 · 기타 선택", spellcasting ? "이 클래스는 주문 시전 metadata를 갖습니다. class spell-list/known-prepared 연결 상태를 명시합니다." : "현재 레벨에 주문 선택이 없습니다.", spellcasting ? "warning" : "not-applicable", spellcasting, ["class"], choose(spells, d.selectedSpells), spellcasting ? [spells.length ? "DEMO fallback · Phase 08 class spell-list mapping pending" : "SRD spell-list Choice mapping pending"] : [], /주문 목록|주문 시전 클래스/),
    mk("review", "review", "검토", "Catalog source, grants, 파생값, validation을 함께 검토합니다.", v.some((x) => x.severity === "blocking") ? "incomplete" : v.some((x) => x.severity === "warning") ? "warning" : "complete", true, ["identity", "species", "background", "class", "abilities", "equipment"], [], [], /.*/)
  ];
  const recommended = sections.find((x) => x.status === "incomplete")?.id ?? "review";
  return { draftId: d.id, rulesProfileId: d.rulesProfileId, activeSectionId: sections.some((x) => x.id === d.activeSectionId) ? d.activeSectionId! : recommended, recommendedSectionId: recommended, sections, summary: { name: d.name, species: d.species, background: d.background, className: d.className, subclassName: d.subclassName || undefined, level: d.level, abilities: structuredClone(d.abilities), unresolvedCount: sections.filter((x) => ["incomplete", "blocked"].includes(x.status)).length, blockingCount: v.filter((x) => x.severity === "blocking").length, warningCount: v.filter((x) => x.severity === "warning").length }, validation: v };
}

export function recommended(d: CharacterCreateDraft) {
  const [a, b] = meta(d).rec;
  const rest = (Object.keys(d.abilities) as AbilityKey[]).filter((x) => x !== a && x !== b);
  const vals = [15, 14, 13, 12, 10, 8];
  return Object.fromEntries([a, b, ...rest].map((k, i) => [k, vals[i]])) as CharacterCreateDraft["abilities"];
}

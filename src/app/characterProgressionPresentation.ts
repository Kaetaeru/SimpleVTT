import type { CharacterCreationPlan, CharacterCreationSection, CharacterCreationSectionStatus, LevelUpDraft } from "./contracts";

export const CREATION_PRIMARY_IDS = ["identity", "species", "class", "background", "abilities", "proficiencies", "review"] as const;
export type CreationPrimaryId = (typeof CREATION_PRIMARY_IDS)[number];

const CLASS_CONTEXT_IDS = ["class-choices", "equipment", "spells"] as const;

export function creationPrimarySections(plan: CharacterCreationPlan) {
  return CREATION_PRIMARY_IDS.map((id) => plan.sections.find((section) => section.id === id)).filter((section): section is CharacterCreationSection => Boolean(section));
}

export function creationContextSections(plan: CharacterCreationPlan, primaryId: string) {
  if (primaryId !== "class") return [];
  return CLASS_CONTEXT_IDS.map((id) => plan.sections.find((section) => section.id === id)).filter((section): section is CharacterCreationSection => Boolean(section) && section.status !== "not-applicable");
}

export function creationPrimaryStatus(plan: CharacterCreationPlan, section: CharacterCreationSection): CharacterCreationSectionStatus {
  if (section.id !== "class") return section.status;
  const children = creationContextSections(plan, section.id);
  if (children.some((child) => child.status === "blocked")) return "blocked";
  if (children.some((child) => child.status === "incomplete")) return "incomplete";
  if (children.some((child) => child.status === "warning")) return "warning";
  return section.status;
}

export function nextCreationPrimaryId(plan: CharacterCreationPlan, currentId: string, direction: 1 | -1) {
  const sections = creationPrimarySections(plan);
  const index = Math.max(0, sections.findIndex((section) => section.id === currentId));
  return sections[Math.min(sections.length - 1, Math.max(0, index + direction))]?.id ?? sections[0]?.id ?? "identity";
}

export type LevelUpFocusId = "hp" | "choice" | "review";

export interface LevelUpFocusItem {
  id: LevelUpFocusId;
  label: string;
  detail: string;
  needsAttention: boolean;
}

export function levelUpFocusItems(draft: LevelUpDraft): LevelUpFocusItem[] {
  return [
    {
      id: "hp",
      label: "생명력",
      detail: `${draft.preview.maxHpBefore} → ${draft.preview.maxHpAfter}`,
      needsAttention: false,
    },
    {
      id: "choice",
      label: "능력치 또는 재주",
      detail: draft.asiMode === "feat" ? "재주 선택" : draft.asiMode === "split" ? "+1 / +1" : "+2",
      needsAttention: draft.validation.some((message) => message.severity === "blocking"),
    },
    {
      id: "review",
      label: "변경 확인",
      detail: `${draft.preview.grantedFeatures.length}개 자동 획득`,
      needsAttention: draft.validation.some((message) => message.severity === "blocking"),
    },
  ];
}

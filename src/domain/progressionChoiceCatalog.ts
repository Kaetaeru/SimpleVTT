export interface ExpertiseChoiceRelationship {
  classId: string;
  level: number;
  count: number;
  feature: "전문화";
  sourcePath: string;
}

const EXPERTISE_RELATIONSHIPS: ExpertiseChoiceRelationship[] = [
  {
    classId:"dnd.srd521.class.bard",
    level:2,
    count:2,
    feature:"전문화",
    sourcePath:"10-RULEBOOKS/integrated-2024/classes/bard.md",
  },
  {
    classId:"dnd.srd521.class.bard",
    level:9,
    count:2,
    feature:"전문화",
    sourcePath:"10-RULEBOOKS/integrated-2024/classes/bard.md",
  },
  {
    classId:"dnd.srd521.class.ranger",
    level:9,
    count:2,
    feature:"전문화",
    sourcePath:"10-RULEBOOKS/integrated-2024/classes/ranger.md",
  },
  {
    classId:"dnd.srd521.class.rogue",
    level:1,
    count:2,
    feature:"전문화",
    sourcePath:"10-RULEBOOKS/integrated-2024/classes/rogue.md",
  },
  {
    classId:"dnd.srd521.class.rogue",
    level:6,
    count:2,
    feature:"전문화",
    sourcePath:"10-RULEBOOKS/integrated-2024/classes/rogue.md",
  },
];

export function expertiseChoiceRelationship(classId: string, level: number) {
  return EXPERTISE_RELATIONSHIPS.find((relationship) => relationship.classId === classId && relationship.level === level);
}

export function expertiseChoiceRelationships() {
  return EXPERTISE_RELATIONSHIPS.map((relationship) => ({ ...relationship }));
}

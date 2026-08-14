import { CLERIC_SPELL_ROWS } from "./clericSpellList";
import { DRUID_SPELL_ROWS } from "./druidSpellList";

export interface ClassSpellListEntry {
  id: string;
  nameEn: string;
  level: number;
}

export interface ClassSpellList {
  classId: string;
  source: {
    document: "System Reference Document 5.2.1";
    page: number;
    license: "CC-BY-4.0";
  };
  spells: ClassSpellListEntry[];
}

export interface AutomaticPreparedSpellRelationship {
  classId: string;
  classLevel: number;
  spellId: string;
  nameEn: string;
  sourceFeature: string;
  subclassName?: string;
}

export function stableSpellId(nameEn: string) {
  const ascii = nameEn.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const slug = ascii.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `dnd.srd521.spell.${slug}`;
}

const spell = (id: string, nameEn: string, level: number): ClassSpellListEntry => ({ id:`dnd.srd521.spell.${id}`, nameEn, level });
const spellByName = (nameEn: string, level: number): ClassSpellListEntry => ({ id:stableSpellId(nameEn), nameEn, level });
const spellId = (id: string) => `dnd.srd521.spell.${id}`;

const CLERIC: ClassSpellList = {
  classId:"dnd.srd521.class.cleric",
  source:{ document:"System Reference Document 5.2.1", page:38, license:"CC-BY-4.0" },
  spells:CLERIC_SPELL_ROWS.map(([nameEn, level]) => spellByName(nameEn, level)),
};

const DRUID: ClassSpellList = {
  classId:"dnd.srd521.class.druid",
  source:{ document:"System Reference Document 5.2.1", page:44, license:"CC-BY-4.0" },
  spells:DRUID_SPELL_ROWS.map(([nameEn, level]) => spellByName(nameEn, level)),
};

const RANGER: ClassSpellList = {
  classId:"dnd.srd521.class.ranger",
  source:{ document:"System Reference Document 5.2.1", page:60, license:"CC-BY-4.0" },
  spells:[
    spell("alarm","Alarm",1), spell("animal-friendship","Animal Friendship",1), spell("cure-wounds","Cure Wounds",1),
    spell("detect-magic","Detect Magic",1), spell("detect-poison-and-disease","Detect Poison and Disease",1),
    spell("ensnaring-strike","Ensnaring Strike",1), spell("entangle","Entangle",1), spell("fog-cloud","Fog Cloud",1),
    spell("goodberry","Goodberry",1), spell("hunter-s-mark","Hunter's Mark",1), spell("jump","Jump",1),
    spell("longstrider","Longstrider",1), spell("speak-with-animals","Speak with Animals",1),

    spell("aid","Aid",2), spell("animal-messenger","Animal Messenger",2), spell("barkskin","Barkskin",2),
    spell("darkvision","Darkvision",2), spell("enhance-ability","Enhance Ability",2), spell("find-traps","Find Traps",2),
    spell("gust-of-wind","Gust of Wind",2), spell("lesser-restoration","Lesser Restoration",2),
    spell("locate-animals-or-plants","Locate Animals or Plants",2), spell("locate-object","Locate Object",2),
    spell("magic-weapon","Magic Weapon",2), spell("pass-without-trace","Pass without Trace",2),
    spell("protection-from-poison","Protection from Poison",2), spell("silence","Silence",2), spell("spike-growth","Spike Growth",2),

    spell("conjure-animals","Conjure Animals",3), spell("daylight","Daylight",3), spell("dispel-magic","Dispel Magic",3),
    spell("meld-into-stone","Meld into Stone",3), spell("nondetection","Nondetection",3), spell("plant-growth","Plant Growth",3),
    spell("protection-from-energy","Protection from Energy",3), spell("revivify","Revivify",3),
    spell("speak-with-plants","Speak with Plants",3), spell("water-breathing","Water Breathing",3),
    spell("water-walk","Water Walk",3), spell("wind-wall","Wind Wall",3),

    spell("conjure-woodland-beings","Conjure Woodland Beings",4), spell("dominate-beast","Dominate Beast",4),
    spell("freedom-of-movement","Freedom of Movement",4), spell("locate-creature","Locate Creature",4), spell("stoneskin","Stoneskin",4),

    spell("commune-with-nature","Commune with Nature",5), spell("greater-restoration","Greater Restoration",5), spell("tree-stride","Tree Stride",5),
  ],
};

const PALADIN: ClassSpellList = {
  classId:"dnd.srd521.class.paladin",
  source:{ document:"System Reference Document 5.2.1", page:55, license:"CC-BY-4.0" },
  spells:[
    spell("bless","Bless",1), spell("command","Command",1), spell("cure-wounds","Cure Wounds",1),
    spell("detect-evil-and-good","Detect Evil and Good",1), spell("detect-magic","Detect Magic",1),
    spell("detect-poison-and-disease","Detect Poison and Disease",1), spell("divine-favor","Divine Favor",1),
    spell("divine-smite","Divine Smite",1), spell("heroism","Heroism",1),
    spell("protection-from-evil-and-good","Protection from Evil and Good",1), spell("purify-food-and-drink","Purify Food and Drink",1),
    spell("searing-smite","Searing Smite",1), spell("shield-of-faith","Shield of Faith",1),

    spell("aid","Aid",2), spell("find-steed","Find Steed",2), spell("gentle-repose","Gentle Repose",2),
    spell("lesser-restoration","Lesser Restoration",2), spell("locate-object","Locate Object",2), spell("magic-weapon","Magic Weapon",2),
    spell("prayer-of-healing","Prayer of Healing",2), spell("protection-from-poison","Protection from Poison",2),
    spell("shining-smite","Shining Smite",2), spell("warding-bond","Warding Bond",2), spell("zone-of-truth","Zone of Truth",2),

    spell("create-food-and-water","Create Food and Water",3), spell("daylight","Daylight",3), spell("dispel-magic","Dispel Magic",3),
    spell("magic-circle","Magic Circle",3), spell("remove-curse","Remove Curse",3), spell("revivify","Revivify",3),

    spell("aura-of-life","Aura of Life",4), spell("banishment","Banishment",4), spell("death-ward","Death Ward",4), spell("locate-creature","Locate Creature",4),

    spell("dispel-evil-and-good","Dispel Evil and Good",5), spell("geas","Geas",5), spell("greater-restoration","Greater Restoration",5), spell("raise-dead","Raise Dead",5),
  ],
};

const LISTS = new Map<string, ClassSpellList>([
  [CLERIC.classId, CLERIC],
  [DRUID.classId, DRUID],
  [RANGER.classId, RANGER],
  [PALADIN.classId, PALADIN],
]);

const AUTOMATIC_PREPARED: AutomaticPreparedSpellRelationship[] = [
  {
    classId:"dnd.srd521.class.ranger",
    classLevel:1,
    spellId:spellId("hunter-s-mark"),
    nameEn:"Hunter's Mark",
    sourceFeature:"주적",
  },
  {
    classId:"dnd.srd521.class.druid",
    classLevel:1,
    spellId:stableSpellId("Speak with Animals"),
    nameEn:"Speak with Animals",
    sourceFeature:"드루이드어",
  },
  {
    classId:"dnd.srd521.class.paladin",
    classLevel:2,
    spellId:spellId("divine-smite"),
    nameEn:"Divine Smite",
    sourceFeature:"팔라딘의 강타",
  },
  {
    classId:"dnd.srd521.class.paladin",
    classLevel:5,
    spellId:spellId("find-steed"),
    nameEn:"Find Steed",
    sourceFeature:"충직한 군마",
  },
  ...[
    [3,"Aid"], [3,"Bless"], [3,"Cure Wounds"], [3,"Lesser Restoration"],
    [5,"Mass Healing Word"], [5,"Revivify"],
    [7,"Aura of Life"], [7,"Death Ward"],
    [9,"Greater Restoration"], [9,"Mass Cure Wounds"],
  ].map(([classLevel, nameEn]) => ({
    classId:"dnd.srd521.class.cleric",
    classLevel:Number(classLevel),
    spellId:stableSpellId(String(nameEn)),
    nameEn:String(nameEn),
    sourceFeature:"생명 권역 주문",
  })),
];

export function classSpellList(classId: string) {
  const list = LISTS.get(classId);
  return list ? { ...list, source:{ ...list.source }, spells:list.spells.map((entry) => ({ ...entry })) } : undefined;
}

export function classSpellListEntries(classId: string, maxLevel?: number) {
  const list = LISTS.get(classId);
  if (!list) return [];
  return list.spells
    .filter((entry) => entry.level >= 1 && (maxLevel === undefined || entry.level <= maxLevel))
    .map((entry) => ({ ...entry }));
}

export function classCantripListEntries(classId: string) {
  const list = LISTS.get(classId);
  if (!list) return [];
  return list.spells.filter((entry) => entry.level === 0).map((entry) => ({ ...entry }));
}

export function classSpellListAllEntries(classId: string) {
  const list = LISTS.get(classId);
  return list ? list.spells.map((entry) => ({ ...entry })) : [];
}

export function automaticPreparedSpellsForLevel(classId: string, classLevel: number, subclassName?: string) {
  return AUTOMATIC_PREPARED
    .filter((entry) => entry.classId === classId && entry.classLevel === classLevel && (!entry.subclassName || entry.subclassName === subclassName))
    .map((entry) => ({ ...entry }));
}

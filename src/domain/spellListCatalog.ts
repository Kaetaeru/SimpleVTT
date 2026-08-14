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

const spell = (id: string, nameEn: string, level: number): ClassSpellListEntry => ({ id:`dnd.srd521.spell.${id}`, nameEn, level });

const RANGER: ClassSpellList = {
  classId:"dnd.srd521.class.ranger",
  source:{ document:"System Reference Document 5.2.1", page:60, license:"CC-BY-4.0" },
  spells:[
    spell("alarm","Alarm",1),
    spell("animal-friendship","Animal Friendship",1),
    spell("cure-wounds","Cure Wounds",1),
    spell("detect-magic","Detect Magic",1),
    spell("detect-poison-and-disease","Detect Poison and Disease",1),
    spell("ensnaring-strike","Ensnaring Strike",1),
    spell("entangle","Entangle",1),
    spell("fog-cloud","Fog Cloud",1),
    spell("goodberry","Goodberry",1),
    spell("hunter-s-mark","Hunter's Mark",1),
    spell("jump","Jump",1),
    spell("longstrider","Longstrider",1),
    spell("speak-with-animals","Speak with Animals",1),

    spell("aid","Aid",2),
    spell("animal-messenger","Animal Messenger",2),
    spell("barkskin","Barkskin",2),
    spell("darkvision","Darkvision",2),
    spell("enhance-ability","Enhance Ability",2),
    spell("find-traps","Find Traps",2),
    spell("gust-of-wind","Gust of Wind",2),
    spell("lesser-restoration","Lesser Restoration",2),
    spell("locate-animals-or-plants","Locate Animals or Plants",2),
    spell("locate-object","Locate Object",2),
    spell("magic-weapon","Magic Weapon",2),
    spell("pass-without-trace","Pass without Trace",2),
    spell("protection-from-poison","Protection from Poison",2),
    spell("silence","Silence",2),
    spell("spike-growth","Spike Growth",2),

    spell("conjure-animals","Conjure Animals",3),
    spell("daylight","Daylight",3),
    spell("dispel-magic","Dispel Magic",3),
    spell("meld-into-stone","Meld into Stone",3),
    spell("nondetection","Nondetection",3),
    spell("plant-growth","Plant Growth",3),
    spell("protection-from-energy","Protection from Energy",3),
    spell("revivify","Revivify",3),
    spell("speak-with-plants","Speak with Plants",3),
    spell("water-breathing","Water Breathing",3),
    spell("water-walk","Water Walk",3),
    spell("wind-wall","Wind Wall",3),

    spell("conjure-woodland-beings","Conjure Woodland Beings",4),
    spell("dominate-beast","Dominate Beast",4),
    spell("freedom-of-movement","Freedom of Movement",4),
    spell("locate-creature","Locate Creature",4),
    spell("stoneskin","Stoneskin",4),

    spell("commune-with-nature","Commune with Nature",5),
    spell("greater-restoration","Greater Restoration",5),
    spell("tree-stride","Tree Stride",5),
  ],
};

const LISTS = new Map<string, ClassSpellList>([[RANGER.classId, RANGER]]);

export function classSpellList(classId: string) {
  const list = LISTS.get(classId);
  return list ? { ...list, source:{ ...list.source }, spells:list.spells.map((entry) => ({ ...entry })) } : undefined;
}

export function classSpellListEntries(classId: string, maxLevel?: number) {
  const list = LISTS.get(classId);
  if (!list) return [];
  return list.spells.filter((entry) => maxLevel === undefined || entry.level <= maxLevel).map((entry) => ({ ...entry }));
}

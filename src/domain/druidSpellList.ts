// System Reference Document 5.2.1, Druid Spell List (pages 44-45).
// Membership only; stable spell IDs are derived centrally in spellListCatalog.ts.
export const DRUID_SPELL_ROWS: ReadonlyArray<readonly [nameEn: string, level: number]> = [
  ["Druidcraft",0], ["Elementalism",0], ["Guidance",0], ["Mending",0], ["Message",0], ["Poison Spray",0],
  ["Produce Flame",0], ["Resistance",0], ["Shillelagh",0], ["Spare the Dying",0], ["Starry Wisp",0],

  ["Animal Friendship",1], ["Charm Person",1], ["Create or Destroy Water",1], ["Cure Wounds",1], ["Detect Magic",1],
  ["Detect Poison and Disease",1], ["Entangle",1], ["Faerie Fire",1], ["Fog Cloud",1], ["Goodberry",1],
  ["Healing Word",1], ["Ice Knife",1], ["Jump",1], ["Longstrider",1], ["Protection from Evil and Good",1],
  ["Purify Food and Drink",1], ["Speak with Animals",1], ["Thunderwave",1],

  ["Aid",2], ["Animal Messenger",2], ["Augury",2], ["Barkskin",2], ["Continual Flame",2], ["Darkvision",2],
  ["Enhance Ability",2], ["Enlarge/Reduce",2], ["Find Traps",2], ["Flame Blade",2], ["Flaming Sphere",2],
  ["Gust of Wind",2], ["Heat Metal",2], ["Hold Person",2], ["Lesser Restoration",2], ["Locate Animals or Plants",2],
  ["Locate Object",2], ["Moonbeam",2], ["Pass without Trace",2], ["Protection from Poison",2], ["Spike Growth",2],

  ["Call Lightning",3], ["Conjure Animals",3], ["Daylight",3], ["Dispel Magic",3], ["Meld into Stone",3],
  ["Plant Growth",3], ["Protection from Energy",3], ["Revivify",3], ["Sleet Storm",3], ["Speak with Plants",3],
  ["Water Breathing",3], ["Water Walk",3], ["Wind Wall",3],

  ["Blight",4], ["Charm Monster",4], ["Confusion",4], ["Conjure Minor Elementals",4], ["Conjure Woodland Beings",4],
  ["Control Water",4], ["Divination",4], ["Dominate Beast",4], ["Fire Shield",4], ["Freedom of Movement",4],
  ["Giant Insect",4], ["Hallucinatory Terrain",4], ["Ice Storm",4], ["Locate Creature",4], ["Polymorph",4],
  ["Stone Shape",4], ["Stoneskin",4], ["Wall of Fire",4],

  ["Antilife Shell",5], ["Awaken",5], ["Commune with Nature",5], ["Cone of Cold",5], ["Conjure Elemental",5],
  ["Contagion",5], ["Geas",5], ["Greater Restoration",5], ["Insect Plague",5], ["Mass Cure Wounds",5],
  ["Planar Binding",5], ["Reincarnate",5], ["Scrying",5], ["Tree Stride",5], ["Wall of Stone",5],

  ["Conjure Fey",6], ["Find the Path",6], ["Flesh to Stone",6], ["Heal",6], ["Heroes' Feast",6],
  ["Move Earth",6], ["Sunbeam",6], ["Transport via Plants",6], ["Wall of Thorns",6], ["Wind Walk",6],

  ["Fire Storm",7], ["Mirage Arcane",7], ["Plane Shift",7], ["Regenerate",7], ["Reverse Gravity",7], ["Symbol",7],

  ["Animal Shapes",8], ["Antipathy/Sympathy",8], ["Befuddlement",8], ["Control Weather",8], ["Earthquake",8],
  ["Incendiary Cloud",8], ["Sunburst",8], ["Tsunami",8],

  ["Foresight",9], ["Shapechange",9], ["Storm of Vengeance",9], ["True Resurrection",9],
];

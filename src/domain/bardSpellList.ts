// System Reference Document 5.2.1, Bard Spell List (pages 33-34).
// Membership only; stable spell IDs are derived centrally in spellListCatalog.ts.
export const BARD_SPELL_ROWS: ReadonlyArray<readonly [nameEn: string, level: number]> = [
  ["Dancing Lights",0], ["Light",0], ["Mage Hand",0], ["Mending",0], ["Message",0],
  ["Minor Illusion",0], ["Prestidigitation",0], ["Starry Wisp",0], ["True Strike",0], ["Vicious Mockery",0],

  ["Animal Friendship",1], ["Bane",1], ["Charm Person",1], ["Color Spray",1], ["Command",1],
  ["Comprehend Languages",1], ["Cure Wounds",1], ["Detect Magic",1], ["Disguise Self",1], ["Dissonant Whispers",1],
  ["Faerie Fire",1], ["Feather Fall",1], ["Healing Word",1], ["Heroism",1], ["Hideous Laughter",1],
  ["Identify",1], ["Illusory Script",1], ["Longstrider",1], ["Silent Image",1], ["Sleep",1],
  ["Speak with Animals",1], ["Thunderwave",1], ["Unseen Servant",1],

  ["Aid",2], ["Animal Messenger",2], ["Blindness/Deafness",2], ["Calm Emotions",2], ["Detect Thoughts",2],
  ["Enhance Ability",2], ["Enlarge/Reduce",2], ["Enthrall",2], ["Heat Metal",2], ["Hold Person",2],
  ["Invisibility",2], ["Knock",2], ["Lesser Restoration",2], ["Locate Animals or Plants",2], ["Locate Object",2],
  ["Magic Mouth",2], ["Mirror Image",2], ["See Invisibility",2], ["Shatter",2], ["Silence",2],
  ["Suggestion",2], ["Zone of Truth",2],

  ["Bestow Curse",3], ["Clairvoyance",3], ["Dispel Magic",3], ["Fear",3], ["Glyph of Warding",3],
  ["Hypnotic Pattern",3], ["Major Image",3], ["Mass Healing Word",3], ["Nondetection",3], ["Plant Growth",3],
  ["Sending",3], ["Slow",3], ["Speak with Dead",3], ["Speak with Plants",3], ["Stinking Cloud",3],
  ["Tiny Hut",3], ["Tongues",3],

  ["Charm Monster",4], ["Compulsion",4], ["Confusion",4], ["Dimension Door",4], ["Freedom of Movement",4],
  ["Greater Invisibility",4], ["Hallucinatory Terrain",4], ["Locate Creature",4], ["Phantasmal Killer",4], ["Polymorph",4],

  ["Animate Objects",5], ["Awaken",5], ["Dominate Person",5], ["Dream",5], ["Geas",5],
  ["Greater Restoration",5], ["Hold Monster",5], ["Legend Lore",5], ["Mass Cure Wounds",5], ["Mislead",5],
  ["Modify Memory",5], ["Planar Binding",5], ["Raise Dead",5], ["Scrying",5], ["Seeming",5],
  ["Telepathic Bond",5], ["Teleportation Circle",5],

  ["Eyebite",6], ["Find the Path",6], ["Guards and Wards",6], ["Heroes' Feast",6],
  ["Irresistible Dance",6], ["Mass Suggestion",6], ["Programmed Illusion",6], ["True Seeing",6],

  ["Arcane Sword",7], ["Etherealness",7], ["Forcecage",7], ["Magnificent Mansion",7], ["Mirage Arcane",7],
  ["Prismatic Spray",7], ["Project Image",7], ["Regenerate",7], ["Resurrection",7], ["Symbol",7], ["Teleport",7],

  ["Antipathy/Sympathy",8], ["Befuddlement",8], ["Dominate Monster",8], ["Glibness",8], ["Mind Blank",8], ["Power Word Stun",8],

  ["Foresight",9], ["Power Word Heal",9], ["Power Word Kill",9], ["Prismatic Wall",9], ["True Polymorph",9],
];

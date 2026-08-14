// System Reference Document 5.2.1, Wizard Spell List (pages 79-82).
// Membership only; stable spell IDs are derived centrally in spellListCatalog.ts.
export const WIZARD_SPELL_ROWS: ReadonlyArray<readonly [nameEn: string, level: number]> = [
  ["Acid Splash",0], ["Chill Touch",0], ["Dancing Lights",0], ["Elementalism",0], ["Fire Bolt",0],
  ["Light",0], ["Mage Hand",0], ["Mending",0], ["Message",0], ["Minor Illusion",0], ["Poison Spray",0],
  ["Prestidigitation",0], ["Ray of Frost",0], ["Shocking Grasp",0], ["True Strike",0],

  ["Alarm",1], ["Burning Hands",1], ["Charm Person",1], ["Chromatic Orb",1], ["Color Spray",1],
  ["Comprehend Languages",1], ["Detect Magic",1], ["Disguise Self",1], ["Expeditious Retreat",1], ["False Life",1],
  ["Feather Fall",1], ["Find Familiar",1], ["Floating Disk",1], ["Fog Cloud",1], ["Grease",1],
  ["Hideous Laughter",1], ["Ice Knife",1], ["Identify",1], ["Illusory Script",1], ["Jump",1],
  ["Longstrider",1], ["Mage Armor",1], ["Magic Missile",1], ["Protection from Evil and Good",1], ["Ray of Sickness",1],
  ["Shield",1], ["Silent Image",1], ["Sleep",1], ["Thunderwave",1], ["Unseen Servant",1],

  ["Acid Arrow",2], ["Alter Self",2], ["Arcane Lock",2], ["Arcanist’s Magic Aura",2], ["Augury",2],
  ["Blindness/Deafness",2], ["Blur",2], ["Continual Flame",2], ["Darkness",2], ["Darkvision",2],
  ["Detect Thoughts",2], ["Dragon’s Breath",2], ["Enhance Ability",2], ["Enlarge/Reduce",2], ["Flaming Sphere",2],
  ["Gentle Repose",2], ["Gust of Wind",2], ["Hold Person",2], ["Invisibility",2], ["Knock",2], ["Levitate",2],
  ["Locate Object",2], ["Magic Mouth",2], ["Magic Weapon",2], ["Mind Spike",2], ["Mirror Image",2], ["Misty Step",2],
  ["Ray of Enfeeblement",2], ["Rope Trick",2], ["Scorching Ray",2], ["See Invisibility",2], ["Shatter",2],
  ["Spider Climb",2], ["Suggestion",2], ["Web",2],

  ["Animate Dead",3], ["Bestow Curse",3], ["Blink",3], ["Clairvoyance",3], ["Counterspell",3], ["Dispel Magic",3],
  ["Fear",3], ["Fireball",3], ["Fly",3], ["Gaseous Form",3], ["Glyph of Warding",3], ["Haste",3],
  ["Hypnotic Pattern",3], ["Lightning Bolt",3], ["Magic Circle",3], ["Major Image",3], ["Nondetection",3],
  ["Phantom Steed",3], ["Protection from Energy",3], ["Remove Curse",3], ["Sending",3], ["Sleet Storm",3],
  ["Slow",3], ["Speak with Dead",3], ["Stinking Cloud",3], ["Tiny Hut",3], ["Tongues",3], ["Vampiric Touch",3], ["Water Breathing",3],

  ["Arcane Eye",4], ["Banishment",4], ["Black Tentacles",4], ["Blight",4], ["Charm Monster",4], ["Confusion",4],
  ["Conjure Minor Elementals",4], ["Control Water",4], ["Dimension Door",4], ["Divination",4], ["Fabricate",4],
  ["Faithful Hound",4], ["Fire Shield",4], ["Greater Invisibility",4], ["Hallucinatory Terrain",4], ["Ice Storm",4],
  ["Locate Creature",4], ["Phantasmal Killer",4], ["Polymorph",4], ["Private Sanctum",4], ["Resilient Sphere",4],
  ["Secret Chest",4], ["Stone Shape",4], ["Stoneskin",4], ["Vitriolic Sphere",4], ["Wall of Fire",4],

  ["Animate Objects",5], ["Arcane Hand",5], ["Cloudkill",5], ["Cone of Cold",5], ["Conjure Elemental",5],
  ["Contact Other Plane",5], ["Creation",5], ["Dominate Person",5], ["Dream",5], ["Geas",5], ["Hold Monster",5],
  ["Legend Lore",5], ["Mislead",5], ["Modify Memory",5], ["Passwall",5], ["Planar Binding",5], ["Scrying",5],
  ["Seeming",5], ["Summon Dragon",5], ["Telekinesis",5], ["Telepathic Bond",5], ["Teleportation Circle",5],
  ["Wall of Force",5], ["Wall of Stone",5],

  ["Chain Lightning",6], ["Circle of Death",6], ["Contingency",6], ["Create Undead",6], ["Disintegrate",6],
  ["Eyebite",6], ["Flesh to Stone",6], ["Freezing Sphere",6], ["Globe of Invulnerability",6], ["Guards and Wards",6],
  ["Instant Summons",6], ["Irresistible Dance",6], ["Magic Jar",6], ["Mass Suggestion",6], ["Move Earth",6],
  ["Programmed Illusion",6], ["Sunbeam",6], ["True Seeing",6], ["Wall of Ice",6],

  ["Arcane Sword",7], ["Delayed Blast Fireball",7], ["Etherealness",7], ["Finger of Death",7], ["Forcecage",7],
  ["Magnificent Mansion",7], ["Mirage Arcane",7], ["Plane Shift",7], ["Prismatic Spray",7], ["Project Image",7],
  ["Reverse Gravity",7], ["Sequester",7], ["Simulacrum",7], ["Symbol",7], ["Teleport",7],

  ["Antimagic Field",8], ["Antipathy/Sympathy",8], ["Befuddlement",8], ["Clone",8], ["Control Weather",8],
  ["Demiplane",8], ["Dominate Monster",8], ["Incendiary Cloud",8], ["Maze",8], ["Mind Blank",8],
  ["Power Word Stun",8], ["Sunburst",8],

  ["Astral Projection",9], ["Foresight",9], ["Gate",9], ["Imprisonment",9], ["Meteor Swarm",9],
  ["Power Word Kill",9], ["Prismatic Wall",9], ["Shapechange",9], ["Time Stop",9], ["True Polymorph",9],
  ["Weird",9], ["Wish",9],
];

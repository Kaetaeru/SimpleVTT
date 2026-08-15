// System Reference Document 5.2.1, Sorcerer Spell List (pages 67-69).
// Membership only; stable spell IDs are derived centrally in spellListCatalog.ts.
export const SORCERER_SPELL_ROWS: ReadonlyArray<readonly [nameEn: string, level: number]> = [
  ["Acid Splash",0], ["Chill Touch",0], ["Dancing Lights",0], ["Elementalism",0], ["Fire Bolt",0],
  ["Light",0], ["Mage Hand",0], ["Mending",0], ["Message",0], ["Minor Illusion",0], ["Poison Spray",0],
  ["Prestidigitation",0], ["Ray of Frost",0], ["Shocking Grasp",0], ["Sorcerous Burst",0], ["True Strike",0],

  ["Burning Hands",1], ["Charm Person",1], ["Chromatic Orb",1], ["Color Spray",1], ["Comprehend Languages",1],
  ["Detect Magic",1], ["Disguise Self",1], ["Expeditious Retreat",1], ["False Life",1], ["Feather Fall",1],
  ["Fog Cloud",1], ["Grease",1], ["Ice Knife",1], ["Jump",1], ["Mage Armor",1], ["Magic Missile",1],
  ["Ray of Sickness",1], ["Shield",1], ["Silent Image",1], ["Sleep",1], ["Thunderwave",1],

  ["Alter Self",2], ["Blindness/Deafness",2], ["Blur",2], ["Darkness",2], ["Darkvision",2], ["Detect Thoughts",2],
  ["Dragon's Breath",2], ["Enhance Ability",2], ["Enlarge/Reduce",2], ["Flame Blade",2], ["Flaming Sphere",2],
  ["Gust of Wind",2], ["Hold Person",2], ["Invisibility",2], ["Knock",2], ["Levitate",2], ["Magic Weapon",2],
  ["Mirror Image",2], ["Misty Step",2], ["Scorching Ray",2], ["See Invisibility",2], ["Shatter",2],
  ["Spider Climb",2], ["Suggestion",2], ["Web",2],

  ["Blink",3], ["Clairvoyance",3], ["Counterspell",3], ["Daylight",3], ["Dispel Magic",3], ["Fear",3],
  ["Fireball",3], ["Fly",3], ["Gaseous Form",3], ["Haste",3], ["Hypnotic Pattern",3], ["Lightning Bolt",3],
  ["Major Image",3], ["Protection from Energy",3], ["Sleet Storm",3], ["Slow",3], ["Stinking Cloud",3],
  ["Tongues",3], ["Vampiric Touch",3], ["Water Breathing",3], ["Water Walk",3],

  ["Banishment",4], ["Blight",4], ["Charm Monster",4], ["Confusion",4], ["Dimension Door",4], ["Dominate Beast",4],
  ["Fire Shield",4], ["Greater Invisibility",4], ["Ice Storm",4], ["Polymorph",4], ["Stoneskin",4],
  ["Vitriolic Sphere",4], ["Wall of Fire",4],

  ["Animate Objects",5], ["Arcane Hand",5], ["Cloudkill",5], ["Cone of Cold",5], ["Creation",5], ["Dominate Person",5],
  ["Hold Monster",5], ["Insect Plague",5], ["Seeming",5], ["Telekinesis",5], ["Teleportation Circle",5], ["Wall of Stone",5],

  ["Chain Lightning",6], ["Circle of Death",6], ["Disintegrate",6], ["Eyebite",6], ["Flesh to Stone",6],
  ["Freezing Sphere",6], ["Globe of Invulnerability",6], ["Mass Suggestion",6], ["Move Earth",6], ["Sunbeam",6], ["True Seeing",6],

  ["Delayed Blast Fireball",7], ["Etherealness",7], ["Finger of Death",7], ["Fire Storm",7], ["Plane Shift",7],
  ["Prismatic Spray",7], ["Reverse Gravity",7], ["Teleport",7],

  ["Demiplane",8], ["Dominate Monster",8], ["Earthquake",8], ["Incendiary Cloud",8], ["Power Word Stun",8], ["Sunburst",8],

  ["Gate",9], ["Meteor Swarm",9], ["Power Word Kill",9], ["Time Stop",9], ["Wish",9],
];

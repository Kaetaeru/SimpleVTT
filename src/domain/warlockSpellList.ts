// System Reference Document 5.2.1, Warlock Spell List (pages 74-76).
// Membership only; stable spell IDs are derived centrally in spellListCatalog.ts.
export const WARLOCK_SPELL_ROWS: ReadonlyArray<readonly [nameEn: string, level: number]> = [
  ["Chill Touch",0], ["Eldritch Blast",0], ["Mage Hand",0], ["Minor Illusion",0], ["Poison Spray",0],
  ["Prestidigitation",0], ["True Strike",0],

  ["Bane",1], ["Charm Person",1], ["Comprehend Languages",1], ["Detect Magic",1], ["Expeditious Retreat",1],
  ["Hellish Rebuke",1], ["Hex",1], ["Hideous Laughter",1], ["Illusory Script",1],
  ["Protection from Evil and Good",1], ["Speak with Animals",1], ["Unseen Servant",1],

  ["Darkness",2], ["Enthrall",2], ["Hold Person",2], ["Invisibility",2], ["Mind Spike",2],
  ["Mirror Image",2], ["Misty Step",2], ["Ray of Enfeeblement",2], ["Spider Climb",2], ["Suggestion",2],

  ["Counterspell",3], ["Dispel Magic",3], ["Fear",3], ["Fly",3], ["Gaseous Form",3],
  ["Hypnotic Pattern",3], ["Magic Circle",3], ["Major Image",3], ["Remove Curse",3], ["Tongues",3], ["Vampiric Touch",3],

  ["Banishment",4], ["Blight",4], ["Charm Monster",4], ["Dimension Door",4], ["Hallucinatory Terrain",4],

  ["Contact Other Plane",5], ["Dream",5], ["Hold Monster",5], ["Mislead",5], ["Planar Binding",5],
  ["Scrying",5], ["Teleportation Circle",5],

  ["Circle of Death",6], ["Create Undead",6], ["Eyebite",6], ["True Seeing",6],

  ["Etherealness",7], ["Finger of Death",7], ["Forcecage",7], ["Plane Shift",7],

  ["Befuddlement",8], ["Demiplane",8], ["Dominate Monster",8], ["Glibness",8], ["Power Word Stun",8],

  ["Astral Projection",9], ["Foresight",9], ["Gate",9], ["Imprisonment",9], ["Power Word Kill",9],
  ["True Polymorph",9], ["Weird",9],
];

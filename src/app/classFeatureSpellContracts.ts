import "./progressionContracts";

declare module "./contracts" {
  interface CharacterSheet {
    featureSpellResourceIds?: Record<string,string>;
    featureSpellSources?: Record<string,string>;
  }
}

export {};

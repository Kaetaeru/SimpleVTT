import rawCatalog from "../generated/spellExecutionCatalog.generated.json";
import type { SpellMechanicDefinition } from "./spellcasting";

const DEFINITIONS=(rawCatalog as {definitions:SpellMechanicDefinition[]}).definitions;
const BY_ID=new Map(DEFINITIONS.map((definition)=>[definition.spellId,definition]));

export const NORMALIZED_SPELL_EXECUTION_COUNT=DEFINITIONS.length;

/** Definitions supplied by installed content (X1-04); replaced wholesale on every composition. Builtin ids cannot be overridden. */
const EXTERNAL=new Map<string,SpellMechanicDefinition>();

export function registerExternalSpellDefinitions(definitions:SpellMechanicDefinition[]) {
  EXTERNAL.clear();
  for(const definition of definitions){
    if(BY_ID.has(definition.spellId))continue;
    EXTERNAL.set(definition.spellId,structuredClone(definition));
  }
}

export function externalSpellDefinitionIds() {
  return [...EXTERNAL.keys()];
}

export function normalizedSpellDefinitionById(spellId:string) {
  const definition=BY_ID.get(spellId)??EXTERNAL.get(spellId);
  return definition?structuredClone(definition):undefined;
}

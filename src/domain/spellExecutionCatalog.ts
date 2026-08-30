import rawCatalog from "../generated/spellExecutionCatalog.generated.json";
import type { SpellMechanicDefinition } from "./spellcasting";

const DEFINITIONS=(rawCatalog as {definitions:SpellMechanicDefinition[]}).definitions;
const BY_ID=new Map(DEFINITIONS.map((definition)=>[definition.spellId,definition]));

export const NORMALIZED_SPELL_EXECUTION_COUNT=DEFINITIONS.length;

export function normalizedSpellDefinitionById(spellId:string) {
  const definition=BY_ID.get(spellId);
  return definition?structuredClone(definition):undefined;
}

import type { InstalledCatalogEntryV1 } from "./installedContentContracts";
import { installedSpellClassKey, type InstalledSpellDefinitionV1 } from "./installedSpellDefinition";
import type { SpellPresentation } from "./spellPresentation";
import type { SpellMechanicDefinition } from "../domain/spellcasting";
import { registerExternalSpellDefinitions } from "../domain/spellExecutionCatalog";

/**
 * Installed (add-on) spells join the builtin spell catalog at runtime: their `spell-definition` becomes a
 * presentation record, their `spell-mechanic` an executable definition registered with the spell execution
 * catalog, and their class lists feed creation spell options. The installed-content owner replaces the whole
 * set on every composition, exactly like installed backgrounds.
 */
export interface InstalledSpellRecord {
  contentId:string;
  presentation:SpellPresentation;
  definition:InstalledSpellDefinitionV1;
  mechanic?:SpellMechanicDefinition;
  source:string;
}

const records=new Map<string,InstalledSpellRecord>();

export function installedSpellRecords():InstalledSpellRecord[] {
  return [...records.values()];
}

export function installedSpellPresentationById(spellId:string):SpellPresentation|undefined {
  return records.get(spellId)?.presentation;
}

export function installedSpellRecordById(spellId:string):InstalledSpellRecord|undefined {
  return records.get(spellId);
}

/** Installed spells on the class's list at the given level (creation offers levels 0 and 1). */
export function installedSpellsForClass(classId:string,level:number):InstalledSpellRecord[] {
  const key=installedSpellClassKey(classId);
  return installedSpellRecords().filter((record)=>record.definition.level===level&&(record.definition.classes??[]).some((entry)=>installedSpellClassKey(entry)===key));
}

export function setInstalledSpellEntries(entries:InstalledCatalogEntryV1[]) {
  records.clear();
  for(const entry of entries){
    if(entry.category!=="spell")continue;
    const definition=(entry.mechanics??[]).find((mechanic)=>mechanic.kind==="spell-definition");
    if(!definition||definition.kind!=="spell-definition")continue;
    const mechanic=(entry.mechanics??[]).find((candidate)=>candidate.kind==="spell-mechanic");
    const config=definition.config;
    const summary=config.summary??entry.description;
    records.set(entry.contentId,{
      contentId:entry.contentId,
      definition:config,
      source:entry.source,
      mechanic:mechanic&&mechanic.kind==="spell-mechanic"?structuredClone(mechanic.config):undefined,
      presentation:{
        id:entry.contentId,name:entry.nameKo||entry.nameEn,nameEn:entry.nameEn||entry.nameKo,level:config.level,school:config.school,ritual:config.ritual,
        castingTime:config.castingTimeText,range:config.rangeText,components:config.componentsText,duration:config.durationText,
        summary,description:summary,
      },
    });
  }
  registerExternalSpellDefinitions(installedSpellRecords().flatMap((record)=>record.mechanic?[record.mechanic]:[]));
}

export function clearInstalledSpellEntriesForTests() {
  setInstalledSpellEntries([]);
}

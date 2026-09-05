import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import "../src/app/offlineRuntimeAdapters";
import "../src/app/characterCreationV10Adapter";
import "../src/app/progressionContracts";
import { MockAdapter } from "../src/app/mockAdapter";
import { setInstalledContentStoreForTests } from "../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../src/app/memoryInstalledContentStore";
import { MemoryCharacterLibraryStore } from "../src/app/memoryCharacterLibraryStore";
import { CharacterLibraryRepository } from "../src/app/characterLibraryPersistence";
import { setCharacterLibraryStoreForTests } from "../src/app/characterLibraryRuntimeAdapter";
import { allOriginFeatOptions, backgroundOptions, classIdFromName, classMeta, speciesOptions, spellOptions } from "../src/app/characterCreationV10Data";
import { parseRuleModulePackage } from "../src/app/ruleModulePackageImport";
import { normalizedSpellDefinitionById } from "../src/domain/spellExecutionCatalog";
import type { Phase07AdapterCommands } from "../src/app/progressionRuntimeAdapter";
import type { CharacterSheet } from "../src/app/contracts";

/**
 * Offline verification of a compiled supplement (X1-08). Runs the production adapters in-process against a
 * module file that may live outside this repository (a private supplement) and writes a report that names
 * only ids, counts, and outcomes — never the supplement's text.
 *
 *   npx tsx scripts/verify-supplement.ts --module <file.module.json> --report <report.json> [--class 파이터]
 */
function arg(name:string,fallback?:string) {
  const index=process.argv.indexOf(`--${name}`);
  if(index>=0&&process.argv[index+1]&&!process.argv[index+1].startsWith("--"))return process.argv[index+1];
  if(fallback!==undefined)return fallback;
  throw new Error(`missing --${name}`);
}

type Outcome={status:"pass"|"fail";detail?:string};
const report:{module:{path:string;sha256:string;bytes:number;moduleId:string;entries:number};counts:Record<string,number>;checks:Record<string,Outcome>;spells:Record<string,Outcome>;subclasses:Record<string,Outcome>;species:Record<string,Outcome>;backgrounds:Record<string,Outcome>}={
  module:{path:"",sha256:"",bytes:0,moduleId:"",entries:0},counts:{},checks:{},spells:{},subclasses:{},species:{},backgrounds:{},
};
const ok=(detail?:string):Outcome=>({status:"pass",...(detail?{detail}:{})});
const fail=(detail:string):Outcome=>({status:"fail",detail});

async function fillCurrentDraft(adapter:MockAdapter) {
  for (let pass=0;pass<60;pass+=1) {
    const snapshot=await adapter.getSnapshot();
    const draft=snapshot.createDraft,plan=snapshot.creationPlan;
    if(!draft||!plan)throw new Error("no draft");
    let changed=false;
    const skills=plan.sections.find((section)=>section.id==="proficiencies");
    if (skills?.status==="incomplete") {
      const count=classMeta(classIdFromName(draft.className)).semantics.skills.count;
      for (const option of skills.options.filter((item)=>!item.selected).slice(0,Math.max(0,count-draft.selectedSkills.length))) { await adapter.updateCharacterDraft({type:"toggle-skill",value:option.name});changed=true; }
    }
    const equipment=plan.sections.find((section)=>section.id==="class-equipment");
    if (equipment?.status==="incomplete"&&equipment.options[0]) { await adapter.updateCharacterDraft({type:"set-equipment",value:equipment.options[0].id});changed=true; }
    const current=await adapter.getSnapshot();
    for (const section of (current.creationPlan?.sections??[]).filter((entry)=>entry.kind==="dynamic-choice"&&entry.status==="incomplete"&&entry.selection)) {
      const selection=section.selection!;
      const wanted=selection.count-section.options.filter((option)=>option.selected).length;
      for (const option of section.options.filter((entry)=>!entry.selected).slice(0,Math.max(0,wanted))) {
        const latest=await adapter.getSnapshot();
        const target=latest.creationPlan?.sections.find((item)=>item.selection?.choiceId===selection.choiceId);
        if (!target||target.status==="complete"||target.status==="blocked") break;
        await adapter.updateCharacterDraft({type:"toggle-class-choice",choiceId:selection.choiceId,value:option.id});changed=true;
      }
    }
    const after=await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount??1)===0) return after;
    if (!changed) throw new Error(`unable to complete draft: ${after.creationPlan?.validation.map((item)=>item.message).join(" | ")}`);
  }
  throw new Error("creation completion exceeded 60 passes");
}

async function installedAdapter(payload:string) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.getSnapshot();
  const preview=await adapter.previewContentImport(payload);
  const blocking=preview.contentImport?.validation.filter((entry)=>entry.severity==="blocking")??[];
  if(blocking.length)throw new Error(`import blocked: ${blocking.map((entry)=>entry.message).join(" | ")}`);
  await adapter.activateContentImport();
  return adapter;
}

async function main() {
  const modulePath=resolve(arg("module"));
  const reportPath=resolve(arg("report",`${modulePath}.verify.json`));
  const className=arg("class","파이터");
  const payload=readFileSync(modulePath,"utf8");
  const parsed=parseRuleModulePackage(payload);
  const moduleId=(JSON.parse(payload) as {moduleId?:string}).moduleId??"unknown";
  report.module={path:modulePath,sha256:createHash("sha256").update(payload).digest("hex"),bytes:Buffer.byteLength(payload),moduleId,entries:parsed.entries.length};
  for(const entry of parsed.entries)report.counts[entry.category]=(report.counts[entry.category]??0)+1;

  // 1. Import through the production path.
  const adapter=await installedAdapter(payload);
  report.checks.import=ok(`${parsed.entries.length} entries activated`);
  const catalog=(await adapter.getSnapshot()).catalog.filter((entry)=>entry.sourceId===moduleId);
  report.checks.catalog=catalog.length===parsed.entries.length?ok(`${catalog.length} catalog entries`):fail(`catalog holds ${catalog.length} of ${parsed.entries.length}`);

  // 2. Creation: every installed species and background creates a Character of the requested class.
  const speciesEntries=parsed.entries.filter((entry)=>entry.category==="species");
  const backgroundEntries=parsed.entries.filter((entry)=>entry.category==="background");
  const speciesOffered=new Set(speciesOptions().map((option)=>option.id));
  const backgroundsOffered=new Set(backgroundOptions().map((option)=>option.id));
  const originFeatsOffered=new Set(allOriginFeatOptions().map((option)=>option.id));
  report.checks.originFeats=ok(`${parsed.entries.filter((entry)=>entry.category==="feat"&&originFeatsOffered.has(entry.contentId)).length} installed origin feats offered`);
  for(const species of speciesEntries){
    if(!speciesOffered.has(species.contentId)){report.species[species.contentId]=fail("not offered at creation");continue;}
    try{
      const fresh=await installedAdapter(payload);
      await fresh.createCharacterDraft("guided");
      await fresh.updateCharacterDraft({type:"set-name",value:`검증 ${species.nameKo}`});
      await fresh.updateCharacterDraft({type:"set-species",value:species.nameKo});
      await fresh.updateCharacterDraft({type:"set-background",value:"범죄자"});
      await fresh.updateCharacterDraft({type:"set-class",value:className});
      await fresh.updateCharacterDraft({type:"apply-recommended-array"});
      await fillCurrentDraft(fresh);
      await fresh.finalizeCharacterDraft();
      const sheet=(await fresh.getSnapshot()).activeCharacter;
      report.species[species.contentId]=sheet.species===species.nameKo?ok(`features=${sheet.features.length} speed=${sheet.speed}`):fail(`sheet species ${sheet.species}`);
    }catch(error){report.species[species.contentId]=fail(error instanceof Error?error.message:String(error));}
  }
  for(const background of backgroundEntries){
    if(!backgroundsOffered.has(background.contentId)){report.backgrounds[background.contentId]=fail("not offered at creation");continue;}
    try{
      const fresh=await installedAdapter(payload);
      await fresh.createCharacterDraft("guided");
      await fresh.updateCharacterDraft({type:"set-name",value:`검증 ${background.nameKo}`});
      await fresh.updateCharacterDraft({type:"set-species",value:"드워프"});
      await fresh.updateCharacterDraft({type:"set-background",value:background.nameKo});
      await fresh.updateCharacterDraft({type:"set-class",value:className});
      await fresh.updateCharacterDraft({type:"apply-recommended-array"});
      await fillCurrentDraft(fresh);
      await fresh.finalizeCharacterDraft();
      const sheet=(await fresh.getSnapshot()).activeCharacter;
      const feat=(background.mechanics?.find((mechanic)=>mechanic.kind==="background-definition") as {config:{originFeat:string}}|undefined)?.config.originFeat;
      report.backgrounds[background.contentId]=sheet.background===background.nameKo&&(!feat||sheet.featIds?.includes(feat))?ok(`originFeat=${feat} skills=${sheet.skills.length}`):fail(`background ${sheet.background} featIds=${JSON.stringify(sheet.featIds)}`);
    }catch(error){report.backgrounds[background.contentId]=fail(error instanceof Error?error.message:String(error));}
  }

  // 3. Level-up: every installed subclass (all parent classes) is chosen at its first level and grants its features.
  const subclassEntries=parsed.entries.filter((entry)=>entry.category==="subclass");
  for(const subclass of subclassEntries){
    const classId=subclass.semanticRelationships?.find((relationship)=>relationship.kind==="parent")?.target??classIdFromName(className);
    const classLabel=classId.replace(/^dnd.srd521.class./,"");
    try{
      const fresh=await installedAdapter(payload);
      const baseline=(await fresh.getSnapshot()).activeCharacter;
      const internal=fresh as unknown as {activeCharacter:CharacterSheet};
      const firstLevel=Math.min(...(subclass.progressionContributions??[]).map((contribution)=>contribution.threshold),3);
      internal.activeCharacter={...baseline,className:classLabel,level:firstLevel-1,subclassName:"",classLevels:[{classId,className:classLabel,level:firstLevel-1}],subclassIds:{},subclassSources:{},subclassFeatureIds:[],subclassFeatureSources:{},installedProgressionGrantIds:[],featIds:[],featSources:{},proficiencyBonus:2,hitDiceByDie:{d10:firstLevel-1}} as CharacterSheet;
      const commands=fresh as unknown as Phase07AdapterCommands;
      let snapshot=await fresh.getSnapshot();
      await fresh.startLevelUp(snapshot.activeCharacter.id);
      snapshot=await fresh.getSnapshot();
      const choiceId=`progression.${classId}.${firstLevel}.subclass`;
      const choice=snapshot.progressionPlan?.choices.find((entry)=>entry.id===choiceId);
      const option=choice?.options.find((entry)=>entry.id===`installed-subclass:${subclass.contentId}`);
      if(!option){report.subclasses[subclass.contentId]=fail(`not offered at ${choiceId}: ${choice?.options.map((entry)=>entry.id).join("|")??"no choice"}`);continue;}
      await commands.setProgressionChoice(choiceId,{kind:"options",optionIds:[option.id]});
      snapshot=await fresh.getSnapshot();
      // Satisfy every other required choice with its first legal options (spell picks need `count` selections).
      for(let round=0;round<3;round+=1){
        snapshot=await fresh.getSnapshot();
        for(const other of snapshot.progressionPlan?.choices??[]){
          if(other.id===choiceId||!other.required||!other.options.length)continue;
          const legal=other.options.filter((entry)=>!entry.disabledReason).slice(0,Math.max(1,other.count));
          if(legal.length)await commands.setProgressionChoice(other.id,{kind:"options",optionIds:legal.map((entry)=>entry.id)});
        }
        snapshot=await fresh.getSnapshot();
        if(!snapshot.progressionPlan?.blocking.length)break;
      }
      snapshot=await fresh.getSnapshot();
      if(snapshot.progressionPlan?.blocking.length){report.subclasses[subclass.contentId]=fail(`blocking: ${snapshot.progressionPlan.blocking.join("|")}`);continue;}
      snapshot=await fresh.commitLevelUp();
      const expected=(subclass.progressionContributions??[]).filter((contribution)=>contribution.threshold===firstLevel).flatMap((contribution)=>contribution.grants);
      const granted=expected.filter((id)=>snapshot.activeCharacter.installedProgressionGrantIds?.includes(id));
      report.subclasses[subclass.contentId]=snapshot.activeCharacter.subclassIds?.[classId]===subclass.contentId&&granted.length===expected.length?ok(`level ${firstLevel}: ${granted.length} feature(s) granted`):fail(`subclassIds=${JSON.stringify(snapshot.activeCharacter.subclassIds)} granted ${granted.length}/${expected.length}`);
    }catch(error){report.subclasses[subclass.contentId]=fail(error instanceof Error?error.message:String(error));}
  }

  // 4. Spells: every installed spell with a mechanic is castable by a persisted caster through production authority.
  const spellEntries=parsed.entries.filter((entry)=>entry.category==="spell");
  const wizardList=new Set(spellOptions("dnd.srd521.class.wizard",0).map((option)=>option.id));
  report.checks.spellPresentation=ok(`${spellEntries.length} spells; ${spellEntries.filter((entry)=>wizardList.has(entry.contentId)).length} on the wizard cantrip list`);
  for(const spell of spellEntries){
    const mechanic=spell.mechanics?.find((entry)=>entry.kind==="spell-mechanic");
    if(!mechanic){report.spells[spell.contentId]=ok("declarative (no spell-mechanic)");continue;}
    try{
      const definition=normalizedSpellDefinitionById(spell.contentId);
      if(!definition){report.spells[spell.contentId]=fail("not registered in the execution catalog");continue;}
      const level=(spell.mechanics?.find((entry)=>entry.kind==="spell-definition") as {config:{level:number}}|undefined)?.config.level??0;
      const store=new MemoryCharacterLibraryStore();
      const repository=new CharacterLibraryRepository(store);
      const casterId=`char.verify.${spell.contentId.replace(/[^a-z0-9]+/gi,"-")}`;
      const sheet:CharacterSheet={
        id:casterId,name:"검증 시전자",className:"소서러",level:17,species:"인간",background:"학자",hp:90,maxHp:90,tempHp:0,ac:12,speed:30,proficiencyBonus:6,saveState:"saved",
        abilities:{str:8,dex:14,con:14,int:12,wis:10,cha:18},saves:["CON +6","CHA +8"],skills:["비전"],features:["주문 시전"],equipment:[],items:[],resources:[],attacks:[],
        classLevels:[{classId:"dnd.srd521.class.sorcerer",className:"소서러",level:17}],
        cantrips:level===0?[spell.contentId]:[],preparedSpells:level>0?[spell.contentId]:[],spellSlotMaximums:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1,9:1},
      };
      await repository.hydrate([sheet],casterId);await repository.commit([sheet],casterId);
      const player=new MockAdapter();
      setCharacterLibraryStoreForTests(player,store);
      setInstalledContentStoreForTests(player,new MemoryInstalledContentStore());
      await player.getSnapshot();
      const preview=await player.previewContentImport(payload);
      if(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"))throw new Error("import blocked");
      await player.activateContentImport();
      await player.startProductionLocalPlay("player");
      await player.startInitiative();
      let snapshot=await player.setCurrentActor(casterId);
      const action=(snapshot.scene.actionsByActor[casterId]??[]).find((entry)=>entry.spellCast?.spellId===spell.contentId);
      if(!action){report.spells[spell.contentId]=fail("no production spell action");continue;}
      if(!action.available){report.spells[spell.contentId]=fail(`action unavailable: ${action.disabledReason}`);continue;}
      const range=definition.targeting.rangeFeet??5;
      const targets=snapshot.scene.entities.filter((entry)=>entry.side==="enemy"&&Number.parseInt(entry.distance??"0")<=Math.max(range,5));
      const wanted=Math.max(definition.targeting.minTargets,1);
      const chosen=definition.targeting.allowedRelations?.length===1&&definition.targeting.allowedRelations[0]==="self"?[casterId]:targets.slice(0,Math.max(wanted,1)).map((entry)=>entry.id);
      if(definition.targeting.maxTargets===0)chosen.length=0;
      const hpBefore=Object.fromEntries(snapshot.scene.entities.map((entry)=>[entry.id,entry.hp]));
      await player.setQueuedD20(18);
      const cast=await player.resolveAction(action.id,chosen);
      const hpAfter=Object.fromEntries(cast.scene.entities.map((entry)=>[entry.id,entry.hp]));
      const changed=Object.keys(hpBefore).filter((id)=>hpBefore[id]!==hpAfter[id]);
      report.spells[spell.contentId]=cast.resolution?.stage==="complete"||cast.resolution?.stage==="interrupt"?ok(`stage=${cast.resolution.stage} primary=${definition.primary.kind} hpChanged=${changed.length} effects=${cast.resolution.stateChanges.length}`):fail(`stage ${cast.resolution?.stage}: ${cast.resolution?.finalOutcome}`);
    }catch(error){report.spells[spell.contentId]=fail(error instanceof Error?error.message:String(error));}
  }

  writeFileSync(reportPath,`${JSON.stringify(report,null,2)}\n`,"utf8");
  const summarize=(group:Record<string,Outcome>)=>`${Object.values(group).filter((entry)=>entry.status==="pass").length}/${Object.keys(group).length} pass`;
  console.log(`module ${report.module.moduleId}: ${report.module.entries} entries, sha256 ${report.module.sha256}`);
  console.log(`counts ${JSON.stringify(report.counts)}`);
  console.log(`species ${summarize(report.species)} | backgrounds ${summarize(report.backgrounds)} | subclasses(all classes) ${summarize(report.subclasses)} | spells ${summarize(report.spells)}`);
  for(const [group,entries] of Object.entries({species:report.species,backgrounds:report.backgrounds,subclasses:report.subclasses,spells:report.spells})){
    for(const [id,outcome] of Object.entries(entries))if(outcome.status==="fail")console.log(`FAIL ${group} ${id}: ${outcome.detail}`);
  }
  console.log(`report → ${reportPath}`);
  const failures=[report.species,report.backgrounds,report.subclasses,report.spells,report.checks].flatMap((group)=>Object.values(group)).filter((entry)=>entry.status==="fail").length;
  process.exitCode=failures?1:0;
}
main().catch((error)=>{console.error(error);process.exitCode=1;});

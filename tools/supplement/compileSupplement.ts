import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Supplement compiler (V1.1 X1-07): turns a translation checkout laid out like the owner's `D-D-2024-` repository
 * (Markdown with YAML-style front matter, one file per entry, `## <level>레벨: <name>` subclass sections, background
 * trait tables, spell stat bullets) plus optional semantic maps into an external RuleModule package that the Contents
 * screen can import. It never embeds text of its own: presentation text comes from the checkout, executable
 * mechanics from the semantic maps, structure from the Markdown. SimpleVTT ships only this tool and a synthetic fixture.
 */
export interface SupplementCompileOptions {
  /** Root that contains `subclasses/`, `backgrounds/`, `species/`, `feats/`, `spells/` (or `spells/items/`). */
  sourceRoot:string;
  /** Directory of optional semantic maps: `feats.json`, `spells.json`, `species.json`, `backgrounds.json`, `subclasses.json`. */
  semanticsRoot?:string;
  moduleId:string;
  moduleVersion?:string;
  /** Stable id prefix, e.g. `phb2024` → `phb2024.feat.lucky`. */
  idPrefix:string;
  document:string;
  license?:string;
  locale?:string;
  rulesProfile?:{ id:string; version:string };
  /** Maps an SRD feat's translated name (as it appears in a background table) to its stable id. */
  srdFeatNames?:Record<string,string>;
  /** Class file-name prefix → class id (defaults to the twelve SRD classes). */
  classIds?:Record<string,string>;
  /** Skill label → skill id (defaults to the SRD creation index labels). */
  skillIds?:Record<string,string>;
}

export interface SupplementEntry {
  id:string;
  category:"subclass"|"background"|"species"|"feat"|"spell"|"option";
  presentation:{ defaultLocale:string; originalName:string; locales:Record<string,{ name:string; description?:string }> };
  relationships?:Array<{ kind:"parent"|"extends"|"replaces"; target:string }>;
  progressionContributions?:Array<{ track:string; threshold:number; grants:string[] }>;
  mechanics?:Array<{ kind:string; config:Record<string,unknown> }>;
}

export interface SupplementCompileResult {
  module:Record<string,unknown>;
  counts:Record<string,number>;
  warnings:string[];
}

type FrontMatter=Record<string,string>;
type Semantics=Record<string,Record<string,unknown>>;

const SRD_CLASS_IDS:Record<string,string>=Object.fromEntries(["barbarian","bard","cleric","druid","fighter","monk","paladin","ranger","rogue","sorcerer","warlock","wizard"].map((name)=>[name,`dnd.srd521.class.${name}`]));
const ABILITY_BY_KO:Record<string,string>={"근력":"str","민첩":"dex","건강":"con","지능":"int","지혜":"wis","매력":"cha"};
const SCHOOL_BY_KO:Record<string,string>={"방호술":"abjuration","조형술":"conjuration","예지술":"divination","환혹술":"enchantment","방출술":"evocation","환영술":"illusion","사령술":"necromancy","변환술":"transmutation"};
const SIZE_BY_KO:Record<string,string>={"초소형":"tiny","소형":"small","중형":"medium","대형":"large"};
const DEFAULT_SKILL_IDS:Record<string,string>={"곡예":"acrobatics","동물 조련":"animal-handling","비전":"arcana","운동":"athletics","기만":"deception","역사":"history","통찰":"insight","위협":"intimidation","조사":"investigation","의학":"medicine","자연":"nature","지각":"perception","공연":"performance","설득":"persuasion","종교":"religion","손재주":"sleight-of-hand","은신":"stealth","생존":"survival"};
/** Translated tool names → SRD tool ids used by background-definition.tool. */
const TOOL_BY_KO:Record<string,string>={"항해 도구":"navigators-tools","도둑 도구":"thieves-tools","변장 도구":"disguise-kit","위조 도구":"forgery-kit","독 제조 도구":"poisoners-kit","서예 도구":"calligrapher-supplies","치유사 도구":"herbalism-kit","약초 도구":"herbalism-kit","목수 도구":"carpenters-tools","대장장이 도구":"smiths-tools","요리 도구":"cooks-utensils","양조 도구":"brewers-supplies","가죽 세공 도구":"leatherworkers-tools","석공 도구":"masons-tools","화가 도구":"painters-supplies","도예 도구":"potters-tools","제화 도구":"cobblers-tools","직조 도구":"weavers-tools","목각 도구":"woodcarvers-tools","보석 세공 도구":"jewelers-tools","유리 세공 도구":"glassblowers-tools","연금술 도구":"alchemists-supplies","지도 제작 도구":"cartographers-tools","지도 제작자 도구":"cartographers-tools","땜장이 도구":"tinkers-tools","항해사 도구":"navigators-tools","약초학 도구":"herbalism-kit","서예가 도구":"calligrapher-supplies","도둑의 도구":"thieves-tools","변장 도구 세트":"disguise-kit","위조 도구 세트":"forgery-kit"};
const DEFAULT_SRD_FEAT_NAMES:Record<string,string>={"경계":"dnd.srd521.feat.alert","숙련됨":"dnd.srd521.feat.skilled","야만적 공격자":"dnd.srd521.feat.savage-attacker","마법 입문자":"dnd.srd521.feat.magic-initiate","마법 입문자—클레릭":"dnd.srd521.feat.magic-initiate-cleric","마법 입문자—위저드":"dnd.srd521.feat.magic-initiate-wizard","마법 입문자—드루이드":"dnd.srd521.feat.magic-initiate"};

export function slugify(value:string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

function readFrontMatter(text:string):{ front:FrontMatter; body:string } {
  const normalized=text.replace(/\r\n/g,"\n");
  if(!normalized.startsWith("---\n"))return {front:{},body:normalized};
  const end=normalized.indexOf("\n---\n",4);
  if(end<0)return {front:{},body:normalized};
  const front:FrontMatter={};
  for(const line of normalized.slice(4,end).split("\n")){
    const match=/^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if(match)front[match[1]]=match[2].trim().replace(/^"(.*)"$/,"$1");
  }
  return {front,body:normalized.slice(end+5)};
}

/** Markdown → plain text: strips links (keeping their label), emphasis, inline code, and table pipes. */
export function plainText(markdown:string) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1")
    .replace(/`([^`]*)`/g,"$1")
    .replace(/\*\*([^*]+)\*\*/g,"$1")
    .replace(/\*([^*]+)\*/g,"$1")
    .replace(/^\s*[-*]\s+/gm,"• ")
    .replace(/^\|[-| ]+\|$/gm,"")
    .replace(/^\|\s*/gm,"").replace(/\s*\|\s*$/gm,"").replace(/\s*\|\s*/g," · ")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

interface Section { level:number; title:string; body:string }
function sections(body:string):{ title:string; intro:string; sections:Section[] } {
  const lines=body.split("\n");
  let title="";const out:Section[]=[];let intro:string[]=[];let current:Section|undefined;
  for(const line of lines){
    const heading=/^(#{1,3})\s+(.*)$/.exec(line);
    if(heading){
      if(heading[1].length===1&&!title){title=heading[2].trim();continue;}
      current={level:heading[1].length,title:heading[2].trim(),body:""};
      out.push(current);
      continue;
    }
    if(current)current.body+=`${line}\n`;
    else intro.push(line);
  }
  return {title,intro:intro.join("\n").trim(),sections:out.map((section)=>({...section,body:section.body.trim()}))};
}

/** Body without the review-log section, as the entry description. */
function descriptionOf(parsed:ReturnType<typeof sections>) {
  const kept=parsed.sections.filter((section)=>!/검수 기록|검수|review/i.test(section.title));
  return plainText([parsed.intro,...kept.map((section)=>`${section.title}\n${section.body}`)].filter(Boolean).join("\n\n"));
}

function markdownFiles(directory:string) {
  if(!existsSync(directory))return [];
  return readdirSync(directory).filter((name)=>name.endsWith(".md")&&name.toLowerCase()!=="readme.md").sort((a,b)=>a.localeCompare(b,"en")).map((name)=>join(directory,name));
}

function loadSemantics(root:string|undefined,name:string):Semantics {
  if(!root)return {};
  const file=join(root,`${name}.json`);
  if(!existsSync(file))return {};
  const parsed=JSON.parse(readFileSync(file,"utf8")) as Semantics;
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error(`${file} must be an object keyed by entry slug`);
  return parsed;
}

function abilityKeys(text:string) {
  return Object.entries(ABILITY_BY_KO).filter(([ko])=>text.includes(ko)).map(([,key])=>key);
}

function presentationOf(front:FrontMatter,title:string,description:string,locale:string,originalFallback:string) {
  const name=front.name||title||originalFallback;
  const originalName=front.original_name||originalFallback;
  return {defaultLocale:locale,originalName,locales:{[locale]:{name,description},en:{name:originalName}}};
}

/** Shallow merge, except that nested objects present on both sides (e.g. species `semantics`) merge one level deeper. */
function mergeConfig(base:Record<string,unknown>,override:unknown) {
  if(!override||typeof override!=="object"||Array.isArray(override))return base;
  const out:Record<string,unknown>={...base};
  for(const [key,value] of Object.entries(override as Record<string,unknown>)){
    const current=out[key];
    if(value&&typeof value==="object"&&!Array.isArray(value)&&current&&typeof current==="object"&&!Array.isArray(current))out[key]={...(current as Record<string,unknown>),...(value as Record<string,unknown>)};
    else out[key]=value;
  }
  return out;
}

export function compileSupplement(options:SupplementCompileOptions):SupplementCompileResult {
  const locale=options.locale??"ko-KR";
  const prefix=options.idPrefix;
  const classIds={...SRD_CLASS_IDS,...(options.classIds??{})};
  const skillIds={...DEFAULT_SKILL_IDS,...(options.skillIds??{})};
  const srdFeatNames={...DEFAULT_SRD_FEAT_NAMES,...(options.srdFeatNames??{})};
  const warnings:string[]=[];
  const entries:SupplementEntry[]=[];
  const counts:Record<string,number>={subclass:0,subclassFeature:0,background:0,species:0,feat:0,spell:0};
  const featIdByFile=new Map<string,string>();
  const semantics={
    feats:loadSemantics(options.semanticsRoot,"feats"),
    spells:loadSemantics(options.semanticsRoot,"spells"),
    species:loadSemantics(options.semanticsRoot,"species"),
    backgrounds:loadSemantics(options.semanticsRoot,"backgrounds"),
    subclasses:loadSemantics(options.semanticsRoot,"subclasses"),
  };
  const capabilities=new Set<string>();

  // ---- feats (first, so backgrounds can link their origin feat) ----
  for(const file of markdownFiles(join(options.sourceRoot,"feats"))){
    const {front,body}=readFrontMatter(readFileSync(file,"utf8"));
    const parsed=sections(body);
    const original=front.original_name||parsed.title||basename(file,".md");
    const slug=slugify(original);
    const id=`${prefix}.feat.${slug}`;
    featIdByFile.set(basename(file),id);
    const italic=/^\*(.+?)\*\s*$/m.exec(body)?.[1]??"";
    const config:Record<string,unknown>={};
    if(/기원 재주/.test(italic)||front.feat_category==="origin")config.tier="origin";
    else if(/전투 방식/.test(italic)||front.feat_category==="fighting-style"){config.tier="fighting-style";config.requires="fighting-style-feature";}
    else if(/서사시|은혜/.test(italic)||front.feat_category==="epic-boon"){config.tier="epic-boon";config.minimumLevel=19;}
    else config.tier="general";
    const level=/(\d+)레벨 이상/.exec(italic);
    if(level)config.minimumLevel=Number(level[1]);
    const prerequisite=/([가-힣]+(?:\s*(?:또는|이나)\s*[가-힣]+)*)\s*(\d+)\s*이상/.exec(italic.replace(/\d+레벨 이상,?\s*/,""));
    if(prerequisite){
      const keys=abilityKeys(prerequisite[1]);
      if(keys.length)config.abilityPrerequisite={any:keys,minimum:Number(prerequisite[2])};
    }
    const increase=/\*\*능력치 증가:\*\*\s*([^\n]*)/.exec(body)?.[1];
    if(increase){
      const keys=abilityKeys(increase);
      const amount=/(\d+)\s*올린다/.exec(increase)?.[1];
      const maximum=/최대치는\s*(\d+)/.exec(increase)?.[1];
      config.abilityIncrease={...(keys.length?{any:keys}:{}),amount:Number(amount??1),maximum:Number(maximum??(config.tier==="epic-boon"?30:20))};
    }
    const override=semantics.feats[slug]??{};
    const featConfig=mergeConfig({...config,execution:{status:"descriptive",reason:"supplement feat: presentation and selection only unless the semantic map supplies mechanics"}},override.definition);
    const mechanics:SupplementEntry["mechanics"]=[{kind:"feat-definition",config:featConfig}];
    if(override.commonPlay&&typeof override.commonPlay==="object"){
      mechanics.push({kind:"common-play",config:override.commonPlay as Record<string,unknown>});
      (featConfig as {execution?:unknown}).execution={status:"common-play"};
    }
    entries.push({id,category:"feat",presentation:presentationOf(front,parsed.title,descriptionOf(parsed),locale,original),mechanics});
    counts.feat+=1;
  }

  // ---- backgrounds ----
  for(const file of markdownFiles(join(options.sourceRoot,"backgrounds"))){
    const {front,body}=readFrontMatter(readFileSync(file,"utf8"));
    const parsed=sections(body);
    const original=front.original_name||parsed.title||basename(file,".md");
    const slug=slugify(original);
    const id=`${prefix}.background.${slug}`;
    const row=(label:string)=>new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.+?)\\s*\\|\\s*$`,"m").exec(body)?.[1]??"";
    const abilityChoices=abilityKeys(row("능력치"));
    const skills=row("기술 숙련").split(/[,·]/).map((item)=>item.trim()).filter(Boolean).map((label)=>skillIds[label]??label);
    const featCell=row("기원 재주");
    const featLink=/\(([^)]*feats\/([^)]+\.md))\)/.exec(featCell);
    let originFeat:string|undefined;
    if(featLink)originFeat=featIdByFile.get(basename(featLink[2]));
    if(!originFeat){
      // "숙련됨 (Skilled)" / "숙련됨(SRD)" → the translated name before any parenthetical.
      const plain=plainText(featCell).replace(/\s*\([^)]*\)\s*/g,"").trim();
      originFeat=srdFeatNames[plain];
    }
    if(!originFeat){warnings.push(`${basename(file)}: origin feat could not be resolved from "${featCell}"`);originFeat="dnd.srd521.feat.skilled";}
    const toolCell=row("도구 숙련");
    const toolPlain=plainText(toolCell).trim();
    const toolKo=Object.keys(TOOL_BY_KO).find((ko)=>toolPlain.includes(ko));
    let tool:Record<string,unknown>={};
    if(/장인의 도구/.test(toolCell))tool={toolChoice:"artisan-tool"};
    else if(/게임 도구/.test(toolCell))tool={toolChoice:"gaming-set"};
    else if(/악기/.test(toolCell))tool={toolChoice:"instrument"};
    else if(toolKo)tool={tool:TOOL_BY_KO[toolKo]};
    else if(/^[a-z0-9-]+$/i.test(toolPlain)&&toolPlain)tool={tool:slugify(toolPlain)};
    else if(toolPlain){warnings.push(`${basename(file)}: tool "${toolPlain}" has no SRD id; recorded as an artisan-tool choice`);tool={toolChoice:"artisan-tool"};}
    const config=mergeConfig({
      abilityChoices:abilityChoices.length?abilityChoices:["str","dex","con"],
      abilityIncreaseModes:["2+1","1+1+1"],
      skills:skills.length?skills:["athletics"],
      ...tool,
      originFeat,
      equipmentChoice:/장비 B/.test(body),
    },semantics.backgrounds[slug]?.definition);
    if(!abilityChoices.length)warnings.push(`${basename(file)}: ability choices not found in the trait table`);
    entries.push({id,category:"background",presentation:presentationOf(front,parsed.title,descriptionOf(parsed),locale,original),mechanics:[{kind:"background-definition",config}]});
    counts.background+=1;
  }

  // ---- species ----
  for(const file of markdownFiles(join(options.sourceRoot,"species"))){
    const {front,body}=readFrontMatter(readFileSync(file,"utf8"));
    const parsed=sections(body);
    const original=front.original_name||parsed.title||basename(file,".md");
    const slug=slugify(original);
    const id=`${prefix}.species.${slug}`;
    const sizeText=/\*\*크기:\*\*\s*([^\n]*)/.exec(body)?.[1]??"";
    const size=Object.entries(SIZE_BY_KO).filter(([ko])=>sizeText.includes(ko)).map(([,key])=>key);
    const speed=Number(/\*\*이동 속도:\*\*\s*(\d+)/.exec(body)?.[1]??30);
    const darkvisionSection=parsed.sections.find((section)=>/암시야/.test(section.title));
    const darkvision=darkvisionSection?Number(/(\d+)피트/.exec(darkvisionSection.body)?.[1]??60):undefined;
    const traitSections=parsed.sections.filter((section)=>section.level===2&&!/기본 특성|검수 기록/.test(section.title));
    const config=mergeConfig({
      size:size.length?size:["medium"],
      speed,
      ...(darkvision?{darkvision}:{}),
      traits:traitSections.map((section)=>slugify(section.title)||`trait-${traitSections.indexOf(section)}`),
      semantics:{baseFeatures:traitSections.map((section)=>`${section.title} (${front.name||parsed.title})`)},
    },semantics.species[slug]?.definition);
    entries.push({id,category:"species",presentation:presentationOf(front,parsed.title,descriptionOf(parsed),locale,original),mechanics:[{kind:"species-definition",config}]});
    counts.species+=1;
  }

  // ---- subclasses ----
  for(const file of markdownFiles(join(options.sourceRoot,"subclasses"))){
    const {front,body}=readFrontMatter(readFileSync(file,"utf8"));
    const parsed=sections(body);
    const original=front.original_name||parsed.title||basename(file,".md");
    const slug=slugify(original);
    const classKey=basename(file,".md").split("-")[0];
    const classId=classIds[classKey];
    if(!classId){warnings.push(`${basename(file)}: unknown class prefix ${classKey}; skipped`);continue;}
    const id=`${prefix}.subclass.${slug}`;
    const byLevel=new Map<number,string[]>();
    const featureOverrides=semantics.subclasses[slug]?.features as Record<string,Record<string,unknown>>|undefined;
    let index=0;
    for(const section of parsed.sections){
      const heading=/^(\d+)레벨\s*[:：]\s*(.+)$/.exec(section.title);
      if(!heading||section.level!==2)continue;
      const level=Number(heading[1]);
      index+=1;
      const featureId=`${id}.feature.${level}-${index}`;
      const featureName=heading[2].trim();
      const override=featureOverrides?.[`${level}-${index}`]??featureOverrides?.[slugify(featureName)];
      const mechanics:SupplementEntry["mechanics"]=[];
      if(override?.commonPlay&&typeof override.commonPlay==="object")mechanics.push({kind:"common-play",config:override.commonPlay as Record<string,unknown>});
      entries.push({
        id:featureId,category:"option",
        presentation:{defaultLocale:locale,originalName:`${original} — level ${level} feature ${index}`,locales:{[locale]:{name:featureName,description:plainText(section.body)},en:{name:`${original} — level ${level} feature ${index}`}}},
        ...(mechanics.length?{mechanics}:{}),
      });
      byLevel.set(level,[...(byLevel.get(level)??[]),featureId]);
      counts.subclassFeature+=1;
    }
    entries.push({
      id,category:"subclass",
      presentation:presentationOf(front,parsed.title,plainText(parsed.intro||descriptionOf(parsed)),locale,original),
      relationships:[{kind:"parent",target:classId}],
      progressionContributions:[...byLevel.entries()].sort((a,b)=>a[0]-b[0]).map(([threshold,grants])=>({track:classId,threshold,grants})),
    });
    counts.subclass+=1;
  }

  // ---- spells ----
  const spellRoot=existsSync(join(options.sourceRoot,"spells","items"))?join(options.sourceRoot,"spells","items"):join(options.sourceRoot,"spells");
  for(const file of markdownFiles(spellRoot)){
    const {front,body}=readFrontMatter(readFileSync(file,"utf8"));
    const parsed=sections(body);
    const original=front.original_name||parsed.title||basename(file,".md");
    const slug=slugify(original);
    const id=`${prefix}.spell.${slug}`;
    const header=/^\*(.+?)\*\s*$/m.exec(body)?.[1]??"";
    const ritual=/의식/.test(header);
    const levelMatch=/(\d+)레벨/.exec(header);
    const level=levelMatch?Number(levelMatch[1]):/소마법/.test(header)?0:Number(front.spell_level??0);
    const school=Object.entries(SCHOOL_BY_KO).find(([ko])=>header.includes(ko))?.[1]??"evocation";
    const bullet=(label:string)=>new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]*)`).exec(body)?.[1]?.trim()??"";
    const override=semantics.spells[slug]??{};
    const summary=plainText(parsed.intro.split("\n\n").filter((paragraph)=>!/^\*.*\*$/.test(paragraph.trim())&&!/^- \*\*/.test(paragraph.trim()))[0]??"");
    const definition=mergeConfig({
      level,school,ritual,
      castingTimeText:bullet("시전 시간")||"행동",rangeText:bullet("사거리")||"—",componentsText:bullet("구성요소")||"—",durationText:bullet("지속시간")||"즉시",
      ...(summary?{summary}:{}),
    },override.definition);
    const mechanics:SupplementEntry["mechanics"]=[{kind:"spell-definition",config:definition}];
    if(override.mechanic&&typeof override.mechanic==="object")mechanics.push({kind:"spell-mechanic",config:override.mechanic as Record<string,unknown>});
    if(override.commonPlay&&typeof override.commonPlay==="object")mechanics.push({kind:"common-play",config:override.commonPlay as Record<string,unknown>});
    entries.push({id,category:"spell",presentation:presentationOf(front,parsed.title,descriptionOf(parsed),locale,original),mechanics});
    counts.spell+=1;
  }

  const module={
    "$schema":"https://simplevtt.local/schemas/rule-module-package.schema.json",
    schemaVersion:"0.1-draft",
    moduleId:options.moduleId,
    moduleVersion:options.moduleVersion??"1",
    rulesProfile:options.rulesProfile??{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:locale,
    source:{document:options.document,version:options.moduleVersion??"1",license:options.license??"private-use",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[...capabilities].sort(),extensionPoints:[],
    content:entries,
  };
  return {module,counts,warnings};
}

/** Directory walk helper exported for the CLI's source-lock summary. */
export function listSourceFiles(root:string):string[] {
  const out:string[]=[];
  const walk=(directory:string)=>{ for(const name of readdirSync(directory).sort()){ const path=join(directory,name); if(statSync(path).isDirectory())walk(path); else if(name.endsWith(".md"))out.push(path); } };
  if(existsSync(root))walk(root);
  return out;
}

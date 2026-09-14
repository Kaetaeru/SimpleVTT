import type { CharacterSheet, CombatantDefinitionVm } from "../app/contracts";
import type { CharacterPortraitV1 } from "../app/characterPortraitContracts";
import type { LocalImageAssetV1 } from "../app/localImageAsset";
import type { CombatantRuntimeStatsVm } from "../app/combatantRuntimeContracts";
import { srdMonsterById, srdMonsterCombatantDefinition } from "../app/srdMonsterCatalog";
import type { ActorSpec } from "./commands";
import type { Side } from "./state";
import { weaponRuleById } from "../domain/weaponRuleCatalog";

/**
 * The host library (DM_WORKSPACE.md §3): NPC definitions, PC presets, custom items, notes and scene bundles the DM owns
 * outside any campaign. A campaign is a tag on an entry, never a precondition. Registration is one form in and out of a
 * session (준비실 = the same lists full-width). Stored as one JSON document; a memory store serves tests and previews.
 */
export type LibraryKind="npc"|"preset"|"item"|"bundle"|"note"|"image";
export interface LibraryItemSpec { definitionId:string; name:string; nameEn?:string; kind:"equipment"|"consumable"|"magic"; quantity:number }
export interface BundleActor { entryId?:string; monsterId?:string; count:number; side?:Side; hidden?:boolean }
export interface LibraryBundle { actors:BundleActor[]; noteIds:string[]; sceneName?:string; conditions?:string[] }
export interface LibraryEntry {
  id:string;
  kind:LibraryKind;
  name:string;
  tags:string[];
  favorite?:boolean;
  campaignId?:string;
  updatedAt:string;
  npc?:CombatantDefinitionVm;
  preset?:CharacterSheet;
  item?:LibraryItemSpec;
  bundle?:LibraryBundle;
  note?:string;
  image?:LocalImageAssetV1;
}
export interface LibraryDocument { version:1; entries:LibraryEntry[]; recent:string[] }

export interface LibraryStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export class MemoryLibraryStorage implements LibraryStorage { private map=new Map<string,string>(); getItem(key:string) { return this.map.get(key)??null; } setItem(key:string,value:string) { this.map.set(key,value); } }

export const HOST_LIBRARY_KEY="simplevtt.host-library.v1";
const EMPTY:LibraryDocument={version:1,entries:[],recent:[]};

export class HostLibrary {
  private document:LibraryDocument;
  private readonly listeners=new Set<()=>void>();
  constructor(private readonly storage:LibraryStorage=new MemoryLibraryStorage(),private readonly now:()=>string=()=>new Date().toISOString(),private readonly key=HOST_LIBRARY_KEY) {
    this.document=HostLibrary.read(storage,key);
  }
  private static read(storage:LibraryStorage,key:string):LibraryDocument {
    try { const raw=storage.getItem(key); if(!raw) return structuredClone(EMPTY); const parsed=JSON.parse(raw) as Partial<LibraryDocument>; return {version:1,entries:Array.isArray(parsed.entries)?parsed.entries:[],recent:Array.isArray(parsed.recent)?parsed.recent:[]}; }
    catch { return structuredClone(EMPTY); }
  }
  private write() { try { this.storage.setItem(this.key,JSON.stringify(this.document)); } catch { /* storage full or blocked: the in-memory copy still serves this session */ } for(const listener of [...this.listeners]) listener(); }
  subscribe(listener:()=>void) { this.listeners.add(listener); return ()=>{ this.listeners.delete(listener); }; }
  entries(kind?:LibraryKind):LibraryEntry[] {
    const list=kind?this.document.entries.filter((entry)=>entry.kind===kind):[...this.document.entries];
    const recent=new Map(this.document.recent.map((id,index)=>[id,index]));
    return list.sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||(recent.get(a.id)??99)-(recent.get(b.id)??99)||b.updatedAt.localeCompare(a.updatedAt));
  }
  get(id:string):LibraryEntry|undefined { return this.document.entries.find((entry)=>entry.id===id); }
  upsert(entry:Omit<LibraryEntry,"updatedAt">&{updatedAt?:string}):LibraryEntry {
    const next:LibraryEntry={...entry,updatedAt:this.now()};
    const index=this.document.entries.findIndex((existing)=>existing.id===entry.id);
    if(index>=0) this.document.entries[index]=next; else this.document.entries.push(next);
    this.write();
    return next;
  }
  remove(id:string) { this.document.entries=this.document.entries.filter((entry)=>entry.id!==id); this.document.recent=this.document.recent.filter((entry)=>entry!==id); this.write(); }
  toggleFavorite(id:string) { const entry=this.get(id); if(entry) this.upsert({...entry,favorite:!entry.favorite}); }
  touch(id:string) { this.document.recent=[id,...this.document.recent.filter((entry)=>entry!==id)].slice(0,20); this.write(); }
  nextId(kind:LibraryKind,name:string):string {
    const slug=name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"")||kind;
    const taken=new Set(this.document.entries.map((entry)=>entry.id));
    let id=`lib.${kind}.${slug}`,n=2;
    while(taken.has(id)) id=`lib.${kind}.${slug}-${n++}`;
    return id;
  }
}

/** A new NPC definition from an SRD monster, with the DM's edits (DM_WORKSPACE.md §3: "SRD에서 복제 → 이름·HP·AC 수정"). */
export function npcFromSrd(library:HostLibrary,monsterId:string,overrides:{name?:string;maxHp?:number;ac?:number}={}):LibraryEntry {
  const monster=srdMonsterById(monsterId);
  if(!monster) throw new Error(`몬스터를 찾을 수 없습니다: ${monsterId}`);
  const name=overrides.name?.trim()||monster.name;
  const id=library.nextId("npc",name);
  const definition:CombatantDefinitionVm={...srdMonsterCombatantDefinition(monster),id,name,maxHp:overrides.maxHp??monster.hp,ac:overrides.ac??monster.ac,source:`내 NPC · ${monster.name} 기반`};
  return library.upsert({id,kind:"npc",name,tags:[monster.creatureType],npc:definition});
}

/** A blank NPC: name, AC, HP and a few plain attacks the DM types ("물기 +4 1d6+2 관통"). */
export function blankNpc(library:HostLibrary,input:{name:string;ac:number;maxHp:number;attacks?:Array<{name:string;bonus:number;dice:string;flat:number;type:string;rangeFeet?:number}>}):LibraryEntry {
  const name=input.name.trim();
  if(!name) throw new Error("NPC 이름을 적으세요.");
  if(!Number.isFinite(input.ac)||!Number.isFinite(input.maxHp)||input.maxHp<1) throw new Error("AC와 HP를 숫자로 적으세요.");
  const id=library.nextId("npc",name);
  const runtimeActions=(input.attacks??[]).map((attack,index)=>({id:`${index}-${attack.name.replace(/\s+/g,"-")}`,name:attack.name,category:"weapon" as const,sourceKind:"weapon" as const,attackBonus:attack.bonus,rangeFeet:attack.rangeFeet??5,attackMode:(attack.rangeFeet??5)>5?"ranged" as const:"melee" as const,damage:{type:attack.type,dice:attack.dice,flat:attack.flat},economy:"행동" as const}));
  const definition={id,name,ac:input.ac,maxHp:input.maxHp,source:"내 NPC",version:"1",actions:runtimeActions.map((action)=>action.name),statusImmunities:[],runtimeStats:{abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,savingThrowProficiencies:[],speed:30,resistances:[],immunities:[],vulnerabilities:[]},runtimeActions} as CombatantDefinitionVm;
  return library.upsert({id,kind:"npc",name,tags:[],npc:definition});
}

/** NPC definitions pasted as JSON: one object or an array; each needs name, ac, maxHp; the rest is optional and kept. */
export function npcsFromJson(library:HostLibrary,text:string):LibraryEntry[] {
  let parsed:unknown;
  try { parsed=JSON.parse(text); } catch { throw new Error("JSON을 읽을 수 없습니다."); }
  const list=Array.isArray(parsed)?parsed:[parsed];
  return list.map((raw)=>{
    const value=raw as Partial<CombatantDefinitionVm>&{hp?:number};
    const name=typeof value.name==="string"?value.name.trim():"";
    const ac=Number(value.ac),maxHp=Number(value.maxHp??value.hp);
    if(!name||!Number.isFinite(ac)||!Number.isFinite(maxHp)) throw new Error("각 NPC에 name, ac, maxHp(또는 hp)가 필요합니다.");
    const id=library.nextId("npc",name);
    const definition={...value,id,name,ac,maxHp,source:typeof value.source==="string"?value.source:"내 NPC (JSON)",version:typeof value.version==="string"?value.version:"1",actions:Array.isArray(value.actions)?value.actions:[],statusImmunities:Array.isArray(value.statusImmunities)?value.statusImmunities:[]} as CombatantDefinitionVm;
    delete (definition as {hp?:number}).hp;
    return library.upsert({id,kind:"npc",name,tags:Array.isArray((value as {tags?:string[]}).tags)?(value as {tags:string[]}).tags:[],npc:definition});
  });
}

/** What the NPC editor may change (DM_WORKSPACE.md §3 "이름·HP·AC 수정" and the owner's ask for a portrait and more): identity, numbers, abilities, text, picture. */
export interface NpcEdit { name?:string; ac?:number; maxHp?:number; speed?:number; abilities?:Partial<CombatantRuntimeStatsVm["abilities"]>; description?:string; dmNotes?:string; tags?:string[]; portrait?:CharacterPortraitV1|null }
export function editNpc(library:HostLibrary,entryId:string,edit:NpcEdit):LibraryEntry {
  const entry=library.get(entryId);
  if(!entry||entry.kind!=="npc"||!entry.npc) throw new Error("편집할 NPC가 없습니다.");
  const npc=structuredClone(entry.npc);
  if(edit.name!==undefined) { const name=edit.name.trim(); if(!name) throw new Error("이름을 비울 수 없습니다."); npc.name=name; }
  if(edit.ac!==undefined) { if(!Number.isFinite(edit.ac)||edit.ac<0) throw new Error("AC는 0 이상의 숫자입니다."); npc.ac=Math.floor(edit.ac); }
  if(edit.maxHp!==undefined) { if(!Number.isFinite(edit.maxHp)||edit.maxHp<1) throw new Error("HP는 1 이상의 숫자입니다."); npc.maxHp=Math.floor(edit.maxHp); }
  const stats=npc.runtimeStats??{abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,savingThrowProficiencies:[],speed:30,resistances:[],immunities:[],vulnerabilities:[]};
  if(edit.speed!==undefined&&Number.isFinite(edit.speed)) stats.speed=Math.max(0,Math.floor(edit.speed));
  if(edit.abilities) for(const [key,value] of Object.entries(edit.abilities)) if(typeof value==="number"&&Number.isFinite(value)) stats.abilities[key as keyof typeof stats.abilities]=Math.max(1,Math.min(30,Math.floor(value)));
  npc.runtimeStats=stats;
  if(edit.description!==undefined) { if(edit.description.trim()) npc.description=edit.description.trim(); else delete npc.description; }
  if(edit.dmNotes!==undefined) { if(edit.dmNotes.trim()) npc.dmNotes=edit.dmNotes.trim(); else delete npc.dmNotes; }
  if(edit.portrait===null) delete npc.portrait; else if(edit.portrait) npc.portrait=structuredClone(edit.portrait);
  const tags=edit.tags!==undefined?edit.tags.map((tag)=>tag.trim()).filter(Boolean):entry.tags;
  npc.tags=tags;
  return library.upsert({...entry,name:npc.name,tags,npc});
}

/** A PC preset: a character sheet kept in the library, summoned as an ally the DM controls (NPC party members, backups). */
export function presetFromSheet(library:HostLibrary,sheet:CharacterSheet):LibraryEntry {
  const id=library.nextId("preset",sheet.name);
  return library.upsert({id,kind:"preset",name:sheet.name,tags:[sheet.className],preset:structuredClone(sheet)});
}

export function itemEntry(library:HostLibrary,item:LibraryItemSpec):LibraryEntry {
  const id=library.nextId("item",item.name);
  return library.upsert({id,kind:"item",name:item.name,tags:[item.kind],item:{...item,quantity:Math.max(1,Math.floor(item.quantity||1))}});
}

/** Whether an item definition is a weapon the rules know (a grant of it also adds an attack tile). */
export function isWeaponItem(definitionId:string):boolean { return Boolean(weaponRuleById(definitionId)); }

/** An image the DM may show later (DM_WORKSPACE.md §3 자료): kept in the host library, shown with the `handout` command. */
export function imageEntry(library:HostLibrary,asset:LocalImageAssetV1,name?:string):LibraryEntry {
  const label=(name??asset.fileName??"이미지").replace(/\.[a-z0-9]+$/i,"").trim()||"이미지";
  const id=library.nextId("image",label);
  return library.upsert({id,kind:"image",name:label,tags:[],image:structuredClone(asset)});
}
export function noteEntry(library:HostLibrary,name:string,text:string):LibraryEntry {
  const label=name.trim()||text.trim().slice(0,24)||"노트";
  const id=library.nextId("note",label);
  return library.upsert({id,kind:"note",name:label,tags:[],note:text});
}

export function bundleEntry(library:HostLibrary,name:string,bundle:LibraryBundle):LibraryEntry {
  const id=library.nextId("bundle",name);
  return library.upsert({id,kind:"bundle",name:name.trim()||"장면 묶음",tags:[],bundle});
}

/** Everything a bundle summons at once, as table commands' actor specs (DM_WORKSPACE.md §3 "한 번에 소환"). */
export function bundleSpecs(library:HostLibrary,bundle:LibraryBundle):ActorSpec[] {
  const specs:ActorSpec[]=[];
  for(const actor of bundle.actors) {
    const count=Math.max(1,Math.floor(actor.count||1));
    if(actor.entryId) {
      const entry=library.get(actor.entryId);
      if(entry?.kind==="npc"&&entry.npc) specs.push({kind:"npc",definition:structuredClone(entry.npc),count,...(actor.side?{side:actor.side}:{}),...(actor.hidden?{hidden:true}:{})});
      else if(entry?.kind==="preset"&&entry.preset) { const sheet=structuredClone(entry.preset); sheet.id=`${sheet.id}.preset.${Date.now().toString(36)}`; specs.push({kind:"character",sheet,side:actor.side??"ally"}); }
    } else if(actor.monsterId) specs.push({kind:"monster",monsterId:actor.monsterId,count,...(actor.side?{side:actor.side}:{}),...(actor.hidden?{hidden:true}:{})});
  }
  return specs;
}

/** The current table as a bundle: every non-character actor, grouped by definition. */
export function bundleFromActors(actors:Array<{source:{kind:string;definitionId?:string};side:Side;hidden?:boolean}>,npcEntryIdByDefinition:Record<string,string>={}):LibraryBundle["actors"] {
  const groups=new Map<string,BundleActor>();
  for(const actor of actors) {
    if(actor.source.kind!=="monster"||!actor.source.definitionId) continue;
    const definitionId=actor.source.definitionId;
    const key=`${definitionId}:${actor.side}:${actor.hidden?1:0}`;
    const existing=groups.get(key);
    if(existing) { existing.count+=1; continue; }
    const entryId=npcEntryIdByDefinition[definitionId];
    groups.set(key,{...(entryId?{entryId}:{monsterId:definitionId}),count:1,side:actor.side,...(actor.hidden?{hidden:true}:{})});
  }
  return [...groups.values()];
}

/** The library the app uses: browser storage when present, memory otherwise (tests, SSR). */
let shared:HostLibrary|null=null;
export function hostLibrary():HostLibrary {
  if(shared) return shared;
  let storage:LibraryStorage|undefined;
  try { storage=typeof window!=="undefined"&&window.localStorage?window.localStorage:undefined; } catch { storage=undefined; }
  shared=new HostLibrary(storage??new MemoryLibraryStorage());
  return shared;
}
